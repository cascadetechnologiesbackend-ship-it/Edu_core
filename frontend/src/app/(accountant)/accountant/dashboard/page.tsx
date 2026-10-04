export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/serverAuth";
import Link from "next/link";
import { CreditCard, Receipt, Percent, BarChart3, TrendingUp, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Accountant Financial Workspace | SchoolMitra ERP",
  description: "Fee collection, pricing matrix, concessions, late fines & financial reports.",
};

export default async function AccountantDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <CreditCard className="w-3.5 h-3.5" /> Financial & Accounts Office
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2">
              Accountant Finance Console
            </h1>
            <p className="text-teal-200/80 text-sm mt-1">
              Class-wise fee pricing matrix, offline fee collection counter, concession approvals & audit ledger.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/fees/collect"
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" /> Collect Student Fees
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Today's Fee Collection</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">₹ 1,48,500</div>
          <p className="text-xs text-gray-500 mt-1">Cash, Online & Cheques</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Pricing Matrix Status</span>
            <Receipt className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">Active</div>
          <p className="text-xs text-emerald-600 mt-1">100% Classes Configured</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Pending Fee Invoices</span>
            <CreditCard className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-600 mt-2">342 Invoices</div>
          <p className="text-xs text-amber-600 mt-1">Due for current term</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Active Concessions</span>
            <Percent className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">28 Students</div>
          <p className="text-xs text-gray-500 mt-1">RTE, Sibling & Staff Wards</p>
        </div>
      </div>

      {/* Financial Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/fees/collect"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-teal-600 transition">
            Fee Collection & Counter
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Accept Cash, Cheque, UPI, DD payments and instantly print official fee receipts.
          </p>
        </Link>

        <Link
          href="/fees/structures"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Receipt className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition">
            Class Pricing Matrix Setup
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Set annual fees per grade, configure due dates, and auto-sync student invoices.
          </p>
        </Link>

        <Link
          href="/fees/reports"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition">
            Financial & Defaulter Reports
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Generate fee collection summaries, class-wise balance reports, and late fine logs.
          </p>
        </Link>
      </div>
    </div>
  );
}
