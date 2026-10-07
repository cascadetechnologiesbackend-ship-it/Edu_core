"use server";

import { db } from "@/db";
import { feeChallans, feeInvoices, feePayments, accountLedgerTransactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import crypto from "crypto";

export async function generateChallan(formData: FormData) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const invoiceId = formData.get("invoiceId") as string;
    const dueDateStr = formData.get("dueDate") as string;

    if (!invoiceId || !dueDateStr) {
      return { success: false, message: "Invoice and Due Date are required" };
    }

    const invoice = await db.query.feeInvoices.findFirst({
      where: and(eq(feeInvoices.id, invoiceId), eq(feeInvoices.schoolId, school.id)),
    });

    if (!invoice) return { success: false, message: "Invoice not found" };

    const challanNumber = `CHL-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    await db.insert(feeChallans).values({
      schoolId: school.id,
      challanNumber,
      studentId: invoice.studentId,
      feeInvoiceId: invoice.id,
      amount: invoice.balanceAmount,
      dueDate: new Date(dueDateStr),
      status: "GENERATED",
    });

    revalidatePath("/school/fee-challans");
    return { success: true, message: `Challan #${challanNumber} generated!` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function clearChallan(formData: FormData) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const challanId = formData.get("challanId") as string;
    const referenceNumber = (formData.get("referenceNumber") as string)?.trim() || null;

    const challan = await db.query.feeChallans.findFirst({
      where: and(eq(feeChallans.id, challanId), eq(feeChallans.schoolId, school.id)),
      with: {
        invoice: true,
      },
    });

    if (!challan) return { success: false, message: "Challan not found" };
    if (challan.status === "CLEARED") return { success: false, message: "Challan already cleared" };

    const invoice = challan.invoice;
    const clearedAmount = parseFloat(challan.amount);
    const receiptNumber = `REC-CHL-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    await db.transaction(async (tx) => {
      // 1. Update Challan
      await tx
        .update(feeChallans)
        .set({
          status: "CLEARED",
          clearedAt: new Date(),
          referenceNumber,
          updatedAt: new Date(),
        })
        .where(eq(feeChallans.id, challan.id));

      // 2. Insert Fee Payment
      const [payment] = await tx
        .insert(feePayments)
        .values({
          receiptNumber,
          schoolId: school.id,
          studentId: challan.studentId,
          feeInvoiceId: challan.feeInvoiceId,
          amountPaid: challan.amount,
          paymentMethod: "CASH", // Bank challan
          transactionReference: `Bank Challan #${challan.challanNumber}`,
          paymentDate: new Date(),
          remarks: `Cleared via Bank Challan. Ref: ${referenceNumber || "Direct"}`,
          collectedById: ctx.userId,
        })
        .returning();
      if (!payment) throw new Error("Failed to record payment.");

      // 3. Update Invoice
      if (invoice) {
        const newPaid = parseFloat(invoice.paidAmount) + clearedAmount;
        const newBalance = Math.max(0, parseFloat(invoice.netAmount) - newPaid);
        await tx
          .update(feeInvoices)
          .set({
            paidAmount: newPaid.toFixed(2),
            balanceAmount: newBalance.toFixed(2),
            status: newBalance <= 0 ? "PAID" : "PARTIAL",
            updatedAt: new Date(),
          })
          .where(eq(feeInvoices.id, invoice.id));
      }

      // 4. Post Ledger Credit
      await tx.insert(accountLedgerTransactions).values({
        schoolId: school.id,
        transactionNumber: `TX-CHL-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
        sourceType: "FEE_COLLECTION",
        sourceId: payment.id,
        transactionType: "CREDIT",
        amount: challan.amount,
        description: `Bank Challan Clearance #${challan.challanNumber}`,
        transactionDate: new Date(),
        createdById: ctx.userId,
      });
    });

    revalidatePath("/school/fee-challans");
    revalidatePath("/school/transactions");
    return { success: true, message: `Challan #${challan.challanNumber} cleared successfully.` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
