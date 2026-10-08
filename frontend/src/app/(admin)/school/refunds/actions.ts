"use server";

import { db } from "@/db";
import {
  feeRefunds,
  feePayments,
  feeInvoices,
  accountLedgerTransactions,
  bankAccounts,
  students,
  classes,
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import { decryptData } from "@/lib/encryption";
import crypto from "crypto";

export interface RefundRequestPayload {
  feePaymentId: string;
  refundAmount: number;
  reason: string;
}

/**
 * Searches paid fee receipts to initiate refund against.
 * Decrypts student names server-side only.
 */
export async function searchPaidPaymentsForRefundAction(query?: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const cleanQuery = (query || "").trim().toLowerCase();

    // Fetch classes for class name mapping
    const allClasses = await db.query.classes.findMany({
      where: eq(classes.schoolId, school.id),
    });
    const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));

    // Fetch payments with relations
    const payments = await db.query.feePayments.findMany({
      where: eq(feePayments.schoolId, school.id),
      with: {
        student: true,
        invoice: true,
        refunds: true,
      },
      orderBy: [desc(feePayments.paymentDate)],
      limit: 100,
    });

    const results = payments
      .map((p) => {
        const student = p.student;
        const studentName = student
          ? `${decryptData(student.firstNameEncrypted) || ""} ${decryptData(student.lastNameEncrypted) || ""}`.trim()
          : "Unknown Student";
        const admissionNumber = student?.admissionNumber || "";

        // Calculate already refunded or pending amount
        const activeRefunds = (p.refunds || []).filter((r) => r.status !== "REJECTED");
        const totalRefundedOrPending = activeRefunds.reduce(
          (acc, r) => acc + parseFloat(r.refundAmount || "0"),
          0
        );
        const originalAmount = parseFloat(p.amountPaid || "0");
        const maxRefundable = Math.max(0, originalAmount - totalRefundedOrPending);

        return {
          paymentId: p.id,
          receiptNumber: p.receiptNumber,
          paymentDate: p.paymentDate.toISOString(),
          paymentMethod: p.paymentMethod,
          amountPaid: originalAmount,
          maxRefundable,
          studentName,
          admissionNumber,
          className: "Enrolled",
          invoiceNumber: p.invoice?.invoiceNumber || "N/A",
          feeHeadName: "Tuition / General",
        };
      })
      .filter((item) => {
        if (!cleanQuery) return item.maxRefundable > 0;
        return (
          item.maxRefundable > 0 &&
          (item.receiptNumber.toLowerCase().includes(cleanQuery) ||
            item.studentName.toLowerCase().includes(cleanQuery) ||
            item.admissionNumber.toLowerCase().includes(cleanQuery) ||
            item.invoiceNumber.toLowerCase().includes(cleanQuery))
        );
      })
      .slice(0, 20);

    return { success: true, results };
  } catch (error: any) {
    return { success: false, message: error.message, results: [] };
  }
}

/**
 * Creates a new refund request (status: PENDING).
 * Allowed for SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT.
 */
export async function requestFeeRefund(payload: RefundRequestPayload) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const { feePaymentId, refundAmount, reason } = payload;

    if (!feePaymentId || !refundAmount || refundAmount <= 0) {
      return { success: false, message: "Valid payment ID and positive refund amount are required" };
    }

    if (!reason || reason.trim().length < 5) {
      return { success: false, message: "A detailed reason for refund is required (min 5 chars)" };
    }

    // Verify payment belongs to this school
    const payment = await db.query.feePayments.findFirst({
      where: and(eq(feePayments.id, feePaymentId), eq(feePayments.schoolId, school.id)),
      with: {
        refunds: true,
        invoice: true,
      },
    });

    if (!payment) {
      return { success: false, message: "Payment record not found" };
    }

    const paidNum = parseFloat(payment.amountPaid || "0");
    const activeRefunds = (payment.refunds || []).filter((r) => r.status !== "REJECTED");
    const alreadyRefunded = activeRefunds.reduce(
      (acc, r) => acc + parseFloat(r.refundAmount || "0"),
      0
    );

    if (refundAmount > paidNum - alreadyRefunded) {
      return {
        success: false,
        message: `Refund amount (₹${refundAmount}) exceeds maximum refundable amount (₹${(paidNum - alreadyRefunded).toFixed(2)}) for Receipt #${payment.receiptNumber}`,
      };
    }

    const [newRefund] = await db
      .insert(feeRefunds)
      .values({
        schoolId: school.id,
        feePaymentId: payment.id,
        refundAmount: refundAmount.toFixed(2),
        reason: reason.trim(),
        status: "PENDING",
      })
      .returning();

    if (!newRefund) {
      return { success: false, message: "Failed to persist refund record" };
    }

    await logFeeAuditEvent(db, {
      schoolId: school.id,
      action: "REQUEST_FEE_REFUND",
      entityType: "FEE_REFUND",
      entityId: newRefund.id,
      performedById: ctx.userId,
      reason: `Refund requested for Receipt #${payment.receiptNumber}: ${reason.trim()}`,
      previousData: null,
      newData: {
        paymentId: payment.id,
        receiptNumber: payment.receiptNumber,
        invoiceId: payment.feeInvoiceId,
        refundAmount: refundAmount.toFixed(2),
      },
    });

    revalidatePath("/school/refunds");
    revalidatePath("/school/fees-dashboard");
    revalidatePath("/school/transactions");

    return { success: true, message: `Refund request for ₹${refundAmount.toFixed(2)} submitted successfully` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Approves a pending refund.
 * Strictly role-gated to SUPER_ADMIN, SCHOOL_ADMIN.
 */
export async function approveFeeRefund(refundId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const refund = await db.query.feeRefunds.findFirst({
      where: and(eq(feeRefunds.id, refundId), eq(feeRefunds.schoolId, school.id)),
      with: {
        payment: true,
      },
    });

    if (!refund) return { success: false, message: "Refund request not found" };
    if (refund.status !== "PENDING") {
      return { success: false, message: `Cannot approve refund in ${refund.status} status` };
    }

    const now = new Date();
    await db
      .update(feeRefunds)
      .set({
        status: "APPROVED",
        approvedById: ctx.userId,
        approvedAt: now,
        updatedAt: now,
      })
      .where(eq(feeRefunds.id, refund.id));

    await logFeeAuditEvent(db, {
      schoolId: school.id,
      action: "APPROVE_FEE_REFUND",
      entityType: "FEE_REFUND",
      entityId: refund.id,
      performedById: ctx.userId,
      reason: `Refund approved by ${ctx.role} for Receipt #${refund.payment?.receiptNumber || "N/A"}`,
      previousData: { status: refund.status },
      newData: { status: "APPROVED", refundAmount: refund.refundAmount },
    });

    revalidatePath("/school/refunds");
    return { success: true, message: "Refund request approved" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Rejects a pending refund.
 * Strictly role-gated to SUPER_ADMIN, SCHOOL_ADMIN.
 */
export async function rejectFeeRefund(refundId: string, reason?: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const refund = await db.query.feeRefunds.findFirst({
      where: and(eq(feeRefunds.id, refundId), eq(feeRefunds.schoolId, school.id)),
      with: {
        payment: true,
      },
    });

    if (!refund) return { success: false, message: "Refund request not found" };
    if (refund.status !== "PENDING" && refund.status !== "APPROVED") {
      return { success: false, message: `Cannot reject refund in ${refund.status} status` };
    }

    const now = new Date();
    await db
      .update(feeRefunds)
      .set({
        status: "REJECTED",
        updatedAt: now,
      })
      .where(eq(feeRefunds.id, refund.id));

    await logFeeAuditEvent(db, {
      schoolId: school.id,
      action: "REJECT_FEE_REFUND",
      entityType: "FEE_REFUND",
      entityId: refund.id,
      performedById: ctx.userId,
      reason: `Refund rejected by ${ctx.role}: ${reason || "No reason specified"}`,
      previousData: { status: refund.status },
      newData: { status: "REJECTED" },
    });

    revalidatePath("/school/refunds");
    return { success: true, message: "Refund request rejected" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Processes an approved refund:
 * - Atomic transaction:
 *   1. Marks fee_refunds status as PROCESSED with processedAt
 *   2. Restores fee_invoices balance: balanceAmount += refundAmount, paidAmount -= refundAmount
 *   3. Debits primary or chosen bank account balance
 *   4. Writes reversal DEBIT entry into account_ledger_transactions
 *   5. Writes immutable audit log via logFeeAuditEvent
 */
export async function processFeeRefund(refundId: string, bankAccountId?: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const refund = await db.query.feeRefunds.findFirst({
      where: and(eq(feeRefunds.id, refundId), eq(feeRefunds.schoolId, school.id)),
      with: {
        payment: {
          with: {
            invoice: true,
          },
        },
      },
    });

    if (!refund) return { success: false, message: "Refund request not found" };
    if (refund.status !== "APPROVED") {
      return { success: false, message: "Only approved refunds can be processed and paid out" };
    }
    if (!refund.payment || !refund.payment.invoice) {
      return { success: false, message: "Linked payment or invoice not found" };
    }

    const refundAmountNum = parseFloat(refund.refundAmount || "0");
    const payment = refund.payment;
    const invoice = payment.invoice;

    // Resolve bank account to debit
    let resolvedBankId = bankAccountId || null;
    if (!resolvedBankId) {
      const defaultBank = await db.query.bankAccounts.findFirst({
        where: and(eq(bankAccounts.schoolId, school.id), eq(bankAccounts.isActive, true)),
      });
      if (defaultBank) resolvedBankId = defaultBank.id;
    }

    await db.transaction(async (tx) => {
      const now = new Date();

      // 1. Mark refund as PROCESSED
      await tx
        .update(feeRefunds)
        .set({
          status: "PROCESSED",
          processedAt: now,
          updatedAt: now,
        })
        .where(eq(feeRefunds.id, refund.id));

      // 2. Restore invoice balance & paidAmount
      const currentPaid = parseFloat(invoice.paidAmount || "0");
      const currentBalance = parseFloat(invoice.balanceAmount || "0");
      const newPaid = Math.max(0, currentPaid - refundAmountNum);
      const newBalance = currentBalance + refundAmountNum;

      // Status logic: if balance remaining > 0, set to PARTIAL or OVERDUE
      const isOverdue = invoice.dueDate && new Date(invoice.dueDate) < now;
      const newStatus = newBalance <= 0 ? "PAID" : isOverdue ? "OVERDUE" : "PARTIAL";

      await tx
        .update(feeInvoices)
        .set({
          paidAmount: newPaid.toFixed(2),
          balanceAmount: newBalance.toFixed(2),
          status: newStatus,
          updatedAt: now,
        })
        .where(eq(feeInvoices.id, invoice.id));

      // 3. Debit bank account if specified
      let bankBalanceAfter = "0";
      if (resolvedBankId) {
        const [updatedBank] = await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} - ${refundAmountNum.toFixed(2)}`,
            updatedAt: now,
          })
          .where(eq(bankAccounts.id, resolvedBankId))
          .returning();
        if (updatedBank) bankBalanceAfter = updatedBank.currentBalance;
      }

      // 4. Post reversal ledger DEBIT entry
      const txNumber = `RFD-TX-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      await tx.insert(accountLedgerTransactions).values({
        schoolId: school.id,
        transactionNumber: txNumber,
        sourceType: "FEE_COLLECTION",
        sourceId: refund.id,
        bankAccountId: resolvedBankId,
        transactionType: "DEBIT",
        amount: refundAmountNum.toFixed(2),
        balanceAfter: bankBalanceAfter,
        description: `Fee Refund Payout for Receipt #${payment.receiptNumber} - ${refund.reason}`,
        transactionDate: now,
        createdById: ctx.userId,
      });

      // 5. Immutable audit log
      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "PROCESS_FEE_REFUND",
        entityType: "FEE_REFUND",
        entityId: refund.id,
        performedById: ctx.userId,
        reason: `Processed refund payout of ₹${refundAmountNum.toFixed(2)} for Receipt #${payment.receiptNumber} (${refund.reason})`,
        previousData: { status: "APPROVED" },
        newData: {
          feePaymentId: payment.id,
          receiptNumber: payment.receiptNumber,
          feeInvoiceId: invoice.id,
          reversalLedgerTx: txNumber,
          bankAccountId: resolvedBankId,
          refundAmount: refundAmountNum.toFixed(2),
          status: "PROCESSED",
        },
      });
    });

    revalidatePath("/school/refunds");
    revalidatePath("/school/fees-dashboard");
    revalidatePath("/school/accounting/dashboard");
    revalidatePath("/school/transactions");
    revalidatePath("/school/due-fees");

    return { success: true, message: `Refund of ₹${refundAmountNum.toFixed(2)} processed successfully with ledger reversal.` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
