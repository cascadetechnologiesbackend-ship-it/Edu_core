"use server";

import { db } from "@/db";
import { feeInvoices, feeCarryForwards } from "@/db/schema";
import { eq, and, gt, inArray } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import { revalidatePath } from "next/cache";

export async function processFeesCarryForward(payload: {
  fromAcademicYearId: string;
  toAcademicYearId: string;
  studentIds: string[];
}) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
  const school = await requireSchool(ctx);

  const { fromAcademicYearId, toAcademicYearId, studentIds } = payload;

  if (!fromAcademicYearId || !toAcademicYearId || !studentIds.length) {
    throw new Error("Invalid parameters for fee carry forward.");
  }

  if (fromAcademicYearId === toAcademicYearId) {
    throw new Error("Source and target academic years cannot be identical.");
  }

  // Fetch unpaid/partially-paid invoices in fromAcademicYearId for the specified students
  const pendingInvoices = await db.query.feeInvoices.findMany({
    where: and(
      eq(feeInvoices.schoolId, school.id),
      eq(feeInvoices.academicYearId, fromAcademicYearId),
      gt(feeInvoices.balanceAmount, "0"),
      inArray(feeInvoices.studentId, studentIds)
    ),
  });

  // Group pending dues by student
  const studentDuesMap = new Map<string, number>();
  for (const inv of pendingInvoices) {
    const current = studentDuesMap.get(inv.studentId) || 0;
    studentDuesMap.set(inv.studentId, current + parseFloat(inv.balanceAmount || "0"));
  }

  let processedCount = 0;

  await db.transaction(async (tx) => {
    for (const studentId of studentIds) {
      const dueAmount = studentDuesMap.get(studentId) || 0;
      if (dueAmount <= 0) continue;

      // 1. Record fee_carry_forwards row
      const [carryRecord] = await tx
        .insert(feeCarryForwards)
        .values({
          schoolId: school.id,
          fromAcademicYearId,
          toAcademicYearId,
          studentId,
          previousDueAmount: dueAmount.toFixed(2),
          carriedAmount: dueAmount.toFixed(2),
          status: "APPLIED",
          appliedById: ctx.userId,
        })
        .returning();

      if (!carryRecord) continue;

      // 2. Generate opening due invoice (AUTO-09) in toAcademicYearId
      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      const invNumber = `CF-${Date.now().toString().slice(-6)}-${randSuffix}`;

      const [openingInvoice] = await tx
        .insert(feeInvoices)
        .values({
          schoolId: school.id,
          studentId,
          academicYearId: toAcademicYearId,
          invoiceNumber: invNumber,
          term: "ANNUAL",
          grossAmount: dueAmount.toFixed(2),
          discountAmount: "0",
          lateFeeAmount: "0",
          taxAmount: "0",
          netAmount: dueAmount.toFixed(2),
          paidAmount: "0",
          balanceAmount: dueAmount.toFixed(2),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Due in 30 days
          status: "PENDING",
        })
        .returning();

      // 3. Immutable audit log with uniform logger
      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "FEE_CARRIED_FORWARD",
        entityType: "FEE_CARRY_FORWARD",
        entityId: carryRecord.id,
        previousData: { dueAmount: dueAmount.toFixed(2), fromAcademicYearId },
        newData: { openingInvoiceId: openingInvoice?.id, invNumber, toAcademicYearId },
        reason: `Rolled forward pending balance ₹${dueAmount.toFixed(2)} from session ${fromAcademicYearId} to ${toAcademicYearId}`,
        performedById: ctx.userId,
      });

      processedCount++;
    }
  });

  revalidatePath("/school/fees-carry-forward");
  revalidatePath("/school/due-fees");
  revalidatePath("/school/fee-audit");
  return { success: true, count: processedCount };
}
