import { db } from "@/db";
import { feePayments, feeInvoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DomainEventPublisher } from "@schoolmitra/domain-events";
import crypto from "crypto";

export interface RecordFeePaymentInput {
  schoolId: string;
  invoiceId: string;
  studentId: string;
  amountPaid: number;
  paymentMethod: "CASH" | "CHEQUE" | "ONLINE" | "DD" | "NEFT" | "RTGS";
  transactionReference?: string;
  collectedByUserId?: string;
}

export class FinanceDomainService {
  /**
   * Records a fee payment transaction, updates invoice status, and emits FeePaidEvent.
   */
  public static async recordFeePayment(input: RecordFeePaymentInput) {
    const { schoolId, invoiceId, studentId, amountPaid, paymentMethod, transactionReference } = input;

    return await db.transaction(async (tx) => {
      // 1. Verify invoice exists
      const invoice = await tx.query.feeInvoices.findFirst({
        where: eq(feeInvoices.id, invoiceId),
      });

      if (!invoice) {
        throw new Error("Fee invoice not found");
      }

      // 2. Insert Payment Record
      const receiptNumber = `RCP-${Date.now().toString().slice(-8)}`;
      const [payment] = await tx
        .insert(feePayments)
        .values({
          schoolId,
          feeInvoiceId: invoiceId,
          studentId,
          receiptNumber,
          amountPaid: amountPaid.toString(),
          paymentMethod,
          transactionReference: transactionReference || `TXN-${Date.now()}`,
          paymentDate: new Date(),
          collectedById: input.collectedByUserId || null,
        })
        .returning();

      if (!payment) {
        throw new Error("Failed to insert payment record");
      }

      // 3. Update Invoice Paid & Balance Amounts & Status
      const newPaidAmount = Number(invoice.paidAmount || 0) + amountPaid;
      const totalAmount = Number(invoice.netAmount);
      const newBalanceAmount = Math.max(0, totalAmount - newPaidAmount);
      const newStatus =
        newPaidAmount >= totalAmount
          ? "PAID"
          : newPaidAmount > 0
          ? "PARTIAL"
          : "PENDING";

      await tx
        .update(feeInvoices)
        .set({
          paidAmount: newPaidAmount.toString(),
          balanceAmount: newBalanceAmount.toString(),
          status: newStatus as any,
          updatedAt: new Date(),
        })
        .where(eq(feeInvoices.id, invoiceId));

      // 4. Publish FeePaidEvent to Event Bus
      await DomainEventPublisher.publish({
        eventId: crypto.randomUUID(),
        eventType: "FeePaidEvent",
        aggregateId: payment.id,
        tenantId: schoolId,
        occurredOn: new Date(),
        payload: {
          paymentId: payment.id,
          invoiceId,
          studentId,
          amountPaid,
          paymentMode: paymentMethod,
          transactionReference: payment.transactionReference || "",
        },
      });

      return { payment, newStatus };
    });
  }
}
