"use server";

import { db } from "@/db";
import { feeConcessions } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function createFeeConcession(formData: FormData) {
  try {
    const schoolId = formData.get("schoolId") as string;
    const academicYearId = formData.get("academicYearId") as string;
    const studentId = formData.get("studentId") as string;
    const concessionType = formData.get("concessionType") as any;
    const concessionName = formData.get("concessionName") as string;
    const appliesTo = formData.get("appliesTo") as string;
    const discountPercentage = formData.get("discountPercentage") as string;
    const discountAmount = formData.get("discountAmount") as string;
    const approvedById = formData.get("approvedById") as string;

    await db.insert(feeConcessions).values({
      schoolId,
      academicYearId,
      studentId,
      concessionType,
      concessionName,
      appliesTo: appliesTo || "ALL",
      discountPercentage: discountPercentage ? discountPercentage : null,
      discountAmount: discountAmount ? discountAmount : null,
      approvedById,
    });

    revalidatePath("/fees/concessions");
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
