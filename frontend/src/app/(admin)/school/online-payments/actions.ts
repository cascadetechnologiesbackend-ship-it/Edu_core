"use server";

import { db } from "@/db";
import { paymentGatewayLogs, accountLedgerTransactions, bankAccounts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import crypto from "crypto";

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

    let primaryBankId: string | null = null;
    let newBalance: string = "0";

    await db.transaction(async (tx) => {
      const primaryBank = await tx.query.bankAccounts.findFirst({
        where: and(eq(bankAccounts.schoolId, school.id), eq(bankAccounts.isActive, true)),
      });

      if (primaryBank) {
        primaryBankId = primaryBank.id;
        const [updatedBank] = await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} + ${parseFloat(log.amount).toFixed(2)}`,
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, primaryBank.id))
          .returning();
        if (updatedBank) newBalance = updatedBank.currentBalance;
      }

      const txNumber = `REC-GW-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      await tx.insert(accountLedgerTransactions).values({
        schoolId: school.id,
        transactionNumber: txNumber,
        sourceType: "FEE_COLLECTION",
        sourceId: log.id,
        bankAccountId: primaryBankId,
        transactionType: "CREDIT",
        amount: log.amount,
        balanceAfter: newBalance,
        description: `Online Gateway Settlement (${log.gateway}) - Payment ID: ${log.gatewayPaymentId}`,
        transactionDate: new Date(),
        createdById: ctx.userId,
      });

      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "RECONCILE_GATEWAY_PAYMENT",
        entityType: "PAYMENT_GATEWAY_LOG",
        entityId: log.id,
        newData: { txNumber, gateway: log.gateway, amount: log.amount, bankAccountId: primaryBankId },
        reason: `Settled online payment ${log.gatewayPaymentId} to general ledger and bank vault`,
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
