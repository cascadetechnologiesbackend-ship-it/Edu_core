/**
 * Pure Bus Boarding & Cross-Check Engine (Spec v1.2 Phase P14, OP9, OP5, AC-P19)
 *
 * Implements:
 * - Append-only driver scan validation with PII stripping (AC-P19)
 * - Absent-but-boarded cross-check (daily attendance ABSENT + BOARDING scan today)
 * - Missed-boarding alert (active pass + morning window elapsed stop ETA + 15 min with no scan)
 * - Stop change effective date evaluation
 */

export interface DriverScanInput {
  qrCodeData: string;
  direction: "BOARDING" | "ALIGHTING";
  scannedByUserId: string;
  scannedAt?: Date | undefined;
  gpsLat?: number | null | undefined;
  gpsLng?: number | null | undefined;
}

export interface StudentBusIdentity {
  id: string;
  firstName: string;
  lastName?: string | undefined;
  className?: string | undefined;
  sectionName?: string | undefined;
}

export interface StudentBusPassInfo {
  id: string;
  passNumber: string;
  routeId: string;
  routeStopId: string;
  stopName?: string | undefined;
  isActive: boolean;
  validFrom?: Date | string | undefined;
  validTo?: Date | string | undefined;
}

export interface DriverScanResult {
  success: boolean;
  error?: string;
  sanitizedStudent?: {
    studentId: string;
    studentName: string;
    className: string;
    stopName: string;
    direction: "BOARDING" | "ALIGHTING";
    scannedAt: string;
  };
  eventPayload?: {
    studentId: string;
    routeId: string;
    direction: "BOARDING" | "ALIGHTING";
    scannedByUserId: string;
    scannedAt: Date;
    gpsLat?: number | null;
    gpsLng?: number | null;
  };
  notificationKind?: "BOARDING" | "ALIGHTING";
}

/**
 * Validates a QR boarding scan by a driver and strips all sensitive PII (AC-P19).
 * Returns strictly student name, class, stop name, direction, and timestamp.
 */
export function evaluateDriverScan(
  input: DriverScanInput,
  student: StudentBusIdentity,
  pass: StudentBusPassInfo | null | undefined
): DriverScanResult {
  if (!pass || !pass.isActive) {
    return {
      success: false,
      error: "Bus pass is inactive or not found.",
    };
  }

  const scannedAt = input.scannedAt || new Date();
  const lastNameInitial = student.lastName ? ` ${student.lastName.charAt(0)}.` : "";
  const studentName = `${student.firstName}${lastNameInitial}`;
  const className = [student.className, student.sectionName].filter(Boolean).join("-") || "Class";

  return {
    success: true,
    sanitizedStudent: {
      studentId: student.id,
      studentName,
      className,
      stopName: pass.stopName || "Designated Stop",
      direction: input.direction,
      scannedAt: scannedAt.toISOString(),
    },
    eventPayload: {
      studentId: student.id,
      routeId: pass.routeId,
      direction: input.direction,
      scannedByUserId: input.scannedByUserId,
      scannedAt,
      gpsLat: input.gpsLat ?? null,
      gpsLng: input.gpsLng ?? null,
    },
    notificationKind: input.direction === "BOARDING" ? "BOARDING" : "ALIGHTING",
  };
}

export interface AbsentButBoardedCheckResult {
  triggered: boolean;
  studentId?: string;
  eventKind?: "ABSENT_BUT_BOARDED";
  tier?: "T1_action_required";
  title?: string;
  body?: string;
  boardingTime?: string;
}

/**
 * Cross-checks today's attendance against today's boarding scans (OP9).
 * If student was marked ABSENT today but has a BOARDING event today, triggers T1 alert.
 */
export function checkAbsentButBoarded(
  studentId: string,
  studentFirstName: string,
  dailyAttendanceStatus: string | null | undefined,
  todayBoardingEvents: Array<{ direction: string; scannedAt: Date | string }>
): AbsentButBoardedCheckResult {
  if (dailyAttendanceStatus !== "ABSENT") {
    return { triggered: false };
  }

  const boardingEvent = todayBoardingEvents.find((e) => e.direction === "BOARDING");
  if (!boardingEvent) {
    return { triggered: false };
  }

  const boardDate =
    typeof boardingEvent.scannedAt === "string"
      ? new Date(boardingEvent.scannedAt)
      : boardingEvent.scannedAt;

  const timeStr = boardDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return {
    triggered: true,
    studentId,
    eventKind: "ABSENT_BUT_BOARDED",
    tier: "T1_action_required",
    title: "Attendance & Commute Mismatch",
    body: `${studentFirstName} boarded the school bus at ${timeStr} today, but was marked absent in classroom attendance. Please contact the class teacher.`,
    boardingTime: boardDate.toISOString(),
  };
}

export interface MissedBoardingCheckResult {
  triggered: boolean;
  studentId?: string;
  eventKind?: "MISSED_BOARDING";
  tier?: "T1_action_required";
  title?: string;
  body?: string;
}

/**
 * Cross-checks whether a student with an active bus pass missed morning boarding (OP9, bus business logic).
 * Triggers T1 alert if morning window has elapsed student's stop ETA by > 15 minutes and NO boarding scan occurred.
 *
 * @param scheduledStopMinutes - e.g., "07:30" => 7 * 60 + 30 = 450 minutes from midnight
 * @param currentMinutes - e.g., "07:50" => 7 * 60 + 50 = 470 minutes from midnight
 */
export function checkMissedBoarding(
  studentId: string,
  studentFirstName: string,
  hasActivePass: boolean,
  scheduledStopMinutes: number, // minutes from midnight, e.g. 450 for 07:30
  currentMinutes: number, // minutes from midnight, e.g. 470 for 07:50
  todayBoardingEvents: Array<{ direction: string }>
): MissedBoardingCheckResult {
  if (!hasActivePass) {
    return { triggered: false };
  }

  // Morning commute window check: only triggers if current time is past stop ETA + 15 min
  const graceMinutes = 15;
  if (currentMinutes < scheduledStopMinutes + graceMinutes) {
    return { triggered: false };
  }

  const hasBoarded = todayBoardingEvents.some((e) => e.direction === "BOARDING");
  if (hasBoarded) {
    return { triggered: false };
  }

  return {
    triggered: true,
    studentId,
    eventKind: "MISSED_BOARDING",
    tier: "T1_action_required",
    title: "Bus Boarding Notice",
    body: `The morning bus passed ${studentFirstName}'s scheduled stop 15+ minutes ago with no boarding scan recorded.`,
  };
}

/**
 * Checks if an approved stop change request has reached its effective date (OP5).
 */
export function isStopChangeEffective(
  statusOrEffectiveDate: string | Date | null | undefined,
  effectiveDateOrNow?: string | Date | null,
  maybeNow?: Date
): boolean {
  let status = "APPROVED";
  let effectiveDate: Date | string | null | undefined;
  let now: Date = new Date();

  if (
    typeof statusOrEffectiveDate === "string" &&
    ["APPROVED", "PENDING", "REJECTED", "CANCELLED"].includes(statusOrEffectiveDate)
  ) {
    status = statusOrEffectiveDate;
    effectiveDate = effectiveDateOrNow as any;
    if (maybeNow) now = maybeNow;
  } else {
    effectiveDate = statusOrEffectiveDate;
    if (effectiveDateOrNow instanceof Date) {
      now = effectiveDateOrNow;
    }
  }

  if (status !== "APPROVED") return false;
  if (!effectiveDate) return false;
  const d = typeof effectiveDate === "string" ? new Date(effectiveDate) : effectiveDate;
  return d.getTime() <= now.getTime();
}
