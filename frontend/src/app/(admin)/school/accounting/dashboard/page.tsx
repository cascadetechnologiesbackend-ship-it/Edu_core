export const dynamic = "force-dynamic";

import { db } from "@/db";
import {
  bankAccounts,
  expenseVouchers,
  accountLedgerTransactions,
  schools,
} from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
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
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { getCachedFinanceData, setCachedFinanceData } from "@/lib/financeCache";

interface CachedAccountsSummary {
  totalFeeInflow: number;
  totalNonFeeInflow: number;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  totalTreasury: number;
  mappedBanks: BankVaultItem[];
  asOf: string;
}

export default async function AccountsDashboardPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const data = await withDataPhaseTiming("/school/accounting/dashboard", async () => {
    return assertQueryBudget(
      async () => {
        // Check S2 cache for account balance & cash position snapshot (PF-R41 / PF-R45)
        const cachedSummary = await getCachedFinanceData<CachedAccountsSummary>(
          schoolId,
          "accounts_dashboard_summary"
        );

        if (cachedSummary) {
          // Warm cache: fetch only school master, pending expense approvals, and recent ledger entries (3 queries <= 5 budget)
          const [activeSchool, pendingExpensesRaw, ledgerEntries] = await Promise.all([
            db.query.schools.findFirst({
              where: eq(schools.id, schoolId),
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

          if (!activeSchool) return null;

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

          return {
            activeSchool,
            summary: cachedSummary,
            pendingExpenses,
            pendingExpensesTotal,
            pendingExpensesCount: pendingExpensesRaw.length,
            mappedLedger,
          };
        }

        // Cold cache miss: Consolidated parallel fetch within 5 queries budget
        // 1. School master
        // 2. Bank accounts
        // 3. Consolidated single-query aggregation for Fees, Incomes, and Approved Expenses
        // 4. Pending expense vouchers (limit 25)
        // 5. Recent ledger journal entries (limit 50)
        const [
          activeSchool,
          banks,
          totalsResult,
          pendingExpensesRaw,
          ledgerEntries,
        ] = await Promise.all([
          db.query.schools.findFirst({
            where: eq(schools.id, schoolId),
          }),
          db.query.bankAccounts.findMany({
            where: eq(bankAccounts.schoolId, schoolId),
            orderBy: [desc(bankAccounts.createdAt)],
          }),
          db.execute<{
            total_incomes: string;
            total_approved_expenses: string;
            total_fees: string;
          }>(sql`
            SELECT 
              (SELECT COALESCE(SUM(CAST(amount AS numeric)), 0) FROM income_vouchers WHERE school_id = ${schoolId}) AS total_incomes,
              (SELECT COALESCE(SUM(CAST(amount AS numeric)), 0) FROM expense_vouchers WHERE school_id = ${schoolId} AND status = 'APPROVED') AS total_approved_expenses,
              (SELECT COALESCE(SUM(CAST(amount_paid AS numeric)), 0) FROM fee_payments WHERE school_id = ${schoolId}) AS total_fees
          `),
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

        if (!activeSchool) return null;

        const totalsRow = (totalsResult as any).rows?.[0] || (totalsResult as any)[0] || {};
        const totalFeeInflow = parseFloat(totalsRow.total_fees || "0");
        const totalNonFeeInflow = parseFloat(totalsRow.total_incomes || "0");
        const totalInflow = totalFeeInflow + totalNonFeeInflow;
        const totalOutflow = parseFloat(totalsRow.total_approved_expenses || "0");
        const netCashFlow = totalInflow - totalOutflow;

        const totalTreasury = banks.reduce(
          (sum, b) => sum + parseFloat(b.currentBalance || "0"),
          0
        );

        const mappedBanks: BankVaultItem[] = banks.map((b) => ({
          id: b.id,
          bankName: b.bankName,
          accountNumber: b.accountNumber,
          currentBalance: parseFloat(b.currentBalance || "0"),
          branchName: b.branchName || undefined,
          isActive: b.isActive,
        }));

        const asOf = new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const summary: CachedAccountsSummary = {
          totalFeeInflow,
          totalNonFeeInflow,
          totalInflow,
          totalOutflow,
          netCashFlow,
          totalTreasury,
          mappedBanks,
          asOf,
        };

        // Cache summary in S2 with tag invalidation sets
        await setCachedFinanceData(schoolId, "accounts_dashboard_summary", summary, {
          tags: [`school:${schoolId}`, `fin:accounts:${schoolId}`, `fin:payments:${schoolId}`],
        });

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

        return {
          activeSchool,
          summary,
          pendingExpenses,
          pendingExpensesTotal,
          pendingExpensesCount: pendingExpensesRaw.length,
          mappedLedger,
        };
      },
      { maxQueries: 5, label: "/school/accounting/dashboard" }
    );
  });

  if (!data) return <div>School not found</div>;

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="accounts" />

      {/* Header Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <BookOpen className="w-3.5 h-3.5" /> General Ledger & Treasury
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Institutional Accounts Command Hub
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Real-time cash flow, bank ledger balances, voucher verification, and double-entry trail.
          </p>
        </div>

        <QuickActionBar userRole={session.user.role} />
      </div>

      {/* Main Accounts Dashboard Client Component */}
      <AccountsDashboardClient
        totalTreasury={data.summary.totalTreasury}
        totalInflow={data.summary.totalInflow}
        totalFeeInflow={data.summary.totalFeeInflow}
        totalNonFeeInflow={data.summary.totalNonFeeInflow}
        totalOutflow={data.summary.totalOutflow}
        netCashFlow={data.summary.netCashFlow}
        pendingExpensesCount={data.pendingExpensesCount}
        pendingExpensesTotal={data.pendingExpensesTotal}
        pendingExpenses={data.pendingExpenses}
        banks={data.summary.mappedBanks}
        ledgerEntries={data.mappedLedger}
        userRole={session.user.role}
        asOf={data.summary.asOf}
      />
    </div>
  );
}
