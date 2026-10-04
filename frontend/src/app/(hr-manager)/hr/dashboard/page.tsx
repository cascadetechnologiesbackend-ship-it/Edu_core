export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/serverAuth";
import Link from "next/link";
import { Users, Banknote, CalendarOff, UserCheck, FileSpreadsheet, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "HR & Payroll Management Workspace | SchoolMitra ERP",
  description: "Staff directory, leave approvals, payroll processing & EPFO ECR exports.",
};

export default async function HRManagerDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "HR_MANAGER"] as const);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-cyan-900 via-sky-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <Users className="w-3.5 h-3.5" /> Human Resources & Payroll Office
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2">
              HR & Payroll Console
            </h1>
            <p className="text-cyan-200/80 text-sm mt-1">
              Staff onboarding, monthly payroll processing, statutory deductions (PF/PT/ESI), and EPFO ECR exports.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/hr?tab=payroll"
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition flex items-center gap-2"
            >
              <Banknote className="w-4 h-4" /> Process Monthly Payroll
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total Employees</span>
            <Users className="w-5 h-5 text-cyan-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">64</div>
          <p className="text-xs text-emerald-600 mt-1">Teaching & Non-Teaching</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Pending Leave Applications</span>
            <CalendarOff className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-600 mt-2">3 Requests</div>
          <p className="text-xs text-amber-600 mt-1">Awaiting approval</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Current Month Payroll</span>
            <Banknote className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">Calculated</div>
          <p className="text-xs text-gray-500 mt-1">Ready for disbursal</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">EPFO ECR Generator</span>
            <FileSpreadsheet className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">100% Ready</div>
          <p className="text-xs text-emerald-600 mt-1">EPFO # format text export</p>
        </div>
      </div>

      {/* HR Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/hr"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-cyan-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-cyan-600 transition">
            Staff Directory & Onboarding
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Manage staff profiles, designation tiers, departments, and Aadhaar/PAN details.
          </p>
        </Link>

        <Link
          href="/hr?tab=payroll"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Banknote className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition">
            Payroll & ECR Text Export
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Process monthly salaries, calculate PF/PT/ESI deductions, and download EPFO ECR text format files.
          </p>
        </Link>

        <Link
          href="/hr?tab=leaves"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <CalendarOff className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-amber-600 transition">
            Leave Approvals & Quotas
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Approve employee leave applications and monitor Leave-Without-Pay (LWP) deductions.
          </p>
        </Link>
      </div>
    </div>
  );
}
