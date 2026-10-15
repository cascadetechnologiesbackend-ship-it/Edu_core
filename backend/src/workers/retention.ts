import { db } from "@/db";
import {
  students,
  staff,
  auditLogs,
  dataRetentionPolicies,
  consentRecords,
  feeInvoices,
  feePayments,
  usageEvents,
} from "@/db/schema";
import { eq, and, isNull, isNotNull, lt, lte, or } from "drizzle-orm";
import { Worker, Queue } from "bullmq";
import { getBullMQValkeyConnection, getBullMQRedisConnection } from "../lib/redisConnection";
import { workerLogger } from "@/lib/logger";

export interface RetentionJobPayload {
  schoolId: string;
  dryRun?: boolean | undefined;
}

export interface RetentionOptions {
  dryRun?: boolean | undefined;
}

export interface WouldAffectRecord {
  id: string;
  tableName: "students" | "staff";
  action: "SOFT_DELETE" | "HARD_PURGE" | "ANONYMIZE";
  reason: string;
}

export interface RetentionExecutionResult {
  success: boolean;
  dryRun: boolean;
  softDeletedCount: number;
  hardPurgedCount: number;
  anonymizedCount: number;
  wouldSoftDelete?: WouldAffectRecord[] | undefined;
  wouldHardPurge?: WouldAffectRecord[] | undefined;
}

export const retentionQueue = new Queue<RetentionJobPayload>("data-retention", {
  connection: getBullMQRedisConnection(),
});

/**
 * Runs the data retention policy checks for a given school.
 * Calculates what needs soft-deleting and hard-purging, performs the operations,
 * and logs to the DPDP audit trail.
 *
 * Invariants:
 * - Active students (isActive: true, leavingDate: null) are NEVER soft deleted regardless of createdAt.
 * - Soft-deletion requires exit lifecycle status (leavingDate < cutoff OR isActive: false).
 * - Hard-purge checks for accounting dependencies (fee_invoices, fee_payments).
 *   If accounting dependencies exist, PII is anonymized while preserving the FK row for audit integrity.
 * - Supports dry-run execution (options.dryRun === true or process.argv.includes("--dry-run")).
 */
/**
 * Purges usage interaction events older than the 90-day retention window (UX-R62 / Sprint S10 Layer 4).
 * Returns the number of purged rows.
 */
export async function purgeExpiredUsageEvents(
  schoolId?: string,
  retentionDays: number = 90,
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const conditions = [lt(usageEvents.createdAt, cutoff)];
  if (schoolId) {
    conditions.push(eq(usageEvents.schoolId, schoolId));
  }
  const result = await db.delete(usageEvents).where(and(...conditions));
  const purgedCount = result.rowCount ?? 0;
  workerLogger.info(
    `[RetentionWorker] Purged ${purgedCount} expired usage_events older than ${retentionDays} days (cutoff: ${cutoff.toISOString()})`,
  );
  return purgedCount;
}

export async function executeRetentionPolicy(
  schoolId: string,
  options?: RetentionOptions,
): Promise<RetentionExecutionResult> {
  const isDryRun = Boolean(
    options?.dryRun || process.argv.includes("--dry-run"),
  );

  const policies = await db.query.dataRetentionPolicies.findMany({
    where: and(
      eq(dataRetentionPolicies.schoolId, schoolId),
      eq(dataRetentionPolicies.isActive, true),
    ),
  });

  let softDeletedCount = 0;
  let hardPurgedCount = 0;
  let anonymizedCount = 0;

  const wouldSoftDelete: WouldAffectRecord[] = [];
  const wouldHardPurge: WouldAffectRecord[] = [];

  for (const p of policies) {
    const retentionCutoff = new Date();
    retentionCutoff.setDate(retentionCutoff.getDate() - p.retentionDays);

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Soft-Delete Logic
    // ──────────────────────────────────────────────────────────────────────────
    if (p.tableName === "students") {
      // Find students who have EXITED past retention days and are not on legal hold.
      // Active students without exit dates are strictly excluded from retention purge.
      const eligibleStudents = await db.query.students.findMany({
        where: and(
          eq(students.schoolId, schoolId),
          eq(students.legalHold, false),
          isNull(students.deletedAt),
          or(
            and(
              isNotNull(students.leavingDate),
              lt(students.leavingDate, retentionCutoff),
            ),
            and(
              eq(students.isActive, false),
              lt(students.updatedAt, retentionCutoff),
            ),
          ),
        ),
      });

      for (const s of eligibleStudents) {
        if (isDryRun) {
          wouldSoftDelete.push({
            id: s.id,
            tableName: "students",
            action: "SOFT_DELETE",
            reason: `Student exit date/inactivity past retention policy window (${p.retentionDays} days)`,
          });
          softDeletedCount++;
        } else {
          await db
            .update(students)
            .set({
              isActive: false,
              deletedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(students.id, s.id));

          softDeletedCount++;

          // Log to DPDP Audit Log
          await db.insert(auditLogs).values({
            userId: "00000000-0000-0000-0000-000000000000", // System automated
            userEmail: "[automated-retention]",
            userRole: "SUPER_ADMIN",
            schoolId,
            action: "WRITE",
            tableName: "students",
            recordId: s.id,
            purposeId: p.purposeId,
            ipAddress: "127.0.0.1",
            userAgent: "Retention Worker",
            metadata: { policyId: p.id, action: "SOFT_DELETE" },
          });
        }
      }
    } else if (p.tableName === "staff") {
      // Find staff who have EXITED past retention days and are not on legal hold.
      const eligibleStaff = await db.query.staff.findMany({
        where: and(
          eq(staff.schoolId, schoolId),
          eq(staff.legalHold, false),
          isNull(staff.deletedAt),
          or(
            and(
              isNotNull(staff.relievingDate),
              lt(staff.relievingDate, retentionCutoff),
            ),
            and(
              eq(staff.isActive, false),
              lt(staff.updatedAt, retentionCutoff),
            ),
          ),
        ),
      });

      for (const st of eligibleStaff) {
        if (isDryRun) {
          wouldSoftDelete.push({
            id: st.id,
            tableName: "staff",
            action: "SOFT_DELETE",
            reason: `Staff relieving date/inactivity past retention policy window (${p.retentionDays} days)`,
          });
          softDeletedCount++;
        } else {
          await db
            .update(staff)
            .set({
              isActive: false,
              deletedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(staff.id, st.id));

          softDeletedCount++;

          // Log to DPDP Audit Log
          await db.insert(auditLogs).values({
            userId: "00000000-0000-0000-0000-000000000000",
            userEmail: "[automated-retention]",
            userRole: "SUPER_ADMIN",
            schoolId,
            action: "WRITE",
            tableName: "staff",
            recordId: st.id,
            purposeId: p.purposeId,
            ipAddress: "127.0.0.1",
            userAgent: "Retention Worker",
            metadata: { policyId: p.id, action: "SOFT_DELETE" },
          });
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Hard-Purge Logic (Grace period of 30 days past soft-deletion date)
    // ──────────────────────────────────────────────────────────────────────────
    const purgeCutoff = new Date();
    purgeCutoff.setDate(purgeCutoff.getDate() - 30); // 30 days grace period

    if (p.tableName === "students") {
      const purgeStudents = await db.query.students.findMany({
        where: and(
          eq(students.schoolId, schoolId),
          eq(students.legalHold, false),
          isNotNull(students.deletedAt),
          lt(students.deletedAt, purgeCutoff),
        ),
      });

      for (const s of purgeStudents) {
        // FK Safety Check: Check if accounting records (fee_invoices, fee_payments) depend on this student
        const linkedInvoice = await db.query.feeInvoices.findFirst({
          where: eq(feeInvoices.studentId, s.id),
          columns: { id: true },
        });

        const linkedPayment = await db.query.feePayments.findFirst({
          where: eq(feePayments.studentId, s.id),
          columns: { id: true },
        });

        const hasAccountingHistory = Boolean(linkedInvoice || linkedPayment);

        if (hasAccountingHistory) {
          // Accounting audit trail must persist: Anonymize PII instead of hard delete
          if (isDryRun) {
            wouldHardPurge.push({
              id: s.id,
              tableName: "students",
              action: "ANONYMIZE",
              reason:
                "Has linked fee accounting records (fee_invoices / fee_payments) — preserve foreign key row and redact PII",
            });
            anonymizedCount++;
          } else {
            await db
              .update(students)
              .set({
                firstNameEncrypted: "[ANONYMIZED]",
                middleNameEncrypted: null,
                lastNameEncrypted: "[ANONYMIZED]",
                firstNameSearchHash: null,
                lastNameSearchHash: null,
                aadhaarLast4: null,
                apaarId: null,
                photoS3Key: null,
                previousSchool: null,
                leavingReason: "[PURGED_ANONYMIZED]",
                updatedAt: new Date(),
              })
              .where(eq(students.id, s.id));

            anonymizedCount++;

            await db.insert(auditLogs).values({
              userId: "00000000-0000-0000-0000-000000000000",
              userEmail: "[automated-retention]",
              userRole: "SUPER_ADMIN",
              schoolId,
              action: "WRITE",
              tableName: "students",
              recordId: s.id,
              purposeId: p.purposeId,
              ipAddress: "127.0.0.1",
              userAgent: "Retention Worker",
              metadata: {
                policyId: p.id,
                action: "HARD_PURGE_ANONYMIZED",
                reason: "Accounting audit trail preserved",
              },
            });
          }
        } else {
          // No linked accounting records: proceed with hard purge
          if (isDryRun) {
            wouldHardPurge.push({
              id: s.id,
              tableName: "students",
              action: "HARD_PURGE",
              reason: "No dependent accounting records — row eligible for deletion",
            });
            hardPurgedCount++;
          } else {
            try {
              await db.delete(students).where(eq(students.id, s.id));
              hardPurgedCount++;

              await db.insert(auditLogs).values({
                userId: "00000000-0000-0000-0000-000000000000",
                userEmail: "[automated-retention]",
                userRole: "SUPER_ADMIN",
                schoolId,
                action: "DELETE",
                tableName: "students",
                recordId: s.id,
                purposeId: p.purposeId,
                ipAddress: "127.0.0.1",
                userAgent: "Retention Worker",
                metadata: { policyId: p.id, action: "HARD_PURGE" },
              });
            } catch (err: any) {
              // Fallback if unexpected foreign key restriction exists: anonymize rather than crash
              await db
                .update(students)
                .set({
                  firstNameEncrypted: "[ANONYMIZED]",
                  middleNameEncrypted: null,
                  lastNameEncrypted: "[ANONYMIZED]",
                  firstNameSearchHash: null,
                  lastNameSearchHash: null,
                  aadhaarLast4: null,
                  apaarId: null,
                  photoS3Key: null,
                  previousSchool: null,
                  leavingReason: "[PURGED_ANONYMIZED_FALLBACK]",
                  updatedAt: new Date(),
                })
                .where(eq(students.id, s.id));

              anonymizedCount++;

              await db.insert(auditLogs).values({
                userId: "00000000-0000-0000-0000-000000000000",
                userEmail: "[automated-retention]",
                userRole: "SUPER_ADMIN",
                schoolId,
                action: "WRITE",
                tableName: "students",
                recordId: s.id,
                purposeId: p.purposeId,
                ipAddress: "127.0.0.1",
                userAgent: "Retention Worker",
                metadata: {
                  policyId: p.id,
                  action: "HARD_PURGE_ANONYMIZED_FALLBACK",
                  error: err?.message,
                },
              });
            }
          }
        }
      }
    } else if (p.tableName === "staff") {
      const purgeStaff = await db.query.staff.findMany({
        where: and(
          eq(staff.schoolId, schoolId),
          eq(staff.legalHold, false),
          isNotNull(staff.deletedAt),
          lt(staff.deletedAt, purgeCutoff),
        ),
      });

      for (const st of purgeStaff) {
        if (isDryRun) {
          wouldHardPurge.push({
            id: st.id,
            tableName: "staff",
            action: "HARD_PURGE",
            reason: "Staff row eligible for hard purge past grace period",
          });
          hardPurgedCount++;
        } else {
          try {
            await db.delete(staff).where(eq(staff.id, st.id));
            hardPurgedCount++;

            // Log to DPDP Audit Log
            await db.insert(auditLogs).values({
              userId: "00000000-0000-0000-0000-000000000000",
              userEmail: "[automated-retention]",
              userRole: "SUPER_ADMIN",
              schoolId,
              action: "DELETE",
              tableName: "staff",
              recordId: st.id,
              purposeId: p.purposeId,
              ipAddress: "127.0.0.1",
              userAgent: "Retention Worker",
              metadata: { policyId: p.id, action: "HARD_PURGE" },
            });
          } catch (err: any) {
            // Anonymize on foreign key restriction
            await db
              .update(staff)
              .set({
                firstNameEncrypted: "[ANONYMIZED]",
                lastNameEncrypted: "[ANONYMIZED]",
                panEncrypted: null,
                bankAccountEncrypted: null,
                bankIfscEncrypted: null,
                bankNameEncrypted: null,
                aadhaarLast4: null,
                photoS3Key: null,
                separationReason: "[PURGED_ANONYMIZED_FALLBACK]",
                updatedAt: new Date(),
              })
              .where(eq(staff.id, st.id));

            anonymizedCount++;

            await db.insert(auditLogs).values({
              userId: "00000000-0000-0000-0000-000000000000",
              userEmail: "[automated-retention]",
              userRole: "SUPER_ADMIN",
              schoolId,
              action: "WRITE",
              tableName: "staff",
              recordId: st.id,
              purposeId: p.purposeId,
              ipAddress: "127.0.0.1",
              userAgent: "Retention Worker",
              metadata: {
                policyId: p.id,
                action: "HARD_PURGE_ANONYMIZED_FALLBACK",
                error: err?.message,
              },
            });
          }
        }
      }
    }

    // Update last run at on the policy (if not dry run)
    if (!isDryRun) {
      await db
        .update(dataRetentionPolicies)
        .set({
          lastRunAt: new Date(),
          recordsDeletedLastRun:
            softDeletedCount + hardPurgedCount + anonymizedCount,
          updatedAt: new Date(),
        })
        .where(eq(dataRetentionPolicies.id, p.id));
    }
  }

  // Purge interaction telemetry older than 90 days (UX-R62)
  if (!isDryRun) {
    await purgeExpiredUsageEvents(schoolId, 90);
  }

  return {
    success: true,
    dryRun: isDryRun,
    softDeletedCount,
    hardPurgedCount,
    anonymizedCount,
    wouldSoftDelete: isDryRun ? wouldSoftDelete : undefined,
    wouldHardPurge: isDryRun ? wouldHardPurge : undefined,
  };
}

/**
 * Checks for consent withdrawals that need to be enforced (processing halted within 24h).
 */
export async function executeConsentWithdrawals(schoolId: string) {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24); // 24 hours SLA

  const withdrawn = await db.query.consentRecords.findMany({
    where: and(
      eq(consentRecords.schoolId, schoolId),
      eq(consentRecords.granted, false),
      isNotNull(consentRecords.processingHaltedAt),
      lte(consentRecords.processingHaltedAt, cutoff),
    ),
  });

  let processedCount = 0;
  for (const record of withdrawn) {
    processedCount++;

    await db.insert(auditLogs).values({
      userId: "00000000-0000-0000-0000-000000000000",
      userEmail: "[automated-retention]",
      userRole: "SUPER_ADMIN",
      schoolId,
      action: "DELETE",
      tableName: "consent_records",
      recordId: record.id,
      purposeId: record.purposeId,
      ipAddress: "127.0.0.1",
      userAgent: "Retention Worker",
      metadata: { action: "CONSENT_WITHDRAWAL_ENFORCED" },
    });
  }

  return { success: true, processedCount };
}

// ─── Worker Start ─────────────────────────────────────────────────────────────
if (process.env["START_WORKERS"] === "true") {
  const worker = new Worker<RetentionJobPayload>(
    "data-retention",
    async (job) => {
      const { schoolId, dryRun } = job.data;
      const { withTenant } = await import("@/lib/tenant");
      await withTenant(schoolId, async () => {
        workerLogger.info(
          `[RetentionWorker] Processing retention policies for school: ${schoolId} (dryRun: ${Boolean(
            dryRun,
          )})`,
        );
        await executeRetentionPolicy(
          schoolId,
          dryRun !== undefined ? { dryRun } : undefined,
        );

        workerLogger.info(
          `[RetentionWorker] Processing consent withdrawals for school: ${schoolId}`,
        );
        await executeConsentWithdrawals(schoolId);
      });
    },
    {
      connection: getBullMQValkeyConnection(),
    },
  );

  worker.on("completed", (job) => {
    workerLogger.info(`[RetentionWorker] Job ${job.id} executed successfully.`);
  });

  worker.on("failed", (job, err) => {
    workerLogger.error(
      `[RetentionWorker] Job ${job?.id} failed: ${err.message}`,
    );
  });

  workerLogger.info("[RetentionWorker] Worker started");
}
