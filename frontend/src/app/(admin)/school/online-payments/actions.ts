"use server";

import { db } from "@/db";
import { paymentGatewayLogs, accountLedgerTransactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
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

    const txNumber = `REC-GW-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await db.insert(accountLedgerTransactions).values({
      schoolId: school.id,
      transactionNumber: txNumber,
      sourceType: "FEE_COLLECTION",
      sourceId: log.id,
      transactionType: "CREDIT",
      amount: log.amount,
      description: `Online Gateway Settlement (${log.gateway}) - Payment ID: ${log.gatewayPaymentId}`,
      transactionDate: new Date(),
      createdById: ctx.userId,
    });

    revalidatePath("/school/online-payments");
    revalidatePath("/school/accounting/dashboard");
    return { success: true, message: `Payment #${log.gatewayPaymentId} reconciled to general ledger.` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
