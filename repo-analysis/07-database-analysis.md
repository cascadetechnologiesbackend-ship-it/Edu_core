# 07 — Database Analysis
## SchoolMitra ERP

---

## Database Technology

| Aspect | Technology |
|--------|-----------|
| Database | PostgreSQL |
| ORM | Drizzle ORM ^0.30.10 |
| Schema Definition | TypeScript (Drizzle schema DSL) |
| Migrations | Drizzle Kit + hand-written SQL |
| Connection | pg (node-postgres) pool |
| Seeding | Custom seed.ts scripts |

---

## Schema Quality Assessment

### Strengths

1. **Consistent tenant scoping** — every domain table has `school_id UUID NOT NULL` with FK.
2. **Soft-delete pattern** — `deleted_at TIMESTAMP` on all mutable entities.
3. **Timestamp discipline** — `created_at`, `updated_at` on all tables; `updated_at` absent only on immutable append-only tables (correct by design).
4. **PII field-level encryption** — AES-256-CBC encrypted columns on all PII fields (names, contacts, medical, bank data). HMAC search hashes for lookups.
5. **Aadhaar compliance** — only `aadhaar_last4` stored; full number never persisted.
6. **Audit log immutability** — PostgreSQL trigger prevents UPDATE/DELETE on `audit_logs` and `platform_audit_logs` (migration 0009).
7. **Enum types** — enums for status fields, roles, board types, etc. prevent invalid state.
8. **Unique constraints** — composite unique constraints on business keys (admission_number × school_id, etc.).
9. **Partial indexes** — fee_structures uses a partial unique index on non-deleted records.
10. **Performance indexes** — critical query paths indexed: school+date, student+year, etc.

---

## Migration Sequence Conflicts — P0 BLOCKER

```
CONFLICT 1:
  0001_lame_shooting_star.sql  (generated — likely initial data/core changes)
  0001_perf_indexes.sql        (hand-written — performance indexes)

CONFLICT 2:
  0002_auth_tokens.sql         (hand-written — auth token tables)
  0002_cuddly_colossus.sql     (generated — Drizzle-generated schema update)

CONFLICT 3:
  0006_admission_blood_group.sql (hand-written — blood group enum)
  0006_huge_ultimates.sql        (generated — major schema update)
```

**Impact:** Drizzle Kit tracks applied migrations in `drizzle/meta/_journal.json`. When two files share a sequence number, the runner may:
- Apply only the first alphabetically and skip the second
- Fail entirely with a duplicate key error in the journal
- Produce a schema that diverges from the ORM definition

**Resolution Required:** Rename conflicting files to unique sequence numbers, audit current production database against expected schema, and reset the migration journal if needed.

---

## Table Analysis — Key Findings

### core.ts

| Table | Integrity | Indexes | Constraints |
|-------|-----------|---------|------------|
| schools | STRONG | slug, status, email | UDISE unique |
| users | STRONG | (schoolId, email) unique | Correct multi-tenant |
| audit_logs | STRONG | school+date composite | Append-only trigger |
| sessions | PARTIAL | token unique, user | Missing: session expiry index for cleanup |
| roles | PARTIAL | schoolId | Missing: schoolId nullable allows system roles |
| role_permissions | STRONG | roleId+permissionId unique | |
| password_reset_tokens | STRONG | tokenHash unique, expires | |

### students.ts

| Table | Integrity | Gap |
|-------|-----------|-----|
| students | STRONG | currentClassId FK missing (nullable without FK) |
| student_family_members | STRONG | |
| student_medical_records | STRONG | Access comment present (health data restricted) |
| student_class_history | STRONG | promotionStatus not an enum (text) |
| student_documents | STRONG | fileSizeBytes stored as text (should be integer) |

### fees.ts

| Table | Integrity | Gap |
|-------|-----------|-----|
| fee_invoices | PARTIAL | studentId not a FK (left as uuid — performance tradeoff note) |
| fee_payments | PARTIAL | studentId not a FK |
| feeConcessions | PARTIAL | studentId not a FK |
| feeStructures | STRONG | Partial unique index on non-deleted records |
| fee_invoices amount fields | PARTIAL | numeric(12,2) correct; amounts as string in Drizzle select require parseFloat |

**Fee FK Gap:** `fee_invoices.studentId`, `fee_payments.studentId`, `feeConcessions.studentId` are UUID columns without explicit FK constraints. This prevents cascade operations and allows orphaned invoice records if students are deleted.

### hr.ts

| Table | Integrity | Gap |
|-------|-----------|-----|
| staff | STRONG | All PII encrypted |
| payroll_runs | STRONG | (schoolId, month) unique prevents duplicate runs |
| payslips | STRONG | (payrollRunId, staffId) unique |
| leaveBalances | STRONG | (staffId, academicYearId, leaveType) unique |
| leave_requests | PARTIAL | totalDays as numeric(5,1) — correct for half-days |

### dpdp.ts

| Table | Integrity | Notes |
|-------|-----------|-------|
| consent_records | STRONG | No updatedAt (append-only by design) |
| privacy_notices | STRONG | Immutable by design (no updatedAt/deletedAt) |
| rights_requests | STRONG | 30-day SLA via dueAt field |
| data_breach_log | STRONG | 72-hour board notification deadline tracked |
| vendor_register | STRONG | DPA status tracking |
| data_retention_policies | STRONG | lastRunAt/nextRunAt for automation |

---

## Transaction Boundaries

| Operation | Transaction Used | Risk |
|-----------|-----------------|------|
| Fee invoice generation (feeAssignmentEngine) | NO | P1 — partial state on failure |
| Admission submit + workflow step creation | NO | P2 — two inserts, no transaction |
| Payroll run creation | UNKNOWN | Verify |
| Student enrollment from admission | UNKNOWN | Verify |
| Consent record creation | UNKNOWN | Verify |

**Critical gap:** `autoAssignFeeStructuresToStudent()` in feeAssignmentEngine.ts loops and inserts fee_invoices one-by-one without a transaction. A process crash mid-loop leaves partial invoice assignment.

---

## Index Coverage

| Query Pattern | Index Present |
|--------------|--------------|
| Students by school + academic year | YES |
| Students by name search hash | YES |
| Audit logs by school + date | YES |
| Fee invoices by student | YES |
| Fee invoices by status | YES |
| Fee invoices by due date | YES |
| Staff by school + active | YES |
| Leave requests by status | YES |
| Admission applications by school + year | YES |
| Attendance by school + date | YES |
| Sessions by expiry (for cleanup) | YES |

---

## Concurrency Risks

| Scenario | Risk | Mitigation |
|----------|------|-----------|
| Two users submit same admission number | LOW | (schoolId, admissionNumber) unique constraint |
| Concurrent payroll run creation | LOW | (schoolId, month) unique constraint |
| Fee invoice generation for same student twice | LOW | (studentId, feeStructureId) checked before insert |
| Concurrent attendance marking | LOW | (studentId, date, periodId) unique |
| Concurrent leave balance update | MEDIUM | No optimistic locking — last write wins |

---

## Data Type Concerns

| Table.Column | Type | Concern |
|-------------|------|---------|
| student_documents.fileSizeBytes | text | Should be bigint |
| student_class_history.promotionStatus | text | Should be enum |
| fee_invoices amounts | numeric → string in Drizzle | Requires parseFloat — done correctly in engine |
| academic_terms.startDate/endDate | text "YYYY-MM-DD" | String dates bypass DB date validation |
| timetable dates | text | Same concern |

---

## Backup and Recovery

**UNKNOWN.** No backup configuration found in the repository. Render.com managed PostgreSQL offers automated backups, but no evidence of configuration, retention period, or restore testing procedure. This is a P1 gap.
