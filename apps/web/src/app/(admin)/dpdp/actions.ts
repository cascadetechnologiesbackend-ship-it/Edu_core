"use server";

import { db } from "@/db";
import {
  rightsRequests,
  dpdpGrievances,
  dataBreachLog,
  vendorRegister,
  students,
  staff,
  auditLogs,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { executeRetentionPolicy } from "@/workers/retention";

// ─── Legal Hold Actions ───────────────────────────────────────────────────────
export async function toggleLegalHold(
  recordId: string,
  targetTable: "students" | "staff",
  hold: boolean
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    if (session.user.role !== "HR_MANAGER" && session.user.role !== "SUPER_ADMIN") {
      return { success: false, message: "Access denied: HR Manager or Super Admin role required." };
    }

    if (targetTable === "students") {
      await db
        .update(students)
        .set({ legalHold: hold, updatedAt: new Date() })
        .where(eq(students.id, recordId));
    } else {
      await db
        .update(staff)
        .set({ legalHold: hold, updatedAt: new Date() })
        .where(eq(staff.id, recordId));
    }

    // Log to DPDP Audit Log
    await db.insert(auditLogs).values({
      userId: session.user.id,
      userEmail: "[audit-redacted]",
      userRole: session.user.role,
      schoolId: session.user.schoolId ?? "00000000-0000-0000-0000-000000000000",
      action: "WRITE",
      tableName: targetTable,
      recordId,
      purposeId: "legal_compliance",
      ipAddress: "127.0.0.1",
      userAgent: "Server Action",
      metadata: { legalHoldChanged: hold },
    });

    revalidatePath("/dpdp");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Vendor Registers CRUD ────────────────────────────────────────────────────
export async function createVendor(input: {
  vendorName: string;
  vendorType: string;
  dataShared: string[];
  purposeOfSharing: string;
  dpaStatus: "SIGNED" | "PENDING" | "EXPIRED";
  dpaExpiresAt?: string;
  contactEmail?: string;
  privacyPolicyUrl?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const school = await db.query.schools.findFirst();
    if (!school) return { success: false, message: "School not configured" };

    await db.insert(vendorRegister).values({
      schoolId: school.id,
      vendorName: input.vendorName,
      vendorType: input.vendorType,
      dataShared: input.dataShared,
      purposeOfSharing: input.purposeOfSharing,
      dpaStatus: input.dpaStatus,
      dpaSignedAt: input.dpaStatus === "SIGNED" ? new Date() : null,
      dpaExpiresAt: input.dpaExpiresAt ? new Date(input.dpaExpiresAt) : null,
      contactEmail: input.contactEmail || null,
      privacyPolicyUrl: input.privacyPolicyUrl || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath("/dpdp");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function updateVendorDpaStatus(vendorId: string, status: string, expiry?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    await db
      .update(vendorRegister)
      .set({
        dpaStatus: status,
        dpaSignedAt: status === "SIGNED" ? new Date() : null,
        dpaExpiresAt: expiry ? new Date(expiry) : null,
        updatedAt: new Date(),
      })
      .where(eq(vendorRegister.id, vendorId));

    revalidatePath("/dpdp");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Data Breach Incident Log Actions ─────────────────────────────────────────
export async function reportDataBreach(input: {
  description: string;
  affectedRecordsCount: number;
  affectedDataCategories: string[];
  containmentActions: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const school = await db.query.schools.findFirst();
    if (!school) return { success: false, message: "School not configured" };

    const now = new Date();
    // 72-hour board notification countdown deadline
    const boardDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    const ref = `BR-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    await db.insert(dataBreachLog).values({
      schoolId: school.id,
      incidentReference: ref,
      detectedAt: now,
      reportedByUserId: session.user.id,
      severity: input.severity,
      status: "DETECTED",
      description: input.description,
      affectedRecordsCount: input.affectedRecordsCount,
      affectedDataCategories: input.affectedDataCategories,
      containmentActions: input.containmentActions,
      boardNotificationDeadline: boardDeadline,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath("/dpdp");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function markBreachBoardNotified(breachId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    await db
      .update(dataBreachLog)
      .set({
        status: "BOARD_NOTIFIED",
        boardNotifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dataBreachLog.id, breachId));

    revalidatePath("/dpdp");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function markBreachParentsNotified(breachId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    await db
      .update(dataBreachLog)
      .set({
        status: "PARENTS_NOTIFIED",
        parentsNotifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dataBreachLog.id, breachId));

    revalidatePath("/dpdp");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Resolve Subject Requests & Grievances ────────────────────────────────────
export async function resolveRightsRequest(id: string, approve: boolean, responseDetails: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    await db
      .update(rightsRequests)
      .set({
        status: approve ? "COMPLETED" : "REJECTED",
        responseDetails,
        respondedAt: new Date(),
        respondedByUserId: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(rightsRequests.id, id));

    revalidatePath("/dpdp");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function resolveGrievance(id: string, responseDetails: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    await db
      .update(dpdpGrievances)
      .set({
        status: "COMPLETED",
        resolutionDetails: responseDetails,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dpdpGrievances.id, id));

    revalidatePath("/dpdp");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ─── Manual Retention Execution Trigger ───────────────────────────────────────
export async function triggerManualRetentionRun() {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const school = await db.query.schools.findFirst();
    if (!school) return { success: false, message: "School not configured" };

    const res = await executeRetentionPolicy(school.id);
    return res;
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
