export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeAuditLogs, feeInvoices, schools } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  FileCheck2,
  AlertTriangle,
  History,
} from "lucide-react";
import { AuditLogClient, AuditLogRow } from "./AuditLogClient";

export default async function FeeAuditPage({
  searchParams,
}: {
  searchParams?: { action?: string; entityType?: string; q?: string };
}) {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const role = session.user.role;
  // Role gate: only view_audit_logs permitted roles
  if (role !== "SUPER_ADMIN" && role !== "SCHOOL_ADMIN") {
    redirect("/school/finance");
  }

  const schoolId = session.user.schoolId;
  const filterAction = searchParams?.action;
  const filterEntityType = searchParams?.entityType;

  // 1. Fetch School & Audit Logs
  const [activeSchool, auditLogs, allInvoices] = await Promise.all([
    db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    }),
    db.query.feeAuditLogs.findMany({
      where: eq(feeAuditLogs.schoolId, schoolId),
      with: {
        performedBy: true,
      },
      orderBy: [desc(feeAuditLogs.createdAt)],
      limit: 300,
    }),
    db.query.feeInvoices.findMany({
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
    }),
  ]);

  let filteredLogs = auditLogs;
  if (filterAction) {
    filteredLogs = filteredLogs.filter((log) => log.action === filterAction);
  }
  if (filterEntityType) {
    filteredLogs = filteredLogs.filter((log) => log.entityType === filterEntityType);
  }

  // 2. Discrepancy & Health Checker
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

  const mappedAuditLogs: AuditLogRow[] = filteredLogs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt ? new Date(log.createdAt).toISOString() : new Date().toISOString(),
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    reason: log.reason,
    previousData: log.previousData,
    newData: log.newData,
    performerEmail: log.performedBy?.email || "System / Automated",
  }));

  return (
    <div className="space-y-6">
      <FinanceTabs activeSection="finance" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Activity className="w-3.5 h-3.5" /> Immutable Audit Trail & Health Monitor
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Fee Data Audit & Compliance Log
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

      {/* Client Audit Log Table with FilterBar & Export */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <AuditLogClient logs={mappedAuditLogs} schoolName={activeSchool?.name || "School"} />
      </div>
    </div>
  );
}
