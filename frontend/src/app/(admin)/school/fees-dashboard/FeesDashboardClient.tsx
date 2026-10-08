"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
  CreditCard,
  PieChart,
  Users,
  ChevronRight,
  ArrowUpRight,
  ExternalLink,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { MoneyKpi } from "@/components/finance/MoneyKpi";
import { AgingBadge, StatusBadge } from "@/components/finance/StatusBadge";
import { StudentLedgerDrawer } from "@/components/finance/StudentLedgerDrawer";
import { EmptyState } from "@/components/finance/EmptyState";
import { cn } from "@/lib/utils";

export interface DashboardKPIs {
  todayCollected: number;
  todayPaymentsCount: number;
  totalBilled: number;
  totalCollected: number;
  totalDues: number;
  recoveryRate: number;
  overdue60Plus: number;
}

export interface AgingSummary {
  current: number;
  days0to30: number;
  days31to60: number;
  days60plus: number;
}

export interface DefaulterItem {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  dueAmount: number;
  daysOverdue: number;
  invoiceCount: number;
}

export interface RecentPaymentItem {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
}

export interface ModeBreakdownItem {
  mode: string;
  amount: number;
  percentage: number;
}

export interface ClassStatItem {
  className: string;
  billed: number;
  collected: number;
  due: number;
  rate: number;
}

export interface FeesDashboardClientProps {
  academicYearsList: Array<{ id: string; label: string; isActive: boolean }>;
  selectedAyId: string;
  kpis: DashboardKPIs;
  aging: AgingSummary;
  topDefaulters: DefaulterItem[];
  recentPayments: RecentPaymentItem[];
  modeBreakdown: ModeBreakdownItem[];
  classStats: ClassStatItem[];
}

export function FeesDashboardClient({
  academicYearsList,
  selectedAyId,
  kpis,
  aging,
  topDefaulters,
  recentPayments,
  modeBreakdown,
  classStats,
}: FeesDashboardClientProps) {
  const router = useRouter();

  const [selectedStudentForDrawer, setSelectedStudentForDrawer] = useState<{
    studentId: string;
    studentName: string;
    admissionNumber: string;
    className: string;
  } | null>(null);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ayId = e.target.value;
    router.push(`/school/fees-dashboard?ayId=${encodeURIComponent(ayId)}` as any);
  };

  return (
    <div className="space-y-8">
      {/* Session / Academic Year Selector Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50/80 dark:bg-slate-900/40 p-4 rounded-2xl border border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-slate-400">
            Active Scope
          </span>
          <select
            value={selectedAyId}
            onChange={handleYearChange}
            className="text-xs font-bold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {academicYearsList.map((ay) => (
              <option key={ay.id} value={ay.id}>
                Session {ay.label} {ay.isActive ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Real-Time SQL Aggregated Telemetry
        </div>
      </div>

      {/* Band 1: Money KPIs (Every KPI is a Clickable Link to prefiltered worklists) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Band 1: Core Financial Metrics & Quick Drills
          </h2>
          <span className="text-xs text-gray-400">Click any card to inspect underlying ledger</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MoneyKpi
            title="Today's Collections"
            amount={kpis.todayCollected}
            subtitle={`${kpis.todayPaymentsCount} receipts cleared today`}
            delta={{ value: "Live", label: "Cash & Bank", isPositive: true }}
            href="/school/transactions"
            variant="emerald"
          />

          <MoneyKpi
            title="Total Outstanding Dues"
            amount={kpis.totalDues}
            subtitle={`Uncollected fees in this session`}
            delta={{ value: `${kpis.recoveryRate}%`, label: "Recovery Rate", isPositive: false }}
            href="/school/due-fees"
            variant="rose"
          />

          <MoneyKpi
            title="Critical Overdue (60+ Days)"
            amount={kpis.overdue60Plus}
            subtitle="Immediate follow-up required"
            delta={{ value: "Risk", label: "Default Warning", isPositive: false }}
            href="/school/due-fees?bracket=60%2B"
            variant="primary"
          />

          <MoneyKpi
            title="Gross Invoiced Demand"
            amount={kpis.totalBilled}
            subtitle={`₹${kpis.totalCollected.toLocaleString("en-IN")} collected`}
            delta={{ value: "Target", label: "Billed Total", isNeutral: true }}
            href="/school/fees-dashboard"
          />
        </div>
      </div>

      {/* Band 2: Priority Work Lists & Aging Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aging Distribution Cards */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Receivables Aging Buckets
              </h3>
              <span className="text-xs text-gray-400 font-mono">FIFO Dues</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              Breakdown of pending balances categorized by due date elapsed.
            </p>
          </div>

          <div className="space-y-3.5 my-2">
            <Link
              href="/school/due-fees"
              className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 hover:scale-[1.01] transition"
            >
              <div>
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                  Current (Not Due)
                </p>
                <p className="text-xs text-gray-500">Grace / Early Window</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  ₹{aging.current.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </Link>

            <Link
              href="/school/due-fees?bracket=0-30"
              className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 hover:scale-[1.01] transition"
            >
              <div>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">
                  1 - 30 Days Overdue
                </p>
                <p className="text-xs text-gray-500">First Warning Bracket</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono text-amber-700 dark:text-amber-300">
                  ₹{aging.days0to30.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </Link>

            <Link
              href="/school/due-fees?bracket=31-60"
              className="flex items-center justify-between p-3 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 hover:scale-[1.01] transition"
            >
              <div>
                <p className="text-xs font-semibold text-orange-800 dark:text-orange-400">
                  31 - 60 Days Overdue
                </p>
                <p className="text-xs text-gray-500">Escalated Reminders</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono text-orange-700 dark:text-orange-300">
                  ₹{aging.days31to60.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </Link>

            <Link
              href="/school/due-fees?bracket=60%2B"
              className="flex items-center justify-between p-3 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 hover:scale-[1.01] transition"
            >
              <div>
                <p className="text-xs font-bold text-rose-800 dark:text-rose-400">
                  60+ Days Overdue (Critical)
                </p>
                <p className="text-xs text-gray-500">Formal Challan & Hold</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono text-rose-700 dark:text-rose-300">
                  ₹{aging.days60plus.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </Link>
          </div>

          <Link
            href="/school/due-fees"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-800 dark:text-slate-200 transition"
          >
            Open Complete Due Ledger <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Top-10 Defaulters Work List */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                Top Priority Defaulter Work List
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Highest balance receivables requiring urgent follow-up or cashier collection.
              </p>
            </div>
            <Link
              href="/school/due-fees"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4 text-center">Aging</th>
                  <th className="py-3 px-4 text-right">Outstanding (₹)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {topDefaulters.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No overdue balances recorded for this academic year!
                    </td>
                  </tr>
                ) : (
                  topDefaulters.map((item) => (
                    <tr
                      key={item.studentId}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedStudentForDrawer({
                              studentId: item.studentId,
                              studentName: item.studentName,
                              admissionNumber: item.admissionNumber,
                              className: item.className,
                            })
                          }
                          className="font-bold text-gray-900 dark:text-white hover:text-indigo-600 text-left transition"
                        >
                          {item.studentName}
                        </button>
                        <p className="text-[11px] text-gray-400 font-mono">
                          Adm #{item.admissionNumber}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-700 dark:text-slate-300">
                        {item.className}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <AgingBadge daysOverdue={item.daysOverdue} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        ₹{item.dueAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/school/collect-fees` as any}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[11px] shadow-sm transition active:scale-95"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Collect
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Band 3: Recent Activity Stream & Payment Mode Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Mode Volume Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Tender Mode Volume
            </h3>
            <span className="text-xs text-gray-400 font-mono">Collections</span>
          </div>

          <div className="space-y-4">
            {modeBreakdown.map((item) => (
              <div key={item.mode} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-gray-700 dark:text-slate-300">
                    {item.mode}
                  </span>
                  <span className="font-mono text-gray-900 dark:text-white font-bold">
                    ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-2.5 rounded-full transition-all duration-500",
                      item.mode === "CASH"
                        ? "bg-emerald-500"
                        : item.mode === "UPI"
                        ? "bg-indigo-600"
                        : item.mode === "ONLINE"
                        ? "bg-blue-500"
                        : "bg-purple-500"
                    )}
                    style={{ width: `${Math.max(2, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Collections Stream */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Live Fee Collections Activity Stream
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Last 10 fee collection payments recorded across counter, UPI, and bank transfers.
              </p>
            </div>
            <Link
              href="/school/transactions"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              Open Day Book <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No payments processed yet for this academic year.
                    </td>
                  </tr>
                ) : (
                  recentPayments.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        #{p.receiptNumber}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                        {p.studentName}
                        <span className="block text-[11px] text-gray-400 font-mono">
                          Adm #{p.admissionNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={p.paymentMethod} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{p.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500 dark:text-slate-400">
                        {new Date(p.paymentDate).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
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

      {/* Class-wise Recovery Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Division Collection Velocity
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Aggregated class-wise billed demand versus actual collections received.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4 text-right">Invoiced (₹)</th>
                <th className="py-3 px-4 text-right">Collected (₹)</th>
                <th className="py-3 px-4 text-right">Outstanding (₹)</th>
                <th className="py-3 px-4 text-center">Recovery %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {classStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No class invoice structures assigned for this session.
                  </td>
                </tr>
              ) : (
                classStats.map((stat, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                      {stat.className}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      ₹{stat.billed.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      ₹{stat.collected.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 dark:text-rose-400 font-semibold">
                      ₹{stat.due.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold",
                          stat.rate >= 80
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : stat.rate >= 50
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                        )}
                      >
                        {stat.rate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Student Fee Ledger Drawer */}
      {selectedStudentForDrawer && (
        <StudentLedgerDrawer
          open={!!selectedStudentForDrawer}
          onOpenChange={(open) => !open && setSelectedStudentForDrawer(null)}
          studentId={selectedStudentForDrawer.studentId}
          studentName={selectedStudentForDrawer.studentName}
          admissionNumber={selectedStudentForDrawer.admissionNumber}
          className={selectedStudentForDrawer.className}
        />
      )}
    </div>
  );
}
