"use server";

import { db } from "@/db";
import { feeHeads } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";

export async function createFeeHead(formData: FormData) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim()?.toUpperCase() || null;
    const description = (formData.get("description") as string)?.trim() || null;
    const category = (formData.get("category") as string) || "RECURRING";
    const headType = (formData.get("headType") as any) || "TUITION";
    const priority = parseInt((formData.get("priority") as string) || "99", 10);
    const discountEligible = formData.get("discountEligible") === "on" || formData.get("discountEligible") === "true";
    const lateFineEligible = formData.get("lateFineEligible") === "on" || formData.get("lateFineEligible") === "true";
    const isRefundable = formData.get("isRefundable") === "on" || formData.get("isRefundable") === "true";
    const isTaxable = formData.get("isTaxable") === "on" || formData.get("isTaxable") === "true";
    const gstPercentage = isTaxable ? (formData.get("gstPercentage") as string) || "0" : "0";

    if (!name) {
      return { success: false, message: "Fee head name is required" };
    }

    // Check duplicate
    const existing = await db.query.feeHeads.findFirst({
      where: and(
        eq(feeHeads.schoolId, school.id),
        eq(feeHeads.name, name),
      ),
    });

    if (existing) {
      return { success: false, message: `Fee head '${name}' already exists` };
    }

    await db.insert(feeHeads).values({
      schoolId: school.id,
      name,
      code,
      description,
      category,
      headType,
      priority,
      discountEligible,
      lateFineEligible,
      isRefundable,
      isTaxable,
      gstPercentage,
      isActive: true,
    });

    revalidatePath("/school/fee-types");
    return { success: true, message: "Fee Head created successfully" };
  } catch (error: any) {
    console.error("Create Fee Head Error:", error);
    return { success: false, message: error.message || "Failed to create fee head" };
  }
}

export async function toggleFeeHeadStatus(id: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const existing = await db.query.feeHeads.findFirst({
      where: and(eq(feeHeads.id, id), eq(feeHeads.schoolId, school.id)),
    });

    if (!existing) {
      return { success: false, message: "Fee head not found" };
    }

    await db
      .update(feeHeads)
      .set({
        isActive: !existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(feeHeads.id, id));

    revalidatePath("/school/fee-types");
    return { success: true, message: `Fee Head ${existing.isActive ? "deactivated" : "activated"}` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
