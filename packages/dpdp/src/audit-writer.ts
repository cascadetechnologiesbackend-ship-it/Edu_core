// ─── Audit Log Writer ─────────────────────────────────────────────────────────
// Append-only audit log for every PII read/write/delete.
// DPDP Act 2023 Section 8(5) — Security safeguards mandate audit trails.
// This module defines the interface; the DB implementation is in apps/web.

export type AuditAction =
  | "READ"
  | "WRITE"
  | "DELETE"
  | "EXPORT"
  | "CONSENT_GRANT"
  | "CONSENT_WITHDRAW"
  | "LOGIN"
  | "LOGOUT"
  | "FAILED_LOGIN";

export type AuditTableName =
  | "students"
  | "student_family_members"
  | "student_medical_records"
  | "student_documents"
  | "staff"
  | "staff_documents"
  | "consent_records"
  | "rights_requests"
  | "dpdp_grievances"
  | "admission_applications"
  | "mark_entries"
  | "payslips"
  | "fee_payments"
  | "parent_teacher_messages"
  | "visitor_logs"
  | string;

export interface AuditLogEntry {
  userId: string;
  userRole: string;
  schoolId: string;
  action: AuditAction;
  tableName: AuditTableName;
  recordId: string;
  purposeId?: string;
  ipAddress: string;
  userAgent: string;
  // IMPORTANT: NEVER include PII field values in the log — only record IDs
  // This prevents the audit log itself from becoming a PII store
  metadata?: Record<string, string | number | boolean>;
}

export interface IAuditWriter {
  /**
   * Write an audit log entry.
   * This is append-only — no UPDATE or DELETE operations are permitted on audit_logs.
   */
  write(entry: AuditLogEntry): Promise<void>;

  /**
   * Write multiple audit log entries atomically.
   */
  writeBatch(entries: readonly AuditLogEntry[]): Promise<void>;
}

// ─── PII Redaction ────────────────────────────────────────────────────────────

/**
 * Fields that must NEVER appear in logs.
 * If found in any log payload, they are replaced with "[REDACTED]".
 */
export const PII_FIELD_NAMES = new Set([
  "aadhaar",
  "aadhaarNumber",
  "pan",
  "panNumber",
  "bankAccount",
  "bankAccountNumber",
  "password",
  "passwordHash",
  "creditCard",
  "mobile",
  "email",
  "dob",
  "dateOfBirth",
  "address",
  "fingerprint",
  "photo",
  "bloodGroup",
  "medicalHistory",
  "salary",
  "netPay",
]);

/**
 * Redact PII fields from an object before logging.
 * Recursively processes nested objects.
 * Safe to call on any payload — pure function, no side effects.
 */
export function redactPii(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELD_NAMES.has(key)) {
      redacted[key] = "[REDACTED]";
    } else if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      redacted[key] = redactPii(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// ─── Structured Logger (PII-safe) ────────────────────────────────────────────

export interface StructuredLogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  schoolId?: string;
  // No PII fields allowed at top level
  [key: string]: unknown;
}

/**
 * Create a PII-safe structured log entry.
 * Use this instead of console.log for application logging.
 */
export function createLogEntry(
  level: StructuredLogEntry["level"],
  message: string,
  context: Record<string, unknown> = {},
): StructuredLogEntry {
  // Redact any accidentally included PII
  const safeContext = redactPii(context);

  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...safeContext,
  };
}
