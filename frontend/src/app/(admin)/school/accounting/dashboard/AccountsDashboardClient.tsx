"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
  Check,
  Building,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  FileText,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { MoneyKpi } from "@/components/finance/MoneyKpi";
import { StatusBadge } from "@/components/finance/StatusBadge";
import { approveExpenseVoucher } from "@/app/(admin)/school/accounts/expenses/actions";
import { cn } from "@/lib/utils";

export interface PendingExpenseItem {
  id: string;
  voucherNumber: string;
  expenseHeadName: string;
  vendorName?: string | null | undefined;
  amount: number;
  paymentMode: string;
  entryDate: string;
  remarks?: string | null | undefined;
}

export interface BankVaultItem {
  id: string;
  bankName: string;
  accountNumber: string;
  currentBalance: number;
  branchName?: string | null | undefined;
  isActive: boolean;
}

export interface LedgerJournalItem {
  id: string;
  transactionNumber: string;
  transactionType: string;
  sourceType: string;
  amount: number;
  balanceAfter?: string | null | undefined;
  description?: string | null | undefined;
  transactionDate: string;
  bankName?: string | undefined;
}

export interface AccountsDashboardClientProps {
  totalTreasury: number;
  totalInflow: number;
  totalFeeInflow: number;
  totalNonFeeInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  pendingExpensesCount: number;
  pendingExpensesTotal: number;
  pendingExpenses: PendingExpenseItem[];
  banks: BankVaultItem[];
  ledgerEntries: LedgerJournalItem[];
  userRole: string;
  asOf?: string | undefined;
}

export function AccountsDashboardClient({
  totalTreasury,
  totalInflow,
  totalFeeInflow,
  totalNonFeeInflow,
  totalOutflow,
  netCashFlow,
  pendingExpensesCount,
  pendingExpensesTotal,
  pendingExpenses,
  banks,
  ledgerEntries,
  userRole,
  asOf,
}: AccountsDashboardClientProps) {
  const router = useRouter();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const canApprove = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(userRole);

  const handleApproveVoucher = async (voucherId: string) => {
    try {
      setApprovingId(voucherId);
      const res = await approveExpenseVoucher(voucherId);
      if (res.success) {
        toast.success("Expense voucher approved and debited from bank balance.");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to approve voucher.");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Band 1: Cash Position & Treasury KPIs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Band 1: Institutional Cash Position & Liquidity
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            {asOf ? `Snapshot as of ${asOf}` : "Real-time synchronized across fee & accounting ledgers"}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MoneyKpi
            title="Total Treasury Liquidity"
            amount={totalTreasury}
            subtitle={`Across ${banks.length} institutional accounts`}
            delta={{ value: "Live", label: "Vault Balance", isPositive: true }}
            href="/school/accounts/bank-accounts"
            variant="emerald"
          />

          <MoneyKpi
            title="Net Institutional Cash Flow"
            amount={netCashFlow}
            subtitle={netCashFlow >= 0 ? "Operating Surplus" : "Operating Deficit"}
            delta={{
              value: netCashFlow >= 0 ? "+ Surplus" : "- Deficit",
              label: "Net Position",
              isPositive: netCashFlow >= 0,
            }}
            href="/school/accounting/dashboard"
            variant={netCashFlow >= 0 ? "primary" : "rose"}
          />

          <MoneyKpi
            title="Total Revenue Inflows"
            amount={totalInflow}
            subtitle={`Fees ₹${totalFeeInflow.toLocaleString("en-IN")} + Non-Fee ₹${totalNonFeeInflow.toLocaleString("en-IN")}`}
            delta={{ value: "Revenue", label: "Cleared Inflow", isPositive: true }}
            href="/school/accounts/incomes"
            variant="emerald"
          />

          <MoneyKpi
            title="Operational Disbursements"
            amount={totalOutflow}
            subtitle={`${pendingExpensesCount} vouchers pending approval`}
            delta={{
              value: `${pendingExpensesCount} Pending`,
              label: "Approved Outflow",
              isPositive: false,
            }}
            href="/school/accounts/expenses"
            variant="rose"
          />
        </div>
      </div>

      {/* Band 2: Expense Approval Queue & Bank Vaults */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Expense Approvals Queue */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/40 shadow-xs overflow-hidden flex flex-col justify-between">
          <div className="p-6 border-b border-border/40 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="text-base font-bold text-foreground">
                  Expense Voucher Approval Queue
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting administrative authorization prior to bank debit and ledger posting.
              </p>
            </div>
            {pendingExpensesCount > 0 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-mono">
                {pendingExpensesCount} Pending (₹{pendingExpensesTotal.toLocaleString("en-IN")})
              </span>
            )}
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/60 border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Voucher #</th>
                  <th className="py-3 px-4">Category Head</th>
                  <th className="py-3 px-4">Beneficiary / Vendor</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Approval Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {pendingExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                      All expense vouchers are approved and up to date!
                    </td>
                  </tr>
                ) : (
                  pendingExpenses.map((v) => (
                    <tr
                      key={v.id}
                      className="hover:bg-muted/30 transition"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[#00875A] dark:text-[#63E6BE]">
                        #{v.voucherNumber}
                        <span className="block text-[11px] text-muted-foreground font-sans">
                          {new Date(v.entryDate).toLocaleDateString("en-IN")}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {v.expenseHeadName}
                        <span className="block text-[11px] text-muted-foreground">
                          via {v.paymentMode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {v.vendorName || "Operational Vendor"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                        ₹{v.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canApprove ? (
                          <button
                            type="button"
                            onClick={() => handleApproveVoucher(v.id)}
                            disabled={approvingId === v.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs min-h-[36px] transition active:scale-95 disabled:opacity-50 cursor-pointer"
                          >
                            {approvingId === v.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            Approve & Debit
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Admin approval required
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bank Balances Vault Card */}
        <div className="bg-card p-6 rounded-2xl border border-border/40 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#00875A] dark:text-[#63E6BE]" />
                Institutional Bank Vaults
              </h3>
              <Link
                href="/school/accounts/bank-accounts"
                className="text-xs text-[#00875A] dark:text-[#63E6BE] hover:underline font-semibold"
              >
                Manage &rarr;
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Liquid reserves across registered operating accounts.
            </p>
          </div>

          <div className="space-y-3 my-2 flex-1">
            {banks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No bank accounts registered.
              </p>
            ) : (
              banks.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-xl border border-border/40 bg-muted/20 flex justify-between items-center hover:scale-[1.01] transition"
                >
                  <div>
                    <div className="text-xs font-bold text-foreground">
                      {b.bankName}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      Acc: {b.accountNumber}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{b.currentBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {b.isActive ? "Active Vault" : "Inactive"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <Link
            href="/school/accounts/bank-accounts"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold rounded-xl bg-card border border-border/40 hover:bg-muted/40 text-foreground transition min-h-[44px]"
          >
            Bank Register & Reconciliations &rarr;
          </Link>
        </div>
      </div>

      {/* Band 3: Master General Ledger Real-Time Journal */}
      <div className="bg-card rounded-2xl border border-border/40 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-border/40 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#00875A] dark:text-[#63E6BE]" />
              General Ledger Live Journal
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Synchronous audit trail of double-entry credit collections and debit disbursements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/school/transactions"
              className="text-xs font-semibold text-[#00875A] dark:text-[#63E6BE] hover:underline"
            >
              Fee Day Book &rarr;
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/60 border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Tx #</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-foreground">
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No ledger transactions logged yet.
                  </td>
                </tr>
              ) : (
                ledgerEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/30">
                    <td className="py-3 px-4 text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(entry.transactionDate).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-foreground">
                      {entry.transactionNumber}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-muted text-muted-foreground">
                        {entry.sourceType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                          entry.transactionType === "CREDIT"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                            : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25"
                        )}
                      >
                        {entry.transactionType === "CREDIT" ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {entry.transactionType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-sm truncate">
                      {entry.description || "—"}
                    </td>
                    <td
                      className={cn(
                        "py-3 px-4 text-right font-mono font-bold text-sm",
                        entry.transactionType === "CREDIT"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {entry.transactionType === "CREDIT" ? "+" : "-"}₹
                      {entry.amount.toLocaleString("en-IN", {
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
  );
}
