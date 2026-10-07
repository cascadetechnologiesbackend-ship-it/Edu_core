"use server";

import { db } from "@/db";
import { feeDiscounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";

export async function createFeeDiscount(formData: FormData) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim()?.toUpperCase() || null;
    const discountType = (formData.get("discountType") as string) || "PERCENTAGE";
    const discountValue = (formData.get("discountValue") as string)?.trim();
    const appliesToFeeHeadId = (formData.get("appliesToFeeHeadId") as string) || null;
    const requiresApproval = formData.get("requiresApproval") === "on" || formData.get("requiresApproval") === "true";
    const description = (formData.get("description") as string)?.trim() || null;

    if (!name || !discountValue) {
      return { success: false, message: "Discount name and value are required" };
    }

    await db.insert(feeDiscounts).values({
      schoolId: school.id,
      name,
      code,
      discountType,
      discountValue,
      appliesToFeeHeadId: appliesToFeeHeadId === "ALL" ? null : appliesToFeeHeadId,
      requiresApproval,
      description,
      isActive: true,
    });

    revalidatePath("/school/fees-discount");
    return { success: true, message: "Discount policy created successfully" };
  } catch (error: any) {
    console.error("Create Fee Discount Error:", error);
    return { success: false, message: error.message || "Failed to create discount policy" };
  }
}

export async function toggleFeeDiscount(id: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const existing = await db.query.feeDiscounts.findFirst({
      where: and(eq(feeDiscounts.id, id), eq(feeDiscounts.schoolId, school.id)),
    });

    if (!existing) return { success: false, message: "Discount not found" };

    await db
      .update(feeDiscounts)
      .set({
        isActive: !existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(feeDiscounts.id, id));

    revalidatePath("/school/fees-discount");
    return { success: true, message: "Discount status updated" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
