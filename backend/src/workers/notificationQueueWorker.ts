import { db } from "@/db";
import { pushNotificationLogs, smsLogs, resultSettings, users, studentFamilyMembers } from "@/db/schema";
import { and, eq, sql, lt, gte, inArray } from "drizzle-orm";
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
 * Flushes push notifications held in DEFERRED_QUIET_HOURS (or legacy QUEUED_QUIET_HOURS)
 * once quiet hours window closes.
 *
 * Requirements (S25-F02 / S25-F03 / AC4):
 * 1. Honors quiet hours gate: defers if called during quiet hours.
 * 2. Fetches queued logs with status DEFERRED_QUIET_HOURS or QUEUED_QUIET_HOURS.
 * 3. Groups deferred logs by (schoolId, title, body) — NEVER broadcasts logs[0] to all recipients!
 * 4. Dispatches each distinct group via dispatchWebPush.
 * 5. Updates each log's status in pushNotificationLogs strictly AFTER the dispatch attempt,
 *    mapping from actual per-recipient dispatch outcomes.
 */
export async function flushQuietHoursNotifications(
  targetSchoolId?: string,
  txDb: any = db,
  quietHoursCheckOverride?: () => boolean,
): Promise<{ flushedCount: number; skippedQuietCount: number }> {
  // If globally in quiet hours (IST), skip flush
  const isQuiet = quietHoursCheckOverride ? quietHoursCheckOverride() : isQuietHours();
  if (isQuiet) {
    workerLogger.info("[NotificationWorker] Currently in IST quiet hours. Deferring flush.");
    return { flushedCount: 0, skippedQuietCount: 1 };
  }

  const quietStatuses = ["DEFERRED_QUIET_HOURS", "QUEUED_QUIET_HOURS"];
  const filter = targetSchoolId
    ? and(
        eq(pushNotificationLogs.schoolId, targetSchoolId),
        inArray(pushNotificationLogs.status, quietStatuses),
      )
    : inArray(pushNotificationLogs.status, quietStatuses);

  const queuedLogs = await txDb.query.pushNotificationLogs.findMany({
    where: filter,
    limit: 500,
  });

  if (!queuedLogs || queuedLogs.length === 0) {
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

  for (const [schoolId, schoolLogs] of bySchool.entries()) {
    try {
      await withTenant(schoolId, async (scopedDb) => {
        const dbContext = scopedDb || txDb;

        // Sub-group by exact payload (title + body) to prevent cross-recipient contamination (S25-F03)
        const byPayload = new Map<string, { title: string; body: string; items: typeof schoolLogs }>();
        for (const log of schoolLogs) {
          const key = `${log.title}:::${log.body}`;
          const existing = byPayload.get(key) || { title: log.title, body: log.body, items: [] };
          existing.items.push(log);
          byPayload.set(key, existing);
        }

        for (const { title, body, items } of byPayload.values()) {
          const userIds = items.map((l: any) => l.recipientUserId);
          const logMap = new Map<string, string>(); // userId -> logId
          for (const item of items) {
            logMap.set(item.recipientUserId, item.id);
          }

          // Dispatch web push with exact payload
          const dispatchResults = await dispatchWebPush(
            schoolId,
            userIds,
            { title, body },
            dbContext,
          );

          // Update each log's status strictly from the actual dispatch outcome
          for (const res of dispatchResults) {
            const logId = logMap.get(res.userId);
            if (!logId) continue;

            const isDelivered = res.status === "DELIVERED";
            if (isDelivered) {
              flushedCount++;
            }

            await dbContext
              .update(pushNotificationLogs)
              .set({
                status: res.status,
                sentAt: isDelivered ? now : null,
              })
              .where(
                and(
                  eq(pushNotificationLogs.id, logId),
                  eq(pushNotificationLogs.schoolId, schoolId),
                ),
              );
          }
        }
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

// ─── Start Worker & Schedulers ──────────────────────────────────────────────────
/**
 * Registers BullMQ repeatable jobs for daily quiet-hours flush (07:05 IST)
 * and periodic SMS drain (every 15 minutes).
 */
export async function registerNotificationSchedulers(): Promise<void> {
  try {
    // 1. Daily quiet hours flush at 07:05 IST
    await notificationQueue.add(
      "scheduled-quiet-hours-flush",
      { type: "FLUSH_QUIET_HOURS" },
      {
        repeat: {
          pattern: "5 7 * * *",
          tz: "Asia/Kolkata",
        },
        jobId: "cron-flush-quiet-hours",
        removeOnComplete: true,
      },
    );

    // 2. Periodic SMS drain every 15 minutes
    await notificationQueue.add(
      "scheduled-sms-drain",
      { type: "DRAIN_SMS" },
      {
        repeat: {
          every: 15 * 60 * 1000,
        },
        jobId: "cron-drain-sms",
        removeOnComplete: true,
      },
    );

    workerLogger.info("[NotificationWorker] Registered BullMQ schedulers for quiet-hours flush and SMS drain.");
  } catch (err: unknown) {
    workerLogger.error(
      `[NotificationWorker] Failed to register BullMQ notification schedulers: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

if (process.env["START_WORKERS"] === "true") {
  registerNotificationSchedulers().catch((err) => {
    workerLogger.error(`[NotificationWorker] Scheduler registration failure: ${err}`);
  });

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
