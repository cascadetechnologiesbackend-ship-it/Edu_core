/**
 * Teacher Event Engine: Notification Matrix & Policy Engine (Spec v1.0, Phase T5)
 *
 * Implements strict push limits, deduplication, and quiet hours:
 * 1. T1 (Action Required): Max 3 pushes/day per teacher, dedupe by (teacherUserId, eventKind, calendarDay).
 * 2. Quiet Hours (21:30 - 07:00 local): Queues push for 07:00 morning delivery; feed card renders immediately.
 * 3. T2 (Informational): Feed card only. No push sounds or web push.
 * 4. T3 (System State): In-app toast only (4s duration); never web push.
 */

import { TeacherCardTier } from "./types";
import { dispatchWebPush, WebPushPayload, DispatchPushResult } from "../webPushDispatcher";
import { db } from "@/db";
import { pushNotificationLogs, userPushSubscriptions } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

export type TeacherAcademicEventKind =
  | "ATTENDANCE_CUTOFF_APPROACHING"
  | "SUBSTITUTION_REQUEST_PENDING"
  | "MARKS_ENTRY_WINDOW_CLOSING"
  | "HOMEWORK_PUBLISHED_PUSH"
  | "HOMEWORK_D1_REMINDER"
  | "ASSESSMENT_D3_REMINDER"
  | "WEEKLY_SYLLABUS_DIGEST";

export interface TeacherNotificationDecisionInput {
  teacherUserId: string;
  tier: TeacherCardTier;
  eventKind: TeacherAcademicEventKind | string;
  now?: Date | undefined;
  todayPushCountForTeacher: number;
  previouslyDispatchedDedupeKeys: Set<string>;
  quietHoursStart?: string | undefined; // Default "21:30"
  quietHoursEnd?: string | undefined;   // Default "07:00"
  tierOptOuts?: string[] | undefined;
}

export type TeacherNotificationOutcome =
  | "DISPATCH_NOW"
  | "QUEUE_QUIET_HOURS"
  | "SKIP_DAILY_CAP"
  | "SKIP_DEDUPE_LIMIT"
  | "SKIP_TIER_FEED_ONLY"
  | "SKIP_TIER_SYSTEM_STATE"
  | "SKIP_USER_OPTOUT";

export interface TeacherNotificationDecision {
  outcome: TeacherNotificationOutcome;
  shouldPushNow: boolean;
  isQueuedForMorning: boolean;
  queuedForDate?: Date | undefined;
  dedupeKey: string;
  reason: string;
}

/**
 * Checks if current time is within quiet hours (default: 21:30 to 07:00).
 */
export function isInsideTeacherQuietHours(
  now: Date,
  quietStart: string = "21:30",
  quietEnd: string = "07:00"
): boolean {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = quietStart.split(":").map(Number);
  const [endH, endM] = quietEnd.split(":").map(Number);

  const startMinutes = (startH ?? 21) * 60 + (startM ?? 30);
  const endMinutes = (endH ?? 7) * 60 + (endM ?? 0);

  if (startMinutes > endMinutes) {
    // Spans midnight: 21:30 (1290) -> 07:00 (420)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}

/**
 * Computes the timestamp for 07:00 AM of the next available morning.
 */
export function getNextTeacherQuietHoursEnd(
  now: Date,
  quietEnd: string = "07:00"
): Date {
  const [endH, endM] = quietEnd.split(":").map(Number);
  const target = new Date(now);
  target.setHours(endH ?? 7, endM ?? 0, 0, 0);

  // If current time is past today's end time, queue for tomorrow morning
  if (now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

/**
 * Generates deterministic dedupe key for an event per (teacherUserId, eventKind, calendarDay).
 */
export function generateTeacherDedupeKey(
  teacherUserId: string,
  eventKind: string,
  date: Date = new Date()
): string {
  const calendarDay = date.toISOString().slice(0, 10);
  return `${teacherUserId}:${eventKind}:${calendarDay}`;
}

/**
 * Pure policy evaluation engine implementing the Spec v1.0 Teacher Notification Matrix (AC-T10).
 */
export function evaluateTeacherNotificationEligibility(
  input: TeacherNotificationDecisionInput
): TeacherNotificationDecision {
  const now = input.now || new Date();
  const dedupeKey = generateTeacherDedupeKey(input.teacherUserId, input.eventKind, now);

  // 1. T3: System State events never trigger push (toast only, AC-T10)
  if (input.tier === "T3_system_state") {
    return {
      outcome: "SKIP_TIER_SYSTEM_STATE",
      shouldPushNow: false,
      isQueuedForMorning: false,
      dedupeKey,
      reason: "Tier 3 system state events are in-app toasts only, no web push.",
    };
  }

  // 2. Check user tier opt-outs
  if (input.tierOptOuts && input.tierOptOuts.includes(input.tier)) {
    return {
      outcome: "SKIP_USER_OPTOUT",
      shouldPushNow: false,
      isQueuedForMorning: false,
      dedupeKey,
      reason: `Teacher opted out of ${input.tier} push notifications.`,
    };
  }

  // 3. T2: Informational events are feed-card only (no push sounds or pushes)
  if (input.tier === "T2_informational") {
    return {
      outcome: "SKIP_TIER_FEED_ONLY",
      shouldPushNow: false,
      isQueuedForMorning: false,
      dedupeKey,
      reason: "Tier 2 informational updates live on the home feed; no push sent.",
    };
  }

  // 4. Deduplication Check: (teacherUserId, eventKind, calendarDay)
  if (input.previouslyDispatchedDedupeKeys.has(dedupeKey)) {
    return {
      outcome: "SKIP_DEDUPE_LIMIT",
      shouldPushNow: false,
      isQueuedForMorning: false,
      dedupeKey,
      reason: `Duplicate push suppressed for ${dedupeKey}.`,
    };
  }

  // 5. Daily Cap: Max 3 T1 pushes per teacher per day (AC-T10)
  const DAILY_PUSH_CAP = 3;
  if (input.todayPushCountForTeacher >= DAILY_PUSH_CAP) {
    return {
      outcome: "SKIP_DAILY_CAP",
      shouldPushNow: false,
      isQueuedForMorning: false,
      dedupeKey,
      reason: `Daily cap of ${DAILY_PUSH_CAP} push notifications reached for teacher today.`,
    };
  }

  // 6. Quiet Hours Check (21:30 - 07:00 local time)
  const isQuiet = isInsideTeacherQuietHours(
    now,
    input.quietHoursStart || "21:30",
    input.quietHoursEnd || "07:00"
  );

  if (isQuiet) {
    const queuedFor = getNextTeacherQuietHoursEnd(now, input.quietHoursEnd || "07:00");
    return {
      outcome: "QUEUE_QUIET_HOURS",
      shouldPushNow: false,
      isQueuedForMorning: true,
      queuedForDate: queuedFor,
      dedupeKey,
      reason: `Quiet hours active (${input.quietHoursStart || "21:30"}-${input.quietHoursEnd || "07:00"}). Queued for 07:00 AM dispatch.`,
    };
  }

  // 7. Approved for immediate dispatch
  return {
    outcome: "DISPATCH_NOW",
    shouldPushNow: true,
    isQueuedForMorning: false,
    dedupeKey,
    reason: "Push notification approved for immediate delivery.",
  };
}

/**
 * Dispatches a teacher push notification respecting all rules, deduplication, and limits.
 */
export async function dispatchTeacherNotification(
  schoolId: string,
  input: TeacherNotificationDecisionInput,
  payload: WebPushPayload
): Promise<{
  decision: TeacherNotificationDecision;
  dispatchResult?: DispatchPushResult | undefined;
}> {
  const decision = evaluateTeacherNotificationEligibility(input);

  // If queued for morning delivery
  if (decision.outcome === "QUEUE_QUIET_HOURS" && decision.queuedForDate) {
    try {
      await db.insert(pushNotificationLogs).values({
        schoolId,
        recipientUserId: input.teacherUserId,
        title: payload.title,
        body: payload.body,
        fcmMessageId: decision.dedupeKey,
        status: "QUEUED_QUIET_HOURS",
      });
    } catch (err) {
      console.error("[dispatchTeacherNotification] Failed to log queued push:", err);
    }

    return { decision };
  }

  // If not approved for push now
  if (!decision.shouldPushNow) {
    return { decision };
  }

  // Find active subscriptions for teacher
  const subs = await db.query.userPushSubscriptions.findMany({
    where: and(
      eq(userPushSubscriptions.userId, input.teacherUserId),
      eq(userPushSubscriptions.schoolId, schoolId)
    ),
  });

  if (subs.length === 0) {
    return {
      decision: {
        ...decision,
        reason: "No active push subscriptions found for teacher.",
      },
    };
  }

  // Execute web push dispatch
  const dispatchResults = await dispatchWebPush(schoolId, [input.teacherUserId], payload);
  const firstResult = dispatchResults[0];

  // Log dispatch in pushNotificationLogs
  try {
    await db.insert(pushNotificationLogs).values({
      schoolId,
      recipientUserId: input.teacherUserId,
      title: payload.title,
      body: payload.body,
      fcmMessageId: decision.dedupeKey,
      status: firstResult && firstResult.success ? "DELIVERED" : "FAILED",
    });
  } catch (err) {
    console.error("[dispatchTeacherNotification] Failed to log push dispatch:", err);
  }

  return { decision, dispatchResult: firstResult };
}

/**
 * Loads today's push count and deduplication keys for a teacher from the database.
 */
export async function getTeacherTodayNotificationState(
  teacherUserId: string,
  schoolId: string,
  now: Date = new Date()
): Promise<{
  todayPushCount: number;
  previouslyDispatchedDedupeKeys: Set<string>;
}> {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const logs = await db.query.pushNotificationLogs.findMany({
    where: and(
      eq(pushNotificationLogs.recipientUserId, teacherUserId),
      eq(pushNotificationLogs.schoolId, schoolId),
      gte(pushNotificationLogs.createdAt, startOfDay)
    ),
  });

  const previouslyDispatchedDedupeKeys = new Set<string>();
  let todayPushCount = 0;

  for (const log of logs) {
    if (log.fcmMessageId) {
      previouslyDispatchedDedupeKeys.add(log.fcmMessageId);
    }
    if (log.status === "DELIVERED") {
      todayPushCount++;
    }
  }

  return {
    todayPushCount,
    previouslyDispatchedDedupeKeys,
  };
}
