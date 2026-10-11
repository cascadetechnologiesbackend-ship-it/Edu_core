import { db } from "@/db";
import { schools, students, academicYears } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withCronAuth } from "@/lib/apiAuth";
import { autoAssignFeeStructuresToStudent } from "@/lib/feeAssignmentEngine";

export const POST = withCronAuth(async () => {
  // 1. Fetch all registered schools to iterate per-tenant
  const allSchools = await db.query.schools.findMany({
    columns: { id: true, name: true },
  });

  let totalInvoicesGenerated = 0;
  let processedSchools = 0;

  for (const school of allSchools) {
    // 2. Resolve that specific school's active academic year
    const activeYear = await db.query.academicYears.findFirst({
      where: and(
        eq(academicYears.schoolId, school.id),
        eq(academicYears.isActive, true),
      ),
    });

    if (!activeYear) {
      // School has no active academic year configured; skip
      continue;
    }

    // 3. Find active students enrolled in this school
    const activeStudents = await db.query.students.findMany({
      where: and(
        eq(students.schoolId, school.id),
        eq(students.isActive, true),
      ),
      columns: { id: true, currentClassId: true },
    });

    // 4. Delegate invoice calculation to autoAssignFeeStructuresToStudent for consistency
    for (const student of activeStudents) {
      if (!student.currentClassId) continue;
      const count = await autoAssignFeeStructuresToStudent(student.id);
      totalInvoicesGenerated += count;
    }

    processedSchools++;
  }

  return NextResponse.json({
    success: true,
    message: `Generated ${totalInvoicesGenerated} invoices across ${processedSchools} schools.`,
    data: {
      schoolsProcessed: processedSchools,
      invoicesGenerated: totalInvoicesGenerated,
    },
  });
});
