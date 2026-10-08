"use server";

import { db } from "@/db";
import { feeInvoices, feePayments, feeHeads, students, academicYears } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import { decryptData } from "@/lib/encryption";

export interface DryRunValidationResult {
  rowNumber: number;
  admissionNumber: string;
  studentName?: string;
  amount: number;
  isValid: boolean;
  error?: string;
}

/**
 * FIX-04: Dry-run preview validator for bulk opening fee balance import.
 * Strictly role-gated to carry_forward_and_import: SUPER_ADMIN, SCHOOL_ADMIN.
 */
export async function validateHistoricalFeeBalances(
  academicYearId: string,
  rows: {
    admissionNumber: string;
    grossAmount: number;
    dueDate?: string;
  }[]
) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    if (!academicYearId) throw new Error("Academic Year is required.");
    if (!rows || rows.length === 0) throw new Error("No data rows supplied for validation.");

    const validationRows: DryRunValidationResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const adm = row.admissionNumber?.trim();
      const gross = row.grossAmount;

      if (!adm) {
        validationRows.push({
          rowNumber: i + 1,
          admissionNumber: "",
          amount: gross || 0,
          isValid: false,
          error: "Admission number is required.",
        });
        continue;
      }

      if (isNaN(gross) || gross <= 0) {
        validationRows.push({
          rowNumber: i + 1,
          admissionNumber: adm,
          amount: gross || 0,
          isValid: false,
          error: `Invalid gross amount '${row.grossAmount}'. Must be greater than 0.`,
        });
        continue;
      }

      const student = await db.query.students.findFirst({
        where: and(
          eq(students.schoolId, school.id),
          eq(students.admissionNumber, adm),
        ),
      });

      if (!student) {
        validationRows.push({
          rowNumber: i + 1,
          admissionNumber: adm,
          amount: gross,
          isValid: false,
          error: `Student '${adm}' not registered in this institution.`,
        });
        continue;
      }

      const fn = decryptData(student.firstNameEncrypted) || "";
      const ln = decryptData(student.lastNameEncrypted) || "";
      const studentName = `${fn} ${ln}`.trim() || "Student";

      validationRows.push({
        rowNumber: i + 1,
        admissionNumber: adm,
        studentName,
        amount: gross,
        isValid: true,
      });
    }

    const validCount = validationRows.filter((r) => r.isValid).length;
    const invalidCount = validationRows.length - validCount;

    return {
      success: true,
      totalCount: validationRows.length,
      validCount,
      invalidCount,
      results: validationRows,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to validate CSV rows",
      results: [],
    };
  }
}

/**
 * FIX-04: Commit imported opening/historical balances into fee_invoices.
 * Strictly role-gated to carry_forward_and_import: SUPER_ADMIN, SCHOOL_ADMIN.
 */
export async function importHistoricalFeeBalances(
  academicYearId: string,
  rows: {
    admissionNumber: string;
    grossAmount: number;
    dueDate?: string;
  }[]
) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
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
          eq(students.admissionNumber, row.admissionNumber.trim()),
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

      await db.transaction(async (tx) => {
        const [inv] = await tx
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

        if (!inv) throw new Error("Failed to insert opening balance invoice.");

        await logFeeAuditEvent(tx, {
          schoolId: school.id,
          action: "HISTORICAL_BALANCE_IMPORTED",
          entityType: "FEE_INVOICE",
          entityId: inv.id,
          reason: `Imported legacy balance ₹${gross.toFixed(2)} for ${student.admissionNumber}`,
          performedById: ctx.userId,
        });
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
