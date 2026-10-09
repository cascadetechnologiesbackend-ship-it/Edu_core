"use server";

import { db } from "@/db";
import { feeDiscounts, feeConcessions, staff, students } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import { decryptData } from "@/lib/encryption";
import { invalidateFinanceTags } from "@/lib/financeCache";

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

/**
 * FIX-01 & RIF-04: Allocate individual student concession assignment.
 * Role-gated to concessions_configure: SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT.
 * If created by ACCOUNTANT, requires approval by SCHOOL_ADMIN/SUPER_ADMIN.
 */
export async function allocateStudentConcessionAction(payload: {
  studentId: string;
  academicYearId: string;
  concessionType: "STAFF_WARD" | "SIBLING" | "RTE_FREE" | "MERIT_SCHOLARSHIP" | "CUSTOM" | "MANAGEMENT_QUOTA";
  concessionName: string;
  appliesTo?: string; // "ALL" or fee_head_id
  discountPercentage?: number | null;
  discountAmount?: number | null;
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
    const school = await requireSchool(ctx);

    const isAutoApproved = ctx.role === "SUPER_ADMIN" || ctx.role === "SCHOOL_ADMIN";
    const approvedById = isAutoApproved ? ctx.userId : null;
    const approvedAt = isAutoApproved ? new Date() : null;

    const [created] = await db
      .insert(feeConcessions)
      .values({
        schoolId: school.id,
        studentId: payload.studentId,
        academicYearId: payload.academicYearId,
        concessionType: payload.concessionType,
        concessionName: payload.concessionName,
        appliesTo: payload.appliesTo || "ALL",
        discountPercentage: payload.discountPercentage != null ? payload.discountPercentage.toString() : null,
        discountAmount: payload.discountAmount != null ? payload.discountAmount.toString() : null,
        approvedById,
        approvedAt,
        isActive: true,
      })
      .returning();

    if (!created) throw new Error("Failed to create concession allocation.");

    await logFeeAuditEvent(db, {
      schoolId: school.id,
      action: isAutoApproved ? "CONCESSION_ALLOCATED" : "CONCESSION_REQUESTED",
      entityType: "FEE_CONCESSION",
      entityId: created.id,
      newData: {
        studentId: payload.studentId,
        concessionType: payload.concessionType,
        concessionName: payload.concessionName,
        discountPercentage: payload.discountPercentage,
        discountAmount: payload.discountAmount,
        status: isAutoApproved ? "APPROVED" : "PENDING_APPROVAL",
      },
      reason: `Student concession assignment created by ${ctx.role}`,
      performedById: ctx.userId,
    });

    await invalidateFinanceTags(school.id, [`school:${school.id}`, `fin:concessions:${school.id}`]);

    revalidatePath("/school/fees-discount");
    revalidatePath(`/students/${payload.studentId}`);
    return {
      success: true,
      message: isAutoApproved
        ? "Concession allocated and approved successfully."
        : "Concession allocation submitted for administrative approval.",
      concession: created,
    };
  } catch (error: any) {
    console.error("allocateStudentConcessionAction error:", error);
    return { success: false, message: error.message || "Failed to allocate concession" };
  }
}

/**
 * FIX-01 & RIF-04: Approve student concession.
 * Strictly role-gated to concessions_approve: SUPER_ADMIN, SCHOOL_ADMIN.
 * ACCOUNTANT receives 403 / auth rejection.
 */
export async function approveStudentConcessionAction(concessionId: string) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const existing = await db.query.feeConcessions.findFirst({
      where: and(eq(feeConcessions.id, concessionId), eq(feeConcessions.schoolId, school.id)),
    });

    if (!existing) return { success: false, message: "Concession assignment not found" };

    const [updated] = await db
      .update(feeConcessions)
      .set({
        approvedById: ctx.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(feeConcessions.id, concessionId))
      .returning();

    await logFeeAuditEvent(db, {
      schoolId: school.id,
      action: "CONCESSION_APPROVED",
      entityType: "FEE_CONCESSION",
      entityId: concessionId,
      previousData: { approvedById: existing.approvedById, approvedAt: existing.approvedAt },
      newData: { approvedById: ctx.userId, approvedAt: updated?.approvedAt },
      reason: `Concession assignment approved by ${ctx.role}`,
      performedById: ctx.userId,
    });

    await invalidateFinanceTags(school.id, [`school:${school.id}`, `fin:concessions:${school.id}`]);

    revalidatePath("/school/fees-discount");
    return { success: true, message: "Concession assignment approved." };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * RIF-07: Staff-ward concession suggestions.
 * Surfaces candidates to concessions_approve roles ONLY: SUPER_ADMIN, SCHOOL_ADMIN.
 * ACCOUNTANT and HR_MANAGER receive 403 / auth rejection.
 */
export async function getStaffWardConcessionSuggestionsAction() {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const activeStaff = await db.query.staff.findMany({
      where: and(eq(staff.schoolId, school.id), eq(staff.isActive, true)),
      with: {
        user: true,
      },
    });

    const allStudents = await db.query.students.findMany({
      where: and(eq(students.schoolId, school.id), eq(students.isActive, true)),
    });

    const suggestions: Array<{
      studentId: string;
      studentName: string;
      admissionNumber: string;
      staffId: string;
      staffName: string;
      staffCode: string;
      suggestedConcessionType: "STAFF_WARD";
    }> = [];

    for (const st of allStudents) {
      const sFirst = decryptData(st.firstNameEncrypted) || "";
      const sLast = decryptData(st.lastNameEncrypted) || "";
      const sName = `${sFirst} ${sLast}`.trim();

      for (const sf of activeStaff) {
        const sfFirst = decryptData(sf.firstNameEncrypted) || "";
        const sfLast = decryptData(sf.lastNameEncrypted) || "";
        const sfName = `${sfFirst} ${sfLast}`.trim();

        if (sfLast && sLast && sfLast.toLowerCase() === sLast.toLowerCase()) {
          suggestions.push({
            studentId: st.id,
            studentName: sName,
            admissionNumber: st.admissionNumber,
            staffId: sf.id,
            staffName: sfName,
            staffCode: sf.employeeCode,
            suggestedConcessionType: "STAFF_WARD",
          });
          break;
        }
      }
    }

    return { success: true, suggestions };
  } catch (error: any) {
    return { success: false, message: error.message, suggestions: [] };
  }
}
