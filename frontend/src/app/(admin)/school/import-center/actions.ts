"use server";

import { db } from "@/db";
import { feeInvoices, feePayments, feeHeads, students, academicYears, feeAuditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";

export async function importHistoricalFeeBalances(
  academicYearId: string,
  rows: {
    admissionNumber: string;
    grossAmount: number;
    dueDate?: string;
  }[]
) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
  const school = await requireSchool(ctx);

  if (!academicYearId) throw new Error("Academic Year is required.");
  if (!rows || rows.length === 0) throw new Error("No data rows supplied for import.");

  let successCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    try {
      const student = await db.query.students.findFirst({
        where: and(
          eq(students.schoolId, school.id),
          eq(students.admissionNumber, row.admissionNumber.trim())
        ),
      });

      if (!student) {
        errors.push(`Row ${i + 1}: Student with Adm No '${row.admissionNumber}' not found.`);
        continue;
      }

      const gross = row.grossAmount;
      if (isNaN(gross) || gross <= 0) {
        errors.push(`Row ${i + 1}: Invalid gross amount '${row.grossAmount}'.`);
        continue;
      }

      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `IMP-${Date.now().toString().slice(-6)}-${randSuffix}`;
      const dueDate = row.dueDate ? new Date(row.dueDate) : new Date(Date.now() + 30 * 86400000);

      const [inv] = await db
        .insert(feeInvoices)
        .values({
          schoolId: school.id,
          studentId: student.id,
          academicYearId,
          invoiceNumber,
          term: "ANNUAL",
          grossAmount: gross.toFixed(2),
          discountAmount: "0",
          lateFeeAmount: "0",
          taxAmount: "0",
          netAmount: gross.toFixed(2),
          paidAmount: "0",
          balanceAmount: gross.toFixed(2),
          dueDate,
          status: "PENDING",
        })
        .returning();

      if (!inv) continue;

      await db.insert(feeAuditLogs).values({
        schoolId: school.id,
        action: "HISTORICAL_BALANCE_IMPORTED",
        entityType: "FEE_INVOICE",
        entityId: inv.id,
        reason: `Imported legacy balance ₹${gross.toFixed(2)} for ${student.admissionNumber}`,
        performedById: ctx.userId,
      });

      successCount++;
    } catch (err: any) {
      errors.push(`Row ${i + 1}: ${err.message || "Failed to process row"}`);
    }
  }

  revalidatePath("/school/import-center");
  revalidatePath("/school/due-fees");
  return { success: true, count: successCount, errors };
}
