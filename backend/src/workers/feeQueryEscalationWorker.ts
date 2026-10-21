/**
 * Fee Query SLA Auto-Escalation Worker (Spec v1.2 Phase P12, Workflow OP2, AC-P18)
 *
 * Monitors open parent fee queries. When a fee query remains in 'OPEN' status for > 7 days
 * without an answer from accountants/admins, it automatically escalates to the Principal:
 * - Status transitions to 'ESCALATED'
 * - escalatedAt timestamp set to now
 * - escalatedToUserId set to Principal user
 * - Evaluates FEE_QUERY_ESCALATED notification (Tier 1 for Principal)
 */

import { Queue, Worker, type Job } from "bullmq";
import { getBullMQValkeyConnection } from "../lib/redisConnection";
import { db, withTenant } from "@/db";
import { feeQueries, users, userRoles, roles } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { evaluateNotificationEligibility } from "../lib/parentEventEngine/notificationMatrix";

export interface FeeQueryEscalationJobPayload {
  schoolId: string;
}

export const FEE_QUERY_ESCALATION_QUEUE_NAME = "fee-query-escalations";

export const feeQueryEscalationQueue = new Queue<FeeQueryEscalationJobPayload>(
  FEE_QUERY_ESCALATION_QUEUE_NAME,
  {
    connection: getBullMQValkeyConnection(),
  }
);

export interface EscalatedFeeQueryResult {
  queryId: string;
  studentId: string;
  invoiceId: string;
  daysOpen: number;
  escalatedToUserId: string | null;
  escalated: boolean;
}

/**
 * Pure evaluation helper: Filters queries open for >= 7 days (auto-escalation threshold).
 * Used for deterministic testing of AC-P18 without database dependencies.
 */
export function filterStaleFeeQueries<
  T extends { id: string; createdAt: Date | string; status: string }
>(queries: T[], now: Date = new Date()): Array<T & { daysOpen: number }> {
  const cutoff7d = new Date(now.getTime() - 7 * 86400000);
  return queries
    .filter((q) => q.status === "OPEN" && new Date(q.createdAt) <= cutoff7d)
    .map((q) => ({
      ...q,
      daysOpen: Math.round((now.getTime() - new Date(q.createdAt).getTime()) / 86400000),
    }));
}

/**
 * Executes 7-day auto-escalation of open fee queries to the school principal in the DB.
 */
export async function escalateStaleFeeQueries(
  schoolId: string,
  now: Date = new Date()
): Promise<EscalatedFeeQueryResult[]> {
  const cutoff7d = new Date(now.getTime() - 7 * 86400000);
  const results: EscalatedFeeQueryResult[] = [];

  await withTenant(schoolId, async (tx) => {
    // 1. Find Principal for the school to receive escalations
    const principalRoleUser = await tx
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(eq(userRoles.schoolId, schoolId), eq(roles.name, "PRINCIPAL")))
      .limit(1);

    const targetEscalationUserId = principalRoleUser[0]?.userId || null;

    // 2. Query open queries older than 7 days
    const staleQueries = await tx
      .select({
        id: feeQueries.id,
        studentId: feeQueries.studentId,
        invoiceId: feeQueries.invoiceId,
        createdAt: feeQueries.createdAt,
      })
      .from(feeQueries)
      .where(
        and(
          eq(feeQueries.schoolId, schoolId),
          eq(feeQueries.status, "OPEN"),
          lte(feeQueries.createdAt, cutoff7d)
        )
      );

    for (const query of staleQueries) {
      const daysOpen = Math.round(
        (now.getTime() - new Date(query.createdAt).getTime()) / 86400000
      );

      // 3. Atomically transition to ESCALATED
      await tx
        .update(feeQueries)
        .set({
          status: "ESCALATED",
          escalatedAt: now,
          escalatedToUserId: targetEscalationUserId,
          updatedAt: now,
        })
        .where(eq(feeQueries.id, query.id));

      // 4. Evaluate notification eligibility (T1 for principal)
      if (targetEscalationUserId) {
        evaluateNotificationEligibility({
          studentId: query.studentId,
          parentUserId: targetEscalationUserId,
          tier: "T1_action_required",
          eventKind: "FEE_QUERY_ESCALATED",
          now,
          todayPushCountForParent: 0,
          previouslyDispatchedDedupeKeys: new Set(),
        });
      }

      results.push({
        queryId: query.id,
        studentId: query.studentId,
        invoiceId: query.invoiceId,
        daysOpen,
        escalatedToUserId: targetEscalationUserId,
        escalated: true,
      });
    }
  });

  return results;
}

/**
 * BullMQ Worker instance processing fee query escalation checks.
 */
export const feeQueryEscalationWorker = new Worker<FeeQueryEscalationJobPayload>(
  FEE_QUERY_ESCALATION_QUEUE_NAME,
  async (job: Job<FeeQueryEscalationJobPayload>) => {
    const { schoolId } = job.data;
    if (!schoolId) {
      throw new Error("Missing schoolId in FeeQueryEscalationJobPayload");
    }

    const results = await escalateStaleFeeQueries(schoolId);
    return {
      processedCount: results.length,
      escalatedQueries: results,
    };
  },
  {
    connection: getBullMQValkeyConnection(),
    concurrency: 2,
  }
);
