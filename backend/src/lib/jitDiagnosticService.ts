import { db } from "@/db";
import { sql } from "drizzle-orm";

export interface DiagnosticReadOptions {
  sessionId: string;
  actorId: string;
  schoolId: string;
  targetTable: string;
  queryIntent: string;
  filterParameters?: Record<string, any>;
  limit?: number;
  offset?: number;
}

export interface DiagnosticReadResult {
  auditLogId: string;
  records: any[];
  rowCount: number;
  occurredAt: string;
}

export class JitDiagnosticService {
  /**
   * Orchestrates the durable 3-phase committed audit workflow required by CTO guardrail E:
   * 
   * Transaction 1: Record and commit ACCESS_INTENT to public.jit_access_audit_logs.
   * Transaction 2: Execute strictly authorized, allowlisted, and bounded diagnostic query.
   * Transaction 3: Record and commit ACCESS_COMPLETED (or ACCESS_FAILED) to public.jit_access_audit_logs.
   *
   * Each transaction commits independently, guaranteeing durable non-repudiable audit trails.
   */
  public static async executeDiagnosticRead(
    options: DiagnosticReadOptions
  ): Promise<DiagnosticReadResult> {
    const {
      sessionId,
      actorId,
      schoolId,
      targetTable,
      queryIntent,
      filterParameters = {},
      limit = 50,
      offset = 0,
    } = options;

    let auditLogId: string | null = null;

    // Phase 1: Record Intent and Commit (Transaction 1)
    try {
      const intentResult = await db.transaction(async (tx) => {
        const rows = await tx.execute(sql`
          SELECT security.record_access_intent(
            ${sessionId}::uuid,
            ${schoolId}::uuid,
            ${targetTable},
            ${queryIntent},
            ${JSON.stringify(filterParameters)}::jsonb
          ) as audit_log_id
        `);
        const first = rows[0] as any;
        return first?.audit_log_id || (Array.isArray(rows) && rows[0]?.audit_log_id);
      });
      auditLogId = typeof intentResult === "string" ? intentResult : (intentResult as any)?.audit_log_id;
    } catch (err: any) {
      throw new Error(`JIT_INTENT_RECORDING_FAILED: ${err.message}`);
    }

    if (!auditLogId) {
      throw new Error("JIT_INTENT_RECORDING_FAILED: No audit log ID returned from Transaction 1");
    }

    // Phase 2: Execute Scoped Diagnostic Query (Transaction 2)
    let records: any[] = [];
    try {
      const readResult = await db.transaction(async (tx) => {
        const rows = await tx.execute(sql`
          SELECT security.read_diagnostic_records(
            ${auditLogId}::uuid,
            ${targetTable},
            ${schoolId}::uuid,
            ${limit},
            ${offset}
          ) as diagnostic_data
        `);
        const first = rows[0] as any;
        return first?.diagnostic_data || (Array.isArray(rows) && rows[0]?.diagnostic_data);
      });
      records = Array.isArray(readResult) ? readResult : (readResult as any) || [];
    } catch (readErr: any) {
      // Phase 3b: If read fails, commit ACCESS_FAILED (Transaction 3)
      try {
        await db.transaction(async (tx) => {
          await tx.execute(sql`
            SELECT security.record_access_outcome(
              ${auditLogId}::uuid,
              'ACCESS_FAILED',
              0,
              ${readErr.message}
            )
          `);
        });
      } catch (logErr) {
        console.error("Failed to commit ACCESS_FAILED audit record:", logErr);
      }
      throw new Error(`JIT_DIAGNOSTIC_READ_FAILED: ${readErr.message}`);
    }

    // Phase 3a: Record Outcome ACCESS_COMPLETED and Commit (Transaction 3)
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT security.record_access_outcome(
          ${auditLogId}::uuid,
          'ACCESS_COMPLETED',
          ${records.length},
          NULL
        )
      `);
    });

    return {
      auditLogId,
      records,
      rowCount: records.length,
      occurredAt: new Date().toISOString(),
    };
  }
}
