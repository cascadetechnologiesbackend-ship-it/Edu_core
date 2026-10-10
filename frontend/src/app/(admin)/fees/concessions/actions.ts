"use server";

import { db } from "@/db";
import { feeConcessions } from "@/db/schema";
import { revalidatePath } from "next/cache";

import { requireAuth, requireSchool } from "@/lib/serverAuth";

export async function createFeeConcession(formData: FormData) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const academicYearId = formData.get("academicYearId") as string;
    const studentId = formData.get("studentId") as string;
    const concessionType = formData.get("concessionType") as any;
    const concessionName = formData.get("concessionName") as string;
    const appliesTo = formData.get("appliesTo") as string;
    const discountPercentage = formData.get("discountPercentage") as string;
    const discountAmount = formData.get("discountAmount") as string;

    await db.insert(feeConcessions).values({
      schoolId: school.id,
      academicYearId,
      studentId,
      concessionType,
      concessionName,
      appliesTo: appliesTo || "ALL",
      discountPercentage: discountPercentage ? discountPercentage : null,
      discountAmount: discountAmount ? discountAmount : null,
      approvedById: ctx.userId,
    });

    revalidatePath("/fees/concessions");
    revalidatePath("/school/fees-discount");
    revalidatePath("/school/collect-fees");
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
