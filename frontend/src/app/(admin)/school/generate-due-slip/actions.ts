"use server";

import { db } from "@/db";
import { feeDueSlips, feeInvoices } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import crypto from "crypto";

export async function createDueSlipBatch(formData: FormData) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const classId = (formData.get("classId") as string) || null;
    const academicYearId = formData.get("academicYearId") as string;

    if (!academicYearId) {
      return { success: false, message: "Academic Year is required" };
    }

    // Count pending invoices
    const pendingInvoices = await db.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.schoolId, school.id),
        eq(feeInvoices.academicYearId, academicYearId),
        inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"]),
      ),
    });

    const slipCount = pendingInvoices.length;
    const batchNumber = `SLIP-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    await db.insert(feeDueSlips).values({
      schoolId: school.id,
      batchNumber,
      classId: classId === "ALL" ? null : classId,
      academicYearId,
      slipCount,
      status: "GENERATED",
      generatedById: ctx.userId,
    });

    revalidatePath("/school/generate-due-slip");
    revalidatePath("/school/due-slip-history");

    return {
      success: true,
      message: `Batch #${batchNumber} generated with ${slipCount} demand slips!`,
      batchNumber,
      slipCount,
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
