import { db } from "@/db";
import {
  feeStructures,
  feeInvoices,
  students,
  feeConcessions,
  academicYears,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

/**
 * Automatically assigns/generates fee invoices for a specific student based on
 * active class-wise fee structures and any applicable concessions.
 */
export async function autoAssignFeeStructuresToStudent(
  studentId: string,
  tx?: any
): Promise<number> {
  const dbOrTx = tx || db;

  const student = await dbOrTx.query.students.findFirst({
    where: eq(students.id, studentId),
  });

  if (!student || !student.currentClassId || !student.isActive) {
    return 0;
  }

  // Find active academic year for student
  const activeYear =
    (await dbOrTx.query.academicYears.findFirst({
      where: and(
        eq(academicYears.id, student.academicYearId),
        eq(academicYears.isActive, true),
      ),
    })) ||
    (await dbOrTx.query.academicYears.findFirst({
      where: and(
        eq(academicYears.schoolId, student.schoolId),
        eq(academicYears.isActive, true),
      ),
    }));

  if (!activeYear) return 0;

  // Query all active fee structures for student's current class
  const classStructures = await dbOrTx.query.feeStructures.findMany({
    where: and(
      eq(feeStructures.schoolId, student.schoolId),
      eq(feeStructures.academicYearId, activeYear.id),
      eq(feeStructures.classId, student.currentClassId),
      eq(feeStructures.isActive, true),
    ),
    with: { feeHead: true },
  });

  if (!classStructures || classStructures.length === 0) return 0;

  // Query student concessions
  const concessions = await dbOrTx.query.feeConcessions.findMany({
    where: and(
      eq(feeConcessions.academicYearId, activeYear.id),
      eq(feeConcessions.studentId, student.id),
    ),
  });

  let generatedCount = 0;

  for (const structure of classStructures) {
    const grossAmount = parseFloat(structure.amount || "0");
    if (grossAmount <= 0) continue;

    const headType = (structure.feeHead as any)?.headType;
    const headCode = (structure.feeHead as any)?.code;
    const headName = ((structure.feeHead as any)?.name || "").toLowerCase();

    // 1. Transport Opt-In Check: Skip if fee head is Transport and student did NOT opt in
    const isTransportHead =
      headType === "TRANSPORT" ||
      headCode === "TRN" ||
      headName.includes("transport");
    if (isTransportHead && !student.optInTransport) {
      continue;
    }

    // 2. Hostel Opt-In Check: Skip if fee head is Hostel and student did NOT opt in
    const isHostelHead =
      headType === "HOSTEL" ||
      headCode === "HST" ||
      headName.includes("hostel");
    if (isHostelHead && !student.optInHostel) {
      continue;
    }

    // Check if invoice already exists for this student + structure
    const existingInvoice = await dbOrTx.query.feeInvoices.findFirst({
      where: and(
        eq(feeInvoices.studentId, student.id),
        eq(feeInvoices.feeStructureId, structure.id),
      ),
    });

    if (existingInvoice) continue;

    // Calculate concession discount
    let discountAmount = 0;
    const applicableConcession = concessions.find(
      (c: any) => c.appliesTo === "ALL" || c.appliesTo === structure.feeHeadId,
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

    await dbOrTx.insert(feeInvoices).values({
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

  return generatedCount;
}

/**
 * Automatically assigns/generates fee invoices for ALL active students in a specific class.
 */
export async function autoAssignFeeStructuresForClass(
  schoolId: string,
  academicYearId: string,
  classId: string,
  tx?: any
): Promise<number> {
  const dbOrTx = tx || db;

  const classStudents = await dbOrTx.query.students.findMany({
    where: and(
      eq(students.schoolId, schoolId),
      eq(students.currentClassId, classId),
      eq(students.isActive, true),
    ),
  });

  let totalGenerated = 0;
  for (const student of classStudents) {
    const count = await autoAssignFeeStructuresToStudent(student.id, dbOrTx);
    totalGenerated += count;
  }

  return totalGenerated;
}
