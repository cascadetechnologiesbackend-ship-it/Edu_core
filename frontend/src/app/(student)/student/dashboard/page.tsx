export const dynamic = "force-dynamic";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { db } from "@/db";
import {
  feeInvoices,
  feePayments,
  examSchedules,
} from "@/db/schema";
import { eq, and, desc, asc, sql, isNotNull } from "drizzle-orm";
import Link from "next/link";
import {
  GraduationCap,
  Award,
  Calendar,
  Receipt,
  Download,
  Clock,
  AlertCircle,
  FileCheck,
  CheckCircle2,
} from "lucide-react";
import { CheckoutButton } from "@/app/(parent)/portal/CheckoutButton";
import { resolveStudentScope } from "@/lib/studentEventEngine/scopeResolver";
import { assembleStudentSnapshot } from "@/lib/studentEventEngine/snapshotAssembler";
import { deriveStudentFeed } from "@/lib/studentEventEngine/deriveStudentFeed";
import { StudentFeedContainer } from "@/components/student/feed/StudentFeedContainer";

export const metadata = {
  title: "Student Feed & Learning Workspace | SchoolMitra ERP",
  description: "My daily feed, homework assignments, classwork recaps, timetable & examinations.",
};

export default async function StudentDashboardPage({
  searchParams,
}: {
  searchParams?: { studentId?: string };
}) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "STUDENT"] as const);
  const school = await requireSchool(ctx);
  const schoolId = school.id;
  const userId = ctx.userId;
  const studentIdParam = searchParams?.studentId;

  // Authoritative scope resolution (SD4 fixed: arbitrary findFirst fallback removed)
  let scope: any = null;
  try {
    scope = await resolveStudentScope(userId, {
      schoolId,
      studentId: studentIdParam ?? null,
      role: ctx.role,
    });
  } catch (err) {
    // If admin preview with no studentId or student not found
  }

  if (!scope) {
    return (
      <div className="space-y-6 p-6 max-w-3xl mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              {["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role)
                ? "Admin Student Preview"
                : "Student Record Not Found"}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role)
                ? "Please provide an active student's ID via ?studentId=<id> to preview their learning portal."
                : "No active student enrollment is associated with your account in this school."}
            </p>
          </div>
          {["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(ctx.role) && (
            <Link
              href="/students"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
            >
              Open Student Directory
            </Link>
          )}
        </div>
      </div>
    );
  }

  const {
    feedCards,
    studentName,
    className,
    sectionName,
    rollNumber,
    admissionNumber,
    academicYearLabel,
    attendanceRate,
    invoices,
    payments,
    totalDue,
    upcomingExamSchedules,
  } = await withDataPhaseTiming("/student/dashboard", () =>
    assertQueryBudget(
      async () => {
        const studentId = scope.studentId;
        const currentClassId = scope.classId;

        // 1. Assemble full student snapshot & derive active feed cards (Phase S3)
        const snapshot = await assembleStudentSnapshot(db, scope);
        const derivedCards = deriveStudentFeed(studentId, new Date(), snapshot);

        // 2. Fetch fee invoices, payments, and upcoming exams concurrently
        const [invs, pmts, examScheds] = await Promise.all([
          db.query.feeInvoices.findMany({
            where: eq(feeInvoices.studentId, studentId),
            with: {
              feeStructure: {
                with: {
                  feeHead: true,
                },
              },
            },
            orderBy: [desc(feeInvoices.dueDate)],
          }),
          db.query.feePayments.findMany({
            where: eq(feePayments.studentId, studentId),
            orderBy: [desc(feePayments.paymentDate)],
            limit: 5,
          }),
          currentClassId
            ? db.query.examSchedules.findMany({
                where: and(
                  eq(examSchedules.schoolId, schoolId),
                  eq(examSchedules.classId, currentClassId),
                  isNotNull(examSchedules.datesheetPublishedAt),
                  sql`${examSchedules.examDate} >= CURRENT_DATE`,
                ),
                with: {
                  exam: true,
                  subject: true,
                },
                orderBy: [asc(examSchedules.examDate)],
                limit: 6,
              })
            : Promise.resolve([]),
        ]);

        let totDue = 0;
        invs.forEach((inv) => {
          totDue += parseFloat(inv.balanceAmount || "0");
        });

        // Derive honest attendance rate (AC-11: zero hardcoded fallbacks)
        let attRate = "No logs yet";
        if (snapshot.attendanceSummary?.ratePercent !== null && snapshot.attendanceSummary?.ratePercent !== undefined) {
          attRate = `${snapshot.attendanceSummary.ratePercent}%`;
        }

        return {
          feedCards: derivedCards,
          studentName: scope.studentName,
          className: scope.className,
          sectionName: scope.sectionName,
          rollNumber: scope.rollNumber,
          admissionNumber: scope.admissionNumber,
          academicYearLabel: scope.academicYearLabel,
          attendanceRate: attRate,
          invoices: invs,
          payments: pmts,
          totalDue: totDue,
          upcomingExamSchedules: examScheds,
        };
      },
      { maxQueries: 16, label: "Student Dashboard" },
    ),
  );

  return (
    <div className="space-y-8 p-4 sm:p-6 max-w-4xl mx-auto pb-24">
      {/* 1. Primary Chronological Feed & Due Today Strip (Phase S3, Surface S1) */}
      <StudentFeedContainer
        initialCards={feedCards}
        studentId={scope.studentId}
        studentName={studentName}
        className={className}
        sectionName={sectionName}
        rollNumber={rollNumber}
        admissionNumber={admissionNumber}
        attendanceRate={attendanceRate}
        academicYearLabel={academicYearLabel}
      />

      {/* 2. Upcoming Examinations & Datesheet Card (Retained Scope UX-P03) */}
      {upcomingExamSchedules.length > 0 && (
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Upcoming Examinations &amp; Datesheet
              </h2>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                {upcomingExamSchedules.length} Papers
              </span>
            </div>
            <Link
              href="/student/timetable"
              className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
            >
              Full Schedule →
            </Link>
          </div>

          <div className="space-y-4">
            {/* Admit Card Status Banner */}
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                totalDue > 0
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-300"
                  : "bg-indigo-500/10 border-indigo-500/30 text-indigo-900 dark:text-indigo-200"
              }`}
            >
              <div className="flex items-start sm:items-center gap-2.5">
                {totalDue > 0 ? (
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
                ) : (
                  <FileCheck className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5 sm:mt-0" />
                )}
                <div>
                  <span className="font-bold text-sm">
                    {totalDue > 0 ? "Admit Card Fee-Locked" : "Admit Card Ready for Download"}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {totalDue > 0
                      ? `Outstanding fee balance detected (₹${totalDue.toLocaleString()}). Settle dues online below to release your examination hall ticket.`
                      : "Official admit card / hall ticket generated. Download and save offline before exam day."}
                  </p>
                </div>
              </div>
              {totalDue > 0 ? (
                <a
                  href="#fee-settlement"
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 self-start sm:self-center transition"
                >
                  Pay Pending Dues
                </a>
              ) : (
                <Link
                  href={upcomingExamSchedules[0]?.examId ? (`/api/admit-cards/${scope.studentId}/${upcomingExamSchedules[0].examId}/pdf` as any) : ("#" as any)}
                  download
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 self-start sm:self-center shadow-md transition"
                >
                  <Download className="w-4 h-4" />
                  Download Admit Card PDF
                </Link>
              )}
            </div>

            {/* Datesheet Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {upcomingExamSchedules.map((sched) => (
                <div
                  key={sched.id}
                  className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col justify-between space-y-2 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                        {sched.subject?.name || "Subject"}
                      </span>
                      <span className="text-[9px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 shrink-0">
                        {sched.exam?.name || "Exam"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {sched.examDate}
                      </span>
                      <span className="font-mono bg-slate-200/60 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700/80">
                        {sched.roomNumber ? `Room ${sched.roomNumber}` : "Hall"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {sched.startTime} ({sched.durationMinutes}m)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Online Fee Payment Section with Razorpay Integration (Retained Scope) */}
      <div id="fee-settlement" className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Fee Dues & Online Settlement
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pay tuition and facility fees securely via UPI, NetBanking, Debit/Credit Cards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Razorpay Secured
            </span>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/80">
            No fee invoices currently assigned to your student account.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invoices.map((inv) => {
              const feeHeadName = inv.feeStructure?.feeHead?.name || `${inv.term} Fee`;
              const balanceAmt = parseFloat(inv.balanceAmount || "0");
              const isPaid = balanceAmt <= 0;

              return (
                <div
                  key={inv.id}
                  className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{feeHeadName}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPaid
                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                        Invoice #{inv.invoiceNumber} • Due: {new Date(inv.dueDate).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Balance Due</span>
                      <span className="text-lg font-black text-slate-900 dark:text-white">
                        ₹{balanceAmt.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-[11px] p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
                    <div>
                      <span className="text-slate-400 block">Gross</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">₹{parseFloat(inv.grossAmount).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Paid</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">₹{parseFloat(inv.paidAmount).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Discount</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">₹{parseFloat(inv.discountAmount || "0").toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Pay button */}
                  {!isPaid ? (
                    <CheckoutButton
                      invoiceId={inv.id}
                      amount={balanceAmt}
                      studentName={studentName}
                      label={`Pay ₹${balanceAmt.toLocaleString()} via Razorpay`}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                    />
                  ) : (
                    <div className="py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Invoice Completely Paid
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recent Payment Receipts ({payments.length})
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/40 dark:bg-slate-950/40">
              {payments.map((p) => (
                <div key={p.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Receipt #{p.receiptNumber}
                      </span>
                      <span className="text-slate-400 block text-[11px]">
                        Paid on {new Date(p.paymentDate).toLocaleDateString()} via {p.paymentMethod}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{parseFloat(p.amountPaid).toLocaleString()}
                    </span>
                    <a
                      href={`/api/receipt/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                      title="Download PDF Receipt"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
