"use server";

import { db } from "@/db";
import {
  feePayments,
  feeInvoices,
  accountLedgerTransactions,
  bankAccounts,
  paymentGatewayLogs,
} from "@/db/schema";
import { eq, and, sql, or } from "drizzle-orm";
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
import { invalidateFinanceOnPayment } from "@/lib/financeCache";

export async function cancelTransaction(input: FormData | { paymentId: string; reason: string }) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    let paymentId = "";
    let reason = "";

    if (input instanceof FormData) {
      paymentId = input.get("paymentId") as string;
      reason = ((input.get("reason") as string) || "").trim();
    } else {
      paymentId = input.paymentId;
      reason = (input.reason || "").trim();
    }

    if (!paymentId || !reason) {
      return { success: false, message: "Payment ID and a cancellation reason are required." };
    }

    const payment = await db.query.feePayments.findFirst({
      where: and(
        eq(feePayments.id, paymentId),
        eq(feePayments.schoolId, school.id)
      ),
      with: {
        invoice: true,
      },
    });

    if (!payment) return { success: false, message: "Payment record not found." };

    const invoice = payment.invoice;
    const amountToReverse = parseFloat(payment.amountPaid);

    // Enforce fiscal lock invariant (ACC-06)
    await assertAcademicYearNotLocked(school.id, new Date(), db);

    // Find the original ledger transaction to determine if a bank account was credited
    const originalLedger = await db.query.accountLedgerTransactions.findFirst({
      where: and(
        eq(accountLedgerTransactions.schoolId, school.id),
        eq(accountLedgerTransactions.sourceType, "FEE_COLLECTION"),
        eq(accountLedgerTransactions.sourceId, payment.id)
      ),
    });

    const bankAccountId = originalLedger?.bankAccountId || null;

    await db.transaction(async (tx) => {
      // 1. Audit log write using uniform wrapper (GAP-04)
      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "RECEIPT_CANCELLED",
        entityType: "FEE_PAYMENT",
        entityId: payment.id,
        previousData: {
          receiptNumber: payment.receiptNumber,
          amountPaid: payment.amountPaid,
          paymentMethod: payment.paymentMethod,
          invoiceId: payment.feeInvoiceId,
        },
        newData: null,
        reason,
        performedById: ctx.userId,
      });

      // 2. Revert invoice balance if invoice exists
      if (invoice) {
        const revertedPaidAmount = Math.max(0, parseFloat(invoice.paidAmount) - amountToReverse);
        const revertedBalance = Math.min(
          parseFloat(invoice.netAmount),
          parseFloat(invoice.balanceAmount) + amountToReverse
        );
        const revertedStatus =
          revertedBalance >= parseFloat(invoice.netAmount) ? "PENDING" : "PARTIAL";

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

      // 3. Post reversal DEBIT to general ledger with double-entry IDs
      let gatewayLog = null;
      if (payment.transactionReference) {
        gatewayLog = await tx.query.paymentGatewayLogs.findFirst({
          where: and(
            eq(paymentGatewayLogs.schoolId, school.id),
            or(
              eq(paymentGatewayLogs.gatewayPaymentId, payment.transactionReference),
              eq(paymentGatewayLogs.gatewayOrderId, payment.transactionReference),
            ),
          ),
        });
      }

      const feeAmount = gatewayLog ? parseFloat((gatewayLog as any).feeAmount || "0") : 0;
      const netAmount = Math.max(0, amountToReverse - feeAmount);

      const debitAccountId = await getStudentReceivableChartAccountId(school.id, tx);
      const creditAccountId = bankAccountId
        ? await getBankAccountChartAccountId(school.id, bankAccountId, tx)
        : await getCashMainChartAccountId(school.id, tx);
      const gatewayFeesExpenseAccountId = await getGatewayFeesExpenseChartAccountId(school.id, tx);

      const txNumber = `REV-${new Date().getFullYear()}-${crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

      if (feeAmount > 0) {
        // ACC-05 Mirrored Reversal:
        // Entry 1: Reversal of Net amount against Bank
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: `${txNumber}-NET`,
          sourceType: "MANUAL_ADJUSTMENT",
          sourceId: payment.id,
          bankAccountId,
          debitAccountId,
          creditAccountId,
          transactionType: "DEBIT",
          amount: netAmount.toFixed(2),
          description: `Mirrored Reversal (Net) of Fee Receipt #${payment.receiptNumber}. Reason: ${reason}`,
          transactionDate: new Date(),
          createdById: ctx.userId,
        });

        // Entry 2: Reversal of Fee amount against Gateway Fees Expense
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: `${txNumber}-FEE`,
          sourceType: "MANUAL_ADJUSTMENT",
          sourceId: payment.id,
          bankAccountId,
          debitAccountId,
          creditAccountId: gatewayFeesExpenseAccountId,
          transactionType: "DEBIT",
          amount: feeAmount.toFixed(2),
          description: `Mirrored Reversal (Fee) of Fee Receipt #${payment.receiptNumber}. Reason: ${reason}`,
          transactionDate: new Date(),
          createdById: ctx.userId,
        });

        // Update bank balance by net amount only (since only net was deposited)
        if (bankAccountId) {
          await tx
            .update(bankAccounts)
            .set({
              currentBalance: sql`${bankAccounts.currentBalance} - ${netAmount.toFixed(2)}`,
              updatedAt: new Date(),
            })
            .where(eq(bankAccounts.id, bankAccountId));
        }
      } else {
        // Standard Reversal
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: txNumber,
          sourceType: "MANUAL_ADJUSTMENT",
          sourceId: payment.id,
          bankAccountId,
          debitAccountId,
          creditAccountId,
          transactionType: "DEBIT",
          amount: amountToReverse.toFixed(2),
          description: `Reversal of Fee Receipt #${payment.receiptNumber}. Reason: ${reason}`,
          transactionDate: new Date(),
          createdById: ctx.userId,
        });

        if (bankAccountId) {
          await tx
            .update(bankAccounts)
            .set({
              currentBalance: sql`${bankAccounts.currentBalance} - ${amountToReverse}`,
              updatedAt: new Date(),
            })
            .where(eq(bankAccounts.id, bankAccountId));
        }
      }

      // 5. Delete payment record
      await tx.delete(feePayments).where(eq(feePayments.id, payment.id));
    });

    // Invalidate tenant S2 finance caches matching payment, dues, and accounts tags
    await invalidateFinanceOnPayment(school.id, invoice?.id ? [invoice.id] : undefined);

    revalidatePath("/school/transactions");
    revalidatePath("/school/collect-fees");
    revalidatePath("/school/due-fees");
    revalidatePath("/school/fee-audit");
    revalidatePath("/school/accounting/dashboard");

    return {
      success: true,
      message: `Receipt #${payment.receiptNumber} successfully cancelled and balance restored to invoice.`,
    };
  } catch (error: any) {
    console.error("Cancel Transaction Error:", error);
    return { success: false, message: error.message || "Failed to cancel transaction." };
  }
}
