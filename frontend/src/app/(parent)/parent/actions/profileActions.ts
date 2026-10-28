"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { profileChangeRequests, students } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { encryptData, decryptData } from "@/lib/encryption";
import {
  validateProfileChangePayload,
  formatProfileChangeSummary,
} from "@/lib/parentEventEngine/documentProfileEngine";
import { dispatchParentNotification } from "@/lib/parentEventEngine/notificationMatrix";

export interface RequestProfileChangeInput {
  studentId: string;
  field: "address" | "phone" | "demographics" | "medical";
  newValue: Record<string, unknown> | string;
  reason?: string | undefined;
}

export interface ProfileChangeItem {
  id: string;
  studentId: string;
  parentUserId: string;
  field: string;
  oldValue: Record<string, unknown> | string | null;
  newValue: Record<string, unknown> | string;
  status: "PENDING" | "APPLIED" | "REJECTED";
  decisionReason: string | null;
  summaryText: string;
  diffItems: Array<{ label: string; from: string; to: string }>;
  decidedAt: string | null;
  createdAt: string;
}

/**
 * Parent Action: Requests a profile data update (Workflow OP10).
 * Stores encrypted old and new values for administrative review.
 */
export async function requestProfileChange(
  input: RequestProfileChangeInput
): Promise<{ success: boolean; requestId?: string | undefined; error?: string | undefined }> {
  try {
    const ctx = await requireAuth(["PARENT", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const validation = validateProfileChangePayload(input.field, input.newValue);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    return await withTenant(school.id, async () => {
      // 1. Verify parent authorization
      const [student] = await db
        .select()
        .from(students)
        .where(and(eq(students.id, input.studentId), eq(students.schoolId, school.id)));

      if (!student) {
        return { success: false, error: "Student not found." };
      }

      if (ctx.role === "PARENT" && student.primaryParentUserId !== ctx.userId) {
        return { success: false, error: "Forbidden: Not authorized for this student." };
      }

      // 2. Derive existing old value snapshot based on field category
      let oldValue: Record<string, unknown> = {};
      if (input.field === "address") {
        oldValue = {
          state: student.state || "",
          district: student.district || "",
          pincode: student.pincode || "",
        };
      } else if (input.field === "demographics") {
        oldValue = {
          bloodGroup: student.bloodGroup || "",
          gender: student.gender || "",
          motherTongue: student.motherTongue || "",
        };
      } else if (input.field === "medical") {
        oldValue = {
          bloodGroup: student.bloodGroup || "",
        };
      }

      const oldValueEncrypted = encryptData(JSON.stringify(oldValue));
      const newValueEncrypted = encryptData(
        typeof input.newValue === "string" ? input.newValue : JSON.stringify(input.newValue)
      );

      const [inserted] = await db
        .insert(profileChangeRequests)
        .values({
          schoolId: school.id,
          studentId: input.studentId,
          parentUserId: ctx.userId,
          field: input.field,
          oldValueEncrypted,
          newValueEncrypted,
          status: "PENDING",
        })
        .returning({ id: profileChangeRequests.id });

      revalidatePath("/parent");
      revalidatePath(`/parent/student/${input.studentId}`);

      return { success: true, requestId: inserted?.id };
    });
  } catch (err: any) {
    console.error("requestProfileChange error:", err);
    return { success: false, error: err?.message || "Failed to submit profile change request." };
  }
}

/**
 * Fetches all profile change requests for a student.
 */
export async function getProfileChangeRequests(
  studentId: string
): Promise<{ success: boolean; data?: ProfileChangeItem[] | undefined; error?: string | undefined }> {
  try {
    const ctx = await requireAuth(["PARENT", "SCHOOL_ADMIN", "SUPER_ADMIN"] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async () => {
      if (ctx.role === "PARENT") {
        const [student] = await db
          .select({ primaryParentUserId: students.primaryParentUserId })
          .from(students)
          .where(and(eq(students.id, studentId), eq(students.schoolId, school.id)));

        if (!student || student.primaryParentUserId !== ctx.userId) {
          return { success: false, error: "Forbidden: Not authorized for this student." };
        }
      }

      const rows = await db
        .select()
        .from(profileChangeRequests)
        .where(
          and(
            eq(profileChangeRequests.studentId, studentId),
            eq(profileChangeRequests.schoolId, school.id)
          )
        )
        .orderBy(desc(profileChangeRequests.createdAt));

      const items: ProfileChangeItem[] = rows.map((r) => {
        let oldValue: Record<string, unknown> | string | null = null;
        let newValue: Record<string, unknown> | string = {};
        let decisionReason: string | null = null;

        if (r.oldValueEncrypted) {
          try {
            const dec = decryptData(r.oldValueEncrypted);
            oldValue = dec ? JSON.parse(dec) : null;
          } catch {
            oldValue = null;
          }
        }

        if (r.newValueEncrypted) {
          try {
            const dec = decryptData(r.newValueEncrypted);
            newValue = dec ? JSON.parse(dec) : dec ?? {};
          } catch {
            newValue = {};
          }
        }

        decisionReason = r.verificationNote || null;

        const summary = formatProfileChangeSummary({
          id: r.id,
          studentId: r.studentId,
          field: r.field,
          oldValue,
          newValue,
          status: r.status as ProfileChangeItem["status"],
          decisionReason,
          requestedAt: r.createdAt,
          decidedAt: r.decidedAt,
        });

        return {
          id: r.id,
          studentId: r.studentId,
          parentUserId: r.parentUserId,
          field: r.field,
          oldValue,
          newValue,
          status: r.status as ProfileChangeItem["status"],
          decisionReason,
          summaryText: summary.summaryText,
          diffItems: summary.diffItems,
          decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        };
      });

      return { success: true, data: items };
    });
  } catch (err: any) {
    console.error("getProfileChangeRequests error:", err);
    return { success: false, error: err?.message || "Failed to fetch profile change requests." };
  }
}

/**
 * Admin Action: Approves and applies or rejects a profile change request (OP10).
 */
export async function decideProfileChangeRequest(input: {
  requestId: string;
  status: "APPLIED" | "REJECTED";
  reason?: string | undefined;
}): Promise<{ success: boolean; error?: string | undefined }> {
  try {
    const ctx = await requireAuth(["SCHOOL_ADMIN", "SUPER_ADMIN"] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async () => {
      const [req] = await db
        .select()
        .from(profileChangeRequests)
        .where(
          and(
            eq(profileChangeRequests.id, input.requestId),
            eq(profileChangeRequests.schoolId, school.id)
          )
        );

      if (!req) {
        return { success: false, error: "Profile change request not found." };
      }

      // If applied, update the target student record if fields map directly
      if (input.status === "APPLIED" && req.newValueEncrypted) {
        try {
          const dec = decryptData(req.newValueEncrypted);
          if (dec) {
            const parsed = JSON.parse(dec);
            const updatePayload: Record<string, any> = { updatedAt: new Date() };

            if (parsed.state) updatePayload.state = String(parsed.state);
            if (parsed.district) updatePayload.district = String(parsed.district);
            if (parsed.pincode) updatePayload.pincode = String(parsed.pincode);
            if (parsed.bloodGroup) updatePayload.bloodGroup = String(parsed.bloodGroup);
            if (parsed.motherTongue) updatePayload.motherTongue = String(parsed.motherTongue);

            if (Object.keys(updatePayload).length > 1) {
              await db
                .update(students)
                .set(updatePayload)
                .where(and(eq(students.id, req.studentId), eq(students.schoolId, school.id)));
            }
          }
        } catch (e) {
          console.warn("Could not parse applied newValue for students table update:", e);
        }
      }

      await db
        .update(profileChangeRequests)
        .set({
          status: input.status,
          verificationNote: input.reason || null,
          verifiedByUserId: ctx.userId,
          decidedAt: new Date(),
        })
        .where(
          and(
            eq(profileChangeRequests.id, input.requestId),
            eq(profileChangeRequests.schoolId, school.id)
          )
        );

      // Notify parent via T3 toast / notification
      const [student] = await db
        .select({ primaryParentUserId: students.primaryParentUserId, firstNameEncrypted: students.firstNameEncrypted })
        .from(students)
        .where(and(eq(students.id, req.studentId), eq(students.schoolId, school.id)));

      if (student?.primaryParentUserId) {
        const studentName = student.firstNameEncrypted ? (decryptData(student.firstNameEncrypted) || "Child") : "Child";
        await dispatchParentNotification(
          school.id,
          {
            studentId: req.studentId,
            parentUserId: student.primaryParentUserId,
            tier: "T3_system_state",
            eventKind: "PROFILE_CHANGE_VERIFIED",
            todayPushCountForParent: 0,
            previouslyDispatchedDedupeKeys: new Set(),
          },
          {
            title: input.status === "APPLIED" ? "Profile Details Updated" : "Profile Request Reviewed",
            body: input.status === "APPLIED"
              ? `Requested profile changes for ${studentName} have been applied.`
              : `Profile change request for ${studentName} was reviewed: ${input.reason || "See details."}`,
            data: { url: `/parent` },
          }
        );
      }

      revalidatePath("/parent");
      revalidatePath(`/parent/student/${req.studentId}`);

      return { success: true };
    });
  } catch (err: any) {
    console.error("decideProfileChangeRequest error:", err);
    return { success: false, error: err?.message || "Failed to decide profile change request." };
  }
}
