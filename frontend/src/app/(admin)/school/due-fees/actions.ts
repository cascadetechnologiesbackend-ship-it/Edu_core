"use server";

import { db } from "@/db";
import { feeInvoices } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";

export async function sendDueReminder(invoiceId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const invoice = await db.query.feeInvoices.findFirst({
      where: and(
        eq(feeInvoices.id, invoiceId),
        eq(feeInvoices.schoolId, school.id),
      ),
    });

    if (!invoice) return { success: false, message: "Invoice not found" };

    // Update reminder flag
    await db
      .update(feeInvoices)
      .set({
        reminderSentD7: true,
        updatedAt: new Date(),
      })
      .where(eq(feeInvoices.id, invoice.id));

    revalidatePath("/school/due-fees");
    return { success: true, message: `Payment reminder dispatched for Invoice #${invoice.invoiceNumber}` };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to trigger reminder" };
  }
}
