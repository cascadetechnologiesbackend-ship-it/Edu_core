"use server";

import { withTenant } from "@/db";
import { feeInvoices } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";

export async function sendDueReminder(invoiceId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const res = await withTenant(school.id, async (tx) => {
      const invoice = await tx.query.feeInvoices.findFirst({
        where: and(
          eq(feeInvoices.id, invoiceId),
          eq(feeInvoices.schoolId, school.id)
        ),
      });

      if (!invoice) {
        return { success: false, message: "Invoice not found" };
      }

      const now = new Date();
      await tx
        .update(feeInvoices)
        .set({
          reminderSentD7: true,
          updatedAt: now,
        })
        .where(and(eq(feeInvoices.id, invoice.id), eq(feeInvoices.schoolId, school.id)));

      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "SEND_DUE_REMINDER",
        entityType: "FEE_INVOICE",
        entityId: invoice.id,
        previousData: { reminderSentD7: invoice.reminderSentD7 },
        newData: { reminderSentD7: true, sentAt: now.toISOString() },
        reason: `Payment reminder dispatched for Invoice #${invoice.invoiceNumber}`,
        performedById: ctx.userId,
      });

      return {
        success: true,
        message: `Payment reminder dispatched for Invoice #${invoice.invoiceNumber}`,
      };
    });

    if (res.success) {
      revalidatePath("/school/due-fees");
    }
    return res;
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to trigger reminder" };
  }
}
