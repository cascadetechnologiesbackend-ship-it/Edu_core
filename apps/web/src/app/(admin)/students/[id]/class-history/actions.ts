"use server";

import { db } from "@/db";
import { studentClassHistory } from "@/db/schema";
import { revalidatePath } from "next/cache";

export async function promoteStudent(studentId: string, formData: FormData) {
  try {
    const schoolId = formData.get("schoolId") as string;
    const academicYearId = formData.get("academicYearId") as string;
    const classId = formData.get("classId") as string;
    const sectionId = formData.get("sectionId") as string;
    
    if (!schoolId || !academicYearId || !classId || !sectionId) {
      return { success: false, message: "Missing required fields" };
    }

    await db.insert(studentClassHistory).values({
      studentId,
      schoolId,
      academicYearId,
      classId,
      sectionId,
      promotionStatus: "PROMOTED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath(`/students/${studentId}/class-history`);
    return { success: true };
  } catch (error: any) {
    console.error("Promotion error:", error);
    return { success: false, message: error?.message || "Failed to promote student" };
  }
}
