export const dynamic = "force-dynamic";

import { db } from "@/db";
import { paymentGatewayLogs, accountLedgerTransactions } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import {
  ReconciliationClient,
  GatewayLogRow,
} from "./ReconciliationClient";
import { DollarSign } from "lucide-react";

export default async function OnlinePaymentsPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [logs, reconciledLedgers] = await Promise.all([
    db.query.paymentGatewayLogs.findMany({
      where: eq(paymentGatewayLogs.schoolId, schoolId),
      with: {
        invoice: true,
      },
      orderBy: [desc(paymentGatewayLogs.createdAt)],
      limit: 200,
    }),
    db.query.accountLedgerTransactions.findMany({
      where: eq(accountLedgerTransactions.schoolId, schoolId),
      columns: {
        sourceId: true,
      },
    }),
  ]);

  const reconciledSet = new Set(reconciledLedgers.map((r) => r.sourceId).filter(Boolean));

  const mappedLogs: GatewayLogRow[] = logs.map((log) => ({
    id: log.id,
    gateway: log.gateway,
    gatewayOrderId: log.gatewayOrderId || undefined,
    gatewayPaymentId: log.gatewayPaymentId || undefined,
    invoiceNumber: log.invoice?.invoiceNumber || undefined,
    amount: parseFloat(log.amount || "0"),
    status: log.status,
    isReconciled: reconciledSet.has(log.id),
    webhookPayload: log.webhookPayload || undefined,
    createdAt: log.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="finance" />

      {/* Header Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-3.5 h-3.5" /> Operations & Reconciliation
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Payment Gateway Reconciliation Queue
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Real-time audit log of Razorpay and online webhook settlements with one-click general ledger posting.
          </p>
        </div>

        <QuickActionBar userRole={session.user.role} />
      </div>

      {/* Interactive Reconciliation Client */}
      <ReconciliationClient logs={mappedLogs} userRole={session.user.role} />
    </div>
  );
}
