"use server";

import { db } from "@/db";
import {
  feeStructures,
  feeInvoices,
  students,
  feeConcessions,
  academicYears,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function generateInvoicesForStudent(studentId: string) {
  try {
    const activeYear = await db.query.academicYears.findFirst({
      where: eq(academicYears.isActive, true),
    });

    if (!activeYear)
      return { success: false, message: "No active academic year found" };

    const student = await db.query.students.findFirst({
      where: eq(students.id, studentId),
    });

    if (!student) return { success: false, message: "Student not found" };
    if (!student.currentClassId)
      return { success: false, message: "Student is not assigned to a class" };

    const allStructures = await db.query.feeStructures.findMany({
      where: and(
        eq(feeStructures.academicYearId, activeYear.id),
        eq(feeStructures.classId, student.currentClassId),
      ),
      with: { feeHead: true },
    });

    const studentConcessions = await db.query.feeConcessions.findMany({
      where: and(
        eq(feeConcessions.academicYearId, activeYear.id),
        eq(feeConcessions.studentId, student.id),
      ),
    });

    let generatedCount = 0;

    for (const structure of allStructures) {
      // Check if invoice already exists for this student + structure
      const existingInvoice = await db.query.feeInvoices.findFirst({
        where: and(
          eq(feeInvoices.studentId, student.id),
          eq(feeInvoices.feeStructureId, structure.id),
        ),
      });

      if (existingInvoice) continue;

      // Calculate amounts
      const grossAmount = parseFloat(structure.amount);
      let discountAmount = 0;

      // Find applicable concessions
      const applicableConcession = studentConcessions.find(
        (c) => c.appliesTo === "ALL" || c.appliesTo === structure.feeHeadId,
      );
      if (applicableConcession) {
        if (applicableConcession.discountPercentage) {
          discountAmount =
            grossAmount *
            (parseFloat(applicableConcession.discountPercentage) / 100);
        } else if (applicableConcession.discountAmount) {
          discountAmount = parseFloat(applicableConcession.discountAmount);
        }
      }

      // Cap discount
      if (discountAmount > grossAmount) discountAmount = grossAmount;

      const taxableAmount = grossAmount - discountAmount;
      let taxAmount = 0;
      if (
        (structure.feeHead as any)?.isTaxable &&
        (structure.feeHead as any)?.gstPercentage
      ) {
        taxAmount =
          taxableAmount *
          (parseFloat((structure.feeHead as any).gstPercentage) / 100);
      }

      const netAmount = taxableAmount + taxAmount;

      const invoiceNumber = `INV-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

      await db.insert(feeInvoices).values({
        invoiceNumber,
        schoolId: student.schoolId,
        studentId: student.id,
        academicYearId: activeYear.id,
        feeStructureId: structure.id,
        grossAmount: grossAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        netAmount: netAmount.toFixed(2),
        balanceAmount: netAmount.toFixed(2),
        paidAmount: "0.00",
        dueDate: structure.dueDate,
        status: "PENDING",
        term: structure.term,
      });

      generatedCount++;
    }

    revalidatePath(`/students/${studentId}/fees`);

    if (generatedCount === 0) {
      return {
        success: true,
        message: "No missing invoices to generate. Ledger is up to date.",
      };
    }
    return {
      success: true,
      message: `Successfully generated ${generatedCount} missing invoice(s).`,
    };
  } catch (error: any) {
    console.error("Action Error (generateInvoicesForStudent):", error);
    return { success: false, message: error.message || "An error occurred" };
  }
}
