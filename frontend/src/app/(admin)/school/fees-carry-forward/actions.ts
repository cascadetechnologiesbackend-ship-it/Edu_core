"use server";

import { withTenant } from "@/db";
import { feeInvoices, feeCarryForwards } from "@/db/schema";
import { eq, and, gt, inArray } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

function toPaise(val: number | string | null | undefined): number {
  const n = typeof val === "string" ? parseFloat(val) : Number(val ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromPaise(paise: number): string {
  return (paise / 100).toFixed(2);
}

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

  let processedCount = 0;

  await withTenant(school.id, async (tx) => {
    const pendingInvoices = await tx.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.schoolId, school.id),
        eq(feeInvoices.academicYearId, fromAcademicYearId),
        gt(feeInvoices.balanceAmount, "0"),
        inArray(feeInvoices.studentId, studentIds)
      ),
    });

    // Group pending dues by student in integer paise
    const studentDuesPaiseMap = new Map<string, number>();
    for (const inv of pendingInvoices) {
      if (inv.status === "CANCELLED" || inv.status === "WAIVED") continue;
      const currentPaise = studentDuesPaiseMap.get(inv.studentId) || 0;
      const invPaise = toPaise(inv.balanceAmount);
      if (invPaise > 0) {
        studentDuesPaiseMap.set(inv.studentId, currentPaise + invPaise);
      }
    }

    for (const studentId of studentIds) {
      const duePaise = studentDuesPaiseMap.get(studentId) || 0;
      if (duePaise <= 0) continue;

      const dueAmountStr = fromPaise(duePaise);

      // 1. Record fee_carry_forwards row
      const [carryRecord] = await tx
        .insert(feeCarryForwards)
        .values({
          schoolId: school.id,
          fromAcademicYearId,
          toAcademicYearId,
          studentId,
          previousDueAmount: dueAmountStr,
          carriedAmount: dueAmountStr,
          status: "APPLIED",
          appliedById: ctx.userId,
        })
        .returning();

      if (!carryRecord) continue;

      // 2. Generate opening due invoice (AUTO-09) in toAcademicYearId
      const randSuffix = crypto.randomBytes(2).toString("hex").toUpperCase();
      const invNumber = `CF-${Date.now().toString().slice(-6)}-${randSuffix}`;

      const [openingInvoice] = await tx
        .insert(feeInvoices)
        .values({
          schoolId: school.id,
          studentId,
          academicYearId: toAcademicYearId,
          invoiceNumber: invNumber,
          term: "ANNUAL",
          grossAmount: dueAmountStr,
          discountAmount: "0.00",
          lateFeeAmount: "0.00",
          taxAmount: "0.00",
          netAmount: dueAmountStr,
          paidAmount: "0.00",
          balanceAmount: dueAmountStr,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: "PENDING",
        })
        .returning();

      // 3. Immutable audit log
      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "FEE_CARRIED_FORWARD",
        entityType: "FEE_CARRY_FORWARD",
        entityId: carryRecord.id,
        previousData: { dueAmount: dueAmountStr, fromAcademicYearId },
        newData: { openingInvoiceId: openingInvoice?.id, invNumber, toAcademicYearId },
        reason: `Rolled forward pending balance ₹${dueAmountStr} from session ${fromAcademicYearId} to ${toAcademicYearId}`,
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
