export const dynamic = "force-dynamic";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  students,
  classes,
  sections,
  studentAttendance,
  feeInvoices,
  reportCards,
  assignmentSubmissions,
  studentBusPasses,
  notices,
  events,
  parentTeacherMessages,
} from "@/db/schema";
import { eq, and, desc, asc, gte, lte, isNotNull, inArray } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { deriveParentFeed } from "@schoolmitra/backend/parentEventEngine/deriveParentFeed";
import type {
  ParentDataSnapshot,
  InvoiceSnapshot,
  AttendanceSnapshot,
  BusPassSnapshot,
  HomeworkSnapshot,
  ReportCardSnapshot,
  NoticeSnapshot,
  UpcomingEventSnapshot,
  UnreadMessageSnapshot,
} from "@schoolmitra/backend/parentEventEngine/types";
import { ParentFeedContainer } from "@/components/parent/ParentFeedContainer";
import type { StudentWardOption } from "@/components/parent/ParentIdentityHeader";

export const metadata = {
  title: "Parent Companion Feed | SchoolMitra ERP",
  description: "High-intent event-driven feed for student attendance, fees, transit, and academics.",
};

export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams?: { studentId?: string; locale?: string };
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "PARENT",
  ] as const);
  const school = await requireSchool(ctx);
  const now = new Date();

  // 1. Identify the parent's wards
  const studentRows = await withTenant(school.id, async (tx) => {
    if (ctx.role === "PARENT") {
      return await tx.query.students.findMany({
        where: and(
          eq(students.schoolId, school.id),
          eq(students.primaryParentUserId, ctx.userId),
          eq(students.isActive, true)
        ),
        orderBy: [asc(students.admissionNumber)],
      });
    }

    // Admins / Principals previewing parent portal
    return await tx.query.students.findMany({
      where: and(eq(students.schoolId, school.id), eq(students.isActive, true)),
      limit: 5,
    });
  });

  if (studentRows.length === 0) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-base font-semibold text-slate-200">
          No Student Profile Linked
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          No active student is linked to your parent account. Please contact the school administrative office.
        </p>
      </div>
    );
  }

  // Fetch class names for all ward classes
  const classIds = studentRows
    .map((s) => s.currentClassId)
    .filter(Boolean) as string[];

  const schoolClasses =
    classIds.length > 0
      ? await withTenant(school.id, async (tx) =>
          tx.query.classes.findMany({
            where: inArray(classes.id, classIds),
            columns: { id: true, displayName: true, gradeLevel: true },
          })
        )
      : [];

  const classMap = new Map(
    schoolClasses.map((c) => [c.id, c.displayName || c.gradeLevel])
  );

  // 2. Select active student (searchParam or first)
  const selectedStudentId = searchParams?.studentId || studentRows[0]!.id;
  const currentStudentRow =
    studentRows.find((s) => s.id === selectedStudentId) || studentRows[0]!;

  // 3. Build available students list with decrypted names
  const availableStudents: StudentWardOption[] = studentRows.map((s) => {
    let studentName = `Student ${s.admissionNumber}`;
    try {
      if (s.firstNameEncrypted) {
        const first = decryptData(s.firstNameEncrypted);
        const last = s.lastNameEncrypted ? decryptData(s.lastNameEncrypted) : "";
        studentName = `${first} ${last}`.trim();
      }
    } catch {
      // Fallback to admission number if decryption fails in preview/sandbox
    }

    return {
      id: s.id,
      name: studentName,
      className: s.currentClassId ? classMap.get(s.currentClassId) || "Class" : "Class",
      sectionName: "",
      admissionNumber: s.admissionNumber,
      avatarUrl: s.photoS3Key,
    };
  });

  const currentStudent = availableStudents.find((s) => s.id === currentStudentRow.id)!;

  // 4. Fetch data snapshot for selected student
  const {
    attendanceSnap,
    attendanceRate30d,
    invoiceSnaps,
    homeworkSnaps,
    reportCardSnaps,
    busPassSnap,
    noticeSnaps,
    eventSnaps,
    unreadMessageSnaps,
  } = await withTenant(school.id, async (tx) => {
    // A. Attendance (last 30 days)
    const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const attRows = await tx.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.studentId, currentStudentRow.id),
        gte(studentAttendance.attendanceDate, cutoff30d)
      ),
      orderBy: [desc(studentAttendance.attendanceDate)],
    });

    const todayStr = now.toISOString().split("T")[0]!;
    const todayAtt = attRows.find(
      (r) => new Date(r.attendanceDate).toISOString().split("T")[0] === todayStr
    );

    let attendanceToday: AttendanceSnapshot | undefined;
    if (todayAtt) {
      attendanceToday = {
        status: todayAtt.status as any,
        markedAt: todayAtt.createdAt || now,
        remarks: todayAtt.remarks,
      };
    }

    const schoolDays = attRows.filter((r) => r.status !== "HOLIDAY");
    const attendedDays = schoolDays.filter(
      (r) => r.status === "PRESENT" || r.status === "LATE"
    ).length;
    const attRate = schoolDays.length > 0 ? attendedDays / schoolDays.length : 1.0;

    // B. Invoices
    const invRows = await tx.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.studentId, currentStudentRow.id),
        eq(feeInvoices.schoolId, school.id)
      ),
      orderBy: [desc(feeInvoices.dueDate)],
    });

    const invoiceSnaps: InvoiceSnapshot[] = invRows.map((inv) => ({
      id: inv.id,
      termName: inv.invoiceNumber || "School Term",
      status: inv.status as any,
      dueDate: inv.dueDate,
      balanceAmount: Number(inv.balanceAmount || 0),
      lateFeeAmount: Number(inv.lateFeeAmount || 0),
      reminderSentFlags: {
        d7: Boolean(inv.reminderSentD7),
        d15: Boolean(inv.reminderSentD15),
        d30: Boolean(inv.reminderSentD30),
      },
    }));

    // C. Homework (last 14 days)
    const cutoff14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const subRows = await tx.query.assignmentSubmissions.findMany({
      where: and(
        eq(assignmentSubmissions.studentId, currentStudentRow.id),
        eq(assignmentSubmissions.schoolId, school.id),
        gte(assignmentSubmissions.submittedAt, cutoff14d)
      ),
      with: {
        assignment: true,
      },
    });

    const homeworkSnaps: HomeworkSnapshot[] = subRows.map((sub) => ({
      id: sub.assignmentId,
      title: sub.assignment?.title || "Homework",
      subjectName: "Academics",
      dueDate: sub.assignment?.dueDate || now,
      isSubmitted: true,
      submission: {
        submittedAt: sub.submittedAt || now,
        grade: sub.marksAwarded !== null ? `${sub.marksAwarded}` : null,
        feedback: sub.remarks,
      },
    }));

    // D. Report Cards
    const rcRows = await tx.query.reportCards.findMany({
      where: and(
        eq(reportCards.studentId, currentStudentRow.id),
        eq(reportCards.schoolId, school.id),
        isNotNull(reportCards.generatedAt)
      ),
      orderBy: [desc(reportCards.generatedAt)],
      limit: 2,
    });

    const reportCardSnaps: ReportCardSnapshot[] = rcRows.map((rc) => ({
      id: rc.id,
      termName: "Term Report",
      publishedAt: rc.generatedAt || rc.createdAt || now,
      averageScore: Number((rc.gradeData as any)?.percentage || 0),
    }));

    // E. Bus Pass
    const bp = await tx.query.studentBusPasses.findFirst({
      where: and(
        eq(studentBusPasses.studentId, currentStudentRow.id),
        eq(studentBusPasses.schoolId, school.id),
        eq(studentBusPasses.isActive, true)
      ),
    });

    let busPassSnap: BusPassSnapshot | undefined;
    if (bp) {
      busPassSnap = {
        isActive: true,
        routeId: bp.routeId,
        stopId: bp.routeStopId,
        stopOrder: 1,
      };
    }

    // F. Notices (within 72h or pinned)
    const cutoff72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const noticeRows = await tx.query.notices.findMany({
      where: and(
        eq(notices.schoolId, school.id),
        gte(notices.publishedAt, cutoff72h)
      ),
      orderBy: [desc(notices.isPinned), desc(notices.publishedAt)],
      limit: 3,
    });

    const noticeSnaps: NoticeSnapshot[] = noticeRows.map((n) => ({
      id: n.id,
      title: n.title,
      contentPreview: n.content?.slice(0, 100) || "",
      publishedAt: n.publishedAt || now,
      isPinned: Boolean(n.isPinned),
      expiresAt: n.expiresAt,
    }));

    // G. Upcoming Events (e.g. PTM within 7 days)
    const eventCutoff7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const eventRows = await tx.query.events.findMany({
      where: and(
        eq(events.schoolId, school.id),
        gte(events.startDate, now),
        lte(events.startDate, eventCutoff7d)
      ),
      orderBy: [asc(events.startDate)],
      limit: 3,
    });

    const eventSnaps: UpcomingEventSnapshot[] = eventRows.map((e) => ({
      id: e.id,
      title: e.title,
      eventType: e.eventType,
      startDate: e.startDate,
      endDate: e.endDate,
      venue: e.description,
    }));

    // H. Unread Messages
    let unreadMessageSnaps: UnreadMessageSnapshot[] = [];
    if (ctx.role === "PARENT") {
      const msgRows = await tx.query.parentTeacherMessages.findMany({
        where: and(
          eq(parentTeacherMessages.schoolId, school.id),
          eq(parentTeacherMessages.recipientUserId, ctx.userId),
          eq(parentTeacherMessages.isRead, false)
        ),
        limit: 1,
      });

      unreadMessageSnaps = msgRows.map((m) => ({
        threadId: m.parentMessageId || m.id,
        teacherName: "Class Teacher",
        lastMessagePreview: m.content?.slice(0, 80) || "",
        sentAt: m.createdAt,
      }));
    }

    return {
      attendanceSnap: attendanceToday,
      attendanceRate30d: attRate,
      invoiceSnaps,
      homeworkSnaps,
      reportCardSnaps,
      busPassSnap,
      noticeSnaps,
      eventSnaps,
      unreadMessageSnaps,
    };
  });

  currentStudent.attendanceRate = attendanceRate30d;

  // 5. Build snapshot & derive feed cards
  const snapshot: ParentDataSnapshot = {
    studentName: currentStudent.name,
    attendanceToday: attendanceSnap,
    invoices: invoiceSnaps,
    homework: homeworkSnaps,
    reportCards: reportCardSnaps,
    busPass: busPassSnap,
    notices: noticeSnaps,
    upcomingEvents: eventSnaps,
    unreadMessages: unreadMessageSnaps,
  };

  const initialCards = deriveParentFeed(currentStudent.id, now, snapshot);

  return (
    <div className="py-2">
      <ParentFeedContainer
        initialCards={initialCards}
        currentStudent={currentStudent}
        availableStudents={availableStudents}
        locale={searchParams?.locale || "en"}
      />
    </div>
  );
}
