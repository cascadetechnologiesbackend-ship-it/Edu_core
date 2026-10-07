export const dynamic = "force-dynamic";

import { db } from "@/db";
import { expenseVouchers, expenseHeads, bankAccounts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import {
  TrendingDown,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building,
  User,
  ArrowDownRight,
  ShieldCheck,
} from "lucide-react";
import { createExpenseVoucher, approveExpenseVoucher } from "./actions";

export default async function ExpensesPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [vouchers, activeHeads, activeBanks] = await Promise.all([
    db.query.expenseVouchers.findMany({
      where: eq(expenseVouchers.schoolId, schoolId),
      with: {
        expenseHead: true,
        bankAccount: true,
        createdBy: true,
        approvedBy: true,
      },
      orderBy: [desc(expenseVouchers.entryDate)],
      limit: 100,
    }),
    db.query.expenseHeads.findMany({
      where: eq(expenseHeads.schoolId, schoolId),
      orderBy: [desc(expenseHeads.name)],
    }),
    db.query.bankAccounts.findMany({
      where: eq(bankAccounts.schoolId, schoolId),
      orderBy: [desc(bankAccounts.bankName)],
    }),
  ]);

  const totalExpense = vouchers
    .filter((v) => v.status === "APPROVED" || v.status === "PAID")
    .reduce((sum, v) => sum + parseFloat(v.amount || "0"), 0);

  const pendingCount = vouchers.filter((v) => v.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="accounts" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <ArrowDownRight className="w-3.5 h-3.5" /> Core Accounting
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Operational Expenses & Disbursements
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Record supplier bills, vendor payments, salary disbursements, and institutional overhead with multi-level approval.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-5 py-3 rounded-2xl flex items-center gap-3">
            <TrendingDown className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            <div>
              <div className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                Approved Disbursements
              </div>
              <div className="text-xl font-extrabold text-rose-900 dark:text-rose-200 font-mono">
                ₹{totalExpense.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New Expense Voucher Form */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
            <Plus className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Create Expense Voucher
            </h2>
          </div>

          <form
            action={async (formData) => {
              "use server";
              await createExpenseVoucher(formData);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                Expense Head *
              </label>
              <select
                name="expenseHeadId"
                required
                className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Select Expense Category...</option>
                {activeHeads
                  .filter((h) => h.isActive)
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.code ? `(${h.code})` : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                Vendor / Payee Name *
              </label>
              <input
                type="text"
                name="vendorName"
                placeholder="e.g. Metro Electricals, Staff Payroll"
                required
                className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  placeholder="0.00"
                  required
                  className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Voucher Date
                </label>
                <input
                  type="date"
                  name="entryDate"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Payment Mode
                </label>
                <select
                  name="paymentMode"
                  className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="UPI">UPI / Corporate Card</option>
                  <option value="CASH">Petty Cash Chest</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Disbursing Bank
                </label>
                <select
                  name="bankAccountId"
                  className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">Petty Cash / Not Selected</option>
                  {activeBanks
                    .filter((b) => b.isActive)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - {b.accountNumber}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Approval Status
                </label>
                <select
                  name="status"
                  className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="APPROVED">Auto-Approve & Debit</option>
                  <option value="PENDING">Submit for Approval</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  Invoice / Bill #
                </label>
                <input
                  type="text"
                  name="transactionReference"
                  placeholder="e.g. INV-98124"
                  className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                Remarks / Purpose
              </label>
              <textarea
                name="remarks"
                rows={2}
                placeholder="e.g. Monthly maintenance & campus cleanliness vendor invoice"
                className="w-full text-xs rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Issue Expense Voucher
            </button>
          </form>
        </div>

        {/* Existing Expense Vouchers Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Expense Voucher Ledger ({vouchers.length})
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Disbursements history with vendor tracking and bank debit status.
              </p>
            </div>
            {pendingCount > 0 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                {pendingCount} Pending Approval
              </span>
            )}
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Voucher #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category & Payee</th>
                  <th className="py-3 px-4">Bank / Mode</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-slate-200">
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500 dark:text-slate-400">
                      No expense vouchers recorded yet. Record institutional disbursements using the form.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900 dark:text-white">
                        {v.voucherNumber}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-slate-400 font-mono whitespace-nowrap">
                        {new Date(v.entryDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {v.expenseHead?.name}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-400">
                          {v.vendorName || "General Vendor"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-800 dark:text-slate-200">
                          {v.paymentMode}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-400 font-mono">
                          {v.bankAccount ? v.bankAccount.bankName : "Petty Cash"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                        ₹{parseFloat(v.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            v.status === "APPROVED" || v.status === "PAID"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                          }`}
                        >
                          {v.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {v.status === "PENDING" ? (
                          <form
                            action={async () => {
                              "use server";
                              await approveExpenseVoucher(v.id);
                            }}
                          >
                            <button
                              type="submit"
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold shadow-sm transition"
                            >
                              Approve
                            </button>
                          </form>
                        ) : (
                          <span className="text-[11px] text-gray-400 font-mono">Completed</span>
                        )}
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
