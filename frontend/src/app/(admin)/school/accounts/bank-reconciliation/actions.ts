"use server";

import { db, withTenant } from "@/db";
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
  persisted?: boolean;
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

export interface BrsReconciliationCounts {
  reconciled: number;
  unreconciled: number;
  disputed: number;
}

/**
 * Fetches bank accounts, reconciliation counts, and ledger transaction baseline for BRS.
 * RBAC: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, PRINCIPAL (read-only)
 */
export async function getBankReconciliationDataAction(bankAccountId?: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async (tx) => {
      let accounts = await getCachedFinanceData<any[]>(school.id, "brs_bank_accounts");
      if (!accounts) {
        accounts = await tx.query.bankAccounts.findMany({
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
          reconciliationCounts: { reconciled: 0, unreconciled: 0, disputed: 0 },
          userRole: ctx.role,
        };
      }

      const selectedAccount = accounts.find((a) => a.id === activeBankId) || null;

      const [ledgerTransactions, adjustingVouchers, countsRes] = await Promise.all([
        tx.query.accountLedgerTransactions.findMany({
          where: and(
            eq(accountLedgerTransactions.schoolId, school.id),
            eq(accountLedgerTransactions.bankAccountId, activeBankId),
          ),
          orderBy: [desc(accountLedgerTransactions.transactionDate)],
          limit: 150,
        }),
        tx.query.accountLedgerTransactions.findMany({
          where: and(
            eq(accountLedgerTransactions.schoolId, school.id),
            eq(accountLedgerTransactions.bankAccountId, activeBankId),
            eq(accountLedgerTransactions.sourceType, "BRS_ADJUSTMENT"),
          ),
          orderBy: [desc(accountLedgerTransactions.transactionDate)],
          limit: 50,
        }),
        tx.execute(sql`
          SELECT
            COUNT(*) FILTER (WHERE bank_reconciliation_status = 'RECONCILED')::int AS reconciled,
            COUNT(*) FILTER (WHERE bank_reconciliation_status = 'UNRECONCILED')::int AS unreconciled,
            COUNT(*) FILTER (WHERE bank_reconciliation_status = 'DISPUTED')::int AS disputed
          FROM account_ledger_transactions
          WHERE school_id = ${school.id}
            AND bank_account_id = ${activeBankId}
        `),
      ]);

      const cRow = (countsRes.rows?.[0] || {}) as Record<string, number>;
      const reconciliationCounts: BrsReconciliationCounts = {
        reconciled: Number(cRow.reconciled || 0),
        unreconciled: Number(cRow.unreconciled || 0),
        disputed: Number(cRow.disputed || 0),
      };

      return {
        success: true,
        bankAccounts: accounts,
        selectedAccount,
        ledgerTransactions: ledgerTransactions.map((t) => ({
          id: t.id,
          transactionNumber: t.transactionNumber,
          amount: t.amount,
          transactionType: t.transactionType,
          sourceType: t.sourceType,
          description: t.description,
          bankReconciliationStatus: t.bankReconciliationStatus,
          bankReconciledAt: t.bankReconciledAt ? new Date(t.bankReconciledAt).toISOString() : null,
          bankStatementRef: t.bankStatementRef,
          transactionDate: t.transactionDate ? new Date(t.transactionDate).toISOString() : new Date().toISOString(),
        })),
        adjustingVouchers: adjustingVouchers.map((t) => ({
          id: t.id,
          transactionNumber: t.transactionNumber,
          amount: t.amount,
          transactionType: t.transactionType,
          description: t.description,
          transactionDate: t.transactionDate ? new Date(t.transactionDate).toISOString() : new Date().toISOString(),
        })),
        reconciliationCounts,
        userRole: ctx.role,
      };
    });
  } catch (error: any) {
    console.error("getBankReconciliationDataAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to load reconciliation data",
      bankAccounts: [],
      selectedAccount: null,
      ledgerTransactions: [],
      adjustingVouchers: [],
      reconciliationCounts: { reconciled: 0, unreconciled: 0, disputed: 0 },
      userRole: "ACCOUNTANT",
    };
  }
}

/**
 * Matches uploaded statement rows against bank ledger transactions.
 * HARD CONSTRAINT: Ambiguous candidates (same amount + same day) go to a suggestion list, NEVER auto-matched!
 * Persists clean 1-to-1 MATCHED rows to DB (`RECONCILED`) for operational roles (PRINCIPAL remains dry-run read-only).
 * RBAC: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, PRINCIPAL
 */
export async function matchBankStatementAction(params: {
  bankAccountId: string;
  statementRows: BankStatementRowInput[];
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);
    const canPersist = ctx.role !== "PRINCIPAL";

    const matchOutcome = await withTenant(school.id, async (tx) => {
      const bank = await tx.query.bankAccounts.findFirst({
        where: and(eq(bankAccounts.id, params.bankAccountId), eq(bankAccounts.schoolId, school.id)),
      });
      if (!bank) throw new Error("Bank account not found.");

      const ledgerTxList = await tx.query.accountLedgerTransactions.findMany({
        where: and(
          eq(accountLedgerTransactions.schoolId, school.id),
          eq(accountLedgerTransactions.bankAccountId, params.bankAccountId),
        ),
      });

      const usedTxIds = new Set<string>();
      const results: MatchedResultItem[] = [];
      const now = new Date();
      let persistedCount = 0;

      for (const row of params.statementRows) {
        const rowDateStr = row.date.slice(0, 10);
        const rowAmount = row.withdrawal > 0 ? row.withdrawal : row.deposit;
        const isDeposit = row.deposit > 0;

        // Only match against unreconciled / disputed ledger items
        const candidates = ledgerTxList.filter((t) => {
          if (usedTxIds.has(t.id)) return false;
          if (t.bankReconciliationStatus === "RECONCILED") return false;
          const txDateStr = (t.transactionDate ? new Date(t.transactionDate) : new Date()).toISOString().slice(0, 10);
          if (txDateStr !== rowDateStr) return false;

          const txAmount = parseFloat(t.amount);
          if (Math.abs(txAmount - rowAmount) > 0.01) return false;

          if (isDeposit && t.transactionType !== "CREDIT") return false;
          if (!isDeposit && t.transactionType !== "DEBIT") return false;

          return true;
        });

        if (candidates.length === 1 && candidates[0]) {
          const matched = candidates[0];
          usedTxIds.add(matched.id);

          let persisted = false;
          if (canPersist) {
            const statementRef = row.refNumber?.trim() || row.id;
            await tx
              .update(accountLedgerTransactions)
              .set({
                bankReconciliationStatus: "RECONCILED",
                bankReconciledAt: now,
                bankReconciledById: ctx.userId,
                bankStatementRef: statementRef,
              })
              .where(
                and(
                  eq(accountLedgerTransactions.id, matched.id),
                  eq(accountLedgerTransactions.schoolId, school.id),
                  eq(accountLedgerTransactions.bankAccountId, params.bankAccountId),
                ),
              );

            await logFeeAuditEvent(tx, {
              schoolId: school.id,
              action: "BRS_AUTO_MATCH_RECONCILE",
              entityType: "LEDGER_TRANSACTION",
              entityId: matched.id,
              previousData: {
                bankReconciliationStatus: matched.bankReconciliationStatus,
                bankStatementRef: matched.bankStatementRef,
              },
              newData: {
                bankReconciliationStatus: "RECONCILED",
                bankReconciledAt: now.toISOString(),
                bankStatementRef: statementRef,
              },
              reason: `BRS 1-to-1 statement match (${rowDateStr}, ₹${rowAmount.toFixed(2)})`,
              performedById: ctx.userId,
            });
            persisted = true;
            persistedCount++;
          }

          results.push({
            statementRow: row,
            status: "MATCHED",
            persisted,
            matchedTx: {
              id: matched.id,
              transactionNumber: matched.transactionNumber,
              amount: matched.amount,
              transactionType: matched.transactionType,
              description: matched.description,
              transactionDate: matched.transactionDate ? new Date(matched.transactionDate).toISOString() : new Date().toISOString(),
            },
          });
        } else if (candidates.length > 1) {
          results.push({
            statementRow: row,
            status: "AMBIGUOUS",
            suggestions: candidates.map((c) => ({
              id: c.id,
              transactionNumber: c.transactionNumber,
              amount: c.amount,
              transactionType: c.transactionType,
              description: c.description,
              transactionDate: c.transactionDate ? new Date(c.transactionDate).toISOString() : new Date().toISOString(),
            })),
          });
        } else {
          results.push({
            statementRow: row,
            status: "UNMATCHED",
          });
        }
      }

      const countsRes = await tx.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE bank_reconciliation_status = 'RECONCILED')::int AS reconciled,
          COUNT(*) FILTER (WHERE bank_reconciliation_status = 'UNRECONCILED')::int AS unreconciled,
          COUNT(*) FILTER (WHERE bank_reconciliation_status = 'DISPUTED')::int AS disputed
        FROM account_ledger_transactions
        WHERE school_id = ${school.id}
          AND bank_account_id = ${params.bankAccountId}
      `);
      const cRow = (countsRes.rows?.[0] || {}) as Record<string, number>;

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
        results,
        persistedCount,
        reconciliationCounts: {
          reconciled: Number(cRow.reconciled || 0),
          unreconciled: Number(cRow.unreconciled || 0),
          disputed: Number(cRow.disputed || 0),
        },
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
    });

    if (matchOutcome.persistedCount > 0) {
      revalidatePath("/school/accounts/bank-reconciliation");
      revalidatePath("/accountant/dashboard");
    }

    return {
      success: true as const,
      ...matchOutcome,
    };
  } catch (error: any) {
    console.error("matchBankStatementAction error:", error);
    return {
      success: false as const,
      message: error.message || "Failed to perform reconciliation match",
    };
  }
}

/**
 * Manually reconciles, disputes, or resets a bank ledger transaction (including ambiguous BRS candidates).
 * RBAC: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT (PRINCIPAL strictly denied).
 */
export async function confirmManualReconciliationAction(params: {
  bankAccountId: string;
  transactionId: string;
  status: "RECONCILED" | "DISPUTED" | "UNRECONCILED";
  statementRef?: string | undefined;
  reason?: string | undefined;
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const validStatuses = ["RECONCILED", "DISPUTED", "UNRECONCILED"];
    if (!validStatuses.includes(params.status)) {
      return { success: false, message: "Invalid reconciliation status." };
    }

    const result = await withTenant(school.id, async (tx) => {
      const txRow = await tx.query.accountLedgerTransactions.findFirst({
        where: and(
          eq(accountLedgerTransactions.id, params.transactionId),
          eq(accountLedgerTransactions.schoolId, school.id),
          eq(accountLedgerTransactions.bankAccountId, params.bankAccountId),
        ),
      });

      if (!txRow) {
        return { success: false, message: "Ledger transaction not found for this bank account." };
      }

      const now = new Date();
      const nextRef =
        params.status === "UNRECONCILED"
          ? null
          : params.statementRef?.trim() || txRow.bankStatementRef || null;

      await tx
        .update(accountLedgerTransactions)
        .set({
          bankReconciliationStatus: params.status,
          bankReconciledAt: params.status === "UNRECONCILED" ? null : now,
          bankReconciledById: params.status === "UNRECONCILED" ? null : ctx.userId,
          bankStatementRef: nextRef,
        })
        .where(
          and(
            eq(accountLedgerTransactions.id, txRow.id),
            eq(accountLedgerTransactions.schoolId, school.id),
          ),
        );

      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "BRS_MANUAL_RECONCILE",
        entityType: "LEDGER_TRANSACTION",
        entityId: txRow.id,
        previousData: {
          bankReconciliationStatus: txRow.bankReconciliationStatus,
          bankStatementRef: txRow.bankStatementRef,
        },
        newData: {
          bankReconciliationStatus: params.status,
          bankReconciledAt: params.status === "UNRECONCILED" ? null : now.toISOString(),
          bankStatementRef: nextRef,
        },
        reason: params.reason?.trim() || `Manual BRS status updated to ${params.status}`,
        performedById: ctx.userId,
      });

      return {
        success: true,
        message: `Transaction ${txRow.transactionNumber} marked as ${params.status}.`,
      };
    });

    if (result.success) {
      revalidatePath("/school/accounts/bank-reconciliation");
      revalidatePath("/accountant/dashboard");
    }

    return result;
  } catch (error: any) {
    console.error("confirmManualReconciliationAction error:", error);
    return {
      success: false,
      message: error.message || "Failed to update reconciliation status",
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
      debitAccountId = await getGatewayFeesExpenseChartAccountId(school.id, db);
      creditAccountId = bankChartAccountId;
      txType = "DEBIT";
    } else {
      debitAccountId = bankChartAccountId;
      txType = "CREDIT";

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
        .where(
          and(
            eq(bankAccounts.id, bank.id),
            eq(bankAccounts.schoolId, school.id),
          ),
        )
        .returning();

      if (updatedBank) finalBalance = updatedBank.currentBalance;

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
