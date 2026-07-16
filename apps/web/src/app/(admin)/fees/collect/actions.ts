"use server";

import { db } from "@/db";
import { feeInvoices, feePayments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function processManualPayment(formData: FormData) {
  try {
    const invoiceId = formData.get("invoiceId") as string;
    const amountPaidStr = formData.get("amountPaid") as string;
    const paymentMethod = formData.get("paymentMethod") as any;
    const transactionReference = formData.get("transactionReference") as string;
    const remarks = formData.get("remarks") as string;

    const amountPaid = parseFloat(amountPaidStr);

    if (!invoiceId || !amountPaid || !paymentMethod) {
      return { success: false, message: "Missing required fields" };
    }

    const invoice = await db.query.feeInvoices.findFirst({
      where: eq(feeInvoices.id, invoiceId)
    });

    if (!invoice) return { success: false, message: "Invoice not found" };

    const newPaidAmount = parseFloat(invoice.paidAmount) + amountPaid;
    const newBalanceAmount = parseFloat(invoice.netAmount) - newPaidAmount;
    
    let newStatus = invoice.status;
    if (newBalanceAmount <= 0) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL";
    }

    // Generate receipt number
    const receiptNumber = `REC-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // Transaction
    await db.transaction(async (tx) => {
      // Create payment record
      await tx.insert(feePayments).values({
        receiptNumber,
        schoolId: invoice.schoolId,
        studentId: invoice.studentId,
        feeInvoiceId: invoice.id,
        amountPaid: amountPaid.toFixed(2),
        paymentMethod,
        transactionReference: transactionReference || null,
        paymentDate: new Date(),
        remarks: remarks || null,
        // Mock collector ID for MVP
        collectedById: invoice.schoolId, 
      });

      // Update invoice
      await tx.update(feeInvoices)
        .set({
          paidAmount: newPaidAmount.toFixed(2),
          balanceAmount: newBalanceAmount.toFixed(2),
          status: newStatus,
        })
        .where(eq(feeInvoices.id, invoice.id));
    });

    revalidatePath("/fees/collect");
    return { success: true, receiptNumber };
  } catch (error: any) {
    console.error("Manual Payment Error:", error);
    return { success: false, message: error.message };
  }
}
