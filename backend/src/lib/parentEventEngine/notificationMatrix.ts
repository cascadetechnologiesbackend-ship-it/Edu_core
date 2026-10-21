/**
 * Parent Event Engine: Notification Matrix & Policy Engine (Spec v1.0)
 *
 * Implements strict push limits, deduplication, and quiet hours:
 * 1. T1 (Action Required): Max 3 pushes/day per parent, dedupe by (studentId, eventKind, calendarDay).
 * 2. Quiet Hours (21:30 - 07:00 local): Queues push for 07:00 morning delivery; feed card renders immediately.
 * 3. T2 (Informational): Feed card only. No push except REPORT_CARD_PUBLISHED (1 push allowed).
 * 4. T3 (System State): In-app toast only; never web push.
 */

import { CardTier } from "./types";
import { dispatchWebPush, WebPushPayload, DispatchPushResult } from "../webPushDispatcher";
import { db } from "@/db";
import { pushNotificationLogs, userPushSubscriptions } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

export interface NotificationDecisionInput {
  studentId: string;
  parentUserId: string;
  tier: CardTier;
  eventKind: string; // e.g. "ATTENDANCE_ABSENT", "FEE_OVERDUE", "BUS_APPROACHING", "DPDP_CONSENT_DUE", "REPORT_CARD_PUBLISHED"
  now?: Date;
  todayPushCountForParent: number;
  previouslyDispatchedDedupeKeys: Set<string>;
  quietHoursStart?: string; // Default "21:30"
  quietHoursEnd?: string;   // Default "07:00"
  tierOptOuts?: string[];
}

export type NotificationOutcome =
  | "DISPATCH_NOW"
  | "QUEUE_QUIET_HOURS"
  | "SKIP_DAILY_CAP"
  | "SKIP_DEDUPE_LIMIT"
  | "SKIP_TIER_FEED_ONLY"
  | "SKIP_TIER_SYSTEM_STATE"
  | "SKIP_USER_OPTOUT";

export interface NotificationDecision {
  outcome: NotificationOutcome;
  shouldPushNow: boolean;
  isQueuedForMorning: boolean;
  queuedForDate?: Date;
  dedupeKey: string;
  reason: string;
}

/**
 * Checks if current time is within quiet hours (default: 21:30 to 07:00).
 */
export function isInsideQuietHours(
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
export function getNextQuietHoursEnd(now: Date, quietEnd: string = "07:00"): Date {
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
 * Generates deterministic dedupe key for an event per (studentId, eventKind, calendarDay).
 */
export function generateDedupeKey(
  studentId: string,
  eventKind: string,
  date: Date = new Date()
): string {
  const calendarDay = date.toISOString().slice(0, 10);
  return `${studentId}:${eventKind}:${calendarDay}`;
}

/**
 * Pure policy evaluation engine implementing the complete Spec v1.0 Notification Matrix.
 */
export function evaluateNotificationEligibility(
  input: NotificationDecisionInput
): NotificationDecision {
  const now = input.now || new Date();
  const dedupeKey = generateDedupeKey(input.studentId, input.eventKind, now);

  // 1. T3: System State events never trigger push (toast only)
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
      reason: `Parent opted out of ${input.tier} push notifications.`,
    };
  }

  // 3. T2: Informational events are feed-card only, EXCEPT report card published
  if (input.tier === "T2_informational") {
    const isReportCardEvent = input.eventKind === "REPORT_CARD_PUBLISHED";
    if (!isReportCardEvent) {
      return {
        outcome: "SKIP_TIER_FEED_ONLY",
        shouldPushNow: false,
        isQueuedForMorning: false,
        dedupeKey,
        reason: "Tier 2 informational updates live on the home feed; no push sent.",
      };
    }
  }

  // 4. Deduplication Check: (studentId, eventKind, calendarDay)
  if (input.previouslyDispatchedDedupeKeys.has(dedupeKey)) {
    return {
      outcome: "SKIP_DEDUPE_LIMIT",
      shouldPushNow: false,
      isQueuedForMorning: false,
      dedupeKey,
      reason: `Duplicate push suppressed for ${dedupeKey}.`,
    };
  }

  // 5. Daily Cap: Max 3 T1 pushes per parent per day (AC-P4)
  const DAILY_PUSH_CAP = 3;
  if (input.todayPushCountForParent >= DAILY_PUSH_CAP) {
    return {
      outcome: "SKIP_DAILY_CAP",
      shouldPushNow: false,
      isQueuedForMorning: false,
      dedupeKey,
      reason: `Daily cap of ${DAILY_PUSH_CAP} push notifications reached for parent today.`,
    };
  }

  // 6. Quiet Hours Check (21:30 - 07:00 local time)
  const isQuiet = isInsideQuietHours(
    now,
    input.quietHoursStart || "21:30",
    input.quietHoursEnd || "07:00"
  );

  if (isQuiet) {
    const queuedFor = getNextQuietHoursEnd(now, input.quietHoursEnd || "07:00");
    return {
      outcome: "QUEUE_QUIET_HOURS",
      shouldPushNow: false,
      isQueuedForMorning: true,
      queuedForDate: queuedFor,
      dedupeKey,
      reason: `Quiet hours active (${input.quietHoursStart || "21:30"}-${input.quietHoursEnd || "07:00"}). Queued for 07:00 AM dispatch.`,
    };
  }

  // 7. Allowed for immediate dispatch
  return {
    outcome: "DISPATCH_NOW",
    shouldPushNow: true,
    isQueuedForMorning: false,
    dedupeKey,
    reason: "Push notification approved for immediate delivery.",
  };
}

/**
 * Dispatches a push notification respecting all rules, deduplication, and limits.
 */
export async function dispatchParentNotification(
  schoolId: string,
  input: NotificationDecisionInput,
  payload: WebPushPayload,
  txDb: any = db
): Promise<{ decision: NotificationDecision; result?: DispatchPushResult[] }> {
  const decision = evaluateNotificationEligibility(input);

  if (!decision.shouldPushNow) {
    return { decision };
  }

  // Dispatch web push via existing webPushDispatcher
  const pushPayload: WebPushPayload = {
    ...payload,
    tag: decision.dedupeKey,
    data: {
      ...payload.data,
      studentId: input.studentId,
      tier: input.tier,
      eventKind: input.eventKind,
      dedupeKey: decision.dedupeKey,
    },
  };

  const dispatchResults = await dispatchWebPush(
    schoolId,
    [input.parentUserId],
    pushPayload,
    txDb
  );

  return { decision, result: dispatchResults };
}

export const EVENT_KIND_TIER_MAP: Record<string, CardTier> = {
  // Existing v1.0
  ATTENDANCE_ABSENT: "T1_action_required",
  ATTENDANCE_LATE: "T1_action_required",
  FEE_OVERDUE: "T1_action_required",
  BUS_APPROACHING: "T1_action_required",
  DPDP_CONSENT_DUE: "T1_action_required",
  REPORT_CARD_PUBLISHED: "T2_informational",
  HOMEWORK_DUE_48H: "T2_informational",
  HOMEWORK_GRADED: "T2_informational",
  NOTICE_PUBLISHED: "T2_informational",
  PTM_UPCOMING: "T2_informational",
  MESSAGE_UNREAD: "T2_informational",
  PAYMENT_SUCCESS: "T3_system_state",
  // v1.1 Workflows
  LEAVE_DECIDED: "T2_informational",
  LEAVE_PENDING_24H: "T2_informational",
  PTM_SLOT_CONFIRMED: "T2_informational",
  PTM_TOMORROW: "T2_informational",
  PTM_IN_2H: "T1_action_required",
  PTM_CANCELLED: "T3_system_state",
  FEE_QUERY_ANSWERED: "T2_informational",
  FEE_QUERY_ESCALATED: "T1_action_required",
};
