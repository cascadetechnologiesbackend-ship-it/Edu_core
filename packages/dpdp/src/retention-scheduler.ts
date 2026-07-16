// ─── Data Retention Scheduler ─────────────────────────────────────────────────
// Defines retention policies and job definitions for BullMQ cron execution.
// DPDP Act 2023 Section 8(7) — Data must not be retained beyond stated purpose.
// Actual BullMQ workers are registered in apps/web/src/server/jobs/

export interface RetentionPolicy {
  readonly purposeId: string;
  readonly tableName: string;
  readonly retentionDays: number;
  readonly description: string;
  /** Field to calculate retention from (default: created_at) */
  readonly retentionFromField: string;
  /** Field that identifies the "end event" (e.g., graduation_date) */
  readonly retentionFromEvent?: string;
  /** If true, skip deletion if legal_hold flag is set on the record */
  readonly respectLegalHold: boolean;
}

/**
 * Data Retention Schedule
 * Source: DPDP Rules 2025 + Board regulations + Income Tax Act + RTE Act
 */
export const RETENTION_POLICIES: readonly RetentionPolicy[] = [
  {
    purposeId: "academic_records",
    tableName: "mark_entries",
    retentionDays: 3650, // 10 years
    description:
      "Student academic records retained 10 years after Class 10 completion (Board requirement)",
    retentionFromField: "created_at",
    retentionFromEvent: "class_10_completion_date",
    respectLegalHold: true,
  },
  {
    purposeId: "academic_records",
    tableName: "report_cards",
    retentionDays: 3650,
    description: "Report cards retained 10 years after Class 10 completion",
    retentionFromField: "created_at",
    retentionFromEvent: "class_10_completion_date",
    respectLegalHold: true,
  },
  {
    purposeId: "health_records",
    tableName: "student_medical_records",
    retentionDays: 1095, // 3 years
    description: "Health records retained 3 years after student leaves school",
    retentionFromField: "created_at",
    retentionFromEvent: "last_attendance_date",
    respectLegalHold: true,
  },
  {
    purposeId: "cctv",
    tableName: "cctv_footage_metadata",
    retentionDays: 30,
    description: "CCTV footage metadata auto-purged after 30 days",
    retentionFromField: "recorded_at",
    respectLegalHold: true,
  },
  {
    purposeId: "attendance",
    tableName: "student_attendance",
    retentionDays: 1825, // 5 years
    description: "Attendance logs retained 5 years (RTE Act compliance)",
    retentionFromField: "attendance_date",
    respectLegalHold: true,
  },
  {
    purposeId: "fee_records",
    tableName: "fee_payments",
    retentionDays: 2920, // 8 years
    description: "Fee records retained 8 years (Income Tax Act requirement)",
    retentionFromField: "payment_date",
    respectLegalHold: true,
  },
  {
    purposeId: "fee_records",
    tableName: "fee_invoices",
    retentionDays: 2920,
    description: "Fee invoices retained 8 years (Income Tax Act requirement)",
    retentionFromField: "created_at",
    respectLegalHold: true,
  },
  {
    purposeId: "admission_data",
    tableName: "admission_applications",
    retentionDays: 90,
    description:
      "REJECTED admission applications deleted within 90 days of rejection",
    retentionFromField: "rejected_at",
    respectLegalHold: false,
  },
  {
    purposeId: "audit_log",
    tableName: "audit_logs",
    retentionDays: 2555, // 7 years — NON-DELETABLE except via this scheduled purge
    description:
      "Audit logs retained 7 years. Append-only; no manual deletion permitted.",
    retentionFromField: "created_at",
    respectLegalHold: false, // Audit logs themselves cannot be placed on legal hold
  },
  {
    purposeId: "consent",
    tableName: "consent_records",
    retentionDays: 1095, // duration of processing + 3 years
    description:
      "Consent records retained for duration of processing plus 3 years",
    retentionFromField: "withdrawn_at",
    respectLegalHold: true,
  },
] as const;

// ─── Retention Job Definitions ────────────────────────────────────────────────

export interface RetentionJobDefinition {
  readonly jobName: string;
  readonly cronExpression: string;
  readonly policy: RetentionPolicy;
  readonly description: string;
}

/**
 * BullMQ cron job definitions for data retention.
 * Workers are registered in apps/web/src/server/jobs/retention-workers.ts
 */
export const RETENTION_JOB_DEFINITIONS: readonly RetentionJobDefinition[] =
  RETENTION_POLICIES.map((policy) => ({
    jobName: `retention:${policy.tableName}`,
    // Run at 2 AM IST (20:30 UTC previous day) — low-traffic window
    cronExpression: "30 20 * * *",
    policy,
    description: policy.description,
  }));

// ─── Deletion Workflow Phases ─────────────────────────────────────────────────

export type DeletionPhase =
  "SOFT_DELETE" | "REVIEW_PENDING" | "HARD_DELETE" | "LEGAL_HOLD";

export interface DeletionWorkflowState {
  recordId: string;
  tableName: string;
  phase: DeletionPhase;
  softDeletedAt: Date | null;
  scheduledHardDeleteAt: Date | null;
  legalHoldReason: string | null;
  initiatedBy: "CONSENT_WITHDRAWAL" | "RETENTION_POLICY" | "ADMIN_REQUEST";
  notificationSentAt: Date | null;
}

/**
 * Review period between soft-delete and hard-delete (in days).
 * Gives DPO time to review before permanent deletion.
 */
export const HARD_DELETE_REVIEW_PERIOD_DAYS = 30;
