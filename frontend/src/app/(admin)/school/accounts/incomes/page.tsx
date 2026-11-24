export const dynamic = "force-dynamic";

import { db } from "@/db";
import { incomeVouchers, incomeHeads, bankAccounts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import {
  DollarSign,
  Plus,
  Calendar,
  Building,
  FileText,
  CreditCard,
  User,
  ArrowUpRight,
} from "lucide-react";
import { createIncomeVoucher } from "./actions";

export default async function IncomesPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [vouchers, activeHeads, activeBanks] = await Promise.all([
    db.query.incomeVouchers.findMany({
      where: eq(incomeVouchers.schoolId, schoolId),
      with: {
        incomeHead: true,
        bankAccount: true,
        createdBy: true,
      },
      orderBy: [desc(incomeVouchers.entryDate)],
      limit: 100,
    }),
    db.query.incomeHeads.findMany({
      where: eq(incomeHeads.schoolId, schoolId),
      orderBy: [desc(incomeHeads.name)],
    }),
    db.query.bankAccounts.findMany({
      where: eq(bankAccounts.schoolId, schoolId),
      orderBy: [desc(bankAccounts.bankName)],
    }),
  ]);

  const totalIncome = vouchers.reduce(
    (sum, v) => sum + parseFloat(v.amount || "0"),
    0
  );

  return (
    <div className="space-y-6">
      <FinanceTabs activeSection="accounts" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-2xl border border-border/40 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ArrowUpRight className="w-3.5 h-3.5" /> Core Accounting
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">
            Non-Fee Income & Revenue Vouchers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate formal income receipt vouchers for external revenue, sponsorships, canteen lease payments, and donations.
          </p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-5 py-3 rounded-2xl flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          <div>
            <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Total Non-Fee Receipts
            </div>
            <div className="text-xl font-extrabold text-emerald-900 dark:text-emerald-200 font-mono">
              ₹{totalIncome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New Income Voucher Form */}
        <div className="bg-card p-6 rounded-2xl border border-border/40 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Plus className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-foreground">
              Create Income Voucher
            </h2>
          </div>

          <form
            action={async (formData) => {
              "use server";
              await createIncomeVoucher(formData);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Income Head *
              </label>
              <select
                name="incomeHeadId"
                required
                className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Revenue Category...</option>
                {activeHeads
                  .filter((h) => h.isActive)
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.code ? `(${h.code})` : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  placeholder="0.00"
                  required
                  className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Receipt Date
                </label>
                <input
                  type="date"
                  name="entryDate"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Payment Mode
                </label>
                <select
                  name="paymentMode"
                  className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="DD">Demand Draft</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Deposit Bank Account
                </label>
                <select
                  name="bankAccountId"
                  className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Cash Chest / Not Deposited</option>
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Received From (Payer / Organization)
              </label>
              <input
                type="text"
                name="paymentSource"
                placeholder="e.g. Apex Sports Academy, Alumni Trust"
                className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Transaction / Cheque / UTR Ref #
              </label>
              <input
                type="text"
                name="transactionReference"
                placeholder="e.g. UTR-93820194829"
                className="w-full text-xs rounded-xl border border-border/40 bg-card px-3 py-2.5 text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Remarks / Description
              </label>
              <textarea
                name="remarks"
                rows={2}
                placeholder="e.g. Annual sponsorship fee for inter-school athletic meet"
                className="w-full text-xs rounded-xl border border-border/40 bg-card p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Issue Income Voucher
            </button>
          </form>
        </div>

        {/* Existing Vouchers Table */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border/40">
            <h3 className="text-base font-bold text-foreground">
              Income Voucher Ledger ({vouchers.length})
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Immutable voucher history with instant ledger credit tracking.
            </p>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Voucher #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Income Head & Payer</th>
                  <th className="py-3 px-4">Payment Mode & Bank</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-foreground">
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      No income vouchers logged yet. Use the voucher entry form to record non-fee collections.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/40">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-foreground">
                          {v.voucherNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono whitespace-nowrap">
                        {new Date(v.entryDate).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">
                          {v.incomeHead?.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {v.paymentSource || "General Payer"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">
                          {v.paymentMode}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {v.bankAccount ? v.bankAccount.bankName : "Cash Chest"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ₹{parseFloat(v.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
