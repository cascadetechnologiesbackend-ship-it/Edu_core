"use server";

import { db } from "@/db";
import { feeInvoices, feePayments, accountLedgerTransactions, bankAccounts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import crypto from "crypto";

export async function processCounterCollection(formData: FormData) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const invoiceId = formData.get("invoiceId") as string;
    const amountPaidStr = formData.get("amountPaid") as string;
    const paymentMethod = (formData.get("paymentMethod") as any) || "CASH";
    const transactionReference = (formData.get("transactionReference") as string) || null;
    const remarks = (formData.get("remarks") as string) || null;
    const bankAccountId = (formData.get("bankAccountId") as string) || null;

    const amountPaid = parseFloat(amountPaidStr);

    if (!invoiceId || isNaN(amountPaid) || amountPaid <= 0) {
      return { success: false, message: "Valid invoice and payment amount are required." };
    }

    const invoice = await db.query.feeInvoices.findFirst({
      where: and(
        eq(feeInvoices.id, invoiceId),
        eq(feeInvoices.schoolId, school.id),
      ),
    });

    if (!invoice) return { success: false, message: "Invoice not found." };

    const newPaidAmount = parseFloat(invoice.paidAmount) + amountPaid;
    const newBalanceAmount = Math.max(0, parseFloat(invoice.netAmount) - newPaidAmount);

    let newStatus = invoice.status;
    if (newBalanceAmount <= 0) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL";
    }

    const receiptNumber = `REC-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const txNumber = `TX-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    let paymentId: string;

    await db.transaction(async (tx) => {
      // 1. Insert fee payment
      const [payment] = await tx
        .insert(feePayments)
        .values({
          receiptNumber,
          schoolId: invoice.schoolId,
          studentId: invoice.studentId,
          feeInvoiceId: invoice.id,
          amountPaid: amountPaid.toFixed(2),
          paymentMethod,
          transactionReference,
          paymentDate: new Date(),
          remarks,
          collectedById: ctx.userId,
        })
        .returning();
      if (!payment) throw new Error("Failed to record fee payment.");
      paymentId = payment.id;

      // 2. Update invoice balances
      await tx
        .update(feeInvoices)
        .set({
          paidAmount: newPaidAmount.toFixed(2),
          balanceAmount: newBalanceAmount.toFixed(2),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(feeInvoices.id, invoice.id));

      // 3. Post Credit Entry to General Ledger
      await tx.insert(accountLedgerTransactions).values({
        schoolId: invoice.schoolId,
        transactionNumber: txNumber,
        sourceType: "FEE_COLLECTION",
        sourceId: payment.id,
        bankAccountId: bankAccountId === "CASH" ? null : bankAccountId,
        transactionType: "CREDIT",
        amount: amountPaid.toFixed(2),
        description: `Fee Collection Receipt #${receiptNumber} (${paymentMethod})`,
        transactionDate: new Date(),
        createdById: ctx.userId,
      });

      // 4. If deposited to specific bank account, increment current balance
      if (bankAccountId && bankAccountId !== "CASH") {
        await tx
          .update(bankAccounts)
          .set({
            currentBalance: sql`${bankAccounts.currentBalance} + ${amountPaid}`,
            updatedAt: new Date(),
          })
          .where(eq(bankAccounts.id, bankAccountId));
      }
    });

    revalidatePath("/school/collect-fees");
    revalidatePath("/school/transactions");
    revalidatePath("/school/accounting/dashboard");

    return {
      success: true,
      receiptNumber,
      paymentId: paymentId!,
      amountPaid: amountPaid.toFixed(2),
      invoiceNumber: invoice.invoiceNumber,
      paymentMethod,
      date: new Date().toLocaleString("en-IN"),
    };
  } catch (error: any) {
    console.error("Counter collection error:", error);
    return { success: false, message: error.message || "Failed to process payment." };
  }
}
