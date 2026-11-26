"use server";

import { and, eq, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { staffAttendance } from "@/db/schema";
import { requireAuth, requireSchool } from "@/lib/serverAuth";

export async function markStaffAttendanceAction(input: {
  dateStr: string;
  records: { staffId: string; status: "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" }[];
}) {
  try {
    const ctx = await requireAuth();
    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "VICE_PRINCIPAL", "HR_MANAGER"].includes(ctx.role)) {
      return { success: false, message: "Unauthorized to mark staff attendance." };
    }
    const school = await requireSchool(ctx);
    const schoolId = school.id;

    const targetDate = new Date(`${input.dateStr}T00:00:00.000Z`);
    const startOfDay = new Date(`${input.dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${input.dateStr}T23:59:59.999Z`);

    for (const rec of input.records) {
      const existing = await db.query.staffAttendance.findFirst({
        where: and(
          eq(staffAttendance.schoolId, schoolId),
          eq(staffAttendance.staffId, rec.staffId),
          gte(staffAttendance.attendanceDate, startOfDay),
          lte(staffAttendance.attendanceDate, endOfDay)
        ),
        columns: { id: true },
      });

      if (existing) {
        await db
          .update(staffAttendance)
          .set({
            status: rec.status as any,
          })
          .where(and(eq(staffAttendance.id, existing.id), eq(staffAttendance.schoolId, schoolId)));
      } else {
        await db.insert(staffAttendance).values({
          schoolId,
          staffId: rec.staffId,
          attendanceDate: targetDate,
          status: rec.status as any,
        });
      }
    }

    revalidatePath("/attendance");
    return { success: true, message: `Saved attendance for ${input.records.length} staff members.` };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to save staff attendance." };
  }
}
