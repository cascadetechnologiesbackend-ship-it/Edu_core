"use server";

import { db } from "@/db";
import { paymentGatewayLogs, accountLedgerTransactions, bankAccounts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import crypto from "crypto";
import {
  assertAcademicYearNotLocked,
  getBankAccountChartAccountId,
  getCashMainChartAccountId,
  getStudentReceivableChartAccountId,
  getGatewayFeesExpenseChartAccountId,
} from "@schoolmitra/backend/lib/chartOfAccountsEngine";

export async function reconcileOnlinePayment(logId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const log = await db.query.paymentGatewayLogs.findFirst({
      where: and(
        eq(paymentGatewayLogs.id, logId),
        eq(paymentGatewayLogs.schoolId, school.id),
      ),
    });

    if (!log) return { success: false, message: "Gateway log not found" };

    if (log.status !== "PAID") {
      return { success: false, message: "Only successful payments can be reconciled" };
    }

    // Check if already reconciled in ledger
    const existingTx = await db.query.accountLedgerTransactions.findFirst({
      where: and(
        eq(accountLedgerTransactions.schoolId, school.id),
        eq(accountLedgerTransactions.sourceId, log.id),
      ),
    });

    if (existingTx) {
      return { success: false, message: "Transaction already reconciled in ledger" };
    }

    // Enforce fiscal lock invariant (ACC-06)
    await assertAcademicYearNotLocked(school.id, new Date(), db);

    let primaryBankId: string | null = null;
    let newBalance: string = "0";

    const totalAmount = parseFloat(log.amount);
    const feeAmount = parseFloat((log as any).feeAmount || "0");
    const netAmount = Math.max(0, totalAmount - feeAmount);

    await db.transaction(async (tx) => {
      const primaryBank = await tx.query.bankAccounts.findFirst({
        where: and(eq(bankAccounts.schoolId, school.id), eq(bankAccounts.isActive, true)),
      });

      if (primaryBank) {
        primaryBankId = primaryBank.id;
        const [updatedBank] = await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} + ${netAmount.toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, primaryBank.id))
          .returning();
        if (updatedBank) newBalance = updatedBank.currentBalance;
      }

      const txNumber = `REC-GW-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const bankChartAccountId = primaryBankId
        ? await getBankAccountChartAccountId(school.id, primaryBankId, tx)
        : await getCashMainChartAccountId(school.id, tx);
      const studentReceivableAccountId = await getStudentReceivableChartAccountId(school.id, tx);
      const gatewayFeesExpenseAccountId = await getGatewayFeesExpenseChartAccountId(school.id, tx);

      if (feeAmount > 0) {
        // ACC-05: Net deposit (Debit Bank, Credit Student Receivable)
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: `${txNumber}-NET`,
          sourceType: "FEE_COLLECTION",
          sourceId: log.id,
          bankAccountId: primaryBankId,
          debitAccountId: bankChartAccountId,
          creditAccountId: studentReceivableAccountId,
          transactionType: "CREDIT",
          amount: netAmount.toFixed(2),
          balanceAfter: newBalance,
          description: `Online Gateway Net Settlement (${log.gateway}) - Txn: ${log.gatewayPaymentId}`,
          transactionDate: new Date(),
          createdById: ctx.userId,
        });

        // ACC-05: Gateway Processing Fee (Debit Gateway Expense 5200, Credit Student Receivable)
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: `${txNumber}-FEE`,
          sourceType: "EXPENSE_VOUCHER",
          sourceId: log.id,
          bankAccountId: primaryBankId,
          debitAccountId: gatewayFeesExpenseAccountId,
          creditAccountId: studentReceivableAccountId,
          transactionType: "CREDIT",
          amount: feeAmount.toFixed(2),
          balanceAfter: newBalance,
          description: `Gateway Processing Fee (${log.gateway}) - Txn: ${log.gatewayPaymentId}`,
          transactionDate: new Date(),
          createdById: ctx.userId,
        });
      } else {
        // Standard settlement without deduction
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: txNumber,
          sourceType: "FEE_COLLECTION",
          sourceId: log.id,
          bankAccountId: primaryBankId,
          debitAccountId: bankChartAccountId,
          creditAccountId: studentReceivableAccountId,
          transactionType: "CREDIT",
          amount: totalAmount.toFixed(2),
          balanceAfter: newBalance,
          description: `Online Gateway Settlement (${log.gateway}) - Payment ID: ${log.gatewayPaymentId}`,
          transactionDate: new Date(),
          createdById: ctx.userId,
        });
      }

      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "RECONCILE_GATEWAY_PAYMENT",
        entityType: "PAYMENT_GATEWAY_LOG",
        entityId: log.id,
        newData: {
          txNumber,
          gateway: log.gateway,
          totalAmount: totalAmount.toFixed(2),
          netAmount: netAmount.toFixed(2),
          feeAmount: feeAmount.toFixed(2),
          bankAccountId: primaryBankId,
        },
        reason: `Settled online payment ${log.gatewayPaymentId} with ACC-05 gateway fee split`,
        performedById: ctx.userId,
      });
    });

    revalidatePath("/school/online-payments");
    revalidatePath("/school/accounting/dashboard");
    revalidatePath("/school/accounts/bank-accounts");
    return { success: true, message: `Payment #${log.gatewayPaymentId} reconciled to general ledger & bank vault.` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
