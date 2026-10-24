import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, withTenant } from "@/db";
import {
  timetablePeriods,
  assignments,
  lessonPlans,
  assessments,
  students,
  feeInvoices,
  studentAttendance,
  examSchedules,
  examMarksLocks,
} from "@/db/schema";
import { eq, and, inArray, gte, desc } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { getActiveAcademicYear } from "../../actions/auth-helper";
import {
  getClassWithDetails,
  getClassHubOverview,
} from "../../actions/class-setup.actions";
import { getBellSchedule } from "../../actions/timetable.actions";
import { getSubjects, getTeachersList } from "../../actions";
import { getTeachingStaffDiagnostics } from "@/app/(admin)/hr/actions";
import ClassHubClient from "./ClassHubClient";
import { cache } from "react";

// Cached per-request so generateMetadata and the page body share one DB call
const getClassWithDetailsCached = cache(async (classId: string) => {
  return getClassWithDetails(classId);
});

export async function generateMetadata({
  params,
}: {
  params: { classId: string };
}): Promise<Metadata> {
  const cls = await getClassWithDetailsCached(params.classId);
  return {
    title: cls ? `${cls.displayName} — Class Hub` : "Class Hub",
  };
}

export default async function ClassHubPage({
  params,
}: {
  params: { classId: string };
}) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.schoolId) {
    redirect("/login");
  }

  const schoolId = session.user.schoolId;
  const role = session.user.role;
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(role);
  const isTeacher = role === "TEACHER";

  let allTeachers: any[] = [];
  let teachersError: string | null = null;
  try {
    allTeachers = await getTeachersList();
  } catch (err: any) {
    console.error("[ClassHubPage] getTeachersList failed:", err);
    teachersError = err?.message || "Failed to load teaching staff";
  }

  let diagnostics: any = null;
  if (isAdmin) {
    try {
      const diagRes = await getTeachingStaffDiagnostics(schoolId);
      if (diagRes?.success) {
        diagnostics = diagRes.diagnostics;
      }
    } catch (err: any) {
      console.warn("[ClassHubPage] getTeachingStaffDiagnostics warning:", err);
    }
  }

  const [cls, overview, activeYear, bellPeriods, allSubjects] =
    await Promise.all([
      getClassWithDetailsCached(params.classId),
      getClassHubOverview(params.classId).catch(() => null),
      getActiveAcademicYear(schoolId).catch(() => null),
      getBellSchedule().catch(() => []),
      getSubjects().catch(() => []),
    ]);

  if (!cls || !overview) notFound();

  const secIds = cls.sections.map((s: any) => s.id);
  const csIds = cls.classSubjects.map((cs: any) => cs.id);

  const {
    timetable,
    classAssignments,
    classLessons,
    classAssessments,
    rosterStudents,
    classExams,
  } = await withTenant(schoolId, async (tx) => {
    // 1. Fetch Class Timetable, Assignments, Lessons, Assessments
    const [timetable, classAssignments, classLessons, classAssessments] =
      await Promise.all([
        secIds.length > 0
          ? tx.query.timetablePeriods.findMany({
              where: and(
                eq(timetablePeriods.schoolId, schoolId),
                inArray(timetablePeriods.sectionId, secIds),
                eq(timetablePeriods.isActive, true),
              ),
              with: {
                subject: { columns: { id: true, name: true, code: true } },
                teacher: { columns: { id: true, email: true } },
              },
            })
          : [],
        csIds.length > 0
          ? tx.query.assignments.findMany({
              where: and(
                eq(assignments.schoolId, schoolId),
                inArray(assignments.classSubjectId, csIds),
              ),
              with: {
                classSubject: { with: { subject: { columns: { name: true } } } },
                section: { columns: { id: true, name: true } },
              },
              limit: 30,
            })
          : [],
        csIds.length > 0
          ? tx.query.lessonPlans.findMany({
              where: and(
                eq(lessonPlans.schoolId, schoolId),
                inArray(lessonPlans.classSubjectId, csIds),
              ),
              with: {
                classSubject: { with: { subject: { columns: { name: true } } } },
              },
              limit: 30,
            })
          : [],
        csIds.length > 0
          ? tx.query.assessments.findMany({
              where: and(
                eq(assessments.schoolId, schoolId),
                inArray(assessments.classSubjectId, csIds),
              ),
              with: {
                classSubject: { with: { subject: { columns: { name: true } } } },
                section: { columns: { id: true, name: true } },
              },
              limit: 30,
            })
          : [],
      ]);

    // 2. Query Roster Stream: Students belonging to this class
    const rawStudents = await tx.query.students.findMany({
      where: and(
        eq(students.schoolId, schoolId),
        eq(students.currentClassId, params.classId),
        eq(students.isActive, true),
      ),
      columns: {
        id: true,
        admissionNumber: true,
        rollNumber: true,
        firstNameEncrypted: true,
        lastNameEncrypted: true,
        gender: true,
        currentSectionId: true,
        isActive: true,
      },
      orderBy: [students.rollNumber, students.admissionNumber],
    });

    const studentIds = rawStudents.map((s) => s.id);

    // 3. Aggregate Student Fee Status and 30-day Attendance
    let invoices: Array<{ studentId: string; status: string; balanceAmount: string; dueDate: Date }> = [];
    let attendanceRecords: Array<{ studentId: string; status: string }> = [];

    if (studentIds.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [invRes, attRes] = await Promise.all([
        tx.query.feeInvoices.findMany({
          where: and(
            eq(feeInvoices.schoolId, schoolId),
            inArray(feeInvoices.studentId, studentIds),
          ),
          columns: {
            studentId: true,
            status: true,
            balanceAmount: true,
            dueDate: true,
          },
        }),
        tx.query.studentAttendance.findMany({
          where: and(
            eq(studentAttendance.schoolId, schoolId),
            inArray(studentAttendance.studentId, studentIds),
            gte(studentAttendance.attendanceDate, thirtyDaysAgo),
          ),
          columns: {
            studentId: true,
            status: true,
          },
        }),
      ]);

      invoices = invRes as any;
      attendanceRecords = attRes as any;
    }

    const now = new Date();
    const rosterStudents = rawStudents.map((s) => {
      const firstName = decryptData(s.firstNameEncrypted) || "Student";
      const lastName = decryptData(s.lastNameEncrypted) || "";
      const fullName = `${firstName} ${lastName}`.trim();

      // Fee status
      const sInvoices = invoices.filter((inv) => inv.studentId === s.id);
      let feeStatus: "PAID" | "DUE" | "DEFAULTER" = "PAID";
      for (const inv of sInvoices) {
        const bal = parseFloat(inv.balanceAmount || "0");
        if (bal > 0) {
          if (inv.status === "OVERDUE" || (inv.dueDate && new Date(inv.dueDate) < now)) {
            feeStatus = "DEFAULTER";
            break;
          } else {
            feeStatus = "DUE";
          }
        }
      }

      // Attendance %
      const sAtt = attendanceRecords.filter((att) => att.studentId === s.id);
      let attendancePct: number | null = null;
      if (sAtt.length > 0) {
        const presentCount = sAtt.filter(
          (a) => a.status === "PRESENT" || a.status === "LATE",
        ).length;
        attendancePct = Math.round((presentCount / sAtt.length) * 100);
      }

      return {
        id: s.id,
        admissionNumber: s.admissionNumber,
        rollNumber: s.rollNumber || "—",
        fullName,
        gender: s.gender,
        sectionId: s.currentSectionId,
        feeStatus,
        attendancePct,
        lastExamAverage: null as number | null,
      };
    });

    // 4. Query Exam Schedules Stream touching this class
    const [rawExams, marksLocks] = await Promise.all([
      tx.query.examSchedules.findMany({
        where: and(
          eq(examSchedules.schoolId, schoolId),
          eq(examSchedules.classId, params.classId),
        ),
        with: {
          exam: { columns: { id: true, name: true } },
          subject: { columns: { id: true, name: true, code: true } },
        },
        orderBy: [desc(examSchedules.examDate)],
      }),
      tx.query.examMarksLocks.findMany({
        where: and(
          eq(examMarksLocks.schoolId, schoolId),
          eq(examMarksLocks.classId, params.classId),
        ),
      }),
    ]);

    const classExams = rawExams.map((es) => {
      const lock = marksLocks.find(
        (l) => l.examId === es.examId && l.subjectId === es.subjectId,
      );
      return {
        id: es.id,
        examId: es.examId,
        examName: es.exam?.name || "Exam",
        subjectName: es.subject?.name || "Subject",
        subjectCode: es.subject?.code || "",
        examDate: es.examDate,
        startTime: es.startTime,
        roomNumber: es.roomNumber,
        maxMarks: es.maxMarks,
        passingMarks: es.passingMarks,
        isLocked: lock ? lock.status === "LOCKED" || Boolean(lock.lockedAt) : false,
        classAverage: null as number | null,
      };
    });

    const teacherMap = new Map(allTeachers.map((t) => [t.id, t.displayName || t.email]));
    const enrichedTimetable = timetable.map((p: any) => ({
      ...p,
      teacher: p.teacher
        ? {
            ...p.teacher,
            displayName: teacherMap.get(p.teacher.id) || p.teacher.email,
          }
        : null,
    }));

    return {
      timetable: enrichedTimetable,
      classAssignments,
      classLessons,
      classAssessments,
      rosterStudents,
      classExams,
    };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6">
      <ClassHubClient
        cls={cls as any}
        overview={overview}
        activeYearName={activeYear?.label || "Active Session"}
        bellPeriods={bellPeriods as any}
        allSubjects={allSubjects as any}
        allTeachers={allTeachers as any}
        teachersError={teachersError}
        diagnostics={diagnostics}
        initialTimetable={timetable}
        initialAssignments={classAssignments}
        initialLessonPlans={classLessons}
        initialAssessments={classAssessments}
        rosterStudents={rosterStudents}
        classExams={classExams}
        isAdmin={isAdmin}
        isTeacher={isTeacher}
        userId={session.user.id}
      />
    </div>
  );
}
