"use server";

import { db } from "@/db";
import { feeStructures, feeInvoices, students, academicYears, feeConcessions } from "@/db/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import crypto from "crypto";

export async function assignFeeStructure(formData: FormData) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const academicYearId = formData.get("academicYearId") as string;
    const classId = formData.get("classId") as string;
    const feeHeadId = formData.get("feeHeadId") as string;
    const term = (formData.get("term") as any) || "ANNUAL";
    const amountStr = formData.get("amount") as string;
    const dueDateStr = formData.get("dueDate") as string;
    const lateFeeAmountStr = (formData.get("lateFeeAmount") as string) || "0";
    const autoGenerateInvoices = formData.get("autoGenerateInvoices") === "on" || formData.get("autoGenerateInvoices") === "true";

    const amount = parseFloat(amountStr);
    if (!academicYearId || !classId || !feeHeadId || isNaN(amount) || !dueDateStr) {
      return { success: false, message: "Missing required structure fields" };
    }

    const dueDate = new Date(dueDateStr);

    let structureId: string;

    // Check existing
    const existing = await db.query.feeStructures.findFirst({
      where: and(
        eq(feeStructures.schoolId, school.id),
        eq(feeStructures.academicYearId, academicYearId),
        eq(feeStructures.classId, classId),
        eq(feeStructures.feeHeadId, feeHeadId),
        eq(feeStructures.term, term),
      ),
    });

    if (existing) {
      await db
        .update(feeStructures)
        .set({
          amount: amount.toFixed(2),
          dueDate,
          lateFeeAmount: parseFloat(lateFeeAmountStr).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(feeStructures.id, existing.id));
      structureId = existing.id;
    } else {
      const [newStruct] = await db
        .insert(feeStructures)
        .values({
          schoolId: school.id,
          academicYearId,
          classId,
          feeHeadId,
          term,
          amount: amount.toFixed(2),
          dueDate,
          lateFeeAmount: parseFloat(lateFeeAmountStr).toFixed(2),
          isActive: true,
        })
        .returning();
      if (!newStruct) throw new Error("Failed to create fee structure.");
      structureId = newStruct.id;
    }

    // Auto generate/sync student invoices for this class
    if (autoGenerateInvoices) {
      const classStudents = await db.query.students.findMany({
        where: and(
          eq(students.schoolId, school.id),
          eq(students.currentClassId, classId),
          eq(students.isActive, true),
        ),
      });

      const studentIds = classStudents.map((s) => s.id);
      const studentConcessions =
        studentIds.length > 0
          ? await db.query.feeConcessions.findMany({
              where: and(
                eq(feeConcessions.schoolId, school.id),
                eq(feeConcessions.academicYearId, academicYearId),
                eq(feeConcessions.isActive, true),
                isNotNull(feeConcessions.studentId),
                isNotNull(feeConcessions.approvedAt),
                inArray(feeConcessions.studentId, studentIds),
              ),
            })
          : [];

      for (const st of classStudents) {
        // Check if invoice already exists for this student & structure
        const existingInv = await db.query.feeInvoices.findFirst({
          where: and(
            eq(feeInvoices.studentId, st.id),
            eq(feeInvoices.feeStructureId, structureId),
          ),
        });

        if (!existingInv) {
          // AUTO-06: Calculate applicable student concessions
          const studentConcessionList = studentConcessions.filter(
            (c) => c.studentId === st.id,
          );
          const applicableConcession = studentConcessionList.find(
            (c) => c.appliesTo === "ALL" || c.appliesTo === feeHeadId,
          );

          let discountAmount = 0;
          if (applicableConcession) {
            if (applicableConcession.discountPercentage) {
              discountAmount =
                amount *
                (parseFloat(applicableConcession.discountPercentage) / 100);
            } else if (applicableConcession.discountAmount) {
              discountAmount = parseFloat(applicableConcession.discountAmount);
            }
          }
          if (discountAmount > amount) discountAmount = amount;
          const netAmount = Math.max(0, amount - discountAmount);

          const invNum = `INV-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
          await db.insert(feeInvoices).values({
            invoiceNumber: invNum,
            schoolId: school.id,
            studentId: st.id,
            academicYearId,
            feeStructureId: structureId,
            grossAmount: amount.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            lateFeeAmount: "0.00",
            taxAmount: "0.00",
            netAmount: netAmount.toFixed(2),
            paidAmount: "0.00",
            balanceAmount: netAmount.toFixed(2),
            dueDate,
            term,
            status: "PENDING",
          });
        }
      }
    }

    revalidatePath("/school/assign-fees");
    return { success: true, message: "Fee structure assigned and invoices generated!" };
  } catch (error: any) {
    console.error("Assign Fee Error:", error);
    return { success: false, message: error.message || "Failed to assign fees" };
  }
}
