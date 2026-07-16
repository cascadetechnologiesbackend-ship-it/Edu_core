import { db } from "@/db";
import { feeInvoices } from "@/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withCronAuth } from "@/lib/apiAuth";

export const POST = withCronAuth(async () => {
  // Get all pending or partial invoices that are past their due date
  const overdueInvoices = await db.query.feeInvoices.findMany({
    where: and(
      lt(feeInvoices.dueDate, new Date()),
      eq(feeInvoices.status, "PENDING") // For simplicity, only apply to PENDING (can expand to PARTIAL later)
    ),
    with: { feeStructure: true }
  });

  let updatedCount = 0;

  for (const invoice of overdueInvoices) {
    if (!invoice.feeStructure) continue;
    
    const structure = invoice.feeStructure;
    if (!structure.lateFeeType || !structure.lateFeeAmount || !structure.lateFeeStartAfterDays) {
      continue;
    }

    // Check if late fee grace period has expired
    const gracePeriodDate = new Date(invoice.dueDate);
    gracePeriodDate.setDate(gracePeriodDate.getDate() + structure.lateFeeStartAfterDays);

    if (new Date() > gracePeriodDate && parseFloat(invoice.lateFeeAmount) === 0) {
      let lateFee = 0;
      const grossAmount = parseFloat(invoice.grossAmount);
      
      if (structure.lateFeeType === "FLAT") {
        lateFee = parseFloat(structure.lateFeeAmount);
      } else if (structure.lateFeeType === "PERCENTAGE") {
        lateFee = grossAmount * (parseFloat(structure.lateFeeAmount) / 100);
      }

      const newNetAmount = parseFloat(invoice.netAmount) + lateFee;
      const newBalanceAmount = parseFloat(invoice.balanceAmount) + lateFee;

      await db.update(feeInvoices)
        .set({
          lateFeeAmount: lateFee.toFixed(2),
          netAmount: newNetAmount.toFixed(2),
          balanceAmount: newBalanceAmount.toFixed(2),
          status: "OVERDUE",
        })
        .where(eq(feeInvoices.id, invoice.id));
      
      updatedCount++;
    }
  }

  return NextResponse.json({ success: true, message: `Applied late fees to ${updatedCount} invoices.` });
});
