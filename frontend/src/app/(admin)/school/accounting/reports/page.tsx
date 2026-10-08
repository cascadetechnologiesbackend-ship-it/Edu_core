import React from "react";
import Link from "next/link";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import {
  FileText,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Download,
  Calendar,
  Building2,
  Percent,
} from "lucide-react";
import {
  generateTrialBalanceReport,
  generateIncomeExpenditureReport,
  generateBalanceSheetReport,
  generateConcessionSummaryReport,
} from "@schoolmitra/backend/lib/financialReportsEngine";

export default async function FinancialReportsHubPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"] as const);
  const school = await requireSchool(ctx);

  // Fetch initial summary snapshots
  const [tb, ie, bs, cs] = await Promise.all([
    generateTrialBalanceReport(school.id).catch(() => null),
    generateIncomeExpenditureReport(school.id).catch(() => null),
    generateBalanceSheetReport(school.id).catch(() => null),
    generateConcessionSummaryReport(school.id).catch(() => null),
  ]);

  const isAdmin = ctx.role === "SUPER_ADMIN" || ctx.role === "SCHOOL_ADMIN";

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Financial Statements & Accounting Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Standard GAAP compliant double-entry statements per ACC-02 for {school.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Chart of Accounts V3
          </span>
          {!isAdmin && (
            <span className="text-xs px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-medium">
              Read-Only View
            </span>
          )}
        </div>
      </div>

      <FinanceTabs activeSection="accounts" />

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isAdmin && (
          <>
            {/* Trial Balance Card */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Trial Balance</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Summary of all ledger debits and credits verifying general ledger equilibrium.
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Total Volume:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      ₹{tb?.totalDebits.toLocaleString("en-IN") || "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Equilibrium Status:</span>
                    <span className={`font-semibold ${tb?.isBalanced ? "text-emerald-600" : "text-rose-600"}`}>
                      {tb?.isBalanced ? "✓ Balanced" : `⚠️ Imbalance ₹${tb?.discrepancy}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800">
                <Link
                  href="/school/accounting/reports/trial-balance"
                  className="inline-flex items-center justify-between w-full text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  <span>View Statement</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Income & Expenditure Card */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Income & Expenditure</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Operational surplus or deficit comparing fee collections and miscellaneous revenue against expenses.
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Net Operating Surplus:</span>
                    <span className={`font-semibold ${ie?.isSurplus ? "text-emerald-600" : "text-rose-600"}`}>
                      ₹{ie?.netSurplus.toLocaleString("en-IN") || "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Total Revenue:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      ₹{ie?.totalIncome.toLocaleString("en-IN") || "0.00"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800">
                <Link
                  href="/school/accounting/reports/income-expenditure"
                  className="inline-flex items-center justify-between w-full text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  <span>View Statement</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Balance Sheet Card */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Balance Sheet</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Institutional financial position: total assets versus liabilities and accumulated reserves.
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Total Assets:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      ₹{bs?.totalAssets.toLocaleString("en-IN") || "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Tie-Out Verification:</span>
                    <span className={`font-semibold ${bs?.isTiedOut ? "text-emerald-600" : "text-rose-600"}`}>
                      {bs?.isTiedOut ? "✓ Balanced & Tied Out" : `Imbalance ₹${bs?.tieOutDifference}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800">
                <Link
                  href="/school/accounting/reports/balance-sheet"
                  className="inline-flex items-center justify-between w-full text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
                >
                  <span>View Statement</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </>
        )}

        {/* Concessions & Waivers Summary Card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Concessions & Waivers</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Revenue foregone matrix by policy, term, and standard with realization rates.
              </p>
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800/80 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Revenue Foregone:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  ₹{cs?.totalConcessions.toLocaleString("en-IN") || "0.00"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Realization Rate:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {cs?.overallRealizationRate !== undefined ? `${cs.overallRealizationRate.toFixed(1)}%` : "100.0%"}
                </span>
              </div>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800">
            <Link
              href="/school/accounting/reports/concessions"
              className="inline-flex items-center justify-between w-full text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400"
            >
              <span>View Report</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
