export const dynamic = "force-dynamic";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { db } from "@/db";
import {
  students,
  classes,
  sections,
  feeInvoices,
  feePayments,
  studentAttendance,
  reportCards,
  examSchedules,
} from "@/db/schema";
import { eq, and, desc, asc, sql, isNotNull } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import Link from "next/link";
import {
  GraduationCap,
  Award,
  Calendar,
  BookOpen,
  CheckCircle2,
  Receipt,
  CreditCard,
  AlertCircle,
  Download,
  Clock,
  FileCheck,
} from "lucide-react";
import { CheckoutButton } from "@/app/(parent)/portal/CheckoutButton";

export const metadata = {
  title: "Student Learning Workspace | SchoolMitra ERP",
  description: "My timetable, homework assignments, report cards, fees & subject resources.",
};

export default async function StudentDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "STUDENT"] as const);
  const school = await requireSchool(ctx);
  const schoolId = school.id;
  const userId = ctx.userId;

  const {
    student,
    className,
    sectionName,
    studentName,
    invoices,
    payments,
    totalDue,
    totalPaid,
    attendanceRate,
    upcomingExamSchedules,
    myReportCards,
  } = await withDataPhaseTiming("/student/dashboard", () =>
    assertQueryBudget(
      async () => {
        // 1. Fetch current student record
        let studentRecord = await db.query.students.findFirst({
          where: and(
            eq(students.userId, userId),
            eq(students.schoolId, schoolId),
          ),
        });

        // Fallback for school administrators previewing student dashboard
        if (!studentRecord && ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(ctx.role)) {
          studentRecord = await db.query.students.findFirst({
            where: eq(students.schoolId, schoolId),
          });
        }

        if (!studentRecord) {
          return {
            student: null,
            className: "Assigned Class",
            sectionName: "A",
            studentName: ctx.email,
            invoices: [],
            payments: [],
            totalDue: 0,
            totalPaid: 0,
            attendanceRate: "100.0%",
            upcomingExamSchedules: [],
            myReportCards: [],
          };
        }

        // 2. Fetch class, section, invoices, payments, attendance, exams, report cards concurrently
        const [c, s, invs, pmts, attendanceLogs, upcomingExamSchedules, myReportCards] = await Promise.all([
          studentRecord.currentClassId
            ? db.query.classes.findFirst({
                where: eq(classes.id, studentRecord.currentClassId),
              })
            : Promise.resolve(null),
          studentRecord.currentSectionId
            ? db.query.sections.findFirst({
                where: eq(sections.id, studentRecord.currentSectionId),
              })
            : Promise.resolve(null),
          db.query.feeInvoices.findMany({
            where: eq(feeInvoices.studentId, studentRecord.id),
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
            where: eq(feePayments.studentId, studentRecord.id),
            orderBy: [desc(feePayments.paymentDate)],
            limit: 5,
          }),
          db.query.studentAttendance.findMany({
            where: eq(studentAttendance.studentId, studentRecord.id),
            limit: 60,
          }),
          studentRecord.currentClassId
            ? db.query.examSchedules.findMany({
                where: and(
                  eq(examSchedules.schoolId, schoolId),
                  eq(examSchedules.classId, studentRecord.currentClassId),
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
          db.query.reportCards.findMany({
            where: eq(reportCards.studentId, studentRecord.id),
            with: {
              exam: true,
            },
            orderBy: [desc(reportCards.createdAt)],
            limit: 5,
          }),
        ]);

        const clsName = c?.displayName || "Assigned Class";
        const secName = s?.name || "A";
        const stdName = `${decryptData(studentRecord.firstNameEncrypted) || ""} ${decryptData(studentRecord.lastNameEncrypted) || ""}`.trim() || ctx.email;

        let totDue = 0;
        let totPaid = 0;
        invs.forEach((inv) => {
          totDue += parseFloat(inv.balanceAmount || "0");
          totPaid += parseFloat(inv.paidAmount || "0");
        });

        let attRate = "96.5%";
        if (attendanceLogs.length > 0) {
          const presentCount = attendanceLogs.filter((a) => a.status === "PRESENT").length;
          attRate = `${((presentCount / attendanceLogs.length) * 100).toFixed(1)}%`;
        }

        return {
          student: studentRecord,
          className: clsName,
          sectionName: secName,
          studentName: stdName,
          invoices: invs,
          payments: pmts,
          totalDue: totDue,
          totalPaid: totPaid,
          attendanceRate: attRate,
          upcomingExamSchedules,
          myReportCards,
        };
      },
      { maxQueries: 8, label: "Student Dashboard" },
    ),
  );

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-violet-900 via-purple-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
              <GraduationCap className="w-3.5 h-3.5" /> Student Learning Portal
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2">
              Welcome back, {studentName}
            </h1>
            <p className="text-violet-200/80 text-sm mt-1">
              Check your class schedule, homework assignments, and settle pending fee installments online.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 text-xs font-medium">
              {className} ({sectionName}) {student?.rollNumber ? `• Roll #${student.rollNumber}` : ""}
            </span>
            {student?.admissionNumber && (
              <span className="px-3 py-2 rounded-lg bg-white/10 text-white font-mono text-xs">
                Adm #{student.admissionNumber}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">My Class</span>
            <GraduationCap className="w-5 h-5 text-violet-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {className} - {sectionName}
          </div>
          <p className="text-xs text-gray-500 mt-1">Academic Year 2026-27</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">My Attendance</span>
            <Calendar className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">{attendanceRate}</div>
          <p className="text-xs text-emerald-600 mt-1">Present Rate</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Fee Dues</span>
            <CreditCard className="w-5 h-5 text-amber-500" />
          </div>
          <div className={`text-2xl font-bold mt-2 ${totalDue > 0 ? "text-amber-500" : "text-emerald-500"}`}>
            ₹{totalDue.toLocaleString()}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {totalDue > 0 ? "Outstanding Balance" : "All Fees Cleared"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Profile Settings</span>
            <BookOpen className="w-5 h-5 text-blue-500" />
          </div>
          <Link
            href="/student/profile"
            className="text-sm font-semibold text-indigo-500 hover:text-indigo-400 mt-3 inline-block"
          >
            Manage My Profile →
          </Link>
          <p className="text-xs text-gray-500 mt-1">Avatar & Emergency Contacts</p>
        </div>
      </div>

      {/* Report Cards Banner (UX-R08) */}
      {myReportCards.length > 0 && (
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Official Report Cards Published</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {myReportCards[0]?.exam?.name || "Term Evaluation"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Your report card is released. Grade: {myReportCards[0]?.overallGrade || "A"}{" "}
                {myReportCards[0]?.rank ? `• Rank #${myReportCards[0]?.rank}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/api/report-cards/${myReportCards[0]?.id}/download`}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Download Report Card PDF
            </Link>
          </div>
        </div>
      )}

      {/* Upcoming Examinations & Datesheet Card (UX-P03) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">Upcoming Examinations &amp; Datesheet</h2>
            {upcomingExamSchedules.length > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                {upcomingExamSchedules.length} Papers
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 font-medium">Standard Timetable</span>
        </div>

        {upcomingExamSchedules.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs rounded-xl bg-slate-950/60 border border-slate-800/80">
            <Calendar className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="font-medium text-slate-300">No Upcoming Examinations Scheduled</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Your examination datesheets will appear here once officially published by the examination department.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Admit Card Status Banner */}
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                totalDue > 0
                  ? "bg-amber-950/20 border-amber-500/30 text-amber-300"
                  : "bg-indigo-950/30 border-indigo-500/30 text-indigo-200"
              }`}
            >
              <div className="flex items-start sm:items-center gap-2.5">
                {totalDue > 0 ? (
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                ) : (
                  <FileCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5 sm:mt-0" />
                )}
                <div>
                  <span className="font-bold text-sm">
                    {totalDue > 0 ? "Admit Card Fee-Locked" : "Admit Card Ready for Download"}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {totalDue > 0
                      ? `Outstanding fee dues detected (₹${totalDue.toLocaleString()}). Settle dues online below to release your examination hall ticket.`
                      : "Official admit card / hall ticket generated. Download and save offline before exam day."}
                  </p>
                </div>
              </div>
              {totalDue > 0 ? (
                <a
                  href="#fee-settlement"
                  className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 self-start sm:self-center"
                >
                  Pay Pending Dues
                </a>
              ) : (
                <Link
                  href={student && upcomingExamSchedules[0]?.examId ? (`/api/admit-cards/${student.id}/${upcomingExamSchedules[0].examId}/pdf` as any) : ("#" as any)}
                  download
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 self-start sm:self-center shadow-md shadow-indigo-600/30"
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
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between space-y-2 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-white text-sm truncate">{sched.subject?.name || "Subject"}</span>
                      <span className="text-[9px] font-semibold text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20 shrink-0">
                        {sched.exam?.name || "Exam"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {sched.examDate}
                      </span>
                      <span className="font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700/80">
                        {sched.roomNumber ? `Room ${sched.roomNumber}` : "Hall"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {sched.startTime} ({sched.durationMinutes}m)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Online Fee Payment Section with Razorpay Integration */}
      <div id="fee-settlement" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Fee Invoices & Online Gateway Settlement
              </h2>
              <p className="text-xs text-slate-400">
                Pay your tuition and facility fees securely via UPI, NetBanking, Debit/Credit Cards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Razorpay Secured
            </span>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
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
                  className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{feeHeadName}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPaid
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        Invoice #{inv.invoiceNumber} • Due: {new Date(inv.dueDate).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Balance Due</span>
                      <span className="text-lg font-extrabold text-white">
                        ₹{balanceAmt.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-[11px] p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-center">
                    <div>
                      <span className="text-slate-500 block">Gross</span>
                      <span className="font-semibold text-slate-300">₹{parseFloat(inv.grossAmount).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Paid</span>
                      <span className="font-semibold text-emerald-400">₹{parseFloat(inv.paidAmount).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Discount</span>
                      <span className="font-semibold text-indigo-400">₹{parseFloat(inv.discountAmount || "0").toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Pay button */}
                  {!isPaid ? (
                    <CheckoutButton
                      invoiceId={inv.id}
                      amount={balanceAmt}
                      studentName={studentName}
                      label={`Pay ₹${balanceAmt.toLocaleString()} via Razorpay`}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                    />
                  ) : (
                    <div className="py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-xs flex items-center justify-center gap-1.5">
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
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Recent Payment Receipts ({payments.length})
            </h3>
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
              {payments.map((p) => (
                <div key={p.id} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="font-semibold text-white">
                        Receipt #{p.receiptNumber}
                      </span>
                      <span className="text-slate-500 block text-[11px]">
                        Paid on {new Date(p.paymentDate).toLocaleDateString()} via {p.paymentMethod}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-400">
                      ₹{parseFloat(p.amountPaid).toLocaleString()}
                    </span>
                    <a
                      href={`/api/receipt/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
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
