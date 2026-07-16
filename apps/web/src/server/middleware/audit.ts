import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { AuditLogEntry, AuditTableName } from "@schoolmitra/dpdp";
import { redactPii } from "@schoolmitra/dpdp";

// ─── Audit Log Writer ─────────────────────────────────────────────────────────
// APPEND-ONLY — DO NOT add UPDATE or DELETE operations here.
// DPDP Act 2023 Section 8(5) — Mandatory audit trail for all PII access.

/**
 * Write a single audit log entry.
 * PII is NEVER stored in audit logs — only record IDs and non-PII metadata.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const safeMetadata = entry.metadata
    ? redactPii(entry.metadata as Record<string, unknown>)
    : null;

  await db.insert(auditLogs).values({
    userId: entry.userId,
    userEmail: "[audit-redacted]", // Email not stored in audit log
    userRole: entry.userRole,
    schoolId: entry.schoolId,
    action: entry.action,
    tableName: entry.tableName,
    recordId: entry.recordId ?? null,
    purposeId: entry.purposeId ?? null,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    metadata: safeMetadata as Record<string, unknown> | null,
  });
}

/**
 * Write multiple audit log entries atomically.
 */
export async function writeAuditLogBatch(entries: readonly AuditLogEntry[]): Promise<void> {
  if (entries.length === 0) return;

  await db.insert(auditLogs).values(
    entries.map((entry) => ({
      userId: entry.userId,
      userEmail: "[audit-redacted]",
      userRole: entry.userRole,
      schoolId: entry.schoolId,
      action: entry.action,
      tableName: entry.tableName,
      recordId: entry.recordId ?? null,
      purposeId: entry.purposeId ?? null,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      metadata: entry.metadata
        ? (redactPii(entry.metadata as Record<string, unknown>) as Record<string, unknown>)
        : null,
    }))
  );
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export interface AuditContext {
  userId: string;
  userRole: string;
  schoolId: string;
  ipAddress: string;
  userAgent: string;
}

export function createAuditLogger(ctx: AuditContext) {
  return {
    read: (tableName: AuditTableName, recordId: string, purposeId?: string) =>
      writeAuditLog({ ...ctx, action: "READ", tableName, recordId, ...(purposeId ? { purposeId } : {}) }),

    write: (tableName: AuditTableName, recordId: string, purposeId?: string) =>
      writeAuditLog({ ...ctx, action: "WRITE", tableName, recordId, ...(purposeId ? { purposeId } : {}) }),

    delete: (tableName: AuditTableName, recordId: string, purposeId?: string) =>
      writeAuditLog({ ...ctx, action: "DELETE", tableName, recordId, ...(purposeId ? { purposeId } : {}) }),

    export: (tableName: AuditTableName, purposeId?: string) =>
      writeAuditLog({ ...ctx, action: "EXPORT", tableName, recordId: "BULK", ...(purposeId ? { purposeId } : {}) }),

    consentGrant: (studentId: string, purposeId: string) =>
      writeAuditLog({
        ...ctx,
        action: "CONSENT_GRANT",
        tableName: "consent_records",
        recordId: studentId,
        purposeId,
      }),

    consentWithdraw: (studentId: string, purposeId: string) =>
      writeAuditLog({
        ...ctx,
        action: "CONSENT_WITHDRAW",
        tableName: "consent_records",
        recordId: studentId,
        purposeId,
      }),
  };
}
