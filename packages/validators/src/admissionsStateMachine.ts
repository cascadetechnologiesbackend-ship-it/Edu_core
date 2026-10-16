/**
 * S13 Admissions State Machine Validator & Transition Guard
 *
 * Defines the canonical legal transition graph for student admission applications.
 * Enforces server-side validation against arbitrary status strings, invalid transitions
 * (e.g. REJECTED -> ENROLLED), same-status transitions, and transitions out of terminal states.
 */

export const ADMISSION_STATUSES = [
  "APPLIED",
  "SCREENING",
  "ENTRANCE_TEST",
  "INTERVIEW",
  "OFFER_LETTER",
  "ENROLLED",
  "REJECTED",
  "WAITLISTED",
  "WITHDRAWN",
] as const;

export type AdmissionStatus = (typeof ADMISSION_STATUSES)[number];

export const LEGAL_ADMISSION_TRANSITIONS: Record<AdmissionStatus, readonly AdmissionStatus[]> = {
  APPLIED: ["SCREENING", "OFFER_LETTER", "REJECTED", "WITHDRAWN", "WAITLISTED"],
  SCREENING: ["ENTRANCE_TEST", "INTERVIEW", "OFFER_LETTER", "ENROLLED", "REJECTED", "WAITLISTED", "WITHDRAWN"],
  ENTRANCE_TEST: ["INTERVIEW", "OFFER_LETTER", "REJECTED", "WAITLISTED", "WITHDRAWN"],
  INTERVIEW: ["OFFER_LETTER", "REJECTED", "WAITLISTED", "WITHDRAWN"],
  OFFER_LETTER: ["ENROLLED", "REJECTED", "WITHDRAWN", "WAITLISTED"],
  WAITLISTED: ["SCREENING", "OFFER_LETTER", "REJECTED", "WITHDRAWN"],
  ENROLLED: [], // Terminal
  REJECTED: [], // Terminal
  WITHDRAWN: [], // Terminal
};

export class UnknownAdmissionStatusError extends Error {
  constructor(public readonly invalidStatus: string) {
    super(`Unknown admission status: '${invalidStatus}'. Expected one of: ${ADMISSION_STATUSES.join(", ")}`);
    this.name = "UnknownAdmissionStatusError";
  }
}

export class InvalidAdmissionStateTransitionError extends Error {
  constructor(
    public readonly currentStatus: string,
    public readonly attemptedStatus: string,
    public readonly allowedTransitions: readonly string[]
  ) {
    super(
      `Illegal admission status transition from '${currentStatus}' to '${attemptedStatus}'. ` +
      (allowedTransitions.length > 0
        ? `Allowed transitions are: ${allowedTransitions.join(", ")}.`
        : `Status '${currentStatus}' is terminal; no further transitions are permitted.`)
    );
    this.name = "InvalidAdmissionStateTransitionError";
  }
}

export function isAdmissionStatus(val: string): val is AdmissionStatus {
  return ADMISSION_STATUSES.includes(val as AdmissionStatus);
}

export function validateAdmissionTransition(
  currentStatus: string,
  newStatus: string
): { valid: true; targetStatus: AdmissionStatus } | { valid: false; error: Error } {
  if (!isAdmissionStatus(currentStatus)) {
    return { valid: false, error: new UnknownAdmissionStatusError(currentStatus) };
  }
  if (!isAdmissionStatus(newStatus)) {
    return { valid: false, error: new UnknownAdmissionStatusError(newStatus) };
  }
  if (currentStatus === newStatus) {
    return {
      valid: false,
      error: new InvalidAdmissionStateTransitionError(currentStatus, newStatus, LEGAL_ADMISSION_TRANSITIONS[currentStatus]),
    };
  }
  const allowed = LEGAL_ADMISSION_TRANSITIONS[currentStatus];
  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      error: new InvalidAdmissionStateTransitionError(currentStatus, newStatus, allowed),
    };
  }
  return { valid: true, targetStatus: newStatus };
}

export function assertValidAdmissionTransition(
  currentStatus: string,
  newStatus: string
): AdmissionStatus {
  const result = validateAdmissionTransition(currentStatus, newStatus);
  if (!result.valid) {
    throw result.error;
  }
  return result.targetStatus;
}
