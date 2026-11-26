"use server";

import { withTenant } from "@/db";
import { feeGroups, feeGroupHeads } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";

export async function createFeeGroup(formData: FormData) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const academicYearId = (formData.get("academicYearId") as string)?.trim();
    const selectedHeads = formData.getAll("feeHeadIds") as string[];

    if (!name || !academicYearId) {
      return { success: false, message: "Name and Academic Year are required" };
    }

    await withTenant(school.id, async (tx) => {
      const [group] = await tx
        .insert(feeGroups)
        .values({
          schoolId: school.id,
          academicYearId,
          name,
          description,
          isActive: true,
        })
        .returning();

      if (group && selectedHeads.length > 0) {
        await tx.insert(feeGroupHeads).values(
          selectedHeads.map((headId) => ({
            feeGroupId: group.id,
            feeHeadId: headId,
          })),
        );
      }

      if (group) {
        await logFeeAuditEvent(tx, {
          schoolId: school.id,
          action: "CREATE_FEE_GROUP",
          entityType: "FEE_GROUP",
          entityId: group.id,
          newData: { name, academicYearId, feeHeadIds: selectedHeads },
          reason: `Fee group '${name}' created`,
          performedById: ctx.userId,
        });
      }
    });

    revalidatePath("/school/fee-groups");
    return { success: true, message: "Fee Group created successfully" };
  } catch (error: any) {
    console.error("Create Fee Group Error:", error);
    return { success: false, message: error.message || "Failed to create fee group" };
  }
}

export async function deleteFeeGroup(groupId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const res = await withTenant(school.id, async (tx) => {
      const existing = await tx.query.feeGroups.findFirst({
        where: and(
          eq(feeGroups.id, groupId),
          eq(feeGroups.schoolId, school.id),
          isNull(feeGroups.deletedAt),
        ),
      });

      if (!existing) {
        return { success: false, message: "Fee Group not found" };
      }

      const now = new Date();
      await tx
        .update(feeGroups)
        .set({
          isActive: false,
          deletedAt: now,
          updatedAt: now,
        })
        .where(and(eq(feeGroups.id, groupId), eq(feeGroups.schoolId, school.id)));

      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: "SOFT_DELETE_FEE_GROUP",
        entityType: "FEE_GROUP",
        entityId: groupId,
        previousData: { name: existing.name, isActive: existing.isActive },
        newData: { isActive: false, deletedAt: now.toISOString() },
        reason: `Fee group '${existing.name}' soft-deleted`,
        performedById: ctx.userId,
      });

      return { success: true, message: "Fee Group deleted" };
    });

    if (res.success) {
      revalidatePath("/school/fee-groups");
    }
    return res;
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
