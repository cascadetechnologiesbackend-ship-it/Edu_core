"use server";

import { db, withTenant } from "@/db";
import {
  feePayments,
  feeInvoices,
  accountLedgerTransactions,
  bankAccounts,
  paymentGatewayLogs,
  domainEvents,
} from "@/db/schema";
import { eq, and, sql, or, inArray } from "drizzle-orm";
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

function toPaise(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

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

    // Enforce fiscal lock invariant (ACC-06)
    await assertAcademicYearNotLocked(school.id, new Date(), db);

    const txOutcome = await withTenant(school.id, async (tx) => {
      // 1. Lock the requested payment row
      const [targetPayment] = await tx
        .select()
        .from(feePayments)
        .where(and(eq(feePayments.id, paymentId), eq(feePayments.schoolId, school.id)))
        .for("update");

      if (!targetPayment) {
        return { success: false as const, message: "Payment record not found." };
      }

      // Guard against double-cancellation
      if (targetPayment.isCancelled || targetPayment.status === "REVERSED") {
        return {
          success: false as const,
          message: `Receipt #${targetPayment.receiptNumber} has already been cancelled/reversed.`,
        };
      }

      // 2. If part of a multi-invoice receiptGroupId, lock ALL active sibling payments in the group
      const paymentsToReverse = targetPayment.receiptGroupId
        ? await tx
            .select()
            .from(feePayments)
            .where(
              and(
                eq(feePayments.schoolId, school.id),
                eq(feePayments.receiptGroupId, targetPayment.receiptGroupId),
                eq(feePayments.isCancelled, false),
              ),
            )
            .for("update")
        : [targetPayment];

      const effectivePayments = paymentsToReverse.length > 0 ? paymentsToReverse : [targetPayment];
      const now = new Date();
      let totalReversedPaise = 0;
      const reversedInvoiceIds: string[] = [];
      const reversedPaymentIds: string[] = [];

      // 3. Reverse each invoice & soft-void each payment in integer paise
      for (const p of effectivePayments) {
        const amountToReversePaise = toPaise(p.amountPaid);
        totalReversedPaise += amountToReversePaise;
        reversedPaymentIds.push(p.id);

        if (p.feeInvoiceId) {
          const [lockedInvoice] = await tx
            .select()
            .from(feeInvoices)
            .where(and(eq(feeInvoices.id, p.feeInvoiceId), eq(feeInvoices.schoolId, school.id)))
            .for("update");

          if (lockedInvoice) {
            reversedInvoiceIds.push(lockedInvoice.id);
            const netPaise = toPaise(lockedInvoice.netAmount);
            const prevPaidPaise = toPaise(lockedInvoice.paidAmount);
            const prevBalPaise = toPaise(lockedInvoice.balanceAmount);

            const revertedPaidPaise = Math.max(0, prevPaidPaise - amountToReversePaise);
            const revertedBalancePaise = Math.min(netPaise, prevBalPaise + amountToReversePaise);
            const isPastDue =
              lockedInvoice.dueDate && new Date(lockedInvoice.dueDate).getTime() < now.getTime();
            const revertedStatus =
              revertedBalancePaise >= netPaise
                ? isPastDue
                  ? "OVERDUE"
                  : "PENDING"
                : "PARTIAL";

            await tx
              .update(feeInvoices)
              .set({
                paidAmount: (revertedPaidPaise / 100).toFixed(2),
                balanceAmount: (revertedBalancePaise / 100).toFixed(2),
                status: revertedStatus as any,
                updatedAt: now,
              })
              .where(
                and(eq(feeInvoices.id, lockedInvoice.id), eq(feeInvoices.schoolId, school.id)),
              );
          }
        }

        // Soft-void the payment record (never hard-delete posted financial records)
        await tx
          .update(feePayments)
          .set({
            status: "REVERSED",
            isCancelled: true,
            cancelledAt: now,
            cancelledById: ctx.userId,
            cancellationReason: reason,
            remarks: p.remarks
              ? `${p.remarks} | CANCELLED: ${reason}`
              : `CANCELLED: ${reason}. Original receipt: ${p.receiptNumber}.`,
            updatedAt: now,
          })
          .where(and(eq(feePayments.id, p.id), eq(feePayments.schoolId, school.id)));

        await logFeeAuditEvent(tx, {
          schoolId: school.id,
          action: "RECEIPT_CANCELLED",
          entityType: "FEE_PAYMENT",
          entityId: p.id,
          previousData: {
            receiptNumber: p.receiptNumber,
            receiptGroupId: p.receiptGroupId,
            amountPaid: p.amountPaid,
            paymentMethod: p.paymentMethod,
            invoiceId: p.feeInvoiceId,
            status: p.status,
            isCancelled: p.isCancelled,
          },
          newData: {
            status: "REVERSED",
            isCancelled: true,
            cancelledAt: now.toISOString(),
            cancelledById: ctx.userId,
            cancellationReason: reason,
          },
          reason,
          performedById: ctx.userId,
        });
      }

      // 4. Post reversal DEBIT to general ledger & decrement bank balance cleanly in integer paise
      const originalLedgers = await tx.query.accountLedgerTransactions.findMany({
        where: and(
          eq(accountLedgerTransactions.schoolId, school.id),
          eq(accountLedgerTransactions.sourceType, "FEE_COLLECTION"),
          inArray(accountLedgerTransactions.sourceId, reversedPaymentIds),
        ),
      });

      const bankAccountId =
        originalLedgers.find((l) => l.bankAccountId)?.bankAccountId || null;

      let gatewayLog = null;
      if (targetPayment.transactionReference) {
        gatewayLog = await tx.query.paymentGatewayLogs.findFirst({
          where: and(
            eq(paymentGatewayLogs.schoolId, school.id),
            or(
              eq(paymentGatewayLogs.gatewayPaymentId, targetPayment.transactionReference),
              eq(paymentGatewayLogs.gatewayOrderId, targetPayment.transactionReference),
            ),
          ),
        });
      }

      const feePaise = gatewayLog ? toPaise((gatewayLog as any).feeAmount) : 0;
      const netPaise = Math.max(0, totalReversedPaise - feePaise);

      const debitAccountId = await getStudentReceivableChartAccountId(school.id, tx);
      const creditAccountId = bankAccountId
        ? await getBankAccountChartAccountId(school.id, bankAccountId, tx)
        : await getCashMainChartAccountId(school.id, tx);
      const gatewayFeesExpenseAccountId = await getGatewayFeesExpenseChartAccountId(
        school.id,
        tx,
      );

      const receiptLabel = targetPayment.receiptGroupId || targetPayment.receiptNumber;
      const txNumber = `REV-${now.getFullYear()}-${crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

      if (feePaise > 0) {
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: `${txNumber}-NET`,
          sourceType: "MANUAL_ADJUSTMENT",
          sourceId: targetPayment.id,
          bankAccountId,
          debitAccountId,
          creditAccountId,
          transactionType: "DEBIT",
          amount: (netPaise / 100).toFixed(2),
          description: `Mirrored Reversal (Net) of Fee Receipt #${receiptLabel}. Reason: ${reason}`,
          transactionDate: now,
          createdById: ctx.userId,
        });

        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: `${txNumber}-FEE`,
          sourceType: "MANUAL_ADJUSTMENT",
          sourceId: targetPayment.id,
          bankAccountId,
          debitAccountId,
          creditAccountId: gatewayFeesExpenseAccountId,
          transactionType: "DEBIT",
          amount: (feePaise / 100).toFixed(2),
          description: `Mirrored Reversal (Fee) of Fee Receipt #${receiptLabel}. Reason: ${reason}`,
          transactionDate: now,
          createdById: ctx.userId,
        });

        if (bankAccountId) {
          await tx
            .update(bankAccounts)
            .set({
              currentBalance: sql`${bankAccounts.currentBalance} - ${(netPaise / 100).toFixed(2)}`,
              updatedAt: now,
            })
            .where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.schoolId, school.id)));
        }
      } else {
        const reversedFormatted = (totalReversedPaise / 100).toFixed(2);
        await tx.insert(accountLedgerTransactions).values({
          schoolId: school.id,
          transactionNumber: txNumber,
          sourceType: "MANUAL_ADJUSTMENT",
          sourceId: targetPayment.id,
          bankAccountId,
          debitAccountId,
          creditAccountId,
          transactionType: "DEBIT",
          amount: reversedFormatted,
          description: `Reversal of Fee Receipt #${receiptLabel}. Reason: ${reason}`,
          transactionDate: now,
          createdById: ctx.userId,
        });

        if (bankAccountId) {
          await tx
            .update(bankAccounts)
            .set({
              currentBalance: sql`${bankAccounts.currentBalance} - ${reversedFormatted}`,
              updatedAt: now,
            })
            .where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.schoolId, school.id)));
        }
      }

      // 5. Emit FeePaymentReversedEvent into domainEvents inside withTenant transaction
      await tx.insert(domainEvents).values({
        schoolId: school.id,
        aggregateId: targetPayment.id,
        eventType: "FeePaymentReversedEvent",
        payload: {
          paymentId: targetPayment.id,
          receiptNumber: receiptLabel,
          reversedPaymentIds,
          invoiceIds: reversedInvoiceIds,
          studentId: targetPayment.studentId,
          amountReversed: totalReversedPaise / 100,
          reason,
          cancelledById: ctx.userId,
        },
        status: "PENDING",
      });

      return {
        success: true as const,
        receiptLabel,
        reversedCount: effectivePayments.length,
        reversedInvoiceIds,
      };
    });

    if (!txOutcome.success) {
      return { success: false, message: txOutcome.message };
    }

    await invalidateFinanceOnPayment(
      school.id,
      txOutcome.reversedInvoiceIds.length > 0 ? txOutcome.reversedInvoiceIds : undefined,
    );

    revalidatePath("/school/transactions");
    revalidatePath("/school/collect-fees");
    revalidatePath("/school/due-fees");
    revalidatePath("/school/fee-audit");
    revalidatePath("/school/accounting/dashboard");
    revalidatePath("/school/fees-dashboard");

    return {
      success: true,
      message:
        txOutcome.reversedCount > 1
          ? `Receipt group #${txOutcome.receiptLabel} (${txOutcome.reversedCount} items) successfully reversed and balances restored.`
          : `Receipt #${txOutcome.receiptLabel} successfully cancelled and balance restored to invoice.`,
    };
  } catch (error: any) {
    console.error("Cancel Transaction Error:", error);
    return { success: false, message: error.message || "Failed to cancel transaction." };
  }
}
