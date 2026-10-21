"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { notices, noticeAcknowledgments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface AcknowledgeNoticeResult {
  success: boolean;
  acknowledgedAt?: string;
  error?: string;
  alreadyAcknowledged?: boolean;
}

/**
 * Parent acknowledges an important notice in 1-click (Workflow OP7, AC-P24).
 * Stored per parent user, not per student (sibling households acknowledge once).
 */
export async function acknowledgeNotice(
  noticeId: string,
  source: "FEED" | "PORTAL" = "FEED"
): Promise<AcknowledgeNoticeResult> {
  try {
    const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    if (!noticeId) {
      return { success: false, error: "Notice ID is required." };
    }

    return await withTenant(school.id, async () => {
      // 1. Verify notice exists and belongs to school
      const [notice] = await db
        .select()
        .from(notices)
        .where(
          and(
            eq(notices.id, noticeId),
            eq(notices.schoolId, school.id)
          )
        );

      if (!notice) {
        return { success: false, error: "Notice not found." };
      }

      // 2. Check if already acknowledged (idempotent)
      const [existing] = await db
        .select()
        .from(noticeAcknowledgments)
        .where(
          and(
            eq(noticeAcknowledgments.noticeId, noticeId),
            eq(noticeAcknowledgments.parentUserId, ctx.userId)
          )
        );

      if (existing) {
        return {
          success: true,
          acknowledgedAt: existing.acknowledgedAt.toISOString(),
          alreadyAcknowledged: true,
        };
      }

      // 3. Insert acknowledgment
      const [inserted] = await db
        .insert(noticeAcknowledgments)
        .values({
          schoolId: school.id,
          noticeId,
          parentUserId: ctx.userId,
          source,
        })
        .returning();

      revalidatePath("/parent/dashboard");
      revalidatePath("/parent/more");

      return {
        success: true,
        acknowledgedAt: inserted?.acknowledgedAt.toISOString() || new Date().toISOString(),
        alreadyAcknowledged: false,
      };
    });
  } catch (error: any) {
    console.error("[noticeActions.acknowledgeNotice] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to acknowledge notice.",
    };
  }
}

/**
 * Retrieves acknowledgment status for a given notice for the current parent user.
 */
export async function getNoticeAcknowledgmentStatus(noticeId: string) {
  try {
    const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async () => {
      const [ack] = await db
        .select()
        .from(noticeAcknowledgments)
        .where(
          and(
            eq(noticeAcknowledgments.noticeId, noticeId),
            eq(noticeAcknowledgments.parentUserId, ctx.userId)
          )
        );

      return {
        acknowledged: Boolean(ack),
        acknowledgedAt: ack?.acknowledgedAt?.toISOString() || null,
        source: ack?.source || null,
      };
    });
  } catch {
    return { acknowledged: false, acknowledgedAt: null, source: null };
  }
}
