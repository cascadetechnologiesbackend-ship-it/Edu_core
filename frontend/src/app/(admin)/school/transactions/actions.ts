"use server";

import { db } from "@/db";
import { feePayments, feeInvoices, accountLedgerTransactions, feeAuditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import crypto from "crypto";

export async function cancelTransaction(formData: FormData) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const paymentId = formData.get("paymentId") as string;
    const reason = (formData.get("reason") as string)?.trim();

    if (!paymentId || !reason) {
      return { success: false, message: "Payment ID and cancellation reason are required." };
    }

    const payment = await db.query.feePayments.findFirst({
      where: and(
        eq(feePayments.id, paymentId),
        eq(feePayments.schoolId, school.id),
      ),
      with: {
        invoice: true,
      },
    });

    if (!payment) return { success: false, message: "Payment record not found." };

    const invoice = payment.invoice;
    const amountToReverse = parseFloat(payment.amountPaid);

    await db.transaction(async (tx) => {
      // 1. Audit log
      await tx.insert(feeAuditLogs).values({
        schoolId: school.id,
        action: "RECEIPT_CANCELLED",
        entityType: "FEE_PAYMENT",
        entityId: payment.id,
        previousData: JSON.stringify({
          receiptNumber: payment.receiptNumber,
          amountPaid: payment.amountPaid,
          paymentMethod: payment.paymentMethod,
          invoiceId: payment.feeInvoiceId,
        }),
        newData: null,
        reason,
        performedById: ctx.userId,
      });

      // 2. Revert invoice balance if invoice exists
      if (invoice) {
        const revertedPaidAmount = Math.max(0, parseFloat(invoice.paidAmount) - amountToReverse);
        const revertedBalance = Math.min(
          parseFloat(invoice.netAmount),
          parseFloat(invoice.balanceAmount) + amountToReverse,
        );
        const revertedStatus = revertedBalance >= parseFloat(invoice.netAmount) ? "PENDING" : "PARTIAL";

        await tx
          .update(feeInvoices)
          .set({
            paidAmount: revertedPaidAmount.toFixed(2),
            balanceAmount: revertedBalance.toFixed(2),
            status: revertedStatus,
            updatedAt: new Date(),
          })
          .where(eq(feeInvoices.id, invoice.id));
      }

      // 3. Post reversal DEBIT to general ledger
      const txNumber = `REV-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      await tx.insert(accountLedgerTransactions).values({
        schoolId: school.id,
        transactionNumber: txNumber,
        sourceType: "MANUAL_ADJUSTMENT",
        sourceId: payment.id,
        transactionType: "DEBIT",
        amount: amountToReverse.toFixed(2),
        description: `Reversal of Fee Receipt #${payment.receiptNumber}. Reason: ${reason}`,
        transactionDate: new Date(),
        createdById: ctx.userId,
      });

      // 4. Delete payment record
      await tx.delete(feePayments).where(eq(feePayments.id, payment.id));
    });

    revalidatePath("/school/transactions");
    revalidatePath("/school/collect-fees");
    revalidatePath("/school/due-fees");
    revalidatePath("/school/fee-audit");

    return { success: true, message: `Receipt #${payment.receiptNumber} cancelled and refunded to dues.` };
  } catch (error: any) {
    console.error("Cancel Transaction Error:", error);
    return { success: false, message: error.message || "Failed to cancel transaction." };
  }
}
