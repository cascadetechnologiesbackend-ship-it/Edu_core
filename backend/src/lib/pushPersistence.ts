import { db } from "@/db";
import { pushNotificationLogs } from "@/db/schema";
import type { DispatchPushResult } from "./webPushDispatcher";

export interface PersistPushResultCounts {
  deliveredCount: number;
  failedCount: number;
  skippedNoSubCount: number;
  skippedUnconfiguredCount: number;
}

/**
 * Single shared write-path for push notification logs.
 * Persists log records strictly downstream of actual dispatch results,
 * guaranteeing that DELIVERED records represent real delivery attempts.
 */
export async function persistPushResults(
  schoolId: string,
  results: DispatchPushResult[],
  payload: { title: string; body: string },
  txDb: any = db,
): Promise<PersistPushResultCounts> {
  if (results.length === 0) {
    return {
      deliveredCount: 0,
      failedCount: 0,
      skippedNoSubCount: 0,
      skippedUnconfiguredCount: 0,
    };
  }

  const now = new Date();
  let deliveredCount = 0;
  let failedCount = 0;
  let skippedNoSubCount = 0;
  let skippedUnconfiguredCount = 0;

  const rows: (typeof pushNotificationLogs.$inferInsert)[] = [];

  for (const r of results) {
    if (r.status === "DELIVERED") deliveredCount++;
    else if (r.status === "FAILED") failedCount++;
    else if (r.status === "SKIPPED_NO_SUBSCRIPTION") skippedNoSubCount++;
    else if (r.status === "SKIPPED_UNCONFIGURED") skippedUnconfiguredCount++;

    rows.push({
      schoolId,
      recipientUserId: r.userId,
      title: payload.title,
      body: payload.body,
      status: r.status,
      sentAt: r.status === "DELIVERED" ? now : null,
    });
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    if (chunk.length > 0) {
      await txDb.insert(pushNotificationLogs).values(chunk);
    }
  }

  return {
    deliveredCount,
    failedCount,
    skippedNoSubCount,
    skippedUnconfiguredCount,
  };
}

/**
 * Persists deferred quiet-hours push notification logs carrying the exact per-event payload.
 * Log rows are recorded with status DEFERRED_QUIET_HOURS and sentAt: null.
 */
export async function persistQuietHoursPushLogs(
  schoolId: string,
  recipientUserIds: string[],
  payload: { title: string; body: string },
  txDb: any = db,
): Promise<void> {
  if (recipientUserIds.length === 0) return;

  const rows: (typeof pushNotificationLogs.$inferInsert)[] = recipientUserIds.map((userId) => ({
    schoolId,
    recipientUserId: userId,
    title: payload.title,
    body: payload.body,
    status: "DEFERRED_QUIET_HOURS",
    sentAt: null,
  }));

  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    if (chunk.length > 0) {
      await txDb.insert(pushNotificationLogs).values(chunk);
    }
  }
}
