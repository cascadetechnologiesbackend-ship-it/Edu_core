export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeInvoices, feePayments, classes, academicYears } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import {
  BarChart3,
  CreditCard,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  FileText,
  Users,
  PieChart,
} from "lucide-react";
import Link from "next/link";

export default async function FeesDashboardPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  // 1. Fetch all invoices for this school
  const [invoices, payments, allClasses] = await Promise.all([
    db.query.feeInvoices.findMany({
      where: eq(feeInvoices.schoolId, schoolId),
      with: {
        student: true,
      },
    }),
    db.query.feePayments.findMany({
      where: eq(feePayments.schoolId, schoolId),
      orderBy: [desc(feePayments.paymentDate)],
      limit: 200,
    }),
    db.query.classes.findMany({
      where: eq(classes.schoolId, schoolId),
    }),
  ]);

  // Aggregate Metrics
  let totalBilled = 0;
  let totalCollected = 0;
  let totalDues = 0;

  for (const inv of invoices) {
    totalBilled += parseFloat(inv.netAmount || "0");
    totalCollected += parseFloat(inv.paidAmount || "0");
    totalDues += parseFloat(inv.balanceAmount || "0");
  }

  const collectionRate =
    totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Payment Mode Breakdown
  const modeMap: Record<string, number> = {
    CASH: 0,
    UPI: 0,
    ONLINE: 0,
    BANK_TRANSFER: 0,
    CHEQUE: 0,
    DD: 0,
  };

  for (const p of payments) {
    const mode = p.paymentMethod || "CASH";
    const amt = parseFloat(p.amountPaid || "0");
    if (modeMap[mode] !== undefined) {
      modeMap[mode] += amt;
    } else {
      modeMap[mode] = (modeMap[mode] || 0) + amt;
    }
  }

  // Class-wise collection performance
  const classStatsMap = new Map<
    string,
    { className: string; billed: number; collected: number; due: number }
  >();

  for (const c of allClasses) {
    classStatsMap.set(c.id, {
      className: c.displayName,
      billed: 0,
      collected: 0,
      due: 0,
    });
  }

  for (const inv of invoices) {
    const cId = inv.student?.currentClassId;
    if (cId && classStatsMap.has(cId)) {
      const stat = classStatsMap.get(cId)!;
      stat.billed += parseFloat(inv.netAmount || "0");
      stat.collected += parseFloat(inv.paidAmount || "0");
      stat.due += parseFloat(inv.balanceAmount || "0");
    }
  }

  const classStats = Array.from(classStatsMap.values()).filter(
    (s) => s.billed > 0 || s.collected > 0
  );

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="analytics" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <BarChart3 className="w-3.5 h-3.5" /> Intelligence & Analytics
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Fees Analytics & Real-Time Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Real-time collection velocity, outstanding aging balances, and multi-mode payment distribution across academic divisions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/school/collect-fees"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <CreditCard className="w-4 h-4" /> Collect Fees
          </Link>
          <Link
            href="/school/due-fees"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-800 dark:text-slate-200 text-xs font-semibold transition"
          >
            <Clock className="w-4 h-4" /> Due Ledger
          </Link>
        </div>
      </div>

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Total Invoiced Demand
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
              ₹{totalBilled.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Across {invoices.length} invoices generated
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Total Collections Realized
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              ₹{totalCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold mt-0.5">
              {collectionRate}% Overall Collection Rate
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Total Outstanding Dues
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
              ₹{totalDues.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Unpaid student balance
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Realized Payments Count
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
              {payments.length}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Successful transactions logged
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Mode Distribution Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Payment Mode Volume
            </h3>
          </div>

          <div className="space-y-3">
            {Object.entries(modeMap).map(([mode, amt]) => {
              const pct = totalCollected > 0 ? Math.round((amt / totalCollected) * 100) : 0;
              return (
                <div key={mode} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-gray-700 dark:text-slate-300">
                      {mode}
                    </span>
                    <span className="font-mono text-gray-900 dark:text-white font-bold">
                      ₹{amt.toLocaleString("en-IN")} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Class-wise Collection Performance Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Division Collection Velocity
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Class-wise billed demand versus actual collections received.
            </p>
          </div>

          <div className="overflow-x-auto flex-1">
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
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-slate-200">
                {classStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 dark:text-slate-400">
                      No invoices currently assigned to classes.
                    </td>
                  </tr>
                ) : (
                  classStats.map((stat, i) => {
                    const rate =
                      stat.billed > 0 ? Math.round((stat.collected / stat.billed) * 100) : 0;
                    return (
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
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              rate >= 80
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : rate >= 50
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                            }`}
                          >
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
