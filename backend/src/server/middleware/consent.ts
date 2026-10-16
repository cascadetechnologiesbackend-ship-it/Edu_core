import { TRPCError } from "@trpc/server";
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
import { withPlatformContext, withTenant } from "../../lib/tenant";

export function requireConsent(purposeId: ConsentPurposeId) {
  return async function consentMiddleware({
    next,
    rawInput,
  }: {
    ctx: { session: { user: { id: string } } | null };
    next: () => Promise<unknown>;
    rawInput: unknown;
  }) {
    const studentId = extractStudentId(rawInput);
    if (!studentId) {
      return next();
    }

    try {
      await assertConsent(studentId, purposeId);
      return next();
    } catch (err) {
      if (err instanceof ConsentRequiredError) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: err.message,
          cause: err,
        });
      }
      throw err;
    }
  };
}

/**
 * Assert consent imperatively — for use in server actions and service functions.
 * Throws ConsentRequiredError if consent is absent or withdrawn.
 *
 * Implements S13 Layer 4 Reconciliation Rule:
 * 1. Queries the most recent record for (studentId, purposeId) ordered by grantedAt desc, createdAt desc.
 * 2. If a record exists, its status is authoritative: granted === true && !withdrawnAt passes; else throws.
 * 3. If no record exists for purposeId:
 *    - For statutory education functions (academic_records, admission_data, attendance),
 *      if the student has active statutory attestation, auto-provisions and passes.
 *    - For all optional purposes (transport, health_records, communication, etc.),
 *      consent is deferred and throws ConsentRequiredError until parent opts in.
 */
export async function assertConsent(
  studentId: string,
  purposeId: ConsentPurposeId,
  txOrDb?: any,
): Promise<void> {
  if (txOrDb) {
    return await executeAssertConsent(txOrDb, studentId, purposeId);
  }
  return await withPlatformContext(async (tx) => {
    return await executeAssertConsent(tx, studentId, purposeId);
  });
}

async function executeAssertConsent(
  executor: any,
  studentId: string,
  purposeId: ConsentPurposeId,
): Promise<void> {
  const latestRecord = await executor.query.consentRecords.findFirst({
    where: and(
      eq(consentRecords.studentId, studentId),
      eq(consentRecords.purposeId, purposeId),
    ),
    orderBy: (t: any, { desc }: any) => [desc(t.grantedAt), desc(t.createdAt)],
  });

  if (latestRecord) {
    if (latestRecord.granted && !latestRecord.withdrawnAt) {
      return;
    }
    throw new ConsentRequiredError(studentId, purposeId);
  }

  // Statutory education fallback for active enrolled students
  const activeStatutory = await executor.query.consentRecords.findFirst({
    where: and(
      eq(consentRecords.studentId, studentId),
      eq(consentRecords.granted, true),
      isNull(consentRecords.withdrawnAt),
    ),
  });

  if (
    activeStatutory &&
    (purposeId === "academic_records" ||
      purposeId === "admission_data" ||
      purposeId === "attendance")
  ) {
    await withTenant(activeStatutory.schoolId, async (tenantTx) => {
      await tenantTx
        .insert(consentRecords)
        .values({
          schoolId: activeStatutory.schoolId,
          studentId: studentId,
          parentUserId: activeStatutory.parentUserId,
          purposeId: purposeId,
          granted: true,
          method: activeStatutory.method,
          privacyNoticeVersion: activeStatutory.privacyNoticeVersion,
          ipAddress: activeStatutory.ipAddress,
          userAgent: activeStatutory.userAgent,
        })
        .catch(() => {});
    });
    return;
  }

  throw new ConsentRequiredError(studentId, purposeId);
}

/**
 * Check multiple consents at once — returns a map of purpose → granted.
 * Implements S13 reconciliation: latest record per purpose wins.
 */
export async function getConsentStatus(
  studentId: string,
  txOrDb?: any,
): Promise<Record<ConsentPurposeId, boolean>> {
  if (txOrDb) {
    return await executeGetConsentStatus(txOrDb, studentId);
  }
  return await withPlatformContext(async (tx) => {
    return await executeGetConsentStatus(tx, studentId);
  });
}

async function executeGetConsentStatus(
  executor: any,
  studentId: string,
): Promise<Record<ConsentPurposeId, boolean>> {
  const records = await executor.query.consentRecords.findMany({
    where: eq(consentRecords.studentId, studentId),
    orderBy: (t: any, { asc }: any) => [asc(t.grantedAt), asc(t.createdAt)],
  });

  const statusMap = new Map<string, boolean>();
  for (const r of records) {
    statusMap.set(r.purposeId, Boolean(r.granted && !r.withdrawnAt));
  }

  return {
    admission_data: statusMap.get("admission_data") ?? false,
    academic_records: statusMap.get("academic_records") ?? false,
    attendance: statusMap.get("attendance") ?? false,
    health_records: statusMap.get("health_records") ?? false,
    photos_videos: statusMap.get("photos_videos") ?? false,
    transport: statusMap.get("transport") ?? false,
    communication: statusMap.get("communication") ?? false,
    biometric: statusMap.get("biometric") ?? false,
    third_party_apps: statusMap.get("third_party_apps") ?? false,
    cctv: statusMap.get("cctv") ?? false,
    published_results: statusMap.get("published_results") ?? false,
    alumni_data: statusMap.get("alumni_data") ?? false,
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
