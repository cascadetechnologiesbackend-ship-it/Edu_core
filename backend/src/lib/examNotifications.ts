import { db } from "@/db";
import {
  notices,
  smsLogs,
  userPushSubscriptions,
  students,
  studentFamilyMembers,
  exams,
  reportCardSetups,
  resultSettings,
  examSchedules,
  examClassScopes,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { withTenant } from "./tenant";
import { dispatchWebPush } from "./webPushDispatcher";
import { persistPushResults, persistQuietHoursPushLogs } from "./pushPersistence";

export interface NotificationResult {
  success: boolean;
  inAppNoticeId?: string | undefined;
  pushSentCount: number;
  smsQueuedCount: number;
  error?: string | undefined;
}

/**
 * Checks whether the current time falls within defined quiet hours (21:00 - 07:00 IST / local).
 * S11 UX-P11 / S12 L4: Delivery respects quiet hours to protect family privacy.
 */
export function isQuietHours(
  date: Date = new Date(),
  timeZone: string = "Asia/Kolkata",
): boolean {
  try {
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        hour12: false,
      }).format(date),
      10,
    );
    return localHour >= 21 || localHour < 7;
  } catch {
    const hours = date.getHours();
    return hours >= 21 || hours < 7;
  }
}

/**
 * Resolves parent user IDs for an examination.
 * Scoped to classes in examClassScopes if present, otherwise all active students in the school.
 * Includes both primary parent and secondary family member user accounts.
 */
async function resolveExamParentRecipients(
  schoolId: string,
  examId?: string,
  scopedDb: any = db,
): Promise<string[]> {
  let scopedClassIds: string[] = [];

  if (examId) {
    const scopes = await scopedDb.query.examClassScopes.findMany({
      where: and(
        eq(examClassScopes.schoolId, schoolId),
        eq(examClassScopes.examId, examId),
      ),
      columns: { classId: true },
    });
    scopedClassIds = scopes.map((s: any) => s.classId);
  }

  const conditions = [
    eq(students.schoolId, schoolId),
    eq(students.isActive, true),
  ];
  if (scopedClassIds.length > 0) {
    conditions.push(inArray(students.currentClassId, scopedClassIds));
  }

  const schoolStudents = await scopedDb.query.students.findMany({
    where: and(...conditions),
    columns: { id: true, primaryParentUserId: true },
  });

  const parentUserIds = new Set<string>();
  const studentIds: string[] = [];

  for (const s of schoolStudents) {
    studentIds.push(s.id);
    if (s.primaryParentUserId) {
      parentUserIds.add(s.primaryParentUserId);
    }
  }

  if (studentIds.length > 0) {
    const familyMembers = await scopedDb.query.studentFamilyMembers.findMany({
      where: and(
        eq(studentFamilyMembers.schoolId, schoolId),
        inArray(studentFamilyMembers.studentId, studentIds),
      ),
      columns: { userId: true },
    });
    for (const fm of familyMembers) {
      if (fm.userId) {
        parentUserIds.add(fm.userId);
      }
    }
  }

  return Array.from(parentUserIds);
}

/**
 * Batch inserts SMS logs in chunks of 100.
 */
async function batchInsertSmsLogs(
  logs: (typeof smsLogs.$inferInsert)[],
  scopedDb: any = db,
) {
  const BATCH_SIZE = 100;
  for (let i = 0; i < logs.length; i += BATCH_SIZE) {
    const chunk = logs.slice(i, i + BATCH_SIZE);
    if (chunk.length > 0) {
      await scopedDb.insert(smsLogs).values(chunk);
    }
  }
}

/**
 * 1. Result Released Notification:
 * Sent to parents when an exam setup's results are published.
 * - Deep link to portal report card view.
 * - Web push + in-app notice.
 * - Optional SMS fallback for parents without push subscriptions (if school toggle enabled).
 * - CRITICAL: Zero student marks or PII in payload.
 */
export async function notifyResultReleased(
  input: {
    schoolId: string;
    setupId: string;
    triggeredById: string;
  },
  txDbOverride?: any,
  quietHoursCheckOverride?: () => boolean,
): Promise<NotificationResult> {
  try {
    const { schoolId, setupId, triggeredById } = input;

    return await withTenant(schoolId, async (scopedDb) => {
      const dbContext = txDbOverride || scopedDb || db;
      // Fetch setup & exam info
      const setup = await dbContext.query.reportCardSetups.findFirst({
        where: and(
          eq(reportCardSetups.schoolId, schoolId),
          eq(reportCardSetups.id, setupId),
        ),
      });

      if (!setup) {
        return {
          success: false,
          pushSentCount: 0,
          smsQueuedCount: 0,
          error: `Report card setup ${setupId} not found in school ${schoolId}`,
        };
      }

      const setupName = setup?.name || "Term Examination";
      const examWeightages = (setup?.examWeightages as Array<{ examId: string }>) || [];
      const primaryExamId = examWeightages[0]?.examId;

      // Check if SMS is enabled for this school/setup in result_settings
      const settings = await dbContext.query.resultSettings.findFirst({
        where: and(
          eq(resultSettings.schoolId, schoolId),
          eq(resultSettings.setupId, setupId),
        ),
      });
      const smsEnabled = settings?.smsNotificationsEnabled ?? false;

      // 1. In-App Notice
      const [notice] = await dbContext
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

      // 2. Derive parent recipients server-side for this exam
      const recipientList = await resolveExamParentRecipients(
        schoolId,
        primaryExamId,
        dbContext,
      );

      if (recipientList.length === 0) {
        return {
          success: true,
          inAppNoticeId: notice?.id,
          pushSentCount: 0,
          smsQueuedCount: 0,
        };
      }

      // 3. Web Push Notifications (Truthful Write-Path: S25-F02)
      const quiet = quietHoursCheckOverride ? quietHoursCheckOverride() : isQuietHours();
      const pushTitle = "Results Published";
      const pushBody = `Examination results for ${setupName} have been published. Tap to view.`;
      let pushSentCount = 0;

      if (quiet) {
        await persistQuietHoursPushLogs(
          schoolId,
          recipientList,
          { title: pushTitle, body: pushBody },
          dbContext,
        );
      } else {
        const dispatchResults = await dispatchWebPush(
          schoolId,
          recipientList,
          { title: pushTitle, body: pushBody },
          dbContext,
        );
        const persisted = await persistPushResults(
          schoolId,
          dispatchResults,
          { title: pushTitle, body: pushBody },
          dbContext,
        );
        pushSentCount = persisted.deliveredCount;
      }

      // 4. Optional SMS Fallback
      let smsQueuedCount = 0;
      if (smsEnabled) {
        const subscriptions = await dbContext.query.userPushSubscriptions.findMany({
          where: and(
            eq(userPushSubscriptions.schoolId, schoolId),
            inArray(userPushSubscriptions.userId, recipientList),
          ),
          columns: { userId: true },
        });

        const pushSubscribedUsers = new Set(subscriptions.map((s: any) => s.userId));
        const parentsWithoutPush = recipientList.filter(
          (id) => !pushSubscribedUsers.has(id),
        );

        if (parentsWithoutPush.length > 0) {
          const smsLogsToInsert: (typeof smsLogs.$inferInsert)[] = parentsWithoutPush.map(
            (parentId) => ({
              schoolId,
              recipientUserId: parentId,
              messageType: "EXAM",
              templateId: "EXAM_RESULT_PUBLISHED",
              status: "QUEUED",
              sentAt: new Date(),
            }),
          );
          await batchInsertSmsLogs(smsLogsToInsert, dbContext);
          smsQueuedCount = parentsWithoutPush.length;
        }
      }

      return {
        success: true,
        inAppNoticeId: notice?.id,
        pushSentCount,
        smsQueuedCount,
      };
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send result notification";
    console.error("[ExamNotifications] notifyResultReleased error:", message);
    return { success: false, pushSentCount: 0, smsQueuedCount: 0, error: message };
  }
}

/**
 * 2. Admit Cards Released Notification:
 * Sent to parents when admit cards become available for an exam.
 */
export async function notifyAdmitCardsReleased(
  input: {
    schoolId: string;
    examId: string;
    triggeredById: string;
  },
  txDbOverride?: any,
  quietHoursCheckOverride?: () => boolean,
): Promise<NotificationResult> {
  try {
    const { schoolId, examId, triggeredById } = input;

    return await withTenant(schoolId, async (scopedDb) => {
      const dbContext = txDbOverride || scopedDb || db;
      const exam = await dbContext.query.exams.findFirst({
        where: and(eq(exams.schoolId, schoolId), eq(exams.id, examId)),
      });
      const examName = exam?.name || "Upcoming Examination";

      // In-App Notice
      const [notice] = await dbContext
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

      // Derive scoped parent recipients
      const parentUserIds = await resolveExamParentRecipients(
        schoolId,
        examId,
        dbContext,
      );

      const quiet = quietHoursCheckOverride ? quietHoursCheckOverride() : isQuietHours();
      const pushTitle = "Admit Cards Available";
      const pushBody = `Admit cards for ${examName} are ready for download. Tap to view.`;
      let pushSentCount = 0;

      if (quiet) {
        await persistQuietHoursPushLogs(
          schoolId,
          parentUserIds,
          { title: pushTitle, body: pushBody },
          dbContext,
        );
      } else if (parentUserIds.length > 0) {
        const dispatchResults = await dispatchWebPush(
          schoolId,
          parentUserIds,
          { title: pushTitle, body: pushBody },
          dbContext,
        );
        const persisted = await persistPushResults(
          schoolId,
          dispatchResults,
          { title: pushTitle, body: pushBody },
          dbContext,
        );
        pushSentCount = persisted.deliveredCount;
      }

      return {
        success: true,
        inAppNoticeId: notice?.id,
        pushSentCount,
        smsQueuedCount: 0,
      };
    });
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
export async function notifyDatesheetPublished(
  input: {
    schoolId: string;
    scheduleIds: string[];
    triggeredById: string;
  },
  txDbOverride?: any,
  quietHoursCheckOverride?: () => boolean,
): Promise<NotificationResult> {
  try {
    const { schoolId, scheduleIds, triggeredById } = input;

    return await withTenant(schoolId, async (scopedDb) => {
      const dbContext = txDbOverride || scopedDb || db;
      // Find exam name and examId from first schedule
      let examName = "Term Examination";
      let examId: string | undefined;

      const firstScheduleId = scheduleIds[0];
      if (firstScheduleId) {
        const firstSchedule = await dbContext.query.examSchedules.findFirst({
          where: and(
            eq(examSchedules.schoolId, schoolId),
            eq(examSchedules.id, firstScheduleId),
          ),
          with: { exam: true },
        });
        if (firstSchedule?.exam) {
          examName = firstSchedule.exam.name;
          examId = firstSchedule.examId;
        }
      }

      // In-App Notice to all
      const [notice] = await dbContext
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

      // Scoped push notice to parents
      const parentUserIds = await resolveExamParentRecipients(
        schoolId,
        examId,
        dbContext,
      );

      const quiet = quietHoursCheckOverride ? quietHoursCheckOverride() : isQuietHours();
      const pushTitle = "Datesheet Published";
      const pushBody = `Datesheet for ${examName} has been published. Tap to view.`;
      let pushSentCount = 0;

      if (quiet) {
        await persistQuietHoursPushLogs(
          schoolId,
          parentUserIds,
          { title: pushTitle, body: pushBody },
          dbContext,
        );
      } else if (parentUserIds.length > 0) {
        const dispatchResults = await dispatchWebPush(
          schoolId,
          parentUserIds,
          { title: pushTitle, body: pushBody },
          dbContext,
        );
        const persisted = await persistPushResults(
          schoolId,
          dispatchResults,
          { title: pushTitle, body: pushBody },
          dbContext,
        );
        pushSentCount = persisted.deliveredCount;
      }

      return {
        success: true,
        inAppNoticeId: notice?.id,
        pushSentCount,
        smsQueuedCount: 0,
      };
    });
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
export async function notifyBulkJobCompleted(
  input: {
    schoolId: string;
    jobId: string;
    examId: string;
    triggeredById: string;
    processedCount: number;
    failedCount: number;
  },
  txDbOverride?: any,
): Promise<NotificationResult> {
  try {
    const { schoolId, jobId, triggeredById, processedCount, failedCount } = input;

    return await withTenant(schoolId, async (scopedDb) => {
      const dbContext = txDbOverride || scopedDb || db;
      // In-app notice for the admin
      const [notice] = await dbContext
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

      const pushTitle = "Bulk Report Card Generation Complete";
      const pushBody = `Batch generation finished (${processedCount} succeeded, ${failedCount} failed). Tap to download.`;

      // Web Push dispatch first
      const dispatchResults = await dispatchWebPush(
        schoolId,
        [triggeredById],
        { title: pushTitle, body: pushBody },
        dbContext,
      );

      // Persist results downstream of dispatch
      const persisted = await persistPushResults(
        schoolId,
        dispatchResults,
        { title: pushTitle, body: pushBody },
        dbContext,
      );

      return {
        success: true,
        inAppNoticeId: notice?.id,
        pushSentCount: persisted.deliveredCount,
        smsQueuedCount: 0,
      };
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send bulk job notification";
    console.error("[ExamNotifications] notifyBulkJobCompleted error:", message);
    return { success: false, pushSentCount: 0, smsQueuedCount: 0, error: message };
  }
}
