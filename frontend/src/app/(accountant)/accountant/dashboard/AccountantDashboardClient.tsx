"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  AlertCircle,
  ArrowLeftRight,
  BookOpen,
  Calendar,
  ExternalLink,
  RotateCcw,
  ShieldAlert,
  PieChart,
  Users,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { MoneyKpi } from "@/components/finance/MoneyKpi";
import { StatusBadge } from "@/components/finance/StatusBadge";

export interface AccountantDashboardData {
  schoolName: string;
  academicYearsList: Array<{ id: string; label: string; isActive: boolean }>;
  selectedAyId: string;
  kpis: {
    todayCollected: number;
    todayCount: number;
    mtdCollected: number;
    mtdCount: number;
    totalDues: number;
    openInvoicesCount: number;
    overdueDues: number;
    overdueCount: number;
    pendingRefundsCount: number;
    pendingBrsCount: number;
  };
  modeBreakdown: Array<{
    mode: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  classCollections: Array<{
    classId: string;
    className: string;
    collected: number;
    paymentsCount: number;
  }>;
  recentTransactions: Array<{
    id: string;
    receiptNumber: string;
    studentName: string;
    admissionNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
  }>;
  pendingRefunds: Array<{
    id: string;
    receiptNumber: string;
    studentName: string;
    admissionNumber: string;
    refundAmount: number;
    reason: string;
    createdAt: string;
  }>;
  failedPayments: Array<{
    id: string;
    gateway: string;
    gatewayOrderId: string;
    gatewayPaymentId: string | null;
    invoiceNumber: string;
    amount: number;
    createdAt: string;
  }>;
}

export function AccountantDashboardClient({
  data,
}: {
  data: AccountantDashboardData;
}) {
  const router = useRouter();
  const {
    academicYearsList,
    selectedAyId,
    kpis,
    modeBreakdown,
    classCollections,
    recentTransactions,
    pendingRefunds,
    failedPayments,
  } = data;

  const handleYearChange = (ayId: string) => {
    router.push(`/accountant/dashboard?ayId=${encodeURIComponent(ayId)}` as any);
  };

  return (
    <div className="space-y-6">
      {/* Academic Year Scope & Quick Actions Strip */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border/40 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <Calendar className="w-4 h-4 text-[#248A3D] dark:text-[#30D158]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Session Scope
          </span>
          <select
            value={selectedAyId}
            onChange={(e) => handleYearChange(e.target.value)}
            aria-label="Academic Year Selector"
            className="text-xs font-semibold bg-muted/40 hover:bg-muted/60 border border-border/40 text-foreground rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#248A3D]/30 dark:focus:ring-[#30D158]/30"
          >
            {academicYearsList.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.label} {ay.isActive ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* 4 Primary Operational Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/school/collect-fees"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#248A3D] hover:bg-[#1f7232] dark:bg-[#30D158] dark:hover:bg-[#28b84d] text-white dark:text-black text-xs font-bold shadow-sm transition"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Collect Fee
          </Link>
          <Link
            href={(selectedAyId ? `/school/due-fees?ayId=${encodeURIComponent(selectedAyId)}` : "/school/due-fees") as any}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border/40 text-xs font-semibold transition"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            View Dues
          </Link>
          <Link
            href="/school/accounts/bank-reconciliation"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border/40 text-xs font-semibold transition"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-[#248A3D] dark:text-[#30D158]" />
            BRS Reconcile
            {kpis.pendingBrsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                {kpis.pendingBrsCount}
              </span>
            )}
          </Link>
          <Link
            href="/school/transactions"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border/40 text-xs font-semibold transition"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Day Book
          </Link>
        </div>
      </div>

      {/* Band 1: Core Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MoneyKpi
          title="Today's Collection"
          amount={kpis.todayCollected}
          subtitle={`${kpis.todayCount} active receipts today`}
          icon={TrendingUp}
          variant="money_in"
          href="/school/transactions"
        />

        <MoneyKpi
          title="MTD Collection"
          amount={kpis.mtdCollected}
          subtitle={`${kpis.mtdCount} receipts this month`}
          icon={Receipt}
          variant="primary"
          href="/school/transactions"
        />

        <MoneyKpi
          title="Total Outstanding Dues"
          amount={kpis.totalDues}
          subtitle={`${kpis.openInvoicesCount} open invoices`}
          icon={AlertCircle}
          variant="money_owed"
          href={(selectedAyId ? `/school/due-fees?ayId=${encodeURIComponent(selectedAyId)}` : "/school/due-fees") as any}
        />

        <MoneyKpi
          title="Overdue Dues"
          amount={kpis.overdueDues}
          subtitle={`${kpis.overdueCount} past-due invoices`}
          icon={ShieldAlert}
          variant="attention"
          href={(selectedAyId ? `/school/due-fees?status=OVERDUE&ayId=${encodeURIComponent(selectedAyId)}` : "/school/due-fees?status=OVERDUE") as any}
        />
      </div>

      {/* Operational Backlog Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/school/refunds"
          className="bg-card p-4 rounded-2xl border border-border/40 shadow-sm flex items-center justify-between hover:border-[#248A3D]/40 dark:hover:border-[#30D158]/40 transition"
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Refund Requests
            </p>
            <p className="text-2xl font-bold text-foreground font-mono mt-1">
              {kpis.pendingRefundsCount}
            </p>
          </div>
          <RotateCcw className="w-6 h-6 text-amber-500" />
        </Link>

        <Link
          href="/school/accounts/bank-reconciliation"
          className="bg-card p-4 rounded-2xl border border-border/40 shadow-sm flex items-center justify-between hover:border-[#248A3D]/40 dark:hover:border-[#30D158]/40 transition"
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending BRS Reconciliation
            </p>
            <p className="text-2xl font-bold text-foreground font-mono mt-1">
              {kpis.pendingBrsCount}
            </p>
          </div>
          <ArrowLeftRight className="w-6 h-6 text-[#248A3D] dark:text-[#30D158]" />
        </Link>

        <Link
          href="/school/online-payments"
          className="bg-card p-4 rounded-2xl border border-border/40 shadow-sm flex items-center justify-between hover:border-[#248A3D]/40 dark:hover:border-[#30D158]/40 transition"
        >
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Failed Payment Exceptions
            </p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono mt-1">
              {failedPayments.length}
            </p>
          </div>
          <ShieldAlert className="w-6 h-6 text-rose-500" />
        </Link>
      </div>

      {/* Band 2: Collection by Mode & Collection by Class */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#248A3D] dark:text-[#30D158]" />
              Collection by Payment Mode
            </h2>
            <span className="text-xs text-muted-foreground font-mono">Active Receipts</span>
          </div>

          {modeBreakdown.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No active collections recorded for this academic session.
            </p>
          ) : (
            <div className="space-y-3">
              {modeBreakdown.map((m) => (
                <div key={m.mode} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      {m.mode} ({m.count})
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      ₹{m.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} ({m.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-[#248A3D] dark:bg-[#30D158]"
                      style={{ width: `${Math.max(2, m.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-[#248A3D] dark:text-[#30D158]" />
              Collection by Class
            </h2>
            <span className="text-xs text-muted-foreground font-mono">Session Total</span>
          </div>

          {classCollections.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No class-wise fee payments recorded yet.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-border/30">
              {classCollections.map((c) => (
                <div
                  key={c.classId}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-foreground">{c.className}</span>
                    <span className="ml-2 text-muted-foreground">
                      ({c.paymentsCount} txns)
                    </span>
                  </div>
                  <span className="font-mono font-bold text-[#248A3D] dark:text-[#30D158]">
                    ₹{c.collected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Band 3: Recent Transactions with PDF Receipt Links */}
      <div className="bg-card rounded-3xl border border-border/40 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/40 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Recent Transactions
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Latest verified receipts with direct PDF download links.
            </p>
          </div>
          <Link
            href="/school/transactions"
            className="text-xs font-semibold text-[#248A3D] dark:text-[#30D158] hover:underline"
          >
            Open Day Book →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Date</th>
                <th className="py-3 px-4 text-right">Receipt PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No active transactions recorded in this session.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      #{tx.receiptNumber}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-foreground">{tx.studentName}</span>
                      <span className="block text-[11px] text-muted-foreground font-mono">
                        Adm #{tx.admissionNumber}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={tx.paymentMethod} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#248A3D] dark:text-[#30D158]">
                      ₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      {new Date(tx.paymentDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={`/api/receipt/${tx.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#248A3D]/10 text-[#248A3D] dark:text-[#30D158] font-semibold hover:bg-[#248A3D]/20 transition"
                      >
                        PDF <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Band 4: Pending Refund Requests & Failed Payment Exceptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-500" />
              Pending Refund Requests ({kpis.pendingRefundsCount})
            </h2>
            <Link
              href="/school/refunds"
              className="text-xs font-semibold text-[#248A3D] dark:text-[#30D158] hover:underline"
            >
              Manage Refunds →
            </Link>
          </div>

          {pendingRefunds.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No pending refund requests in queue.
            </p>
          ) : (
            <div className="divide-y divide-border/30">
              {pendingRefunds.map((r) => (
                <div key={r.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-foreground">
                      {r.studentName} <span className="font-mono text-muted-foreground">({r.admissionNumber})</span>
                    </p>
                    <p className="text-muted-foreground font-mono">
                      Receipt #{r.receiptNumber}
                    </p>
                    <p className="text-muted-foreground mt-0.5 line-clamp-1">{r.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      ₹{r.refundAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="block text-[10px] text-muted-foreground font-mono">
                      {new Date(r.createdAt).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card p-6 rounded-3xl border border-border/40 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Failed Payment Exceptions ({failedPayments.length})
            </h2>
            <Link
              href="/school/online-payments"
              className="text-xs font-semibold text-[#248A3D] dark:text-[#30D158] hover:underline"
            >
              Gateway Logs →
            </Link>
          </div>

          {failedPayments.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No failed online payment gateway exceptions.
            </p>
          ) : (
            <div className="divide-y divide-border/30">
              {failedPayments.map((f) => (
                <div key={f.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-foreground">
                      {f.gateway} • Inv #{f.invoiceNumber}
                    </p>
                    <p className="text-muted-foreground font-mono">
                      Order: {f.gatewayOrderId}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      ₹{f.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="block text-[10px] text-muted-foreground font-mono">
                      {new Date(f.createdAt).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
