"use server";

import { db } from "@/db";
import { feeGroups, feeGroupHeads, academicYears } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";

export async function createFeeGroup(formData: FormData) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const academicYearId = (formData.get("academicYearId") as string)?.trim();
    const selectedHeads = formData.getAll("feeHeadIds") as string[];

    if (!name || !academicYearId) {
      return { success: false, message: "Name and Academic Year are required" };
    }

    const [group] = await db
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
      await db.insert(feeGroupHeads).values(
        selectedHeads.map((headId) => ({
          feeGroupId: group.id,
          feeHeadId: headId,
        })),
      );
    }

    revalidatePath("/school/fee-groups");
    return { success: true, message: "Fee Group created successfully" };
  } catch (error: any) {
    console.error("Create Fee Group Error:", error);
    return { success: false, message: error.message || "Failed to create fee group" };
  }
}

export async function deleteFeeGroup(groupId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    await db
      .delete(feeGroups)
      .where(and(eq(feeGroups.id, groupId), eq(feeGroups.schoolId, school.id)));

    revalidatePath("/school/fee-groups");
    return { success: true, message: "Fee Group deleted" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
