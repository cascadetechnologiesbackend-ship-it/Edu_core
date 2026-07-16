import { db } from "@/db";
import {
  students,
  staff,
  auditLogs,
  dataRetentionPolicies,
} from "@/db/schema";
import { eq, and, isNull, isNotNull, lt } from "drizzle-orm";
import { Worker, Queue } from "bullmq";

export interface RetentionJobPayload {
  schoolId: string;
}

export const retentionQueue = new Queue<RetentionJobPayload>("data-retention", {
  connection: {
    host: process.env["REDIS_HOST"] ?? "127.0.0.1",
    port: parseInt(process.env["REDIS_PORT"] ?? "6379"),
    password: process.env["REDIS_PASSWORD"] ?? undefined,
  },
});

/**
 * Runs the data retention policy checks for a given school.
 * Calculates what needs soft-deleting and hard-purging, performs the operations,
 * and logs to the DPDP audit trail.
 */
export async function executeRetentionPolicy(schoolId: string) {
  const policies = await db.query.dataRetentionPolicies.findMany({
    where: and(
      eq(dataRetentionPolicies.schoolId, schoolId),
      eq(dataRetentionPolicies.isActive, true)
    ),
  });

  let softDeletedCount = 0;
  let hardPurgedCount = 0;

  for (const p of policies) {
    const retentionCutoff = new Date();
    retentionCutoff.setDate(retentionCutoff.getDate() - p.retentionDays);

    // 1. Soft-Delete Logic
    if (p.tableName === "students") {
      // Find active students past retention days without legal hold
      const eligibleStudents = await db.query.students.findMany({
        where: and(
          eq(students.schoolId, schoolId),
          eq(students.isActive, true),
          eq(students.legalHold, false),
          isNull(students.deletedAt),
          lt(students.createdAt, retentionCutoff)
        ),
      });

      for (const s of eligibleStudents) {
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
    } else if (p.tableName === "staff") {
      // Find active staff past retention days without legal hold
      const eligibleStaff = await db.query.staff.findMany({
        where: and(
          eq(staff.schoolId, schoolId),
          eq(staff.isActive, true),
          eq(staff.legalHold, false),
          isNull(staff.deletedAt),
          lt(staff.createdAt, retentionCutoff)
        ),
      });

      for (const st of eligibleStaff) {
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

    // 2. Hard-Purge Logic (Grace period of 30 days past soft-deletion date)
    const purgeCutoff = new Date();
    purgeCutoff.setDate(purgeCutoff.getDate() - 30); // 30 days grace period

    if (p.tableName === "students") {
      const purgeStudents = await db.query.students.findMany({
        where: and(
          eq(students.schoolId, schoolId),
          eq(students.legalHold, false),
          isNotNull(students.deletedAt),
          lt(students.deletedAt, purgeCutoff)
        ),
      });

      for (const s of purgeStudents) {
        await db.delete(students).where(eq(students.id, s.id));
        hardPurgedCount++;

        // Log to DPDP Audit Log
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
      }
    } else if (p.tableName === "staff") {
      const purgeStaff = await db.query.staff.findMany({
        where: and(
          eq(staff.schoolId, schoolId),
          eq(staff.legalHold, false),
          isNotNull(staff.deletedAt),
          lt(staff.deletedAt, purgeCutoff)
        ),
      });

      for (const st of purgeStaff) {
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
      }
    }

    // Update last run at on the policy
    await db
      .update(dataRetentionPolicies)
      .set({
        lastRunAt: new Date(),
        recordsDeletedLastRun: softDeletedCount + hardPurgedCount,
        updatedAt: new Date(),
      })
      .where(eq(dataRetentionPolicies.id, p.id));
  }

  return { success: true, softDeletedCount, hardPurgedCount };
}

import { workerLogger } from "@/lib/logger";

// ─── Worker Start ─────────────────────────────────────────────────────────────
if (process.env["START_WORKERS"] === "true") {
  const worker = new Worker<RetentionJobPayload>(
    "data-retention",
    async (job) => {
      const { schoolId } = job.data;
      workerLogger.info(`[RetentionWorker] Processing retention policies for school: ${schoolId}`);
      await executeRetentionPolicy(schoolId);
    },
    {
      connection: {
        host: process.env["REDIS_HOST"] ?? "127.0.0.1",
        port: parseInt(process.env["REDIS_PORT"] ?? "6379"),
        password: process.env["REDIS_PASSWORD"] ?? undefined,
      },
    }
  );

  worker.on("completed", (job) => {
    workerLogger.info(`[RetentionWorker] Job ${job.id} executed successfully.`);
  });

  worker.on("failed", (job, err) => {
    workerLogger.error(`[RetentionWorker] Job ${job?.id} failed: ${err.message}`);
  });

  workerLogger.info("[RetentionWorker] Worker started");
}
