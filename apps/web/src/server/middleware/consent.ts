import { TRPCError } from "@trpc/server";
import { t } from "@/server/trpc";
import { db } from "@/db";
import { consentRecords } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { ConsentPurposeId } from "@schoolmitra/validators";
import { ConsentRequiredError } from "@schoolmitra/dpdp";

// ─── DPDP Consent Assertion Middleware ────────────────────────────────────────
// Called automatically before EVERY tRPC procedure that touches student PII.
// DPDP Act 2023 Section 9 — Children's data requires verifiable parental consent.

/**
 * Create a tRPC middleware that asserts parental consent for a specific purpose.
 *
 * Usage in tRPC procedure:
 *   export const studentProcedure = protectedProcedure
 *     .use(requireConsent("academic_records"));
 *
 * The studentId MUST be in the input (extracted from context or input).
 */
export function requireConsent(purposeId: ConsentPurposeId) {
  return async function consentMiddleware({
    ctx,
    next,
    rawInput,
  }: {
    ctx: { session: { user: { id: string } } | null };
    next: () => Promise<unknown>;
    rawInput: unknown;
  }) {
    // Extract studentId from input (supports both direct and nested)
    const studentId = extractStudentId(rawInput);

    if (!studentId) {
      // No student involved — skip consent check (e.g., school-level operations)
      return next();
    }

    // Check active consent record
    const consentRecord = await db.query.consentRecords.findFirst({
      where: and(
        eq(consentRecords.studentId, studentId),
        eq(consentRecords.purposeId, purposeId),
        eq(consentRecords.granted, true),
        isNull(consentRecords.withdrawnAt)
      ),
    });

    if (!consentRecord) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: new ConsentRequiredError(studentId, purposeId).message,
        cause: new ConsentRequiredError(studentId, purposeId),
      });
    }

    return next();
  };
}

/**
 * Assert consent imperatively — for use in server actions and service functions.
 * Throws ConsentRequiredError if consent is absent or withdrawn.
 */
export async function assertConsent(
  studentId: string,
  purposeId: ConsentPurposeId
): Promise<void> {
  const consentRecord = await db.query.consentRecords.findFirst({
    where: and(
      eq(consentRecords.studentId, studentId),
      eq(consentRecords.purposeId, purposeId),
      eq(consentRecords.granted, true),
      isNull(consentRecords.withdrawnAt)
    ),
  });

  if (!consentRecord) {
    throw new ConsentRequiredError(studentId, purposeId);
  }
}

/**
 * Check multiple consents at once — returns a map of purpose → granted.
 */
export async function getConsentStatus(
  studentId: string
): Promise<Record<ConsentPurposeId, boolean>> {
  const records = await db.query.consentRecords.findMany({
    where: and(
      eq(consentRecords.studentId, studentId),
      eq(consentRecords.granted, true),
      isNull(consentRecords.withdrawnAt)
    ),
  });

  const grantedPurposes = new Set(records.map((r) => r.purposeId as ConsentPurposeId));

  return {
    admission_data: grantedPurposes.has("admission_data"),
    academic_records: grantedPurposes.has("academic_records"),
    attendance: grantedPurposes.has("attendance"),
    health_records: grantedPurposes.has("health_records"),
    photos_videos: grantedPurposes.has("photos_videos"),
    transport: grantedPurposes.has("transport"),
    communication: grantedPurposes.has("communication"),
    biometric: grantedPurposes.has("biometric"),
    third_party_apps: grantedPurposes.has("third_party_apps"),
    cctv: grantedPurposes.has("cctv"),
    published_results: grantedPurposes.has("published_results"),
    alumni_data: grantedPurposes.has("alumni_data"),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractStudentId(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;

  if (typeof obj["studentId"] === "string") return obj["studentId"];
  if (typeof obj["student_id"] === "string") return obj["student_id"];

  // Nested input (e.g., { filter: { studentId: "..." } })
  if (obj["filter"] && typeof obj["filter"] === "object") {
    return extractStudentId(obj["filter"]);
  }

  return null;
}
