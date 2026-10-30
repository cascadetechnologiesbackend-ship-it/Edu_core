"use server";

import { db } from "@/db";
import { schools, academicYears } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/serverAuth";
import { signImpersonationToken } from "@/lib/impersonation";
import { logPlatformAuditEvent } from "@/lib/auditLogger";
import { invalidateSchoolCache } from "@/lib/schoolCache";
import { revalidatePath } from "next/cache";

// Server action for Impersonation
export async function startImpersonationAction(formData: FormData) {
  const authCtx = await requireAuth(["SUPER_ADMIN"]);

  const schoolId = formData.get("schoolId") as string;
  const schoolName = formData.get("schoolName") as string;

  if (!schoolId) return;

  const token = signImpersonationToken(
    {
      superAdminId: authCtx.userId,
      superAdminEmail: authCtx.email ?? "",
      schoolId,
      schoolName: schoolName || "School Instance",
      role: "SCHOOL_ADMIN",
    },
    60,
  );

  await logPlatformAuditEvent({
    superAdminId: authCtx.userId,
    superAdminEmail: authCtx.email ?? "",
    action: "START_IMPERSONATION",
    targetSchoolId: schoolId,
    entityType: "school",
    entityId: schoolId,
    metadata: {
      schoolName: schoolName || "School Instance",
      ttlMinutes: 60,
    },
  });

  const isHttps = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "").startsWith("https://");
  const cookieStore = cookies();
  cookieStore.set("sm_impersonation", token, {
    path: "/",
    maxAge: 3600, // 60 mins hard TTL
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
  });

  redirect("/dashboard");
}

// Server action for Status Lifecycle (R-14 Generic Administrative Suspension)
export async function toggleSchoolStatusAction(formData: FormData) {
  const authCtx = await requireAuth(["SUPER_ADMIN"]);

  const schoolId = formData.get("schoolId") as string;
  const currentStatus = formData.get("currentStatus") as string;
  const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

  if (!schoolId) return { success: false, error: "School ID is required" };

  try {
    await db
      .update(schools)
      .set({
        status: newStatus,
        suspensionReason:
          newStatus === "SUSPENDED"
            ? "Administrative review pending"
            : null,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, schoolId));

    await logPlatformAuditEvent({
      superAdminId: authCtx.userId,
      superAdminEmail: authCtx.email ?? "",
      action: newStatus === "SUSPENDED" ? "SUSPEND_SCHOOL" : "ACTIVATE_SCHOOL",
      targetSchoolId: schoolId,
      entityType: "school",
      entityId: schoolId,
      beforeSnapshot: { status: currentStatus },
      afterSnapshot: { status: newStatus },
    });

    await invalidateSchoolCache(schoolId);
    revalidatePath("/super-admin/schools");
    return { success: true, status: newStatus };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to toggle status" };
  }
}

// Helper to generate a unique, clean slug
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `school-${Date.now().toString(36)}`;
}

export interface SchoolFormInput {
  name: string;
  board: "CBSE" | "ICSE" | "STATE_BOARD" | "IGCSE" | "IB";
  udiseCode: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  principalName: string;
  establishedYear: number;
  schoolType?: "PRIMARY" | "SECONDARY" | "SENIOR_SECONDARY" | "INTEGRATED";
  website?: string;
  slug?: string;
  academicYearLabel?: string;
}

// CREATE SCHOOL
export async function createSchoolAction(data: SchoolFormInput) {
  const authCtx = await requireAuth(["SUPER_ADMIN"]);

  if (!data.name || !data.board || !data.udiseCode || !data.email || !data.principalName) {
    return { success: false, error: "Missing required school fields." };
  }

  // Validate UDISE
  const cleanUdise = data.udiseCode.trim();
  if (!/^\d{8,11}$/.test(cleanUdise)) {
    return { success: false, error: "UDISE Code must be 8-11 digits." };
  }

  try {
    // Check if UDISE already exists
    const existing = await db.query.schools.findFirst({
      where: eq(schools.udiseCode, cleanUdise),
    });
    if (existing) {
      return { success: false, error: `A school with UDISE Code ${cleanUdise} already exists (${existing.name}).` };
    }

    let finalSlug = data.slug?.trim() ? generateSlug(data.slug) : generateSlug(data.name);
    // Ensure slug uniqueness
    const existingSlug = await db.query.schools.findFirst({
      where: eq(schools.slug, finalSlug),
    });
    if (existingSlug) {
      finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`;
    }

    const [createdSchool] = await db
      .insert(schools)
      .values({
        name: data.name.trim(),
        board: data.board,
        udiseCode: cleanUdise,
        address: data.address.trim(),
        city: data.city.trim(),
        state: data.state.trim(),
        pincode: data.pincode.trim(),
        phone: data.phone.trim(),
        email: data.email.trim().toLowerCase(),
        principalName: data.principalName.trim(),
        establishedYear: Number(data.establishedYear) || new Date().getFullYear(),
        schoolType: data.schoolType || "SECONDARY",
        website: data.website?.trim() || null,
        slug: finalSlug,
        status: "ACTIVE",
        isActive: true,
      })
      .returning();

    if (!createdSchool) {
      return { success: false, error: "Failed to create school record." };
    }

    // Automatically provision inaugural active academic year
    const currentYear = new Date().getFullYear();
    const yearLabel = data.academicYearLabel?.trim() || `${currentYear}-${currentYear + 1}`;
    await db.insert(academicYears).values({
      schoolId: createdSchool.id,
      label: yearLabel,
      startDate: new Date(`${currentYear}-04-01`),
      endDate: new Date(`${currentYear + 1}-03-31`),
      isActive: true,
    });

    await logPlatformAuditEvent({
      superAdminId: authCtx.userId,
      superAdminEmail: authCtx.email ?? "",
      action: "CREATE_SCHOOL",
      targetSchoolId: createdSchool.id,
      entityType: "school",
      entityId: createdSchool.id,
      metadata: {
        name: createdSchool.name,
        udiseCode: createdSchool.udiseCode,
        board: createdSchool.board,
        slug: createdSchool.slug,
      },
    });

    revalidatePath("/super-admin/schools");
    return { success: true, school: createdSchool };
  } catch (err: any) {
    console.error("createSchoolAction error:", err);
    return { success: false, error: err?.message || "Failed to create school" };
  }
}

// UPDATE SCHOOL
export async function updateSchoolAction(schoolId: string, data: Partial<SchoolFormInput>) {
  const authCtx = await requireAuth(["SUPER_ADMIN"]);

  if (!schoolId) {
    return { success: false, error: "School ID is required for update." };
  }

  try {
    const existingSchool = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    });

    if (!existingSchool) {
      return { success: false, error: "School not found." };
    }

    const updatePayload: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (data.name) updatePayload.name = data.name.trim();
    if (data.board) updatePayload.board = data.board;
    if (data.udiseCode) {
      const cleanUdise = data.udiseCode.trim();
      if (!/^\d{8,11}$/.test(cleanUdise)) {
        return { success: false, error: "UDISE Code must be 8-11 digits." };
      }
      updatePayload.udiseCode = cleanUdise;
    }
    if (data.address) updatePayload.address = data.address.trim();
    if (data.city) updatePayload.city = data.city.trim();
    if (data.state) updatePayload.state = data.state.trim();
    if (data.pincode) updatePayload.pincode = data.pincode.trim();
    if (data.phone) updatePayload.phone = data.phone.trim();
    if (data.email) updatePayload.email = data.email.trim().toLowerCase();
    if (data.principalName) updatePayload.principalName = data.principalName.trim();
    if (data.establishedYear) updatePayload.establishedYear = Number(data.establishedYear);
    if (data.schoolType) updatePayload.schoolType = data.schoolType;
    if (data.website !== undefined) updatePayload.website = data.website ? data.website.trim() : null;
    if (data.slug) {
      const cleanSlug = generateSlug(data.slug);
      updatePayload.slug = cleanSlug;
    }

    const [updatedSchool] = await db
      .update(schools)
      .set(updatePayload)
      .where(eq(schools.id, schoolId))
      .returning();

    if (!updatedSchool) {
      return { success: false, error: "Failed to update school record." };
    }

    await logPlatformAuditEvent({
      superAdminId: authCtx.userId,
      superAdminEmail: authCtx.email ?? "",
      action: "UPDATE_SCHOOL",
      targetSchoolId: schoolId,
      entityType: "school",
      entityId: schoolId,
      beforeSnapshot: existingSchool,
      afterSnapshot: updatedSchool,
    });

    await invalidateSchoolCache(schoolId);
    revalidatePath("/super-admin/schools");
    return { success: true, school: updatedSchool };
  } catch (err: any) {
    console.error("updateSchoolAction error:", err);
    return { success: false, error: err?.message || "Failed to update school" };
  }
}

// DELETE / ARCHIVE SCHOOL
export async function deleteSchoolAction(schoolId: string, confirmSchoolName: string) {
  const authCtx = await requireAuth(["SUPER_ADMIN"]);

  if (!schoolId) {
    return { success: false, error: "School ID is required." };
  }

  try {
    const targetSchool = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    });

    if (!targetSchool) {
      return { success: false, error: "School not found." };
    }

    // Safety verification check
    const normalizedInput = confirmSchoolName.trim().toLowerCase();
    const normalizedTarget = targetSchool.name.trim().toLowerCase();
    if (normalizedInput !== normalizedTarget && normalizedInput !== "confirm delete") {
      return {
        success: false,
        error: `Confirmation mismatch. You must type "${targetSchool.name}" or "CONFIRM DELETE".`,
      };
    }

    // Soft-delete to preserve audit logs & DPDP compliance
    await db
      .update(schools)
      .set({
        deletedAt: new Date(),
        status: "ARCHIVED",
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, schoolId));

    await logPlatformAuditEvent({
      superAdminId: authCtx.userId,
      superAdminEmail: authCtx.email ?? "",
      action: "DELETE_SCHOOL",
      targetSchoolId: schoolId,
      entityType: "school",
      entityId: schoolId,
      beforeSnapshot: {
        name: targetSchool.name,
        udiseCode: targetSchool.udiseCode,
        status: targetSchool.status,
      },
      afterSnapshot: {
        status: "ARCHIVED",
        deletedAt: new Date(),
      },
    });

    await invalidateSchoolCache(schoolId);
    revalidatePath("/super-admin/schools");
    return { success: true };
  } catch (err: any) {
    console.error("deleteSchoolAction error:", err);
    return { success: false, error: err?.message || "Failed to delete school" };
  }
}

// PROVISIONING ACTIONS (Sprint S20)
import type { DryRunPreviewResult, ProvisionResult, TopUpResult } from "@/lib/provisioningEngine";
export type { DryRunPreviewResult, ProvisionResult, TopUpResult };

export async function dryRunProvisionSchoolAction(
  schoolId: string,
  blueprintId: string
): Promise<DryRunPreviewResult> {
  const authCtx = await requireAuth(["SUPER_ADMIN"]);
  if (!schoolId || !blueprintId) {
    return {
      canProvision: false,
      schoolId: schoolId || "",
      schoolName: "",
      blueprintId: blueprintId || "",
      error: "School ID and Blueprint ID are required.",
    };
  }
  const { dryRunProvisionSchool } = await import("@/lib/provisioningEngine");
  return await dryRunProvisionSchool(schoolId, blueprintId);
}

export async function provisionSchoolAction(schoolId: string, blueprintId: string, notes?: string) {
  const authCtx = await requireAuth(["SUPER_ADMIN"]);
  if (!schoolId || !blueprintId) {
    return { success: false, message: "School ID and Blueprint ID are required." };
  }

  const { executeProvisionSchool } = await import("@/lib/provisioningEngine");
  const result = await executeProvisionSchool({
    schoolId,
    blueprintId,
    operatorUserId: authCtx.userId,
    notes,
  });

  if (result.success) {
    await logPlatformAuditEvent({
      superAdminId: authCtx.userId,
      superAdminEmail: authCtx.email ?? "",
      action: "PROVISION_SCHOOL" as any,
      targetSchoolId: schoolId,
      entityType: "school",
      entityId: schoolId,
      metadata: {
        blueprintId,
        entityCounts: result.entityCounts,
      },
    });

    await invalidateSchoolCache(schoolId);
    revalidatePath("/super-admin/schools");
  }

  return result;
}

export async function getSchoolProvisionStatusAction(schoolId: string) {
  await requireAuth(["SUPER_ADMIN"]);
  const { schoolProvisions } = await import("@/db/schema");
  const provision = await db.query.schoolProvisions.findFirst({
    where: eq(schoolProvisions.schoolId, schoolId),
  });

  return {
    isProvisioned: !!provision,
    provision: provision || null,
  };
}

export async function topUpSchoolProvisionAction(
  schoolId: string,
  blueprintId?: string
): Promise<TopUpResult> {
  const authCtx = await requireAuth(["SUPER_ADMIN"]);
  if (!schoolId) {
    return { success: false, addedCount: 0, message: "School ID is required." };
  }

  const { topUpSchoolProvision } = await import("@/lib/provisioningEngine");
  const result = await topUpSchoolProvision(schoolId, blueprintId);

  if (result.success) {
    await logPlatformAuditEvent({
      superAdminId: authCtx.userId,
      superAdminEmail: authCtx.email ?? "",
      action: "TOP_UP_SCHOOL_PROVISION" as any,
      targetSchoolId: schoolId,
      entityType: "school",
      entityId: schoolId,
      metadata: {
        blueprintId: blueprintId || "auto",
        addedCount: result.addedCount,
      },
    });

    await invalidateSchoolCache(schoolId);
    revalidatePath("/super-admin/schools");
  }

  return result;
}


