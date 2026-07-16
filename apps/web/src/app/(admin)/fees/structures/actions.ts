"use server";

import { db } from "@/db";
import { feeStructures, feeHeads } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function createFeeHead(formData: FormData) {
  try {
    const schoolId = formData.get("schoolId") as string;
    const name = formData.get("name") as string;
    const headType = formData.get("headType") as any;
    const isTaxable = formData.get("isTaxable") === "on";
    const gstPercentage = formData.get("gstPercentage") as string;

    await db.insert(feeHeads).values({
      schoolId,
      name,
      headType,
      isTaxable,
      gstPercentage: gstPercentage || "0",
    });

    revalidatePath("/fees/structures");
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function createFeeStructure(formData: FormData) {
  try {
    const schoolId = formData.get("schoolId") as string;
    const academicYearId = formData.get("academicYearId") as string;
    const classId = formData.get("classId") as string;
    const feeHeadId = formData.get("feeHeadId") as string;
    const term = formData.get("term") as any;
    const amount = formData.get("amount") as string;
    const dueDate = new Date(formData.get("dueDate") as string);

    const lateFeeType = formData.get("lateFeeType") as any;
    const lateFeeAmount = formData.get("lateFeeAmount") as string;
    const lateFeeStartAfterDays = formData.get(
      "lateFeeStartAfterDays",
    ) as string;

    await db.insert(feeStructures).values({
      schoolId,
      academicYearId,
      classId,
      feeHeadId,
      term,
      amount,
      dueDate,
      lateFeeType: lateFeeType || null,
      lateFeeAmount: lateFeeAmount || null,
      lateFeeStartAfterDays: lateFeeStartAfterDays
        ? parseInt(lateFeeStartAfterDays)
        : null,
    });

    revalidatePath("/fees/structures");
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
