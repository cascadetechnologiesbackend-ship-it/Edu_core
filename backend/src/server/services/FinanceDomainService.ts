import crypto from "crypto";
import { db, withTenant } from "@/db";
import {
  feePayments,
  feeInvoices,
  accountLedgerTransactions,
  domainEvents,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import {
  assertAcademicYearNotLocked,
  getCashMainChartAccountId,
  getStudentReceivableChartAccountId,
} from "@/lib/chartOfAccountsEngine";

export interface RecordFeePaymentInput {
  schoolId: string;
  invoiceId: string;
  studentId: string;
  amountPaid: number;
  paymentMethod: "CASH" | "CHEQUE" | "ONLINE" | "DD" | "NEFT" | "RTGS" | "UPI";
  transactionReference?: string;
  collectedByUserId?: string;
}

/**
 * @deprecated Prefer `processCounterCollection` or tenant-guarded payment actions.
 * Hardened with `withTenant`, `FOR UPDATE`, integer-paise math, `feeAuditLogs`,
 * and `accountLedgerTransactions` so no unguarded call can bypass ledger integrity.
 */
export class FinanceDomainService {
  /**
   * @deprecated Prefer `processCounterCollection` or guarded tenant-scoped payment service.
   * Records a fee payment transaction, updates invoice status, writes audit & GL ledger entries,
   * and emits FeePaidEvent inside a `withTenant` transaction.
   */
  public static async recordFeePayment(input: RecordFeePaymentInput) {
    const { schoolId, invoiceId, studentId, amountPaid, paymentMethod, transactionReference } =
      input;

    const amountPaidPaise = Math.round(Number(amountPaid) * 100);
    if (!Number.isFinite(amountPaidPaise) || amountPaidPaise <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    await assertAcademicYearNotLocked(schoolId, new Date(), db);

    return await withTenant(schoolId, async (tx) => {
      // 1. Lock invoice row inside tenant transaction
      const [invoice] = await tx
        .select()
        .from(feeInvoices)
        .where(and(eq(feeInvoices.id, invoiceId), eq(feeInvoices.schoolId, schoolId)))
        .for("update");

      if (!invoice) {
        throw new Error("Fee invoice not found");
      }

      const netPaise = Math.round(parseFloat(invoice.netAmount) * 100);
      const prevPaidPaise = Math.round(parseFloat(invoice.paidAmount || "0") * 100);
      const outstandingPaise = Math.max(0, netPaise - prevPaidPaise);

      if (amountPaidPaise > outstandingPaise) {
        throw new Error(
          `Payment amount Rs.${(amountPaidPaise / 100).toFixed(2)} exceeds outstanding balance Rs.${(
            outstandingPaise / 100
          ).toFixed(2)}`,
        );
      }

      const amountFormatted = (amountPaidPaise / 100).toFixed(2);
      const receiptNumber = `RCP-${new Date().getFullYear()}-${crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

      // 2. Insert Payment Record
      const [payment] = await tx
        .insert(feePayments)
        .values({
          schoolId,
          feeInvoiceId: invoiceId,
          studentId,
          receiptNumber,
          amountPaid: amountFormatted,
          paymentMethod,
          transactionReference: transactionReference || `TXN-${Date.now()}`,
          paymentDate: new Date(),
          collectedById: input.collectedByUserId || null,
          status: "ACTIVE",
          isCancelled: false,
        })
        .returning();

      if (!payment) {
        throw new Error("Failed to insert payment record");
      }

      // 3. Update Invoice Paid & Balance Amounts & Status (integer paise)
      const newPaidPaise = prevPaidPaise + amountPaidPaise;
      const newBalancePaise = Math.max(0, netPaise - newPaidPaise);
      const newStatus =
        newBalancePaise <= 0 ? "PAID" : newPaidPaise > 0 ? "PARTIAL" : "PENDING";

      await tx
        .update(feeInvoices)
        .set({
          paidAmount: (newPaidPaise / 100).toFixed(2),
          balanceAmount: (newBalancePaise / 100).toFixed(2),
          status: newStatus as any,
          updatedAt: new Date(),
        })
        .where(and(eq(feeInvoices.id, invoiceId), eq(feeInvoices.schoolId, schoolId)));

      // 4. Write immutable fee audit log
      const actorId = input.collectedByUserId || "00000000-0000-0000-0000-000000000000";
      await logFeeAuditEvent(tx, {
        schoolId,
        action: "FEE_COLLECTED",
        entityType: "FEE_PAYMENT",
        entityId: payment.id,
        previousData: {
          invoiceId: invoice.id,
          paidAmount: invoice.paidAmount,
          balanceAmount: invoice.balanceAmount,
        },
        newData: {
          paymentId: payment.id,
          receiptNumber,
          amountPaid: amountFormatted,
          newPaidAmount: (newPaidPaise / 100).toFixed(2),
          newBalanceAmount: (newBalancePaise / 100).toFixed(2),
          paymentMethod,
        },
        reason: `FinanceDomainService payment of Rs.${amountFormatted} via ${paymentMethod}`,
        performedById: actorId,
      });

      // 5. Post double-entry ledger transaction
      const debitAccountId = await getCashMainChartAccountId(schoolId, tx);
      const creditAccountId = await getStudentReceivableChartAccountId(schoolId, tx);
      const txNumber = `TX-${new Date().getFullYear()}-${crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

      await tx.insert(accountLedgerTransactions).values({
        schoolId,
        transactionNumber: txNumber,
        sourceType: "FEE_COLLECTION",
        sourceId: payment.id,
        bankAccountId: null,
        debitAccountId,
        creditAccountId,
        transactionType: "CREDIT",
        amount: amountFormatted,
        description: `Fee Collection Receipt #${receiptNumber} (${paymentMethod})`,
        transactionDate: new Date(),
        createdById: actorId,
      });

      // 6. Insert durable outbox domain event
      await tx.insert(domainEvents).values({
        schoolId,
        aggregateId: payment.id,
        eventType: "FeePaidEvent",
        payload: {
          paymentId: payment.id,
          invoiceId,
          studentId,
          amountPaid: amountPaidPaise / 100,
          paymentMode: paymentMethod,
          transactionReference: payment.transactionReference || "",
        },
        status: "PENDING",
      });

      return { payment, newStatus };
    });
  }
}
