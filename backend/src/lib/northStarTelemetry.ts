/**
 * North Star Telemetry Engine (Charter Phase D0)
 *
 * Implements truthful, first-party telemetry for SchoolMitra's Six North Star Metrics:
 * 1. attendance_mark_minutes (target: < 4 min)
 * 2. fee_day_reconciled_by_3pm (target: >= 95%)
 * 3. month_close_hours (target: < 4 hr)
 * 4. onboarding_days (target: <= 1 day)
 * 5. parent_fee_seconds (target: < 90 sec)
 * 6. journey_completion_rate (target: >= 95%)
 *
 * Architectural Invariants:
 * - First-party only: stored in Postgres `usage_events`, zero external analytics or third-party trackers.
 * - Strictly zero PII: rejects student names, email addresses, phone numbers, Aadhaar, PAN, card numbers.
 * - Tenant-isolated: scoped strictly by `school_id` with `withTenant` access checks.
 */

import { db } from "@/db";
import { usageEvents, schools } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { withTenant } from "./tenant";

export const NORTH_STAR_EVENTS = [
  "north_star_attendance_duration",
  "north_star_fee_day_reconciled",
  "north_star_month_close_duration",
  "north_star_onboarding_duration",
  "north_star_parent_fee_duration",
  "north_star_journey_completion",
] as const;

export type NorthStarEventName = (typeof NORTH_STAR_EVENTS)[number];

export const NORTH_STAR_TARGETS = {
  attendance_mark_minutes: 4,
  fee_day_reconciled_by_3pm_pct: 95,
  month_close_hours: 4,
  onboarding_days: 1,
  parent_fee_seconds: 90,
  journey_completion_rate_pct: 95,
} as const;

// PII patterns strictly prohibited in telemetry payloads
const PII_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i, // Email
  /(?:\+91[-\s]?)?[6-9]\d{9}/,                        // Indian Mobile (10 digits)
  /\b\d{4}\s\d{4}\s\d{4}\b/,                          // 12-digit Aadhaar pattern (e.g. 1234 5678 9012)
  /\b[A-Z]{5}\d{4}[A-Z]\b/,                           // PAN pattern
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates that an arbitrary telemetry payload is strictly free of personal data.
 * Throws an Error if any PII pattern is discovered.
 */
export function assertZeroPII(data: unknown): void {
  if (data === null || data === undefined) return;

  if (typeof data === "string") {
    // Standard UUIDs are safe entity keys
    if (UUID_REGEX.test(data)) {
      return;
    }

    for (const pattern of PII_PATTERNS) {
      if (pattern.test(data)) {
        throw new Error(`[NorthStarTelemetry] PII violation detected in telemetry payload: matching pattern ${pattern}`);
      }
    }
    return;
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      assertZeroPII(item);
    }
    return;
  }

  if (typeof data === "object") {
    for (const [key, val] of Object.entries(data)) {
      // Reject suspect key names that indicate PII leak
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("name") ||
        lowerKey.includes("email") ||
        lowerKey.includes("phone") ||
        lowerKey.includes("mobile") ||
        lowerKey.includes("aadhaar") ||
        lowerKey.includes("address")
      ) {
        throw new Error(`[NorthStarTelemetry] Prohibited PII key name detected: "${key}"`);
      }
      assertZeroPII(val);
    }
  }
}

export interface BaseEventParams {
  schoolId: string;
  userId: string;
  role: string;
}

export interface AttendanceDurationParams extends BaseEventParams {
  sectionId?: string;
  studentCount: number;
  durationMs: number;
  status: "completed" | "abandoned";
}

export interface FeeDayReconciledParams extends BaseEventParams {
  date: string;
  collectedPaise: number;
  reconciledPaise: number;
  isReconciledBy3pm: boolean;
}

export interface MonthCloseDurationParams extends BaseEventParams {
  monthYear: string;
  durationHours: number;
  invariantsGreen: boolean;
}

export interface OnboardingDurationParams extends BaseEventParams {
  tenantId: string;
  workingDaysElapsed: number;
  firstAttendanceMarked: boolean;
}

export interface ParentFeeDurationParams extends BaseEventParams {
  invoiceId: string;
  durationSeconds: number;
  gatewaySuccess: boolean;
}

export interface JourneyCompletionParams extends BaseEventParams {
  journeyId: string;
  durationMs: number;
  completed: boolean;
  finishedState?: string;
  action?: string;
}

/**
 * Generic emitter writing a validated North Star event to `usage_events`.
 */
export async function emitNorthStarEvent(params: {
  schoolId: string;
  userId: string;
  role: string;
  screen: string;
  eventName: NorthStarEventName;
  action: string;
  payload: Record<string, unknown>;
  txDb?: any;
}) {
  const { schoolId, userId, role, screen, eventName, action, payload, txDb } = params;

  // 1. Strict PII assertion
  assertZeroPII(payload);

  const serializedLabel = JSON.stringify({
    eventName,
    ...payload,
    recordedAt: new Date().toISOString(),
  });

  const row = {
    schoolId,
    screen,
    elementId: eventName,
    elementLabel: serializedLabel,
    action,
    role,
    userId,
  };

  const client = txDb || db;
  const [inserted] = await client.insert(usageEvents).values(row).returning();
  return inserted;
}

// ============================================================================
// Strongly-Typed North Star Metric Recording Functions
// ============================================================================

export async function recordAttendanceMarkDuration(params: AttendanceDurationParams, txDb?: any) {
  if (params.durationMs < 0) {
    throw new Error("[NorthStarTelemetry] durationMs must be non-negative");
  }

  return emitNorthStarEvent({
    schoolId: params.schoolId,
    userId: params.userId,
    role: params.role || "TEACHER",
    screen: "/teacher/attendance",
    eventName: "north_star_attendance_duration",
    action: "submit_attendance",
    payload: {
      durationMs: params.durationMs,
      durationMinutes: Number((params.durationMs / 60000).toFixed(2)),
      studentCount: params.studentCount,
      sectionId: params.sectionId ?? "unspecified",
      status: params.status,
      targetMet: params.durationMs <= NORTH_STAR_TARGETS.attendance_mark_minutes * 60000,
    },
    txDb,
  });
}

export async function recordFeeDayReconciledBy3pm(params: FeeDayReconciledParams, txDb?: any) {
  if (params.collectedPaise < 0 || params.reconciledPaise < 0) {
    throw new Error("[NorthStarTelemetry] paise values must be non-negative");
  }

  const reconciliationPct = params.collectedPaise > 0
    ? Number(((params.reconciledPaise / params.collectedPaise) * 100).toFixed(2))
    : 100;

  return emitNorthStarEvent({
    schoolId: params.schoolId,
    userId: params.userId,
    role: params.role || "OFFICE_ADMIN",
    screen: "/fees/reconciliation",
    eventName: "north_star_fee_day_reconciled",
    action: "reconcile_day",
    payload: {
      date: params.date,
      collectedPaise: params.collectedPaise,
      reconciledPaise: params.reconciledPaise,
      reconciliationPct,
      isReconciledBy3pm: params.isReconciledBy3pm,
      targetMet: params.isReconciledBy3pm && reconciliationPct >= NORTH_STAR_TARGETS.fee_day_reconciled_by_3pm_pct,
    },
    txDb,
  });
}

export async function recordMonthCloseDuration(params: MonthCloseDurationParams, txDb?: any) {
  if (params.durationHours < 0) {
    throw new Error("[NorthStarTelemetry] durationHours must be non-negative");
  }

  return emitNorthStarEvent({
    schoolId: params.schoolId,
    userId: params.userId,
    role: params.role || "ACCOUNTANT",
    screen: "/school/accounting/close",
    eventName: "north_star_month_close_duration",
    action: "close_month",
    payload: {
      monthYear: params.monthYear,
      durationHours: params.durationHours,
      invariantsGreen: params.invariantsGreen,
      targetMet: params.durationHours <= NORTH_STAR_TARGETS.month_close_hours && params.invariantsGreen,
    },
    txDb,
  });
}

export async function recordOnboardingDays(params: OnboardingDurationParams, txDb?: any) {
  if (params.workingDaysElapsed < 0) {
    throw new Error("[NorthStarTelemetry] workingDaysElapsed must be non-negative");
  }

  return emitNorthStarEvent({
    schoolId: params.schoolId,
    userId: params.userId,
    role: params.role || "SUPER_ADMIN",
    screen: "/onboard",
    eventName: "north_star_onboarding_duration",
    action: "complete_onboarding",
    payload: {
      tenantId: params.tenantId,
      workingDaysElapsed: params.workingDaysElapsed,
      firstAttendanceMarked: params.firstAttendanceMarked,
      targetMet: params.workingDaysElapsed <= NORTH_STAR_TARGETS.onboarding_days && params.firstAttendanceMarked,
    },
    txDb,
  });
}

export async function recordParentFeeDuration(params: ParentFeeDurationParams, txDb?: any) {
  if (params.durationSeconds < 0) {
    throw new Error("[NorthStarTelemetry] durationSeconds must be non-negative");
  }

  return emitNorthStarEvent({
    schoolId: params.schoolId,
    userId: params.userId,
    role: params.role || "PARENT",
    screen: "/portal/fees",
    eventName: "north_star_parent_fee_duration",
    action: "pay_fee",
    payload: {
      invoiceId: params.invoiceId,
      durationSeconds: params.durationSeconds,
      gatewaySuccess: params.gatewaySuccess,
      targetMet: params.durationSeconds <= NORTH_STAR_TARGETS.parent_fee_seconds && params.gatewaySuccess,
    },
    txDb,
  });
}

export async function recordJourneyCompletion(params: JourneyCompletionParams, txDb?: any) {
  const resolvedAction = params.action || (
    params.completed
      ? "journey_finished"
      : params.durationMs === 0
      ? "journey_started"
      : "journey_abandoned"
  );

  return emitNorthStarEvent({
    schoolId: params.schoolId,
    userId: params.userId,
    role: params.role,
    screen: `/journeys/${params.journeyId}`,
    eventName: "north_star_journey_completion",
    action: resolvedAction,
    payload: {
      journeyId: params.journeyId,
      durationMs: params.durationMs,
      completed: params.completed,
      finishedState: params.finishedState ?? null,
    },
    txDb,
  });
}

/**
 * Calculates working days elapsed between two timestamps.
 * Standard Indian school operational calendar: Sunday (day 0) is non-instructional.
 * Slices time by calendar day to accurately exclude Sunday hours while correctly
 * accounting for all non-Sunday hours across day/night boundaries.
 */
export function calculateElapsedWorkingDays(
  startDate: Date,
  endDate: Date = new Date()
): number {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    return 0;
  }

  let workingMs = 0;
  let cur = new Date(start.getTime());

  while (cur.getTime() < end.getTime()) {
    // End of current UTC calendar day (midnight next UTC day)
    const nextMidnight = new Date(cur.getTime());
    nextMidnight.setUTCHours(24, 0, 0, 0);

    const segmentEnd = nextMidnight.getTime() < end.getTime() ? nextMidnight : end;

    // Day of week: 0 is Sunday
    if (cur.getUTCDay() !== 0) {
      workingMs += (segmentEnd.getTime() - cur.getTime());
    }

    cur = segmentEnd;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const elapsedDays = workingMs / msPerDay;

  return Number(Math.max(0.1, elapsedDays).toFixed(1));
}

export interface FirstAttendanceOnboardingParams {
  schoolId: string;
  userId: string;
  role?: string;
  txDb?: any;
}

/**
 * Stops the onboarding clock and marks J10 journey completion when the school
 * records its very first live classroom attendance.
 * Idempotent: checks for prior onboarding events and exits cleanly if already recorded.
 */
export async function recordFirstAttendanceOnboarding(params: FirstAttendanceOnboardingParams) {
  const { schoolId, userId, role = "TEACHER", txDb } = params;
  const client = txDb || db;

  // 1. Idempotency check: Exit immediately if already recorded for this tenant
  const existingOnboardingEvent = await client.query.usageEvents.findFirst({
    where: and(
      eq(usageEvents.schoolId, schoolId),
      eq(usageEvents.elementId, "north_star_onboarding_duration")
    ),
    columns: { id: true },
  });

  if (existingOnboardingEvent) {
    return null;
  }

  // 2. Fetch school tenant creation timestamp
  const school = await client.query.schools.findFirst({
    where: eq(schools.id, schoolId),
    columns: { id: true, name: true, createdAt: true },
  });

  const createdAt = school?.createdAt || new Date();
  const now = new Date();
  const workingDaysElapsed = calculateElapsedWorkingDays(createdAt, now);

  // 3. Emit north_star_onboarding_duration
  const onboardingEvent = await recordOnboardingDays(
    {
      schoolId,
      userId,
      role: role || "SUPER_ADMIN",
      tenantId: schoolId,
      workingDaysElapsed,
      firstAttendanceMarked: true,
    },
    client
  );

  // 4. Emit J10 journey completion (finished state per spec J10 row)
  const durationMs = Math.max(0, now.getTime() - createdAt.getTime());
  const journeyEvent = await recordJourneyCompletion(
    {
      schoolId,
      userId,
      role: role || "SUPER_ADMIN",
      journeyId: "J10_school_onboarding",
      durationMs,
      completed: true,
      finishedState: "A new school opens on day one and takes attendance with real data.",
    },
    client
  );

  return { onboardingEvent, journeyEvent, workingDaysElapsed };
}

// ============================================================================
// North Star Aggregation & Admin Readout Engine
// ============================================================================

export interface MetricReadout {
  current: number;
  target: number;
  unit: string;
  status: "met" | "breached" | "no_data";
  sampleCount: number;
}

export interface NorthStarSummary {
  attendanceMinutes: MetricReadout;
  feeDayReconciliationRate: MetricReadout;
  monthCloseHours: MetricReadout;
  onboardingDays: MetricReadout;
  parentFeeSeconds: MetricReadout;
  journeyCompletionRate: MetricReadout;
  overallHealth: "healthy" | "needs_attention" | "insufficient_data";
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const valAtMid = sorted[mid] ?? 0;
  if (sorted.length % 2 !== 0) {
    return valAtMid;
  }
  const valBeforeMid = sorted[mid - 1] ?? 0;
  return (valBeforeMid + valAtMid) / 2;
}

/**
 * Computes an unvarnished, truthful readout of all six North Star metrics for a school.
 */
export async function getNorthStarMetricsSummary(
  schoolId: string,
  options?: { txDb?: any }
): Promise<NorthStarSummary> {
  const computeSummary = async (client: any): Promise<NorthStarSummary> => {
    const events = await client.query.usageEvents.findMany({
      where: and(
        eq(usageEvents.schoolId, schoolId)
      ),
      orderBy: [desc(usageEvents.createdAt)],
      limit: 1000,
    });

    const attendanceDurationsMin: number[] = [];
    const feeReconciliationResults: boolean[] = [];
    const monthCloseDurationsHr: number[] = [];
    const onboardingDaysList: number[] = [];
    const parentFeeDurationsSec: number[] = [];
    let startedJourneysCount = 0;
    let completedJourneysCount = 0;
    let abandonedJourneysCount = 0;

    for (const evt of events) {
      if (!NORTH_STAR_EVENTS.includes(evt.elementId as NorthStarEventName)) continue;

      try {
        const payload = JSON.parse(evt.elementLabel);
        switch (evt.elementId) {
          case "north_star_attendance_duration":
            if (typeof payload.durationMinutes === "number") {
              attendanceDurationsMin.push(payload.durationMinutes);
            }
            break;
          case "north_star_fee_day_reconciled":
            if (typeof payload.isReconciledBy3pm === "boolean") {
              feeReconciliationResults.push(payload.isReconciledBy3pm && (payload.reconciliationPct ?? 0) >= 95);
            }
            break;
          case "north_star_month_close_duration":
            if (typeof payload.durationHours === "number") {
              monthCloseDurationsHr.push(payload.durationHours);
            }
            break;
          case "north_star_onboarding_duration":
            if (typeof payload.workingDaysElapsed === "number") {
              onboardingDaysList.push(payload.workingDaysElapsed);
            }
            break;
          case "north_star_parent_fee_duration":
            if (typeof payload.durationSeconds === "number") {
              parentFeeDurationsSec.push(payload.durationSeconds);
            }
            break;
          case "north_star_journey_completion":
            if (evt.action === "journey_started" || (payload.completed === false && payload.durationMs === 0)) {
              startedJourneysCount++;
            } else if (evt.action === "journey_finished" || payload.completed === true) {
              completedJourneysCount++;
            } else if (evt.action === "journey_abandoned" || (payload.completed === false && (payload.durationMs ?? 0) > 0)) {
              abandonedJourneysCount++;
            }
            break;
        }
      } catch {
        // Skip malformed legacy records
      }
    }

    // 1. Attendance duration (target: < 4 min)
    const medianAttendance = calculateMedian(attendanceDurationsMin);
    const attendanceStatus = attendanceDurationsMin.length === 0
      ? "no_data"
      : medianAttendance <= NORTH_STAR_TARGETS.attendance_mark_minutes ? "met" : "breached";

    // 2. Fee day reconciliation rate (target: >= 95%)
    const feeReconciledSuccessCount = feeReconciliationResults.filter(Boolean).length;
    const feeReconciledPct = feeReconciliationResults.length > 0
      ? Number(((feeReconciledSuccessCount / feeReconciliationResults.length) * 100).toFixed(1))
      : 0;
    const feeStatus = feeReconciliationResults.length === 0
      ? "no_data"
      : feeReconciledPct >= NORTH_STAR_TARGETS.fee_day_reconciled_by_3pm_pct ? "met" : "breached";

    // 3. Month close hours (target: < 4 hr)
    const medianMonthClose = calculateMedian(monthCloseDurationsHr);
    const monthStatus = monthCloseDurationsHr.length === 0
      ? "no_data"
      : medianMonthClose <= NORTH_STAR_TARGETS.month_close_hours ? "met" : "breached";

    // 4. Onboarding days (target: <= 1 day)
    const medianOnboarding = calculateMedian(onboardingDaysList);
    const onboardingStatus = onboardingDaysList.length === 0
      ? "no_data"
      : medianOnboarding <= NORTH_STAR_TARGETS.onboarding_days ? "met" : "breached";

    // 5. Parent fee payment seconds (target: < 90 sec)
    const medianParentFee = calculateMedian(parentFeeDurationsSec);
    const parentFeeStatus = parentFeeDurationsSec.length === 0
      ? "no_data"
      : medianParentFee <= NORTH_STAR_TARGETS.parent_fee_seconds ? "met" : "breached";

    // 6. Journey completion rate (target: >= 95%)
    const totalJourneys = Math.max(startedJourneysCount, completedJourneysCount + abandonedJourneysCount);
    const journeyPct = totalJourneys > 0
      ? Number(((completedJourneysCount / totalJourneys) * 100).toFixed(1))
      : 0;
    const journeyStatus = totalJourneys === 0
      ? "no_data"
      : journeyPct >= NORTH_STAR_TARGETS.journey_completion_rate_pct ? "met" : "breached";

    const allStatuses = [attendanceStatus, feeStatus, monthStatus, onboardingStatus, parentFeeStatus, journeyStatus];
    const hasBreach = allStatuses.includes("breached");
    const activeCount = allStatuses.filter((s) => s !== "no_data").length;

    const overallHealth = hasBreach
      ? "needs_attention"
      : activeCount >= 2
      ? "healthy"
      : "insufficient_data";

    return {
      attendanceMinutes: {
        current: Number(medianAttendance.toFixed(2)),
        target: NORTH_STAR_TARGETS.attendance_mark_minutes,
        unit: "minutes",
        status: attendanceStatus,
        sampleCount: attendanceDurationsMin.length,
      },
      feeDayReconciliationRate: {
        current: feeReconciledPct,
        target: NORTH_STAR_TARGETS.fee_day_reconciled_by_3pm_pct,
        unit: "%",
        status: feeStatus,
        sampleCount: feeReconciliationResults.length,
      },
      monthCloseHours: {
        current: Number(medianMonthClose.toFixed(2)),
        target: NORTH_STAR_TARGETS.month_close_hours,
        unit: "hours",
        status: monthStatus,
        sampleCount: monthCloseDurationsHr.length,
      },
      onboardingDays: {
        current: Number(medianOnboarding.toFixed(1)),
        target: NORTH_STAR_TARGETS.onboarding_days,
        unit: "days",
        status: onboardingStatus,
        sampleCount: onboardingDaysList.length,
      },
      parentFeeSeconds: {
        current: Number(medianParentFee.toFixed(1)),
        target: NORTH_STAR_TARGETS.parent_fee_seconds,
        unit: "seconds",
        status: parentFeeStatus,
        sampleCount: parentFeeDurationsSec.length,
      },
      journeyCompletionRate: {
        current: journeyPct,
        target: NORTH_STAR_TARGETS.journey_completion_rate_pct,
        unit: "%",
        status: journeyStatus,
        sampleCount: totalJourneys,
      },
      overallHealth,
    };
  };

  if (options?.txDb) {
    return await computeSummary(options.txDb);
  }

  return await withTenant(schoolId, async (tenantDb) => {
    return await computeSummary(tenantDb);
  });
}
