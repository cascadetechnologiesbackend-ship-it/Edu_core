"use server";

import { db } from "@/db";
import { bankAccounts, accountLedgerTransactions, chartOfAccounts } from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import { revalidatePath } from "next/cache";
import {
  assertAcademicYearNotLocked,
  getBankAccountChartAccountId,
  getCashMainChartAccountId,
} from "@schoolmitra/backend/lib/chartOfAccountsEngine";
import crypto from "crypto";

export interface JournalVoucherListItem {
  id: string;
  transactionNumber: string;
  sourceType: string;
  transactionType: string;
  amount: string;
  debitAccountName: string;
  debitAccountCode: string;
  creditAccountName: string;
  creditAccountCode: string;
  description: string | null;
  transactionDate: string;
}

export interface JVRowInput {
  accountId: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
}

/**
 * Fetches existing Journal Vouchers and Contra entries from the ledger.
 * RBAC: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, PRINCIPAL
 */
export async function getJournalVouchersAction(filters?: {
  sourceType?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const conditions = [
      eq(accountLedgerTransactions.schoolId, school.id),
      inArray(accountLedgerTransactions.sourceType, ["CONTRA", "JOURNAL_VOUCHER", "BRS_ADJUSTMENT", "MANUAL_ADJUSTMENT"]),
    ];

    if (filters?.sourceType && filters.sourceType !== "ALL") {
      conditions.push(eq(accountLedgerTransactions.sourceType, filters.sourceType));
    }

    const txs = await db.query.accountLedgerTransactions.findMany({
      where: and(...conditions),
      orderBy: [desc(accountLedgerTransactions.transactionDate), desc(accountLedgerTransactions.createdAt)],
      with: {
        debitAccount: true,
        creditAccount: true,
      },
      limit: 200,
    });

    const items: JournalVoucherListItem[] = txs.map((tx) => ({
      id: tx.id,
      transactionNumber: tx.transactionNumber,
      sourceType: tx.sourceType,
      transactionType: tx.transactionType,
      amount: tx.amount,
      debitAccountName: tx.debitAccount?.name || "Unassigned Debit",
      debitAccountCode: tx.debitAccount?.code || "N/A",
      creditAccountName: tx.creditAccount?.name || "Unassigned Credit",
      creditAccountCode: tx.creditAccount?.code || "N/A",
      description: tx.description,
      transactionDate: tx.transactionDate.toISOString(),
    }));

    return {
      success: true,
      items,
      userRole: ctx.role,
    };
  } catch (error: any) {
    console.error("getJournalVouchersAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to load journal vouchers",
      items: [],
      userRole: "ACCOUNTANT",
    };
  }
}

/**
 * Fetches available Chart of Accounts and Bank Accounts for JV entry forms.
 * RBAC: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, PRINCIPAL
 */
export async function getChartOfAccountsForJVAction() {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const accounts = await db.query.chartOfAccounts.findMany({
      where: and(eq(chartOfAccounts.schoolId, school.id), eq(chartOfAccounts.isActive, true)),
      orderBy: [chartOfAccounts.code],
    });

    const banks = await db.query.bankAccounts.findMany({
      where: and(eq(bankAccounts.schoolId, school.id), eq(bankAccounts.isActive, true)),
      orderBy: [bankAccounts.bankName],
    });

    return {
      success: true,
      accounts: accounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
      })),
      bankAccounts: banks.map((b) => ({
        id: b.id,
        bankName: b.bankName,
        accountName: b.accountName,
        accountNumber: b.accountNumber,
        currentBalance: b.currentBalance,
      })),
      userRole: ctx.role,
    };
  } catch (error: any) {
    console.error("getChartOfAccountsForJVAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to load accounts",
      accounts: [],
      bankAccounts: [],
      userRole: "ACCOUNTANT",
    };
  }
}

/**
 * Creates a Contra Entry (Cash-to-Bank, Bank-to-Cash, Bank-to-Bank).
 * HARD CONSTRAINT: Enforces assertAcademicYearNotLocked.
 * HARD CONSTRAINT: RBAC: SUPER_ADMIN, SCHOOL_ADMIN (ACCOUNTANT gets 403).
 */
export async function createContraEntryAction(params: {
  transferType: "CASH_TO_BANK" | "BANK_TO_CASH" | "BANK_TO_BANK";
  fromBankAccountId?: string | undefined;
  toBankAccountId?: string | undefined;
  amount: number;
  entryDate?: string | undefined;
  description: string;
}) {
  try {
    // RBAC: Admins only
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    if (isNaN(params.amount) || params.amount <= 0) {
      throw new Error("Amount must be a positive number.");
    }

    const entryDate = params.entryDate ? new Date(params.entryDate) : new Date();

    // HARD CONSTRAINT: Assert academic year is not locked
    await assertAcademicYearNotLocked(school.id, entryDate, db);

    const randSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const voucherNumber = `CONTRA-${Date.now().toString().slice(-6)}-${randSuffix}`;

    const cashChartId = await getCashMainChartAccountId(school.id, db);
    let debitChartId = "";
    let creditChartId = "";
    let affectedBankId: string | null = null;

    if (params.transferType === "CASH_TO_BANK") {
      if (!params.toBankAccountId) throw new Error("Destination bank account is required.");
      const toBank = await db.query.bankAccounts.findFirst({
        where: and(eq(bankAccounts.id, params.toBankAccountId), eq(bankAccounts.schoolId, school.id)),
      });
      if (!toBank) throw new Error("Destination bank account not found.");

      debitChartId = await getBankAccountChartAccountId(school.id, toBank.id, db);
      creditChartId = cashChartId;
      affectedBankId = toBank.id;

      await db.transaction(async (tx) => {
        // Increment destination bank balance
        await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} + ${params.amount.toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, toBank.id));

        // Post ledger transaction (Debit Bank 1010, Credit Cash 1000)
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: voucherNumber,
          sourceType: "CONTRA",
          sourceId: toBank.id,
          bankAccountId: toBank.id,
          debitAccountId: debitChartId,
          creditAccountId: creditChartId,
          transactionType: "CREDIT", // Asset bank increased
          amount: params.amount.toFixed(2),
          description: `Contra Deposit: Cash deposited into ${toBank.bankName} (${toBank.accountNumber.slice(-4)}). ${params.description}`,
          transactionDate: entryDate,
          createdById: ctx.userId,
        });

        await logFeeAuditEvent(tx, {
          schoolId: school.id,
          action: "CREATE_CONTRA_ENTRY",
          entityType: "CONTRA_VOUCHER",
          entityId: toBank.id,
          newData: {
            voucherNumber,
            type: params.transferType,
            amount: params.amount.toFixed(2),
            toBank: toBank.bankName,
          },
          reason: params.description,
          performedById: ctx.userId,
        });
      });
    } else if (params.transferType === "BANK_TO_CASH") {
      if (!params.fromBankAccountId) throw new Error("Source bank account is required.");
      const fromBank = await db.query.bankAccounts.findFirst({
        where: and(eq(bankAccounts.id, params.fromBankAccountId), eq(bankAccounts.schoolId, school.id)),
      });
      if (!fromBank) throw new Error("Source bank account not found.");

      if (parseFloat(fromBank.currentBalance) < params.amount) {
        throw new Error(`Insufficient funds in bank account (Available: ₹${fromBank.currentBalance}).`);
      }

      debitChartId = cashChartId;
      creditChartId = await getBankAccountChartAccountId(school.id, fromBank.id, db);
      affectedBankId = fromBank.id;

      await db.transaction(async (tx) => {
        // Decrement source bank balance
        await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} - ${params.amount.toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, fromBank.id));

        // Post ledger transaction (Debit Cash 1000, Credit Bank 1010)
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: voucherNumber,
          sourceType: "CONTRA",
          sourceId: fromBank.id,
          bankAccountId: fromBank.id,
          debitAccountId: debitChartId,
          creditAccountId: creditChartId,
          transactionType: "DEBIT", // Asset bank decreased
          amount: params.amount.toFixed(2),
          description: `Contra Withdrawal: Cash withdrawn from ${fromBank.bankName} (${fromBank.accountNumber.slice(-4)}). ${params.description}`,
          transactionDate: entryDate,
          createdById: ctx.userId,
        });

        await logFeeAuditEvent(tx, {
          schoolId: school.id,
          action: "CREATE_CONTRA_ENTRY",
          entityType: "CONTRA_VOUCHER",
          entityId: fromBank.id,
          newData: {
            voucherNumber,
            type: params.transferType,
            amount: params.amount.toFixed(2),
            fromBank: fromBank.bankName,
          },
          reason: params.description,
          performedById: ctx.userId,
        });
      });
    } else {
      // BANK_TO_BANK
      if (!params.fromBankAccountId || !params.toBankAccountId) {
        throw new Error("Both source and destination bank accounts are required.");
      }
      if (params.fromBankAccountId === params.toBankAccountId) {
        throw new Error("Source and destination bank accounts must be different.");
      }

      const fromBank = await db.query.bankAccounts.findFirst({
        where: and(eq(bankAccounts.id, params.fromBankAccountId), eq(bankAccounts.schoolId, school.id)),
      });
      const toBank = await db.query.bankAccounts.findFirst({
        where: and(eq(bankAccounts.id, params.toBankAccountId), eq(bankAccounts.schoolId, school.id)),
      });
      if (!fromBank || !toBank) throw new Error("Bank account not found.");

      if (parseFloat(fromBank.currentBalance) < params.amount) {
        throw new Error(`Insufficient funds in source account (Available: ₹${fromBank.currentBalance}).`);
      }

      debitChartId = await getBankAccountChartAccountId(school.id, toBank.id, db);
      creditChartId = await getBankAccountChartAccountId(school.id, fromBank.id, db);

      await db.transaction(async (tx) => {
        // Decrement source bank
        await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} - ${params.amount.toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, fromBank.id));

        // Increment destination bank
        await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} + ${params.amount.toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, toBank.id));

        // Post inter-bank ledger transfer
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: voucherNumber,
          sourceType: "CONTRA",
          sourceId: fromBank.id,
          bankAccountId: fromBank.id,
          debitAccountId: debitChartId,
          creditAccountId: creditChartId,
          transactionType: "DEBIT",
          amount: params.amount.toFixed(2),
          description: `Contra Inter-Bank: Transfer from ${fromBank.bankName} to ${toBank.bankName}. ${params.description}`,
          transactionDate: entryDate,
          createdById: ctx.userId,
        });

        await logFeeAuditEvent(tx, {
          schoolId: school.id,
          action: "CREATE_CONTRA_ENTRY",
          entityType: "CONTRA_VOUCHER",
          entityId: fromBank.id,
          newData: {
            voucherNumber,
            type: params.transferType,
            amount: params.amount.toFixed(2),
            from: fromBank.bankName,
            to: toBank.bankName,
          },
          reason: params.description,
          performedById: ctx.userId,
        });
      });
    }

    revalidatePath("/school/accounts/journal-vouchers");
    revalidatePath("/school/accounts/bank-accounts");
    revalidatePath("/school/accounting/dashboard");
    revalidatePath("/school/accounting/reports/trial-balance");

    return {
      success: true,
      voucherNumber,
      message: `Contra entry ${voucherNumber} posted successfully.`,
    };
  } catch (error: any) {
    console.error("createContraEntryAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to create Contra entry",
    };
  }
}

/**
 * Creates a multi-row General Journal Voucher.
 * HARD CONSTRAINT: Validates that sum(Debits) === sum(Credits).
 * HARD CONSTRAINT: Enforces assertAcademicYearNotLocked.
 * HARD CONSTRAINT: RBAC: SUPER_ADMIN, SCHOOL_ADMIN (ACCOUNTANT receives 403).
 */
export async function createGeneralJournalVoucherAction(params: {
  entries: JVRowInput[];
  entryDate?: string | undefined;
  description: string;
}) {
  try {
    // RBAC: Admins only
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    if (!params.entries || params.entries.length < 2) {
      throw new Error("Journal voucher requires at least two account entries.");
    }

    // Tally debits and credits
    let totalDebits = 0;
    let totalCredits = 0;

    for (const row of params.entries) {
      if (isNaN(row.amount) || row.amount <= 0) {
        throw new Error("All entry rows must have an amount greater than zero.");
      }
      if (row.type === "DEBIT") totalDebits += row.amount;
      else if (row.type === "CREDIT") totalCredits += row.amount;
      else throw new Error("Entry row type must be DEBIT or CREDIT.");
    }

    // Invariant check: sum(Debits) === sum(Credits) to 2 decimal places
    const diff = Math.abs(totalDebits - totalCredits);
    if (diff > 0.01) {
      throw new Error(
        `Journal voucher must be balanced: Total Debits (₹${totalDebits.toFixed(2)}) does not match Total Credits (₹${totalCredits.toFixed(2)}). Discrepancy: ₹${diff.toFixed(2)}.`,
      );
    }

    const entryDate = params.entryDate ? new Date(params.entryDate) : new Date();

    // HARD CONSTRAINT: Assert academic year not locked
    await assertAcademicYearNotLocked(school.id, entryDate, db);

    const randSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const voucherNumber = `JV-${Date.now().toString().slice(-6)}-${randSuffix}`;

    // Separate debits and credits
    const debitEntries = params.entries.filter((e) => e.type === "DEBIT");
    const creditEntries = params.entries.filter((e) => e.type === "CREDIT");

    await db.transaction(async (tx) => {
      // Pair debits with credits or post balanced ledger entries
      // In double entry: debit entries debit the specified account and credit the primary credit account
      const primaryCreditAccountId = creditEntries[0]?.accountId || "";
      const primaryDebitAccountId = debitEntries[0]?.accountId || "";

      let lineIdx = 1;
      for (const deb of debitEntries) {
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: `${voucherNumber}-${lineIdx++}`,
          sourceType: "JOURNAL_VOUCHER",
          debitAccountId: deb.accountId,
          creditAccountId: primaryCreditAccountId,
          transactionType: "DEBIT",
          amount: deb.amount.toFixed(2),
          description: `JV ${voucherNumber}: ${params.description}`,
          transactionDate: entryDate,
          createdById: ctx.userId,
        });
      }

      for (const cred of creditEntries) {
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: `${voucherNumber}-${lineIdx++}`,
          sourceType: "JOURNAL_VOUCHER",
          debitAccountId: primaryDebitAccountId,
          creditAccountId: cred.accountId,
          transactionType: "CREDIT",
          amount: cred.amount.toFixed(2),
          description: `JV ${voucherNumber}: ${params.description}`,
          transactionDate: entryDate,
          createdById: ctx.userId,
        });
      }

      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "CREATE_JOURNAL_VOUCHER",
        entityType: "JOURNAL_VOUCHER",
        entityId: school.id,
        newData: {
          voucherNumber,
          totalAmount: totalDebits.toFixed(2),
          entriesCount: params.entries.length,
          description: params.description,
        },
        reason: params.description,
        performedById: ctx.userId,
      });
    });

    revalidatePath("/school/accounts/journal-vouchers");
    revalidatePath("/school/accounting/dashboard");
    revalidatePath("/school/accounting/reports/trial-balance");

    return {
      success: true,
      voucherNumber,
      message: `Journal voucher ${voucherNumber} (₹${totalDebits.toFixed(2)}) posted successfully.`,
    };
  } catch (error: any) {
    console.error("createGeneralJournalVoucherAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to create general journal voucher",
    };
  }
}
