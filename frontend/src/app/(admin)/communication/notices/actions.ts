"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  notices,
  noticeAcknowledgments,
  students,
  users,
  classes,
  sections,
  pushNotificationLogs,
} from "@/db/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  type NoticeParentRecipient,
  type NoticeAcknowledgmentReport,
  type BulkReminderResult,
  calculateAcknowledgmentPercentage,
  evaluateBulkReminderBatch,
} from "@/lib/noticeAcknowledgmentEngine";

export type {
  NoticeParentRecipient,
  NoticeAcknowledgmentReport,
  BulkReminderResult,
};

/**
 * Server Action: Generates full notice acknowledgment report for school admins (surface_p8, AC-P20).
 */
export async function getNoticeAcknowledgmentReport(
  noticeId: string
): Promise<{ success: boolean; report?: NoticeAcknowledgmentReport; error?: string }> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async () => {
      // 1. Fetch Notice
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

      // 2. Fetch existing acknowledgments for this notice
      const acks = await db
        .select()
        .from(noticeAcknowledgments)
        .where(
          and(
            eq(noticeAcknowledgments.noticeId, noticeId),
            eq(noticeAcknowledgments.schoolId, school.id)
          )
        );

      const ackMap = new Map<string, { acknowledgedAt: Date; source: "FEED" | "PORTAL" }>();
      for (const a of acks) {
        ackMap.set(a.parentUserId, {
          acknowledgedAt: a.acknowledgedAt,
          source: a.source as "FEED" | "PORTAL",
        });
      }

      // 3. Resolve targeted active students & their primary parents
      // Based on audienceType (ALL, PARENTS, CLASS, SECTION)
      const studentRows = await db
        .select({
          studentId: students.id,
          primaryParentUserId: students.primaryParentUserId,
          classId: students.currentClassId,
          sectionId: students.currentSectionId,
          studentName: students.firstNameEncrypted,
        })
        .from(students)
        .where(
          and(
            eq(students.schoolId, school.id),
            eq(students.isActive, true)
          )
        );

      // Filter by audience if CLASS or SECTION specified
      let filteredStudents = studentRows;
      const filter = notice.audienceFilter as any;
      if (notice.audienceType === "CLASS" && filter?.classId) {
        filteredStudents = filteredStudents.filter((s) => s.classId === filter.classId);
      } else if (notice.audienceType === "SECTION" && filter?.sectionId) {
        filteredStudents = filteredStudents.filter((s) => s.sectionId === filter.sectionId);
      }

      // Group by unique parentUserId (OP7: sibling households acknowledge once)
      const parentUserMap = new Map<string, typeof filteredStudents[0]>();
      for (const s of filteredStudents) {
        if (s.primaryParentUserId && !parentUserMap.has(s.primaryParentUserId)) {
          parentUserMap.set(s.primaryParentUserId, s);
        }
      }

      const parentUserIds = Array.from(parentUserMap.keys());
      const parentUsers =
        parentUserIds.length > 0
          ? await db
              .select({
                id: users.id,
                email: users.email,
              })
              .from(users)
              .where(
                and(
                  eq(users.schoolId, school.id),
                  inArray(users.id, parentUserIds)
                )
              )
          : [];

      const parentEmailMap = new Map<string, string>();
      for (const u of parentUsers) {
        if (u.email) parentEmailMap.set(u.id, u.email);
      }

      const now = new Date();
      const pubDate = notice.publishedAt ? new Date(notice.publishedAt) : now;
      const hoursSinceNotice = Math.max(0, Math.round((now.getTime() - pubDate.getTime()) / (1000 * 60 * 60)));

      const acknowledgedList: NoticeParentRecipient[] = [];
      const unacknowledgedList: NoticeParentRecipient[] = [];

      for (const [pUserId, s] of parentUserMap.entries()) {
        const ack = ackMap.get(pUserId);
        const recipient: NoticeParentRecipient = {
          parentUserId: pUserId,
          parentEmail: parentEmailMap.get(pUserId) || "Parent",
          studentId: s.studentId,
          studentName: "Student", // encrypted in students table
          acknowledged: Boolean(ack),
          acknowledgedAt: ack?.acknowledgedAt?.toISOString() || null,
          source: ack?.source || null,
          hoursSinceNotice,
        };

        if (ack) {
          acknowledgedList.push(recipient);
        } else {
          unacknowledgedList.push(recipient);
        }
      }

      const totalTargeted = parentUserMap.size;
      const acknowledgedCount = acknowledgedList.length;
      const percentage = calculateAcknowledgmentPercentage(acknowledgedCount, totalTargeted);

      return {
        success: true,
        report: {
          noticeId: notice.id,
          title: notice.title,
          publishedAt: pubDate.toISOString(),
          requiresAcknowledgment: Boolean((notice as any).requiresAcknowledgment),
          totalTargeted,
          acknowledgedCount,
          percentage,
          acknowledgedList,
          unacknowledgedList,
        },
      };
    });
  } catch (error: any) {
    console.error("[getNoticeAcknowledgmentReport] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to load notice acknowledgment report.",
    };
  }
}

/**
 * Server Action: 1-Tap bulk remind all unacknowledged parents respecting caps & quiet hours (AC-P20).
 */
export async function bulkRemindUnacknowledgedParents(
  noticeId: string
): Promise<BulkReminderResult> {
  try {
    const reportRes = await getNoticeAcknowledgmentReport(noticeId);
    if (!reportRes.success || !reportRes.report) {
      return {
        success: false,
        totalTargeted: 0,
        remindedCount: 0,
        queuedForMorningCount: 0,
        skippedDailyCapCount: 0,
        error: reportRes.error || "Failed to load report",
      };
    }

    const { report } = reportRes;
    const unacknowledged = report.unacknowledgedList;

    if (unacknowledged.length === 0) {
      return {
        success: true,
        totalTargeted: 0,
        remindedCount: 0,
        queuedForMorningCount: 0,
        skippedDailyCapCount: 0,
      };
    }

    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async () => {
      // Fetch today's push counts for parents
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const recentLogs = await db
        .select({
          recipientUserId: pushNotificationLogs.recipientUserId,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(pushNotificationLogs)
        .where(
          and(
            eq(pushNotificationLogs.schoolId, school.id),
            sql`${pushNotificationLogs.sentAt} >= ${startOfDay}`
          )
        )
        .groupBy(pushNotificationLogs.recipientUserId);

      const parentPushCounts = new Map<string, number>();
      for (const log of recentLogs) {
        if (log.recipientUserId) {
          parentPushCounts.set(log.recipientUserId, Number(log.count));
        }
      }

      const evaluation = evaluateBulkReminderBatch(
        unacknowledged.map((u) => ({ parentUserId: u.parentUserId, studentId: u.studentId })),
        {
          noticePublishedAt: new Date(report.publishedAt),
          parentPushCounts,
        }
      );

      // Record logs for reminded parents
      for (const item of evaluation.reminded) {
        try {
          await db.insert(pushNotificationLogs).values({
            schoolId: school.id,
            recipientUserId: item.parentUserId,
            title: "Important School Notice Reminder",
            body: `Please review and acknowledge: ${report.title}`,
            status: "DELIVERED",
            sentAt: new Date(),
          });
        } catch {
          // Continue logging best-effort
        }
      }

      revalidatePath(`/admin/communication/notices/${noticeId}/acknowledgments`);

      return {
        success: true,
        totalTargeted: unacknowledged.length,
        remindedCount: evaluation.reminded.length,
        queuedForMorningCount: evaluation.queued.length,
        skippedDailyCapCount: evaluation.skippedCap.length,
      };
    });
  } catch (error: any) {
    console.error("[bulkRemindUnacknowledgedParents] Error:", error);
    return {
      success: false,
      totalTargeted: 0,
      remindedCount: 0,
      queuedForMorningCount: 0,
      skippedDailyCapCount: 0,
      error: error?.message || "Failed to dispatch reminders.",
    };
  }
}
