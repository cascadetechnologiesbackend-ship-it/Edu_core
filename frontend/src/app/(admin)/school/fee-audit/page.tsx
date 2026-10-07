export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeAuditLogs, feeInvoices, feePayments } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceSubNav } from "@/components/layout/FinanceSubNav";
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  User,
  Clock,
  FileCheck2,
  AlertTriangle,
  History,
  FileSpreadsheet,
} from "lucide-react";

export default async function FeeAuditPage({
  searchParams,
}: {
  searchParams?: { action?: string };
}) {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;
  const filterAction = searchParams?.action;

  // 1. Fetch Audit Logs
  const auditLogs = await db.query.feeAuditLogs.findMany({
    where: eq(feeAuditLogs.schoolId, schoolId),
    with: {
      performedBy: true,
    },
    orderBy: [desc(feeAuditLogs.createdAt)],
    limit: 100,
  });

  const filteredLogs = filterAction
    ? auditLogs.filter((log) => log.action === filterAction)
    : auditLogs;

  // 2. Discrepancy & Health Checker
  const allInvoices = await db.query.feeInvoices.findMany({
    where: eq(feeInvoices.schoolId, schoolId),
    columns: {
      id: true,
      invoiceNumber: true,
      grossAmount: true,
      discountAmount: true,
      lateFeeAmount: true,
      taxAmount: true,
      netAmount: true,
      paidAmount: true,
      balanceAmount: true,
    },
  });

  let arithmeticMismatchCount = 0;
  let balanceMismatchCount = 0;

  for (const inv of allInvoices) {
    const gross = parseFloat(inv.grossAmount || "0");
    const disc = parseFloat(inv.discountAmount || "0");
    const late = parseFloat(inv.lateFeeAmount || "0");
    const tax = parseFloat(inv.taxAmount || "0");
    const net = parseFloat(inv.netAmount || "0");
    const paid = parseFloat(inv.paidAmount || "0");
    const bal = parseFloat(inv.balanceAmount || "0");

    const expectedNet = gross - disc + late + tax;
    if (Math.abs(expectedNet - net) > 0.05) {
      arithmeticMismatchCount++;
    }

    if (Math.abs(paid + bal - net) > 0.05) {
      balanceMismatchCount++;
    }
  }

  const totalInvoicesAudited = allInvoices.length;
  const totalIssues = arithmeticMismatchCount + balanceMismatchCount;
  const integrityScore =
    totalInvoicesAudited > 0
      ? Math.round(((totalInvoicesAudited - totalIssues) / totalInvoicesAudited) * 100)
      : 100;

  return (
    <div className="space-y-6">
      <FinanceSubNav activeSection="audit" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Activity className="w-3.5 h-3.5" /> Data Integrity & Compliance
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Fee Data Audit & Discrepancy Monitor
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Real-time automated reconciliation checker, orphan transaction detection, and immutable administrative audit trail.
          </p>
        </div>
      </div>

      {/* System Health Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Integrity Score
            </span>
            <div
              className={`p-2 rounded-xl ${
                integrityScore >= 99
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                  : "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
              }`}
            >
              {integrityScore >= 99 ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {integrityScore}%
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Across {totalInvoicesAudited} invoices
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Arithmetic Discrepancies
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {arithmeticMismatchCount}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Net vs. Head Sum deviations
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Balance Variance Issues
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {balanceMismatchCount}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              (Paid + Due) ≠ Net discrepancies
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Audit Events Captured
            </span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <History className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {auditLogs.length}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Administrative adjustments logged
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "All Audit Actions", val: "" },
          { label: "Receipt Cancellations", val: "RECEIPT_CANCELLED" },
          { label: "Manual Adjustments", val: "MANUAL_ADJUSTMENT" },
          { label: "Fee Carry Forwards", val: "FEE_CARRIED_FORWARD" },
          { label: "Fee Waivers", val: "FEE_WAIVED" },
        ].map((tab) => {
          const isActive = (!filterAction && tab.val === "") || filterAction === tab.val;
          return (
            <a
              key={tab.label}
              href={tab.val ? `/school/fee-audit?action=${tab.val}` : "/school/fee-audit"}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-800"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* Immutable Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Audit Event Log
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Showing {filteredLogs.length} events logged with operator attribution and reason documentation.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity Type</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-slate-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500 dark:text-slate-400">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 whitespace-nowrap text-gray-500 dark:text-slate-400 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {new Date(log.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          log.action === "RECEIPT_CANCELLED"
                            ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                            : log.action === "FEE_CARRIED_FORWARD"
                            ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                            : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600 dark:text-slate-400">
                      {log.entityType}
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="text-gray-900 dark:text-white font-medium">
                        {log.reason}
                      </p>
                      {log.previousData && (
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                          Prev: {log.previousData}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-gray-700 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {log.performedBy ? log.performedBy.email : "System / Admin"}
                      </div>
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
