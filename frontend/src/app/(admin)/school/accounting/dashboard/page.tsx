export const dynamic = "force-dynamic";

import { db } from "@/db";
import {
  bankAccounts,
  incomeVouchers,
  expenseVouchers,
  accountLedgerTransactions,
  feePayments,
  schools,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import {
  AccountsDashboardClient,
  PendingExpenseItem,
  BankVaultItem,
  LedgerJournalItem,
} from "./AccountsDashboardClient";
import { BookOpen } from "lucide-react";

export default async function AccountsDashboardPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  // 1. Fetch Active School, Banks, Incomes, Expenses, and Ledger Transactions
  const [
    activeSchool,
    banks,
    incomes,
    approvedExpenses,
    pendingExpensesRaw,
    feeCollections,
    ledgerEntries,
  ] = await Promise.all([
    db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    }),
    db.query.bankAccounts.findMany({
      where: eq(bankAccounts.schoolId, schoolId),
      orderBy: [desc(bankAccounts.createdAt)],
    }),
    db.query.incomeVouchers.findMany({
      where: eq(incomeVouchers.schoolId, schoolId),
    }),
    db.query.expenseVouchers.findMany({
      where: and(
        eq(expenseVouchers.schoolId, schoolId),
        eq(expenseVouchers.status, "APPROVED")
      ),
    }),
    db.query.expenseVouchers.findMany({
      where: and(
        eq(expenseVouchers.schoolId, schoolId),
        eq(expenseVouchers.status, "PENDING")
      ),
      with: {
        expenseHead: true,
      },
      orderBy: [desc(expenseVouchers.entryDate)],
      limit: 25,
    }),
    db.query.feePayments.findMany({
      where: eq(feePayments.schoolId, schoolId),
    }),
    db.query.accountLedgerTransactions.findMany({
      where: eq(accountLedgerTransactions.schoolId, schoolId),
      with: {
        bankAccount: true,
        createdBy: true,
      },
      orderBy: [desc(accountLedgerTransactions.transactionDate)],
      limit: 50,
    }),
  ]);

  if (!activeSchool) return <div>School not found</div>;

  // Calculations
  const totalFeeInflow = feeCollections.reduce(
    (sum, f) => sum + parseFloat(f.amountPaid || "0"),
    0
  );
  const totalNonFeeInflow = incomes.reduce(
    (sum, inc) => sum + parseFloat(inc.amount || "0"),
    0
  );
  const totalInflow = totalFeeInflow + totalNonFeeInflow;

  const totalOutflow = approvedExpenses.reduce(
    (sum, exp) => sum + parseFloat(exp.amount || "0"),
    0
  );

  const netCashFlow = totalInflow - totalOutflow;

  const totalTreasury = banks.reduce(
    (sum, b) => sum + parseFloat(b.currentBalance || "0"),
    0
  );

  const pendingExpensesTotal = pendingExpensesRaw.reduce(
    (sum, v) => sum + parseFloat(v.amount || "0"),
    0
  );

  const pendingExpenses: PendingExpenseItem[] = pendingExpensesRaw.map((v) => ({
    id: v.id,
    voucherNumber: v.voucherNumber,
    expenseHeadName: v.expenseHead?.name || "Operational Expense",
    vendorName: v.vendorName || undefined,
    amount: parseFloat(v.amount || "0"),
    paymentMode: v.paymentMode,
    entryDate: v.entryDate.toISOString(),
    remarks: v.remarks || undefined,
  }));

  const mappedBanks: BankVaultItem[] = banks.map((b) => ({
    id: b.id,
    bankName: b.bankName,
    accountNumber: b.accountNumber,
    currentBalance: parseFloat(b.currentBalance || "0"),
    branchName: b.branchName || undefined,
    isActive: b.isActive,
  }));

  const mappedLedger: LedgerJournalItem[] = ledgerEntries.map((e) => ({
    id: e.id,
    transactionNumber: e.transactionNumber,
    transactionType: e.transactionType,
    sourceType: e.sourceType,
    amount: parseFloat(e.amount || "0"),
    balanceAfter: e.balanceAfter || undefined,
    description: e.description || undefined,
    transactionDate: e.transactionDate.toISOString(),
    bankName: e.bankAccount?.bankName || undefined,
  }));

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="accounts" />

      {/* Header Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <BookOpen className="w-3.5 h-3.5" /> Treasury & General Ledger
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Accounts & Financial Statement Hub
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Institutional liquidity, non-fee revenue streams, voucher disbursements, and real-time bank vault balances.
          </p>
        </div>

        <QuickActionBar userRole={session.user.role} />
      </div>

      {/* Interactive Accounts Dashboard Client */}
      <AccountsDashboardClient
        totalTreasury={totalTreasury}
        totalInflow={totalInflow}
        totalFeeInflow={totalFeeInflow}
        totalNonFeeInflow={totalNonFeeInflow}
        totalOutflow={totalOutflow}
        netCashFlow={netCashFlow}
        pendingExpensesCount={pendingExpensesRaw.length}
        pendingExpensesTotal={pendingExpensesTotal}
        pendingExpenses={pendingExpenses}
        banks={mappedBanks}
        ledgerEntries={mappedLedger}
        userRole={session.user.role}
      />
    </div>
  );
}
