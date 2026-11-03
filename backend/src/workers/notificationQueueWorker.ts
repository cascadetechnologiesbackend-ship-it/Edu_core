import { db } from "@/db";
import { pushNotificationLogs, smsLogs, resultSettings, users, studentFamilyMembers } from "@/db/schema";
import { and, eq, sql, lt, gte } from "drizzle-orm";
import { Worker, Queue } from "bullmq";
import { getBullMQRedisConnection } from "../lib/redisConnection";
import { workerLogger } from "@/lib/logger";
import { isQuietHours } from "../lib/examNotifications";
import { dispatchWebPush } from "../lib/webPushDispatcher";
import { sendSMSWithStatus, isSmsConfigured } from "../lib/sms";
import { decryptData } from "../lib/encryption";
import { withTenant } from "../lib/tenant";

export interface NotificationJobPayload {
  schoolId?: string | undefined;
  type: "FLUSH_QUIET_HOURS" | "DRAIN_SMS";
}

export const notificationQueue = new Queue<NotificationJobPayload>("exam-notifications", {
  connection: getBullMQRedisConnection(),
});

/**
 * Flushes push notifications held in QUEUED_QUIET_HOURS once quiet hours window closes.
 */
export async function flushQuietHoursNotifications(
  targetSchoolId?: string,
  txDb: any = db,
): Promise<{ flushedCount: number; skippedQuietCount: number }> {
  // If globally in quiet hours (IST), skip flush
  if (isQuietHours()) {
    workerLogger.info("[NotificationWorker] Currently in IST quiet hours. Deferring flush.");
    return { flushedCount: 0, skippedQuietCount: 1 };
  }

  const filter = targetSchoolId
    ? and(
        eq(pushNotificationLogs.schoolId, targetSchoolId),
        eq(pushNotificationLogs.status, "QUEUED_QUIET_HOURS"),
      )
    : eq(pushNotificationLogs.status, "QUEUED_QUIET_HOURS");

  const queuedLogs = await txDb.query.pushNotificationLogs.findMany({
    where: filter,
    limit: 500,
  });

  if (queuedLogs.length === 0) {
    return { flushedCount: 0, skippedQuietCount: 0 };
  }

  let flushedCount = 0;
  const now = new Date();

  // Group by school to update with tenant context
  const bySchool = new Map<string, typeof queuedLogs>();
  for (const log of queuedLogs) {
    const arr = bySchool.get(log.schoolId) || [];
    arr.push(log);
    bySchool.set(log.schoolId, arr);
  }

  for (const [schoolId, logs] of bySchool.entries()) {
    try {
      await withTenant(schoolId, async (scopedDb) => {
        const userIds = logs.map((l: any) => l.recipientUserId);
        
        // Mark as DELIVERED
        for (const log of logs) {
          await scopedDb
            .update(pushNotificationLogs)
            .set({
              status: "DELIVERED",
              sentAt: now,
            })
            .where(
              and(
                eq(pushNotificationLogs.id, log.id),
                eq(pushNotificationLogs.schoolId, schoolId),
              ),
            );
          flushedCount++;
        }

        // Attempt push dispatch
        await dispatchWebPush(
          schoolId,
          userIds,
          {
            title: logs[0]?.title || "Exam Update",
            body: logs[0]?.body || "New exam notification available.",
          },
          scopedDb,
        );
      });
    } catch (err: unknown) {
      workerLogger.error(
        `[NotificationWorker] Error flushing quiet hours for school ${schoolId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { flushedCount, skippedQuietCount: 0 };
}

function renderSmsMessage(templateId?: string | null, messageType?: string | null): string {
  if (templateId === "EXAM_RESULT_PUBLISHED") {
    return "Examination results have been published. Please check the SchoolMitra portal to view report cards.";
  }
  if (templateId === "ADMIT_CARDS_RELEASED") {
    return "Examination admit cards are now available for download on the SchoolMitra portal.";
  }
  if (templateId === "DATESHEET_PUBLISHED") {
    return "The official examination datesheet has been published on the SchoolMitra portal.";
  }
  if (templateId === "BULK_JOB_COMPLETED") {
    return "Your requested bulk report card generation has finished processing.";
  }
  return `Notification from SchoolMitra (${messageType || "UPDATE"}): Please visit your portal for updates.`;
}

/**
 * Drains queued SMS messages while strictly enforcing the 500 SMS/day per-school limit.
 *
 * Requirements (S25-F01 / AC2):
 * 1. Resolves recipient mobile number by querying user / family linkage and decrypting via decryptData.
 * 2. Invokes sendSMSWithStatus per queued log row.
 * 3. Transitions status strictly downstream of the real result:
 *    - delivered === true: SENT with gatewayMessageId, sentAt, consumes daily quota.
 *    - delivered === false (provider error): FAILED with failureReason, does not consume quota.
 *    - unconfigured === true: defers honestly in QUEUED state without fabricating SENT (OD2).
 *    - missing mobile: FAILED with "No mobile number on file for recipient".
 * 4. Strictly blocks sends and tallies cappedCount when 500 SMS/day limit is exhausted.
 */
export async function drainQueuedSms(
  targetSchoolId?: string,
  txDb: any = db,
): Promise<{ sentCount: number; cappedCount: number; disabledCount: number }> {
  if (!isSmsConfigured()) {
    workerLogger.warn("[NotificationWorker] SMS provider not configured. Skipping drain.");
    return { sentCount: 0, cappedCount: 0, disabledCount: 0 };
  }

  const filter = targetSchoolId
    ? and(eq(smsLogs.schoolId, targetSchoolId), eq(smsLogs.status, "QUEUED"))
    : eq(smsLogs.status, "QUEUED");

  const queuedSms = await txDb.query.smsLogs.findMany({
    where: filter,
    limit: 200,
  });

  if (queuedSms.length === 0) {
    return { sentCount: 0, cappedCount: 0, disabledCount: 0 };
  }

  let sentCount = 0;
  let cappedCount = 0;
  let disabledCount = 0;

  // Group by school
  const bySchool = new Map<string, typeof queuedSms>();
  for (const item of queuedSms) {
    const arr = bySchool.get(item.schoolId) || [];
    arr.push(item);
    bySchool.set(item.schoolId, arr);
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  for (const [schoolId, items] of bySchool.entries()) {
    try {
      await withTenant(schoolId, async (scopedDb) => {
        const dbContext = scopedDb || txDb;

        // Check daily count of strictly real SENT logs
        const todayLogs = await dbContext.query.smsLogs.findMany({
          where: and(
            eq(smsLogs.schoolId, schoolId),
            gte(smsLogs.createdAt, startOfDay),
            eq(smsLogs.status, "SENT"),
          ),
          columns: { id: true },
        });

        const DAILY_CAP = 500;
        let remainingCap = Math.max(0, DAILY_CAP - (todayLogs?.length || 0));

        if (remainingCap <= 0) {
          cappedCount += items.length;
          return;
        }

        for (const item of items) {
          if (remainingCap <= 0) {
            cappedCount++;
            continue;
          }

          // 1. Resolve recipient mobile number
          let mobile: string | null = null;
          if (item.recipientUserId) {
            if (dbContext.query?.users) {
              const u = await dbContext.query.users.findFirst({
                where: eq(users.id, item.recipientUserId),
                columns: { mobileEncrypted: true },
              });
              if (u?.mobileEncrypted) {
                mobile = decryptData(u.mobileEncrypted);
              }
            }

            if (!mobile && dbContext.query?.studentFamilyMembers) {
              const fm = await dbContext.query.studentFamilyMembers.findFirst({
                where: eq(studentFamilyMembers.userId, item.recipientUserId),
                columns: { mobileEncrypted: true },
              });
              if (fm?.mobileEncrypted) {
                mobile = decryptData(fm.mobileEncrypted);
              }
            }
          }

          if (!mobile) {
            workerLogger.warn(
              `[NotificationWorker] No mobile number on file for recipient ${item.recipientUserId}. Marking FAILED.`,
            );
            await dbContext
              .update(smsLogs)
              .set({
                status: "FAILED",
                failureReason: "No mobile number on file for recipient",
                sentAt: new Date(),
              })
              .where(and(eq(smsLogs.id, item.id), eq(smsLogs.schoolId, schoolId)));
            continue;
          }

          // 2. Dispatch SMS via live provider
          const messageText = renderSmsMessage(item.templateId, item.messageType);
          const sendResult = await sendSMSWithStatus(mobile, messageText, {
            templateId: item.templateId || undefined,
          });

          if (sendResult.delivered) {
            await dbContext
              .update(smsLogs)
              .set({
                status: "SENT",
                gatewayMessageId: sendResult.messageId || null,
                failureReason: null,
                sentAt: new Date(),
              })
              .where(and(eq(smsLogs.id, item.id), eq(smsLogs.schoolId, schoolId)));

            sentCount++;
            remainingCap--;
          } else if (sendResult.unconfigured) {
            // OD2: Unconfigured provider leaves log QUEUED honestly without consuming daily quota
            workerLogger.warn(
              `[NotificationWorker] SMS provider unconfigured during drain for school ${schoolId}; message ${item.id} remains QUEUED`,
            );
          } else {
            // Delivery failed at gateway
            workerLogger.error(
              `[NotificationWorker] SMS delivery failed for school ${schoolId}, log ${item.id}: ${sendResult.error}`,
            );
            await dbContext
              .update(smsLogs)
              .set({
                status: "FAILED",
                failureReason: sendResult.error || "SMS provider delivery rejection",
                sentAt: new Date(),
              })
              .where(and(eq(smsLogs.id, item.id), eq(smsLogs.schoolId, schoolId)));
          }
        }
      });
    } catch (err: unknown) {
      workerLogger.error(
        `[NotificationWorker] Error draining SMS for school ${schoolId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { sentCount, cappedCount, disabledCount };
}

// ─── Start Worker ─────────────────────────────────────────────────────────────
if (process.env["START_WORKERS"] === "true") {
  const worker = new Worker<NotificationJobPayload>(
    "exam-notifications",
    async (job) => {
      workerLogger.info(`[NotificationWorker] Processing job ${job.id} type=${job.data.type}`);
      if (job.data.type === "FLUSH_QUIET_HOURS") {
        return await flushQuietHoursNotifications(job.data.schoolId);
      }
      if (job.data.type === "DRAIN_SMS") {
        return await drainQueuedSms(job.data.schoolId);
      }
      return { success: false, error: "Unknown job type" };
    },
    {
      connection: getBullMQRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on("completed", (job) => {
    workerLogger.info(`[NotificationWorker] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    workerLogger.error(`[NotificationWorker] Job ${job?.id} failed: ${err.message}`);
  });
}
