import type { ConsentPurposeId } from "@schoolmitra/validators";
import { MANDATORY_PURPOSE_IDS, getConsentPurpose } from "./consent-purposes";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConsentRecord {
  id: string;
  studentId: string;
  parentUserId: string;
  purposeId: ConsentPurposeId;
  privacyNoticeVersion: string;
  granted: boolean;
  method: "web_form" | "app" | "physical_scan";
  ipAddress: string | null;
  userAgent: string | null;
  otpVerified: boolean;
  grantedAt: Date;
  withdrawnAt: Date | null;
}

export type ConsentStatusMap = Record<ConsentPurposeId, boolean>;

export interface ConsentCheckResult {
  allowed: boolean;
  missingConsent?: ConsentPurposeId;
  reason?: string;
}

export interface ConsentRecordInput {
  studentId: string;
  parentUserId: string;
  purposeIds: readonly ConsentPurposeId[];
  privacyNoticeVersion: string;
  method: "web_form" | "app" | "physical_scan";
  ipAddress?: string;
  userAgent?: string;
  otpVerified: boolean;
}

export interface WithdrawConsentInput {
  studentId: string;
  parentUserId: string;
  purposeIds: readonly ConsentPurposeId[];
  reason?: string;
}

// ─── Consent Engine Interface ──────────────────────────────────────────────────
// Concrete implementation is in apps/web (DB-dependent).
// This package exports the interface + pure logic that can be used anywhere.

export interface IConsentEngine {
  /**
   * Assert that consent has been given for a specific purpose.
   * Throws ConsentRequiredError if consent is absent or withdrawn.
   * Called by tRPC middleware before EVERY student-data procedure.
   */
  assertConsent(studentId: string, purposeId: ConsentPurposeId): Promise<void>;

  /**
   * Record consent grants for one or more purposes.
   * OTP must be verified before calling this.
   */
  recordConsent(input: ConsentRecordInput): Promise<readonly ConsentRecord[]>;

  /**
   * Withdraw consent for one or more purposes.
   * Triggers data processing halt workflow asynchronously.
   */
  withdrawConsent(input: WithdrawConsentInput): Promise<void>;

  /**
   * Get the full consent status map for a student.
   * Used by the parent portal consent management panel.
   */
  getConsentStatus(studentId: string): Promise<ConsentStatusMap>;

  /**
   * Check if all mandatory consents are present for a student.
   * Used before processing admission data.
   */
  checkMandatoryConsents(studentId: string): Promise<ConsentCheckResult>;
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export class ConsentRequiredError extends Error {
  public readonly purposeId: ConsentPurposeId;
  public readonly studentId: string;

  constructor(studentId: string, purposeId: ConsentPurposeId) {
    const purpose = getConsentPurpose(purposeId);
    super(
      `Processing blocked: Parental consent required for purpose "${purpose.label}" (${purposeId}) for student ${studentId}. ` +
        `This is required under DPDP Act 2023 Section 9 (Children's Data Protection).`
    );
    this.name = "ConsentRequiredError";
    this.purposeId = purposeId;
    this.studentId = studentId;
  }
}

export class OtpVerificationRequiredError extends Error {
  constructor() {
    super(
      "Guardian identity verification via OTP is required before recording consent. " +
        "This is required under DPDP Act 2023 Section 9 (Verifiable Parental Consent)."
    );
    this.name = "OtpVerificationRequiredError";
  }
}

export class MandatoryConsentError extends Error {
  public readonly missingPurposeIds: readonly ConsentPurposeId[];

  constructor(missingPurposeIds: readonly ConsentPurposeId[]) {
    super(
      `Cannot process student data: Mandatory consents are missing for purposes: ${missingPurposeIds.join(", ")}. ` +
        `Mandatory purposes cannot be opted out (${MANDATORY_PURPOSE_IDS.join(", ")}).`
    );
    this.name = "MandatoryConsentError";
    this.missingPurposeIds = missingPurposeIds;
  }
}

// ─── Pure Validation Logic (no DB dependency) ─────────────────────────────────

/**
 * Validate consent input before recording.
 * Pure function — no side effects.
 */
export function validateConsentInput(input: ConsentRecordInput): void {
  if (!input.otpVerified) {
    throw new OtpVerificationRequiredError();
  }

  if (input.purposeIds.length === 0) {
    throw new Error("At least one consent purpose must be specified");
  }

  // Ensure we're not trying to withdraw mandatory purposes
  const invalidMandatory = MANDATORY_PURPOSE_IDS.filter(
    (mandId) =>
      !input.purposeIds.includes(mandId) &&
      input.purposeIds.some((p) => p === mandId)
  );

  if (invalidMandatory.length > 0) {
    throw new MandatoryConsentError(invalidMandatory);
  }
}

/**
 * Validate withdrawal input — cannot withdraw mandatory consents.
 */
export function validateWithdrawalInput(input: WithdrawConsentInput): void {
  const attemptedMandatory = input.purposeIds.filter((id) =>
    (MANDATORY_PURPOSE_IDS as readonly string[]).includes(id)
  );

  if (attemptedMandatory.length > 0) {
    throw new MandatoryConsentError(attemptedMandatory);
  }
}

/**
 * Build an empty consent status map (all false).
 * Used as default before any consent is recorded.
 */
export function buildEmptyConsentStatusMap(): ConsentStatusMap {
  return {
    admission_data: false,
    academic_records: false,
    attendance: false,
    health_records: false,
    photos_videos: false,
    transport: false,
    communication: false,
    biometric: false,
    third_party_apps: false,
    cctv: false,
    published_results: false,
    alumni_data: false,
  };
}

/**
 * Determine if a student is a minor (under 18) based on DOB.
 * Per DPDP Act 2023 Section 9 — ALL students in this ERP are minors,
 * but this function provides the formal check.
 */
export function isMinor(dateOfBirth: Date): boolean {
  const now = new Date();
  const age = now.getFullYear() - dateOfBirth.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > dateOfBirth.getMonth() ||
    (now.getMonth() === dateOfBirth.getMonth() &&
      now.getDate() >= dateOfBirth.getDate());
  return (hasBirthdayPassed ? age : age - 1) < 18;
}
