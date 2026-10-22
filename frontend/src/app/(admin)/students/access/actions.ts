"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import {
  getStudentAccessQueue,
  enableStudentAccess,
  disableStudentAccess,
  resendStudentClaim,
} from "@schoolmitra/backend/lib/studentAccess";
import { revalidatePath } from "next/cache";

export async function fetchStudentAccessQueueAction(options?: {
  search?: string;
  status?: "UNPROVISIONED" | "ACTIVE" | "DISABLED" | "ALL";
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);
    const items = await getStudentAccessQueue(school.id, options);
    return { success: true, items };
  } catch (error: any) {
    console.error("fetchStudentAccessQueueAction error:", error);
    return { success: false, message: error.message || "Failed to fetch student access queue", items: [] };
  }
}

export async function enableStudentAccessAction(studentId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);
    const res = await enableStudentAccess(school.id, studentId, ctx.userId);
    revalidatePath("/students/access");
    return res;
  } catch (error: any) {
    console.error("enableStudentAccessAction error:", error);
    return { success: false, message: error.message || "Failed to enable student access" };
  }
}

export async function disableStudentAccessAction(studentId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);
    const res = await disableStudentAccess(school.id, studentId, ctx.userId);
    revalidatePath("/students/access");
    return res;
  } catch (error: any) {
    console.error("disableStudentAccessAction error:", error);
    return { success: false, message: error.message || "Failed to disable student access" };
  }
}

export async function resendStudentClaimAction(studentId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);
    const res = await resendStudentClaim(school.id, studentId, ctx.userId);
    revalidatePath("/students/access");
    return res;
  } catch (error: any) {
    console.error("resendStudentClaimAction error:", error);
    return { success: false, message: error.message || "Failed to generate claim link" };
  }
}
