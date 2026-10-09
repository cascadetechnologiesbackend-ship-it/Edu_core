"use server";

import { db } from "@/db";
import { bankAccounts, accountLedgerTransactions, chartOfAccounts } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import { revalidatePath } from "next/cache";
import {
  assertAcademicYearNotLocked,
  getBankAccountChartAccountId,
  getGatewayFeesExpenseChartAccountId,
} from "@schoolmitra/backend/lib/chartOfAccountsEngine";
import crypto from "crypto";
import { getCachedFinanceData, setCachedFinanceData } from "@/lib/financeCache";

export interface BankStatementRowInput {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  refNumber: string;
  withdrawal: number;
  deposit: number;
  balance: number;
}

export interface MatchedResultItem {
  statementRow: BankStatementRowInput;
  status: "MATCHED" | "AMBIGUOUS" | "UNMATCHED";
  matchedTx?: {
    id: string;
    transactionNumber: string;
    amount: string;
    transactionType: string;
    description: string | null;
    transactionDate: string;
  } | undefined;
  suggestions?: {
    id: string;
    transactionNumber: string;
    amount: string;
    transactionType: string;
    description: string | null;
    transactionDate: string;
  }[] | undefined;
}

/**
 * Fetches bank accounts and ledger transaction baseline for BRS.
 * RBAC: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, PRINCIPAL (read-only)
 */
export async function getBankReconciliationDataAction(bankAccountId?: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    let accounts = await getCachedFinanceData<any[]>(school.id, "brs_bank_accounts");
    if (!accounts) {
      accounts = await db.query.bankAccounts.findMany({
        where: and(eq(bankAccounts.schoolId, school.id), eq(bankAccounts.isActive, true)),
        orderBy: [desc(bankAccounts.createdAt)],
      });
      await setCachedFinanceData(school.id, "brs_bank_accounts", accounts, {
        tags: [`school:${school.id}`, `fin:accounts:${school.id}`],
      });
    }

    const activeBankId = bankAccountId || accounts[0]?.id;
    if (!activeBankId) {
      return {
        success: true,
        bankAccounts: accounts,
        selectedAccount: null,
        ledgerTransactions: [],
        adjustingVouchers: [],
        userRole: ctx.role,
      };
    }

    const selectedAccount = accounts.find((a) => a.id === activeBankId) || null;

    const ledgerTransactions = await db.query.accountLedgerTransactions.findMany({
      where: and(
        eq(accountLedgerTransactions.schoolId, school.id),
        eq(accountLedgerTransactions.bankAccountId, activeBankId),
      ),
      orderBy: [desc(accountLedgerTransactions.transactionDate)],
      limit: 150,
    });

    const adjustingVouchers = await db.query.accountLedgerTransactions.findMany({
      where: and(
        eq(accountLedgerTransactions.schoolId, school.id),
        eq(accountLedgerTransactions.bankAccountId, activeBankId),
        eq(accountLedgerTransactions.sourceType, "BRS_ADJUSTMENT"),
      ),
      orderBy: [desc(accountLedgerTransactions.transactionDate)],
      limit: 50,
    });

    return {
      success: true,
      bankAccounts: accounts,
      selectedAccount,
      ledgerTransactions: ledgerTransactions.map((tx) => ({
        id: tx.id,
        transactionNumber: tx.transactionNumber,
        amount: tx.amount,
        transactionType: tx.transactionType,
        sourceType: tx.sourceType,
        description: tx.description,
        transactionDate: tx.transactionDate.toISOString(),
      })),
      adjustingVouchers: adjustingVouchers.map((tx) => ({
        id: tx.id,
        transactionNumber: tx.transactionNumber,
        amount: tx.amount,
        transactionType: tx.transactionType,
        description: tx.description,
        transactionDate: tx.transactionDate.toISOString(),
      })),
      userRole: ctx.role,
    };
  } catch (error: any) {
    console.error("getBankReconciliationDataAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to load reconciliation data",
      bankAccounts: [],
      selectedAccount: null,
      ledgerTransactions: [],
      adjustingVouchers: [],
      userRole: "ACCOUNTANT",
    };
  }
}

/**
 * Matches uploaded statement rows against bank ledger transactions.
 * HARD CONSTRAINT: Ambiguous candidates (same amount + same day) go to a suggestion list, NEVER auto-matched!
 * RBAC: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, PRINCIPAL
 */
export async function matchBankStatementAction(params: {
  bankAccountId: string;
  statementRows: BankStatementRowInput[];
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const bank = await db.query.bankAccounts.findFirst({
      where: and(eq(bankAccounts.id, params.bankAccountId), eq(bankAccounts.schoolId, school.id)),
    });
    if (!bank) throw new Error("Bank account not found.");

    // Fetch ledger transactions for this bank account
    const ledgerTxList = await db.query.accountLedgerTransactions.findMany({
      where: and(
        eq(accountLedgerTransactions.schoolId, school.id),
        eq(accountLedgerTransactions.bankAccountId, params.bankAccountId),
      ),
    });

    const usedTxIds = new Set<string>();
    const results: MatchedResultItem[] = [];

    for (const row of params.statementRows) {
      const rowDateStr = row.date.slice(0, 10);
      const rowAmount = row.withdrawal > 0 ? row.withdrawal : row.deposit;
      const isDeposit = row.deposit > 0;

      // Find candidates with matching date (same calendar day) and matching amount
      const candidates = ledgerTxList.filter((tx) => {
        if (usedTxIds.has(tx.id)) return false;
        const txDateStr = tx.transactionDate.toISOString().slice(0, 10);
        if (txDateStr !== rowDateStr) return false;

        const txAmount = parseFloat(tx.amount);
        if (Math.abs(txAmount - rowAmount) > 0.01) return false;

        // Direction match:
        // Deposit increases bank: in ledger, transactionType === "CREDIT" (collection/income)
        // Withdrawal decreases bank: in ledger, transactionType === "DEBIT" (expense/refund)
        if (isDeposit && tx.transactionType !== "CREDIT") return false;
        if (!isDeposit && tx.transactionType !== "DEBIT") return false;

        return true;
      });

      if (candidates.length === 1 && candidates[0]) {
        // Clean 1-to-1 match
        const matched = candidates[0];
        usedTxIds.add(matched.id);
        results.push({
          statementRow: row,
          status: "MATCHED",
          matchedTx: {
            id: matched.id,
            transactionNumber: matched.transactionNumber,
            amount: matched.amount,
            transactionType: matched.transactionType,
            description: matched.description,
            transactionDate: matched.transactionDate.toISOString(),
          },
        });
      } else if (candidates.length > 1) {
        // AMBIGUOUS CANDIDATES: Same amount + same day -> SUGGESTION LIST ONLY, NEVER AUTO-MATCH
        results.push({
          statementRow: row,
          status: "AMBIGUOUS",
          suggestions: candidates.map((c) => ({
            id: c.id,
            transactionNumber: c.transactionNumber,
            amount: c.amount,
            transactionType: c.transactionType,
            description: c.description,
            transactionDate: c.transactionDate.toISOString(),
          })),
        });
      } else {
        // UNMATCHED STATEMENT ROW
        results.push({
          statementRow: row,
          status: "UNMATCHED",
        });
      }
    }

    const matchedCount = results.filter((r) => r.status === "MATCHED").length;
    const ambiguousCount = results.filter((r) => r.status === "AMBIGUOUS").length;
    const unmatchedCount = results.filter((r) => r.status === "UNMATCHED").length;

    const statementClosingBalance =
      params.statementRows.length > 0
        ? params.statementRows[params.statementRows.length - 1]?.balance ?? 0
        : parseFloat(bank.currentBalance);

    const ledgerBalance = parseFloat(bank.currentBalance);
    const discrepancy = Math.abs(statementClosingBalance - ledgerBalance);

    return {
      success: true,
      results,
      summary: {
        totalRows: params.statementRows.length,
        matchedCount,
        ambiguousCount,
        unmatchedCount,
        statementClosingBalance,
        ledgerBalance,
        discrepancy,
      },
    };
  } catch (error: any) {
    console.error("matchBankStatementAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to perform reconciliation match",
    };
  }
}

/**
 * Creates an Adjusting Journal Voucher for un-reconciled bank charges or bank interest.
 * HARD CONSTRAINT: Adjusting JVs run through assertAcademicYearNotLocked.
 * HARD CONSTRAINT: RBAC: SUPER_ADMIN, SCHOOL_ADMIN (ACCOUNTANT receives 403 / Forbidden).
 */
export async function createAdjustingJournalVoucherAction(params: {
  bankAccountId: string;
  type: "BANK_CHARGES" | "BANK_INTEREST";
  amount: number;
  entryDate?: string | undefined;
  description: string;
  refNumber?: string | undefined;
}) {
  try {
    // RBAC: Admins only (ACCOUNTANT gets 403)
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    if (isNaN(params.amount) || params.amount <= 0) {
      throw new Error("Amount must be a positive number.");
    }

    const entryDate = params.entryDate ? new Date(params.entryDate) : new Date();

    // HARD CONSTRAINT: Assert academic year is not locked
    await assertAcademicYearNotLocked(school.id, entryDate, db);

    const bank = await db.query.bankAccounts.findFirst({
      where: and(eq(bankAccounts.id, params.bankAccountId), eq(bankAccounts.schoolId, school.id)),
    });
    if (!bank) throw new Error("Bank account not found.");

    const bankChartAccountId = await getBankAccountChartAccountId(school.id, bank.id, db);
    const randSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const voucherNumber = `BRS-ADJ-${Date.now().toString().slice(-6)}-${randSuffix}`;

    let debitAccountId = "";
    let creditAccountId = "";
    let txType = "DEBIT";

    if (params.type === "BANK_CHARGES") {
      // Bank Charges: Debit Expense 5200 (Gateway & Bank Charges), Credit Bank 1010
      debitAccountId = await getGatewayFeesExpenseChartAccountId(school.id, db);
      creditAccountId = bankChartAccountId;
      txType = "DEBIT"; // Decrements bank in ledger
    } else {
      // Bank Interest: Debit Bank 1010, Credit Revenue (4010-INTEREST)
      debitAccountId = bankChartAccountId;
      txType = "CREDIT"; // Increments bank in ledger

      // Resolve or create Bank Interest revenue account
      let interestAccount = await db.query.chartOfAccounts.findFirst({
        where: and(
          eq(chartOfAccounts.schoolId, school.id),
          eq(chartOfAccounts.code, "4010-INTEREST"),
        ),
      });
      if (!interestAccount) {
        const [created] = await db
          .insert(chartOfAccounts)
          .values({
            schoolId: school.id,
            code: "4010-INTEREST",
            name: "Bank Interest Income",
            type: "REVENUE",
            parentCode: "4000",
            isSystem: false,
            isActive: true,
          })
          .returning();
        debitAccountId = bankChartAccountId;
        creditAccountId = created?.id || "";
      } else {
        creditAccountId = interestAccount.id;
      }
    }

    let finalBalance = bank.currentBalance;

    await db.transaction(async (tx) => {
      // 1. Update bank balance
      const balanceDelta =
        params.type === "BANK_CHARGES"
          ? -params.amount
          : params.amount;

      const [updatedBank] = await tx
        .update(bankAccounts)
        .set({
          currentBalance: sql`${bankAccounts.currentBalance} + ${balanceDelta.toFixed(2)}`,
          updatedAt: new Date(),
        })
        .where(eq(bankAccounts.id, bank.id))
        .returning();

      if (updatedBank) finalBalance = updatedBank.currentBalance;

      // 2. Insert into account_ledger_transactions
      await tx.insert(accountLedgerTransactions).values({
        schoolId: school.id,
        transactionNumber: voucherNumber,
        sourceType: "BRS_ADJUSTMENT",
        sourceId: bank.id,
        bankAccountId: bank.id,
        debitAccountId,
        creditAccountId,
        transactionType: txType,
        amount: params.amount.toFixed(2),
        balanceAfter: finalBalance,
        description: `BRS Adjusting Voucher: ${params.description} (Ref: ${params.refNumber || "N/A"})`,
        transactionDate: entryDate,
        createdById: ctx.userId,
      });

      // 3. Log uniform audit event
      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "CREATE_BRS_ADJUSTMENT",
        entityType: "LEDGER_TRANSACTION",
        entityId: bank.id,
        newData: {
          voucherNumber,
          type: params.type,
          amount: params.amount.toFixed(2),
          bankAccountId: bank.id,
          finalBalance,
        },
        reason: params.description,
        performedById: ctx.userId,
      });
    });

    revalidatePath("/school/accounts/bank-reconciliation");
    revalidatePath("/school/accounts/bank-accounts");
    revalidatePath("/school/accounting/dashboard");
    revalidatePath("/school/accounting/reports/trial-balance");

    return {
      success: true,
      voucherNumber,
      message: `Adjusting JV ${voucherNumber} posted successfully.`,
    };
  } catch (error: any) {
    console.error("createAdjustingJournalVoucherAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to create adjusting journal voucher.",
    };
  }
}
