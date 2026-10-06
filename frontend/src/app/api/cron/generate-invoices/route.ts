import { db } from "@/db";
import {
  feeStructures,
  feeInvoices,
  students,
  feeConcessions,
  academicYears,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { withCronAuth } from "@/lib/apiAuth";

export const POST = withCronAuth(async () => {
  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });

  if (!activeYear)
    return NextResponse.json(
      { error: "No active academic year found" },
      { status: 400 },
    );

  const activeStudents = await db.query.students.findMany({
    where: eq(students.isActive, true),
  });

  const allStructures = await db.query.feeStructures.findMany({
    where: eq(feeStructures.academicYearId, activeYear.id),
    with: { feeHead: true },
  });

  const allConcessions = await db.query.feeConcessions.findMany({
    where: eq(feeConcessions.academicYearId, activeYear.id),
  });

  let generatedCount = 0;

  for (const student of activeStudents) {
    if (!student.currentClassId) continue;

    const studentStructures = allStructures.filter(
      (s) => s.classId === student.currentClassId,
    );
    const studentConcessions = allConcessions.filter(
      (c) => c.studentId === student.id,
    );

    // Pre-fetch all existing invoices for this student to eliminate loop queries
    const existingInvoices = await db.query.feeInvoices.findMany({
      where: eq(feeInvoices.studentId, student.id),
      columns: { feeStructureId: true },
    });
    const existingStructureIds = new Set(existingInvoices.map((i) => i.feeStructureId));

    const invoicesToInsert: any[] = [];

    for (const structure of studentStructures) {
      if (existingStructureIds.has(structure.id)) continue;

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

      invoicesToInsert.push({
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
    }

    if (invoicesToInsert.length > 0) {
      await db.insert(feeInvoices).values(invoicesToInsert);
      generatedCount += invoicesToInsert.length;
    }
  }

  return NextResponse.json({
    success: true,
    message: `Generated ${generatedCount} invoices.`,
  });
});
