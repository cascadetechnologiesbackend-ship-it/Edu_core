export const dynamic = "force-dynamic";

import { db } from "@/db";
import {
  bankAccounts,
  incomeVouchers,
  expenseVouchers,
  accountLedgerTransactions,
  feePayments,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Clock,
  Building,
} from "lucide-react";
import Link from "next/link";

export default async function AccountsDashboardPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  // 1. Fetch Banks, Incomes, Expenses, and Ledger Transactions
  const [banks, incomes, expenses, feeCollections, ledgerEntries] =
    await Promise.all([
      db.query.bankAccounts.findMany({
        where: eq(bankAccounts.schoolId, schoolId),
        orderBy: [desc(bankAccounts.createdAt)],
      }),
      db.query.incomeVouchers.findMany({
        where: eq(incomeVouchers.schoolId, schoolId),
      }),
      db.query.expenseVouchers.findMany({
        where: and(
          eq(expenseVouchers.schoolId, schoolId),
          eq(expenseVouchers.status, "APPROVED")
        ),
      }),
      db.query.feePayments.findMany({
        where: eq(feePayments.schoolId, schoolId),
      }),
      db.query.accountLedgerTransactions.findMany({
        where: eq(accountLedgerTransactions.schoolId, schoolId),
        with: {
          bankAccount: true,
          createdBy: true,
        },
        orderBy: [desc(accountLedgerTransactions.transactionDate)],
        limit: 50,
      }),
    ]);

  // Calculations
  const totalFeeInflow = feeCollections.reduce(
    (sum, f) => sum + parseFloat(f.amountPaid || "0"),
    0
  );
  const totalNonFeeInflow = incomes.reduce(
    (sum, inc) => sum + parseFloat(inc.amount || "0"),
    0
  );
  const totalInflow = totalFeeInflow + totalNonFeeInflow;

  const totalOutflow = expenses.reduce(
    (sum, exp) => sum + parseFloat(exp.amount || "0"),
    0
  );

  const netCashFlow = totalInflow - totalOutflow;

  const totalBankBalance = banks.reduce(
    (sum, b) => sum + parseFloat(b.currentBalance || "0"),
    0
  );

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="accounts" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <BookOpen className="w-3.5 h-3.5" /> General Ledger Accounting
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Accounts & Financial Statement Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Institutional cash flows, non-fee revenue streams, operational disbursements, and real-time bank vault balances.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/school/accounts/incomes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Log Income
          </Link>
          <Link
            href="/school/accounts/expenses"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Log Expense
          </Link>
          <Link
            href="/school/accounts/bank-accounts"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-800 dark:text-slate-200 text-xs font-semibold transition"
          >
            <Building className="w-4 h-4" /> Banks
          </Link>
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Total Inflows (Revenue)
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              ₹{totalInflow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Fees (₹{totalFeeInflow.toLocaleString("en-IN")}) + Non-Fee (₹{totalNonFeeInflow.toLocaleString("en-IN")})
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Total Outflows (Expenses)
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
              ₹{totalOutflow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Approved vendor & operational bills
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Net Institutional Cash Flow
            </span>
            <div
              className={`p-2 rounded-xl ${
                netCashFlow >= 0
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
              }`}
            >
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold font-mono ${
                netCashFlow >= 0
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              ₹{netCashFlow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Net surplus / deficit
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Total Bank Vault Liquidity
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
              ₹{totalBankBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Across {banks.length} bank accounts
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bank Balances Summary Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Bank Balances
            </h3>
            <Link
              href="/school/accounts/bank-accounts"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              Manage &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {banks.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">
                No bank accounts registered yet.
              </p>
            ) : (
              banks.map((b) => (
                <div
                  key={b.id}
                  className="p-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 flex justify-between items-center"
                >
                  <div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white">
                      {b.bankName}
                    </div>
                    <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                      Acc: {b.accountNumber}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{parseFloat(b.currentBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {b.isActive ? "Active" : "Inactive"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* General Ledger Transactions */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Recent General Ledger Activity
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Synchronous audit trail of credit collections and debit disbursements.
            </p>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Tx #</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-slate-200">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 dark:text-slate-400">
                      No ledger transactions logged yet.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-gray-500 dark:text-slate-400 font-mono whitespace-nowrap">
                        {new Date(entry.transactionDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-gray-900 dark:text-white">
                        {entry.transactionNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            entry.transactionType === "CREDIT"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                          }`}
                        >
                          {entry.transactionType === "CREDIT" ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {entry.transactionType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-slate-300 max-w-xs truncate">
                        {entry.description || "—"}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold text-sm ${
                          entry.transactionType === "CREDIT"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {entry.transactionType === "CREDIT" ? "+" : "-"}₹
                        {parseFloat(entry.amount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
