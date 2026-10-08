export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeRefunds, bankAccounts, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import { RefundsClient, RefundRow, BankAccountOption } from "./RefundsClient";
import { decryptData } from "@/lib/encryption";
import { RotateCcw } from "lucide-react";

export default async function FeeRefundsPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;
  const userRole = session.user.role || "ACCOUNTANT";

  // Fetch refunds and active bank accounts
  const [allRefunds, schoolBanks, approverUsers] = await Promise.all([
    db.query.feeRefunds.findMany({
      where: eq(feeRefunds.schoolId, schoolId),
      with: {
        payment: {
          with: {
            student: true,
            invoice: true,
          },
        },
      },
      orderBy: [desc(feeRefunds.createdAt)],
      limit: 150,
    }),
    db.query.bankAccounts.findMany({
      where: eq(bankAccounts.schoolId, schoolId),
      orderBy: [desc(bankAccounts.isActive), desc(bankAccounts.currentBalance)],
    }),
    db.query.users.findMany({
      where: eq(users.schoolId, schoolId),
      columns: {
        id: true,
        email: true,
      },
    }),
  ]);

  const approverMap = new Map(approverUsers.map((u) => [u.id, u.email]));

  const mappedRefunds: RefundRow[] = allRefunds.map((r) => {
    const student = r.payment?.student;
    const studentName = student
      ? `${decryptData(student.firstNameEncrypted) || ""} ${decryptData(student.lastNameEncrypted) || ""}`.trim()
      : "Unknown Student";

    return {
      id: r.id,
      receiptNumber: r.payment?.receiptNumber || "N/A",
      invoiceNumber: r.payment?.invoice?.invoiceNumber || "N/A",
      studentName,
      admissionNumber: student?.admissionNumber || "N/A",
      className: "Enrolled",
      refundAmount: parseFloat(r.refundAmount || "0"),
      originalAmountPaid: parseFloat(r.payment?.amountPaid || "0"),
      reason: r.reason,
      status: r.status as any,
      approvedByName: r.approvedById ? approverMap.get(r.approvedById) : undefined,
      approvedAt: r.approvedAt ? r.approvedAt.toISOString() : undefined,
      processedAt: r.processedAt ? r.processedAt.toISOString() : undefined,
      createdAt: r.createdAt.toISOString(),
    };
  });

  const mappedBanks: BankAccountOption[] = schoolBanks
    .filter((b) => b.isActive)
    .map((b) => ({
      id: b.id,
      bankName: b.bankName,
      accountName: b.accountName,
      accountNumber: b.accountNumber,
      currentBalance: b.currentBalance,
    }));

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="finance" />

      {/* Header Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <RotateCcw className="w-3.5 h-3.5" /> Tier-2 Receivables Reversal
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Fee Refunds & Reversals Workbench
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Initiate, approve, and disburse official fee refunds with automatic general ledger reversals and student invoice restorations.
          </p>
        </div>

        <QuickActionBar userRole={userRole} />
      </div>

      {/* Interactive Refunds Workbench */}
      <RefundsClient
        refunds={mappedRefunds}
        bankAccounts={mappedBanks}
        userRole={userRole}
      />
    </div>
  );
}
