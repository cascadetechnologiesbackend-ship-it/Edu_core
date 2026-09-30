import { db } from "@/db";
import { leaveBalances, leaveTypes, staff } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Carries forward leave balances from one academic year to the next.
 * Typically run on April 1.
 *
 * Rules:
 * - CL (Casual Leave) resets to 0 carried forward.
 * - SL (Sick Leave) resets to 0 carried forward.
 * - ML (Maternity Leave) resets to 0 carried forward.
 * - EL (Earned Leave) carries forward any unused balance, capped at a maximum of 30 days.
 */
export async function carryForwardLeaveBalances(
  schoolId: string,
  fromYearId: string,
  toYearId: string,
) {
  // 1. Fetch all active staff
  const allStaff = await db.query.staff.findMany({
    where: eq(staff.schoolId, schoolId),
  });

  // 2. Fetch all leave types configured for the school
  const schoolLeaveTypes = await db.query.leaveTypes.findMany({
    where: eq(leaveTypes.schoolId, schoolId),
  });

  let createdCount = 0;

  for (const s of allStaff) {
    // Query existing balances for the previous year
    const oldBalances = await db.query.leaveBalances.findMany({
      where: and(
        eq(leaveBalances.staffId, s.id),
        eq(leaveBalances.academicYearId, fromYearId),
      ),
    });

    for (const lt of schoolLeaveTypes) {
      let carriedForward = 0;

      // EL carry forward logic
      if (lt.code === "EL") {
        const oldEl = oldBalances.find((b) => b.leaveType === "EL");
        if (oldEl) {
          const oldAllocated = parseFloat(oldEl.allocatedDays);
          const oldUsed = parseFloat(oldEl.usedDays);
          const oldCarried = parseFloat(oldEl.carriedForwardDays);
          const unused = oldAllocated + oldCarried - oldUsed;

          // Cap carry forward at 30 days
          carriedForward = Math.max(0, Math.min(unused, 30));
        }
      }

      // Check if balance already exists for the new year
      const existingNewBalance = await db.query.leaveBalances.findFirst({
        where: and(
          eq(leaveBalances.staffId, s.id),
          eq(leaveBalances.academicYearId, toYearId),
          eq(leaveBalances.leaveType, lt.code),
        ),
      });

      if (!existingNewBalance) {
        await db.insert(leaveBalances).values({
          schoolId,
          staffId: s.id,
          leaveType: lt.code,
          academicYearId: toYearId,
          allocatedDays: lt.maxDaysPerYear.toString(),
          usedDays: "0.0",
          carriedForwardDays: carriedForward.toFixed(1),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        createdCount++;
      }
    }
  }

  return { success: true, createdBalancesCount: createdCount };
}
