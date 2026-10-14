import { db } from "@/db";
import {
  students,
  exams,
  academicYears,
  schools,
  classes,
  subjects,
  examSchedules,
  examAdmitCardSettings,
  examAdmitCardHolds,
  feeInvoices,
  auditLogs,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { decryptData } from "@/lib/encryption";
import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import {
  PortalAdmitCardView,
  type StudentAdmitCardData,
} from "./PortalAdmitCardView";

export default async function ParentPortalAdmitCardsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-center text-xs text-slate-400">
        Please log in to view admit cards.
      </div>
    );
  }

  const userId = session.user.id;
  const role = session.user.role as string;
  const isPrivileged = [
    "ADMIN",
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
    "ACCOUNTANT",
  ].includes(role);

  // 1. Identify student(s) linked to this user
  let myStudents = await db.query.students.findMany({
    where: eq(students.primaryParentUserId, userId),
  });

  // If role is STUDENT, also check userId on student
  if (myStudents.length === 0 && role === "STUDENT") {
    myStudents = await db.query.students.findMany({
      where: eq(students.userId, userId),
    });
  }

  // Preview fallback for admins
  if (myStudents.length === 0 && isPrivileged) {
    const demo = await db.query.students.findFirst({
      where: eq(students.isActive, true),
    });
    if (demo) myStudents = [demo];
  }

  if (myStudents.length === 0) {
    return (
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Admit Cards &amp; Hall Tickets
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Download examination hall tickets and verify reporting schedules.
            </p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            <Link
              href="/portal"
              className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
            >
              Fees &amp; Dues
            </Link>
            <Link
              href="/portal/report-cards"
              className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
            >
              Report Cards
            </Link>
            <span className="px-3.5 py-2 rounded-xl font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/30 whitespace-nowrap">
              Admit Cards
            </span>
            <Link
              href="/portal/consent"
              className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
            >
              Consent Center
            </Link>
            <Link
              href="/parent/documents"
              className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
            >
              Documents
            </Link>
            <Link
              href="/portal/rights"
              className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
            >
              Subject Rights
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-6 text-center space-y-2">
          <h2 className="text-base font-bold text-rose-400">Access Restricted</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No students linked to your account. If you are a parent or student, please contact school administration.
          </p>
        </div>
      </div>
    );
  }

  // 2. Build cards for linked students
  const cards: StudentAdmitCardData[] = [];

  for (const st of myStudents) {
    // Audit log
    await db.insert(auditLogs).values({
      schoolId: st.schoolId,
      userId,
      userEmail: session.user.email || "unknown@portal",
      userRole: role || "PARENT",
      action: "READ",
      tableName: "exam_admit_card_settings",
      recordId: st.id,
      ipAddress: "127.0.0.1",
      userAgent: "PortalAdmitCard",
      metadata: { note: "Student/Parent viewed admit card portal" },
    });

    const school = await db.query.schools.findFirst({
      where: eq(schools.id, st.schoolId),
    });

    // Student name
    const studentFullName = `${decryptData(st.firstNameEncrypted) || ""} ${decryptData(st.lastNameEncrypted) || ""}`.trim() || "Student";

    // Class name
    let className = "Unassigned";
    if (st.currentClassId) {
      const cls = await db.query.classes.findFirst({
        where: eq(classes.id, st.currentClassId),
      });
      if (cls) className = cls.displayName;
    }

    // Active academic year
    const activeYear = await db.query.academicYears.findFirst({
      where: and(
        eq(academicYears.schoolId, st.schoolId),
        eq(academicYears.isActive, true),
      ),
    });

    if (!activeYear) continue;

    // Active exams
    const activeExams = await db.query.exams.findMany({
      where: and(
        eq(exams.schoolId, st.schoolId),
        eq(exams.academicYearId, activeYear.id),
      ),
      orderBy: (t, { desc }) => [desc(t.startDate)],
    });

    // Invoices for fee due calculation
    const invoices = await db.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.schoolId, st.schoolId),
        eq(feeInvoices.studentId, st.id),
        isNull(feeInvoices.deletedAt),
      ),
      columns: {
        balanceAmount: true,
      },
    });

    let dueAmount = 0;
    for (const inv of invoices) {
      const bal = parseFloat(inv.balanceAmount || "0");
      if (bal > 0) dueAmount += bal;
    }

    for (const ex of activeExams) {
      // Admit card settings
      const settings = await db.query.examAdmitCardSettings.findFirst({
        where: and(
          eq(examAdmitCardSettings.schoolId, st.schoolId),
          eq(examAdmitCardSettings.examId, ex.id),
        ),
      });

      // Holds
      const hold = await db.query.examAdmitCardHolds.findFirst({
        where: and(
          eq(examAdmitCardHolds.schoolId, st.schoolId),
          eq(examAdmitCardHolds.examId, ex.id),
          eq(examAdmitCardHolds.studentId, st.id),
        ),
      });

      // Schedules for student's class
      let schedulesList: StudentAdmitCardData["schedules"] = [];
      if (st.currentClassId) {
        const rawSchedules = await db.query.examSchedules.findMany({
          where: and(
            eq(examSchedules.schoolId, st.schoolId),
            eq(examSchedules.examId, ex.id),
            eq(examSchedules.classId, st.currentClassId),
          ),
          with: {
            subject: true,
          },
          orderBy: (t, { asc }) => [asc(t.examDate), asc(t.startTime)],
        });

        schedulesList = rawSchedules.map((sc) => ({
          subjectName: sc.subject?.name || "Subject",
          subjectCode: sc.subject?.code || "",
          date: sc.examDate,
          startTime: sc.startTime,
          endTime: sc.durationMinutes ? `${Math.floor(sc.durationMinutes / 60)}h ${sc.durationMinutes % 60}m` : "",
          room: sc.roomNumber,
        }));
      }

      cards.push({
        student: {
          id: st.id,
          name: studentFullName,
          rollNumber: st.rollNumber,
          admissionNumber: st.admissionNumber,
          className,
        },
        school: {
          name: school?.name || "School",
          board: school?.board || "CBSE",
          address: school?.address || "School Campus",
          city: school?.city || "",
        },
        exam: {
          id: ex.id,
          name: ex.name,
          startDate: ex.startDate ? ex.startDate.toISOString() : "",
          endDate: ex.endDate ? ex.endDate.toISOString() : "",
        },
        settings: settings
          ? {
              availableFrom: settings.availableFrom ? settings.availableFrom.toISOString() : null,
              availableUntil: settings.availableUntil ? settings.availableUntil.toISOString() : null,
              feeLockMode: settings.feeLockMode as "OFF" | "SOFT" | "HARD",
              feeLockThresholdAmount: settings.feeLockThresholdAmount || "0",
              instructions: settings.instructions,
              examCentre: settings.examCentre,
              reportingTime: settings.reportingTime,
            }
          : null,
        isHeld: !!hold,
        holdReason: hold?.reason || null,
        dueAmount,
        schedules: schedulesList,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── 1. Header & Navigation Tabs ──────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Examination Hall Tickets
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Download and print official admit cards with exam datesheets and instructions.
          </p>
        </div>

        {/* Dedicated Horizontal Pill Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          <Link
            href="/portal"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Fees &amp; Dues
          </Link>
          <Link
            href="/portal/report-cards"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Report Cards
          </Link>
          <span className="px-3.5 py-2 rounded-xl font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/30 whitespace-nowrap">
            Admit Cards
          </span>
          <Link
            href="/portal/consent"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Consent Center
          </Link>
          <Link
            href="/parent/documents"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Documents
          </Link>
          <Link
            href="/portal/rights"
            className="px-3.5 py-2 rounded-xl font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition"
          >
            Subject Rights
          </Link>
        </div>
      </div>

      {/* ─── 2. Admit Cards Roster ───────────────────────────────────────────── */}
      {cards.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center space-y-2">
          <FileCheck2 className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="font-semibold text-slate-300 text-sm">
            No Scheduled Examinations Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are currently no active exams with admit cards available for your enrolled students.
          </p>
        </div>
      ) : (
        <PortalAdmitCardView cards={cards} />
      )}
    </div>
  );
}
