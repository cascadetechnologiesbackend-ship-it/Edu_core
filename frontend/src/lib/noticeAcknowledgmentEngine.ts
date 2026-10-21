/**
 * Notice Acknowledgment & Bulk Reminder Evaluation Engine (Spec v1.2 Phase P13, OP7, AC-P20)
 *
 * Pure business logic isolated from Next.js server runtime / next-auth.
 */

import {
  evaluateNotificationEligibility,
  type NotificationDecisionInput,
} from "../../../backend/src/lib/parentEventEngine/notificationMatrix";

export interface NoticeParentRecipient {
  parentUserId: string;
  parentName?: string;
  parentEmail?: string;
  studentId: string;
  studentName?: string;
  className?: string;
  sectionName?: string;
  acknowledged: boolean;
  acknowledgedAt?: string | null;
  source?: "FEED" | "PORTAL" | null;
  hoursSinceNotice?: number;
}

export interface NoticeAcknowledgmentReport {
  noticeId: string;
  title: string;
  publishedAt: string;
  requiresAcknowledgment: boolean;
  totalTargeted: number;
  acknowledgedCount: number;
  percentage: number;
  acknowledgedList: NoticeParentRecipient[];
  unacknowledgedList: NoticeParentRecipient[];
}

export interface BulkReminderResult {
  success: boolean;
  totalTargeted: number;
  remindedCount: number;
  queuedForMorningCount: number;
  skippedDailyCapCount: number;
  error?: string;
}

/**
 * Pure calculation helper: calculates acknowledgment percentage.
 */
export function calculateAcknowledgmentPercentage(
  acknowledgedCount: number,
  totalTargeted: number
): number {
  if (totalTargeted <= 0) return 0;
  return Math.min(100, Math.round((acknowledgedCount / totalTargeted) * 100));
}

/**
 * Pure helper to filter unacknowledged parents from full recipient set.
 */
export function filterUnacknowledgedRecipients(
  recipients: NoticeParentRecipient[]
): NoticeParentRecipient[] {
  return recipients.filter((r) => !r.acknowledged);
}

/**
 * Pure evaluation helper for bulk reminder dispatch respecting daily caps and quiet hours.
 */
export function evaluateBulkReminderBatch(
  unacknowledgedParents: Array<{ parentUserId: string; studentId: string }>,
  options: {
    now?: Date;
    noticePublishedAt: Date;
    parentPushCounts?: Map<string, number>;
    dispatchedDedupeKeys?: Set<string>;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  }
): {
  reminded: Array<{ parentUserId: string; studentId: string; eventKind: string; dedupeKey: string }>;
  queued: Array<{ parentUserId: string; studentId: string; eventKind: string; dedupeKey: string }>;
  skippedCap: Array<{ parentUserId: string; studentId: string; reason: string }>;
} {
  const now = options.now || new Date();
  const hoursSincePub = (now.getTime() - options.noticePublishedAt.getTime()) / (1000 * 60 * 60);
  const eventKind = hoursSincePub >= 48 ? "NOTICE_ACK_REMINDER_48H" : "NOTICE_ACK_REMINDER_24H";

  const parentPushCounts = options.parentPushCounts || new Map<string, number>();
  const dispatchedDedupeKeys = options.dispatchedDedupeKeys || new Set<string>();

  const reminded: Array<{ parentUserId: string; studentId: string; eventKind: string; dedupeKey: string }> = [];
  const queued: Array<{ parentUserId: string; studentId: string; eventKind: string; dedupeKey: string }> = [];
  const skippedCap: Array<{ parentUserId: string; studentId: string; reason: string }> = [];

  for (const parent of unacknowledgedParents) {
    const todayCount = parentPushCounts.get(parent.parentUserId) || 0;

    const input: NotificationDecisionInput = {
      studentId: parent.studentId,
      parentUserId: parent.parentUserId,
      tier: "T1_action_required",
      eventKind,
      now,
      todayPushCountForParent: todayCount,
      previouslyDispatchedDedupeKeys: dispatchedDedupeKeys,
      quietHoursStart: options.quietHoursStart || "21:30",
      quietHoursEnd: options.quietHoursEnd || "07:00",
    };

    const decision = evaluateNotificationEligibility(input);

    if (decision.outcome === "DISPATCH_NOW") {
      reminded.push({
        parentUserId: parent.parentUserId,
        studentId: parent.studentId,
        eventKind,
        dedupeKey: decision.dedupeKey,
      });
      parentPushCounts.set(parent.parentUserId, todayCount + 1);
      dispatchedDedupeKeys.add(decision.dedupeKey);
    } else if (decision.outcome === "QUEUE_QUIET_HOURS") {
      queued.push({
        parentUserId: parent.parentUserId,
        studentId: parent.studentId,
        eventKind,
        dedupeKey: decision.dedupeKey,
      });
      dispatchedDedupeKeys.add(decision.dedupeKey);
    } else if (decision.outcome === "SKIP_DAILY_CAP") {
      skippedCap.push({
        parentUserId: parent.parentUserId,
        studentId: parent.studentId,
        reason: decision.reason,
      });
    }
  }

  return { reminded, queued, skippedCap };
}
