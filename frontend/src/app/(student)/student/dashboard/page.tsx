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
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
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
          };
        }

        // 2. Fetch class, section, invoices, payments, attendance concurrently
        const [c, s, invs, pmts, attendanceLogs] = await Promise.all([
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
        };
      },
      { maxQueries: 6, label: "Student Dashboard" },
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

      {/* Online Fee Payment Section with Razorpay Integration */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg space-y-5">
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
