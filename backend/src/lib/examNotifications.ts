import { db } from "@/db";
import {
  notices,
  pushNotificationLogs,
  smsLogs,
  userPushSubscriptions,
  students,
  studentFamilyMembers,
  exams,
  reportCardSetups,
  resultSettings,
  examSchedules,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface NotificationResult {
  success: boolean;
  inAppNoticeId?: string | undefined;
  pushSentCount: number;
  smsQueuedCount: number;
  error?: string | undefined;
}

/**
 * Checks whether the current time falls within defined quiet hours (21:00 - 07:00 IST / local).
 * S11 UX-P11: delivery respects quiet hours to protect family privacy and peace.
 */
export function isQuietHours(date: Date = new Date()): boolean {
  const hours = date.getHours();
  // 9 PM (21:00) to 7 AM (07:00)
  return hours >= 21 || hours < 7;
}

/**
 * 1. Result Released Notification:
 * Sent to parents when an exam setup's results are published.
 * - Deep link to portal report card view.
 * - Web push + in-app notice.
 * - Optional SMS fallback for parents without push subscriptions (if school toggle enabled).
 * - CRITICAL: Zero student marks or PII in payload.
 */
export async function notifyResultReleased(input: {
  schoolId: string;
  setupId: string;
  triggeredById: string;
}): Promise<NotificationResult> {
  try {
    const { schoolId, setupId, triggeredById } = input;

    // Fetch setup & exam info
    const setup = await db.query.reportCardSetups.findFirst({
      where: and(
        eq(reportCardSetups.schoolId, schoolId),
        eq(reportCardSetups.id, setupId),
      ),
    });

    const setupName = setup?.name || "Term Examination";

    // Check if SMS is enabled for this school/setup in result_settings
    const settings = await db.query.resultSettings.findFirst({
      where: and(
        eq(resultSettings.schoolId, schoolId),
        eq(resultSettings.setupId, setupId),
      ),
    });
    const smsEnabled = settings?.smsNotificationsEnabled ?? false;

    // 1. In-App Notice
    const [notice] = await db
      .insert(notices)
      .values({
        schoolId,
        title: `Results Published: ${setupName}`,
        content: `Examination results for ${setupName} have been published. Tap to view your child's published report card.`,
        audienceType: "PARENTS",
        audienceFilter: { setupId },
        isPublished: true,
        publishedAt: new Date(),
        createdById: triggeredById,
      })
      .returning();

    // 2. Derive parent recipients server-side for this school
    const schoolStudents = await db.query.students.findMany({
      where: and(eq(students.schoolId, schoolId), eq(students.isActive, true)),
      columns: { id: true, primaryParentUserId: true },
    });

    const parentUserIds = new Set<string>();
    for (const s of schoolStudents) {
      if (s.primaryParentUserId) {
        parentUserIds.add(s.primaryParentUserId);
      }
    }

    const recipientList = Array.from(parentUserIds);
    if (recipientList.length === 0) {
      return {
        success: true,
        inAppNoticeId: notice?.id,
        pushSentCount: 0,
        smsQueuedCount: 0,
      };
    }

    // 3. Web Push Notifications
    const quiet = isQuietHours();
    const pushStatus = quiet ? "QUEUED_QUIET_HOURS" : "DELIVERED";
    let pushSentCount = 0;

    for (const parentId of recipientList) {
      await db.insert(pushNotificationLogs).values({
        schoolId,
        recipientUserId: parentId,
        title: "Results Published",
        body: `Examination results for ${setupName} have been published. Tap to view.`,
        status: pushStatus,
        sentAt: quiet ? null : new Date(),
      });
      pushSentCount++;
    }

    // 4. Optional SMS Fallback
    let smsQueuedCount = 0;
    if (smsEnabled) {
      // Find parents who have active push subscriptions
      const subscriptions = await db.query.userPushSubscriptions.findMany({
        where: and(
          eq(userPushSubscriptions.schoolId, schoolId),
          inArray(userPushSubscriptions.userId, recipientList),
        ),
        columns: { userId: true },
      });

      const pushSubscribedUsers = new Set(subscriptions.map((s) => s.userId));
      const parentsWithoutPush = recipientList.filter(
        (id) => !pushSubscribedUsers.has(id),
      );

      for (const parentId of parentsWithoutPush) {
        await db.insert(smsLogs).values({
          schoolId,
          recipientUserId: parentId,
          messageType: "EXAM",
          templateId: "EXAM_RESULT_PUBLISHED",
          status: "QUEUED",
          sentAt: new Date(),
        });
        smsQueuedCount++;
      }
    }

    return {
      success: true,
      inAppNoticeId: notice?.id,
      pushSentCount,
      smsQueuedCount,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send result notification";
    console.error("[ExamNotifications] notifyResultReleased error:", message);
    return { success: false, pushSentCount: 0, smsQueuedCount: 0, error: message };
  }
}

/**
 * 2. Admit Cards Released Notification:
 * Sent to parents and students when admit cards become available for an exam.
 */
export async function notifyAdmitCardsReleased(input: {
  schoolId: string;
  examId: string;
  triggeredById: string;
}): Promise<NotificationResult> {
  try {
    const { schoolId, examId, triggeredById } = input;

    const exam = await db.query.exams.findFirst({
      where: and(eq(exams.schoolId, schoolId), eq(exams.id, examId)),
    });
    const examName = exam?.name || "Upcoming Examination";

    // In-App Notice
    const [notice] = await db
      .insert(notices)
      .values({
        schoolId,
        title: `Admit Cards Released: ${examName}`,
        content: `Examination admit cards for ${examName} are now available for download. Please ensure all student details and exam dates are verified.`,
        audienceType: "PARENTS",
        audienceFilter: { examId },
        isPublished: true,
        publishedAt: new Date(),
        createdById: triggeredById,
      })
      .returning();

    // Derive parent recipients
    const schoolStudents = await db.query.students.findMany({
      where: and(eq(students.schoolId, schoolId), eq(students.isActive, true)),
      columns: { primaryParentUserId: true },
    });

    const parentUserIds = Array.from(
      new Set(
        schoolStudents
          .map((s) => s.primaryParentUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const quiet = isQuietHours();
    const pushStatus = quiet ? "QUEUED_QUIET_HOURS" : "DELIVERED";
    let pushSentCount = 0;

    for (const parentId of parentUserIds) {
      await db.insert(pushNotificationLogs).values({
        schoolId,
        recipientUserId: parentId,
        title: "Admit Cards Available",
        body: `Admit cards for ${examName} are ready for download. Tap to view.`,
        status: pushStatus,
        sentAt: quiet ? null : new Date(),
      });
      pushSentCount++;
    }

    return {
      success: true,
      inAppNoticeId: notice?.id,
      pushSentCount,
      smsQueuedCount: 0,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send admit card notification";
    console.error("[ExamNotifications] notifyAdmitCardsReleased error:", message);
    return { success: false, pushSentCount: 0, smsQueuedCount: 0, error: message };
  }
}

/**
 * 3. Datesheet Published Notification:
 * Sent to school community (Parents, Students, Teachers) when schedule is published.
 */
export async function notifyDatesheetPublished(input: {
  schoolId: string;
  scheduleIds: string[];
  triggeredById: string;
}): Promise<NotificationResult> {
  try {
    const { schoolId, scheduleIds, triggeredById } = input;

    // Find exam name from first schedule
    let examName = "Term Examination";
    const firstScheduleId = scheduleIds[0];
    if (firstScheduleId) {
      const firstSchedule = await db.query.examSchedules.findFirst({
        where: and(
          eq(examSchedules.schoolId, schoolId),
          eq(examSchedules.id, firstScheduleId),
        ),
        with: { exam: true },
      });
      if (firstSchedule?.exam?.name) {
        examName = firstSchedule.exam.name;
      }
    }

    // In-App Notice to all
    const [notice] = await db
      .insert(notices)
      .values({
        schoolId,
        title: `Datesheet Published: ${examName}`,
        content: `The official examination datesheet for ${examName} has been published. Tap to check schedules and timings.`,
        audienceType: "ALL",
        audienceFilter: { scheduleIds },
        isPublished: true,
        publishedAt: new Date(),
        createdById: triggeredById,
      })
      .returning();

    // Push notice to parents
    const schoolStudents = await db.query.students.findMany({
      where: and(eq(students.schoolId, schoolId), eq(students.isActive, true)),
      columns: { primaryParentUserId: true },
    });

    const parentUserIds = Array.from(
      new Set(
        schoolStudents
          .map((s) => s.primaryParentUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const quiet = isQuietHours();
    const pushStatus = quiet ? "QUEUED_QUIET_HOURS" : "DELIVERED";
    let pushSentCount = 0;

    for (const parentId of parentUserIds) {
      await db.insert(pushNotificationLogs).values({
        schoolId,
        recipientUserId: parentId,
        title: "Datesheet Published",
        body: `Datesheet for ${examName} has been published. Tap to view.`,
        status: pushStatus,
        sentAt: quiet ? null : new Date(),
      });
      pushSentCount++;
    }

    return {
      success: true,
      inAppNoticeId: notice?.id,
      pushSentCount,
      smsQueuedCount: 0,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send datesheet notification";
    console.error("[ExamNotifications] notifyDatesheetPublished error:", message);
    return { success: false, pushSentCount: 0, smsQueuedCount: 0, error: message };
  }
}

/**
 * 4. Bulk Job Completed Notification:
 * Sent specifically to the School Admin or Principal who launched the asynchronous bulk generation job.
 */
export async function notifyBulkJobCompleted(input: {
  schoolId: string;
  jobId: string;
  examId: string;
  triggeredById: string;
  processedCount: number;
  failedCount: number;
}): Promise<NotificationResult> {
  try {
    const { schoolId, jobId, triggeredById, processedCount, failedCount } = input;

    // Send push notification directly to the triggering user
    await db.insert(pushNotificationLogs).values({
      schoolId,
      recipientUserId: triggeredById,
      title: "Bulk Report Card Generation Complete",
      body: `Batch generation finished (${processedCount} succeeded, ${failedCount} failed). Tap to download.`,
      status: "DELIVERED",
      sentAt: new Date(),
    });

    // Also write an in-app notice for the admin
    const [notice] = await db
      .insert(notices)
      .values({
        schoolId,
        title: "Bulk Report Card Generation Complete",
        content: `Bulk generation job ${jobId} finished with ${processedCount} generated report cards and ${failedCount} failures. Tap to access your ZIP archive download.`,
        audienceType: "STAFF",
        audienceFilter: { jobId },
        isPublished: true,
        publishedAt: new Date(),
        createdById: triggeredById,
      })
      .returning();

    return {
      success: true,
      inAppNoticeId: notice?.id,
      pushSentCount: 1,
      smsQueuedCount: 0,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send bulk job notification";
    console.error("[ExamNotifications] notifyBulkJobCompleted error:", message);
    return { success: false, pushSentCount: 0, smsQueuedCount: 0, error: message };
  }
}
