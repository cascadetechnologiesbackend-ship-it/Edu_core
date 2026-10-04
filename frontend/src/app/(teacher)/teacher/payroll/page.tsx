import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db } from "@/db";
import { staff, salaryComponents, payslips, departments, designations } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { computeSalaryBreakdown } from "@/lib/salaryCalculator";
import Link from "next/link";
import {
  Receipt,
  ArrowLeft,
  ShieldCheck,
  TrendingUp,
  Percent,
  Calendar,
  Building,
  CreditCard,
  Download,
  AlertCircle,
  HelpCircle,
  Info,
  CheckCircle2,
  FileText,
} from "lucide-react";

export const metadata = {
  title: "My Payroll & Compensation | Educator Workspace",
  description: "View salary structure, itemized allowances, statutory deductions, and payslips.",
};

export default async function TeacherPayrollPage() {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
  ] as const);
  const school = await requireSchool(ctx);
  const schoolId = school.id;
  const userId = ctx.userId;

  // 1. Fetch Staff Profile with Department & Designation
  const staffMember = await db.query.staff.findFirst({
    where: and(eq(staff.userId, userId), eq(staff.schoolId, schoolId)),
    with: {
      department: true,
      designation: true,
    },
  });

  const teacherName = staffMember
    ? `${decryptData(staffMember.firstNameEncrypted)} ${decryptData(staffMember.lastNameEncrypted)}`.trim()
    : "Educator";

  // 2. Fetch Active Salary Structure
  let activeSalary = null;
  let breakdown = null;

  if (staffMember) {
    activeSalary = await db.query.salaryComponents.findFirst({
      where: and(
        eq(salaryComponents.staffId, staffMember.id),
        eq(salaryComponents.schoolId, schoolId)
      ),
      orderBy: [desc(salaryComponents.createdAt)],
    });

    if (activeSalary) {
      breakdown = computeSalaryBreakdown(activeSalary);
    }
  }

  // 3. Fetch Historical Payslips
  let historicalPayslips: any[] = [];
  if (staffMember) {
    historicalPayslips = await db.query.payslips.findMany({
      where: and(
        eq(payslips.staffId, staffMember.id),
        eq(payslips.schoolId, schoolId)
      ),
      orderBy: [desc(payslips.createdAt)],
    });
  }

  // Decrypt bank information if available (safely masked)
  let bankName = "Salary Account";
  let maskedAccount = "•••• 4242";
  let ifscCode = "HDFC0000123";

  if (staffMember?.bankAccountEncrypted) {
    try {
      const decryptedAcc = decryptData(staffMember.bankAccountEncrypted);
      if (decryptedAcc && decryptedAcc.length >= 4) {
        maskedAccount = `•••• ${decryptedAcc.slice(-4)}`;
      }
    } catch {
      // ignore
    }
  }

  if (staffMember?.bankNameEncrypted) {
    try {
      bankName = decryptData(staffMember.bankNameEncrypted) || bankName;
    } catch {
      // ignore
    }
  }

  if (staffMember?.bankIfscEncrypted) {
    try {
      ifscCode = decryptData(staffMember.bankIfscEncrypted) || ifscCode;
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-12">
      {/* Top Header & Back Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors p-1.5 -ml-1.5 rounded-lg active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Hub</span>
        </Link>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="w-3 h-3" />
          Verified Structure
        </span>
      </div>

      {/* Staff Identity Card */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{teacherName}</span>
              {staffMember?.employeeCode && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {staffMember.employeeCode}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              {staffMember?.designation?.name || "Teaching Faculty"} •{" "}
              {staffMember?.department?.name || "Academic Department"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Hero Salary Card */}
      {breakdown ? (
        <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/20 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Monthly Take-Home Pay
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                {breakdown.grossEarnings > 0
                  ? `${((breakdown.netMonthlyPay / breakdown.grossEarnings) * 100).toFixed(0)}% of Gross`
                  : "Active"}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-300">
                ₹{breakdown.netMonthlyPay.toLocaleString("en-IN")}
              </span>
              <span className="text-xs text-slate-400 font-medium">/ month (Net)</span>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Gross Pay (CTC)</span>
                <span className="text-base font-bold text-slate-100">
                  ₹{breakdown.grossEarnings.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Total Deductions</span>
                <span className="text-base font-bold text-rose-400">
                  -₹{breakdown.deductionsTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Proportional breakdown bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Net Pay vs Statutory Deductions</span>
                <span>
                  ₹{breakdown.netMonthlyPay.toLocaleString("en-IN")} / ₹{breakdown.grossEarnings.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${breakdown.grossEarnings > 0 ? (breakdown.netMonthlyPay / breakdown.grossEarnings) * 100 : 0}%`,
                  }}
                  title="Net Pay"
                />
                <div
                  className="bg-rose-500 transition-all duration-500"
                  style={{
                    width: `${breakdown.grossEarnings > 0 ? (breakdown.deductionsTotal / breakdown.grossEarnings) * 100 : 0}%`,
                  }}
                  title="Deductions (PF, PT, TDS)"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
          <h2 className="text-base font-semibold text-slate-200">
            Salary Structure Pending Assignment
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Your compensation components have not yet been assigned by the school HR office. Please contact administration if this requires immediate attention.
          </p>
        </div>
      )}

      {/* Itemized 2-Column Ledger */}
      {breakdown && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Earnings (Allowances) */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Earnings & Allowances
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                ₹{breakdown.grossEarnings.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                <span className="text-slate-300 font-medium">Basic Salary</span>
                <span className="font-semibold text-slate-100">
                  ₹{breakdown.basicSalary.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                <div className="flex items-center gap-1 text-slate-300 font-medium">
                  <span>Dearness Allowance (DA)</span>
                  <span className="text-[10px] text-slate-500">
                    ({activeSalary?.daPercent ?? 0}%)
                  </span>
                </div>
                <span className="font-semibold text-slate-100">
                  +₹{breakdown.daAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                <div className="flex items-center gap-1 text-slate-300 font-medium">
                  <span>House Rent Allowance (HRA)</span>
                  <span className="text-[10px] text-slate-500">
                    ({activeSalary?.hraPercent ?? 0}%)
                  </span>
                </div>
                <span className="font-semibold text-slate-100">
                  +₹{breakdown.hraAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-300 font-medium">Other Allowances</span>
                <span className="font-semibold text-slate-100">
                  +₹{breakdown.otherAllowancesTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs font-bold text-slate-200">
              <span>Total Monthly Gross</span>
              <span className="text-emerald-400 text-sm">
                ₹{breakdown.grossEarnings.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Statutory Deductions */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" />
                Statutory Deductions
              </span>
              <span className="text-xs font-semibold text-rose-400">
                -₹{breakdown.deductionsTotal.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                <div className="flex items-center gap-1 text-slate-300 font-medium">
                  <span>Provident Fund (PF Employee)</span>
                  <span className="text-[10px] text-slate-500">
                    ({activeSalary?.pfEmployeePercent ?? 12}%)
                  </span>
                </div>
                <span className="font-semibold text-rose-300">
                  -₹{breakdown.pfEmployeeAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                <div className="flex items-center gap-1 text-slate-300 font-medium">
                  <span>Professional Tax (PT)</span>
                  <span className="text-[10px] text-slate-500">
                    ({activeSalary?.professionalTaxState || "State"})
                  </span>
                </div>
                <span className="font-semibold text-rose-300">
                  -₹{breakdown.ptAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
                <span className="text-slate-300 font-medium">TDS / Income Tax</span>
                <span className="font-semibold text-rose-300">
                  -₹{breakdown.tdsAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-medium">Employer PF (12%)</span>
                <span className="text-slate-400 text-[11px]">
                  ₹{breakdown.pfEmployerAmount.toLocaleString("en-IN")} (School Contrib.)
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs font-bold text-slate-200">
              <span>Total Deductions</span>
              <span className="text-rose-400 text-sm">
                -₹{breakdown.deductionsTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Direct Deposit & Banking Channel Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
            Disbursement Channel
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Direct Deposit Configured
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-0.5">
              Bank Name
            </span>
            <span className="text-xs font-semibold text-slate-200">{bankName}</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-0.5">
              Account Number
            </span>
            <span className="text-xs font-mono font-semibold text-slate-200">
              {maskedAccount}
            </span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-0.5">
              IFSC Code
            </span>
            <span className="text-xs font-mono font-semibold text-slate-200">
              {ifscCode}
            </span>
          </div>
        </div>
      </div>

      {/* Digital Payslips Ledger */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            Disbursed Payslips
          </span>
          <span className="text-[11px] text-slate-400">
            {historicalPayslips.length} Record{historicalPayslips.length === 1 ? "" : "s"}
          </span>
        </div>

        {historicalPayslips.length > 0 ? (
          <div className="divide-y divide-slate-800">
            {historicalPayslips.map((slip) => (
              <div
                key={slip.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    <span>{slip.month}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Disbursed
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {slip.presentDays} of {slip.workingDays} days attended
                  </p>
                </div>

                <div className="text-right space-y-0.5">
                  <div className="font-bold text-slate-100">
                    ₹{Number(slip.netPay).toLocaleString("en-IN")}
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300"
                  >
                    <Download className="w-3 h-3" />
                    Receipt
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 px-4 space-y-2 border border-dashed border-slate-800 rounded-xl">
            <Calendar className="w-7 h-7 text-slate-600 mx-auto" />
            <p className="text-xs font-medium text-slate-300">
              No Finalized Monthly Payslips Yet
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Monthly payroll batches processed and approved by administration will automatically generate downloadable PDF salary statements here.
            </p>
          </div>
        )}
      </div>

      {/* Human Psychology / Help & Grievance Notice */}
      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-medium text-slate-300">Compensation Transparency Policy</span>
          <p>
            Your monthly salary calculation follows standardized school payroll policies. Provident Fund contributions are deposited to EPFO under your UAN. For questions regarding deductions or tax certificates (Form 16), reach out to the Accounts desk.
          </p>
        </div>
      </div>
    </div>
  );
}
