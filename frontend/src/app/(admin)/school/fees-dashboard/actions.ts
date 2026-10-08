"use server";

import { db } from "@/db";
import { academicYears, auditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";

export async function toggleAcademicYearFiscalLockAction(input: {
  academicYearId: string;
  isLocked: boolean;
  reason: string;
}) {
  try {
    // Only SUPER_ADMIN can manage fiscal locks (ACC-06)
    const ctx = await requireAuth(["SUPER_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const reason = input.reason?.trim();
    if (!reason) {
      return {
        success: false,
        message: "A mandatory justification reason is required for fiscal lock/unlock.",
      };
    }

    const ay = await db.query.academicYears.findFirst({
      where: and(
        eq(academicYears.id, input.academicYearId),
        eq(academicYears.schoolId, school.id),
      ),
    });

    if (!ay) {
      return { success: false, message: "Academic year not found for this school." };
    }

    const now = new Date();

    await db
      .update(academicYears)
      .set({
        isLocked: input.isLocked,
        lockedAt: input.isLocked ? now : null,
        lockedById: input.isLocked ? ctx.userId : null,
        lockReason: input.isLocked ? reason : null,
        updatedAt: now,
      })
      .where(eq(academicYears.id, ay.id));

    // Mandatory Audit Log
    await db.insert(auditLogs).values({
      userId: ctx.userId,
      userEmail: ctx.email || "super-admin@schoolmitra.internal",
      userRole: ctx.role,
      schoolId: school.id,
      action: "WRITE",
      tableName: "academic_years",
      recordId: ay.id,
      purposeId: "fiscal_governance",
      ipAddress: "127.0.0.1",
      userAgent: "Fees Dashboard Action",
      metadata: {
        action: input.isLocked ? "LOCK_FISCAL_YEAR" : "UNLOCK_FISCAL_YEAR",
        academicYearLabel: ay.label,
        reason,
      },
    });

    revalidatePath("/school/fees-dashboard");
    revalidatePath("/school/accounting/dashboard");

    return {
      success: true,
      message: `Academic year ${ay.label} ${input.isLocked ? "locked" : "unlocked"} successfully.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to update fiscal lock status.",
    };
  }
}
