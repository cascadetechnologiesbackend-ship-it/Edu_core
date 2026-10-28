"use server";

import { getCachedSession } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { notices, noticeAcknowledgments, auditLogs } from "@/db/schema";
import { eq, and, or, isNull, gte, desc } from "drizzle-orm";
import { resolveStudentScope } from "@/lib/studentEventEngine/scopeResolver";
import { getClientRequestContext } from "@/lib/requestContext";
import { revalidatePath } from "next/cache";

export interface StudentNoticeItem {
  id: string;
  title: string;
  content: string;
  audienceType: string;
  publishedAt: string | null;
  expiresAt: string | null;
  isPinned: boolean;
  requiresAcknowledgment: boolean;
  attachmentS3Key: string | null;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
}

export interface GetStudentNoticesResult {
  success: boolean;
  notices: StudentNoticeItem[];
  studentName?: string;
  className?: string;
  sectionName?: string;
  error?: string;
}

export interface AcknowledgeStudentNoticeResult {
  success: boolean;
  acknowledgedAt?: string;
  alreadyAcknowledged?: boolean;
  error?: string;
}

import { isNoticeInStudentScope } from "../../../../lib/studentEventEngine/noticeScoping";
export { isNoticeInStudentScope };

/**
 * Server action to fetch student notices with server-side audience scoping (AC-12).
 */
export async function getStudentNoticesAction(
  studentIdParam?: string
): Promise<GetStudentNoticesResult> {
  try {
    const session = await getCachedSession();
    if (!session?.user?.id) {
      return { success: false, notices: [], error: "Unauthorized" };
    }

    const userId = session.user.id;
    const schoolId = session.user.schoolId || "";
    const role = session.user.role || "STUDENT";

    const scope = await resolveStudentScope(userId, {
      schoolId,
      studentId: studentIdParam ?? null,
      role,
    });

    if (scope.isAccountDisabled) {
      return {
        success: false,
        notices: [],
        error: "Your student portal account has been disabled by the school office.",
      };
    }

    return await withTenant(scope.schoolId, async () => {
      const now = new Date();

      // Query active, published notices in this school
      const rawNotices = await db
        .select()
        .from(notices)
        .where(
          and(
            eq(notices.schoolId, scope.schoolId),
            eq(notices.isPublished, true),
            isNull(notices.deletedAt),
            or(isNull(notices.expiresAt), gte(notices.expiresAt, now))
          )
        )
        .orderBy(desc(notices.isPinned), desc(notices.publishedAt));

      // Filter by student audience scope server-side
      const eligibleNotices = rawNotices.filter((n) =>
        isNoticeInStudentScope(
          { audienceType: n.audienceType, audienceFilter: n.audienceFilter },
          { classId: scope.classId, sectionId: scope.sectionId }
        )
      );

      // Query acknowledgments for this student's user account
      const ackMap = new Map<string, string>();
      if (scope.studentUserId) {
        const acks = await db
          .select()
          .from(noticeAcknowledgments)
          .where(
            and(
              eq(noticeAcknowledgments.schoolId, scope.schoolId),
              eq(noticeAcknowledgments.parentUserId, scope.studentUserId)
            )
          );

        for (const ack of acks) {
          ackMap.set(
            ack.noticeId,
            ack.acknowledgedAt ? new Date(ack.acknowledgedAt).toISOString() : new Date().toISOString()
          );
        }
      }

      const noticeItems: StudentNoticeItem[] = eligibleNotices.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        audienceType: n.audienceType,
        publishedAt: n.publishedAt ? new Date(n.publishedAt).toISOString() : null,
        expiresAt: n.expiresAt ? new Date(n.expiresAt).toISOString() : null,
        isPinned: n.isPinned,
        requiresAcknowledgment: n.requiresAcknowledgment,
        attachmentS3Key: n.attachmentS3Key || null,
        isAcknowledged: ackMap.has(n.id),
        acknowledgedAt: ackMap.get(n.id) || null,
      }));

      return {
        success: true,
        notices: noticeItems,
        studentName: scope.studentName,
        className: scope.className,
        sectionName: scope.sectionName,
      };
    });
  } catch (error: any) {
    console.error("[getStudentNoticesAction] Error:", error);
    return {
      success: false,
      notices: [],
      error: error?.message || "Failed to load notices.",
    };
  }
}

/**
 * Server action for a student to acknowledge an official notice (AC-12).
 */
export async function acknowledgeStudentNoticeAction(
  noticeId: string,
  studentIdParam?: string
): Promise<AcknowledgeStudentNoticeResult> {
  try {
    const session = await getCachedSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!noticeId) {
      return { success: false, error: "Notice ID is required." };
    }

    const userId = session.user.id;
    const schoolId = session.user.schoolId || "";
    const role = session.user.role || "STUDENT";

    const scope = await resolveStudentScope(userId, {
      schoolId,
      studentId: studentIdParam ?? null,
      role,
    });

    if (scope.isAccountDisabled) {
      return { success: false, error: "Account access suspended." };
    }

    const studentUserId = scope.studentUserId;
    if (!studentUserId) {
      return { success: false, error: "No student user account linked to acknowledge." };
    }

    return await withTenant(scope.schoolId, async () => {
      // 1. Verify notice exists and is published
      const [notice] = await db
        .select()
        .from(notices)
        .where(
          and(
            eq(notices.id, noticeId),
            eq(notices.schoolId, scope.schoolId),
            eq(notices.isPublished, true),
            isNull(notices.deletedAt)
          )
        );

      if (!notice) {
        return { success: false, error: "Notice not found or unpublished." };
      }

      // Verify audience scope
      const inScope = isNoticeInStudentScope(
        { audienceType: notice.audienceType, audienceFilter: notice.audienceFilter },
        { classId: scope.classId, sectionId: scope.sectionId }
      );

      if (!inScope) {
        return { success: false, error: "Notice is not addressed to your class." };
      }

      // 2. Check if already acknowledged (idempotent)
      const [existing] = await db
        .select()
        .from(noticeAcknowledgments)
        .where(
          and(
            eq(noticeAcknowledgments.noticeId, noticeId),
            eq(noticeAcknowledgments.parentUserId, studentUserId)
          )
        );

      if (existing) {
        return {
          success: true,
          acknowledgedAt: existing.acknowledgedAt
            ? new Date(existing.acknowledgedAt).toISOString()
            : new Date().toISOString(),
          alreadyAcknowledged: true,
        };
      }

      // 3. Insert acknowledgment
      const [inserted] = await db
        .insert(noticeAcknowledgments)
        .values({
          schoolId: scope.schoolId,
          noticeId,
          parentUserId: studentUserId,
          source: "FEED",
        })
        .returning();

      // Audit log write with real request context
      const reqCtx = getClientRequestContext();
      await db.insert(auditLogs).values({
        schoolId: scope.schoolId,
        userId: studentUserId,
        userEmail: session.user.email || `student-${scope.studentId}@schoolmitra.internal`,
        userRole: "STUDENT",
        action: "WRITE",
        tableName: "notice_acknowledgments",
        recordId: noticeId,
        ipAddress: reqCtx.ipAddress || "0.0.0.0",
        userAgent: reqCtx.userAgent || "StudentPWA",
        metadata: {
          studentId: scope.studentId,
          noticeId,
          title: notice.title,
        },
      });

      revalidatePath("/student/notices");
      revalidatePath("/student/dashboard");

      return {
        success: true,
        acknowledgedAt: inserted?.acknowledgedAt
          ? new Date(inserted.acknowledgedAt).toISOString()
          : new Date().toISOString(),
        alreadyAcknowledged: false,
      };
    });
  } catch (error: any) {
    console.error("[acknowledgeStudentNoticeAction] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to acknowledge notice.",
    };
  }
}
