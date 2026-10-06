# 11 — Multi-Tenancy Analysis
## SchoolMitra ERP

---

## Tenancy Model

SchoolMitra uses a **shared database, shared schema** multi-tenancy model.

- All school data lives in the same PostgreSQL database.
- Every tenant-scoped table has a `school_id UUID NOT NULL` column with a FK to `schools`.
- Tenant isolation is enforced **exclusively at the application layer** — there is no PostgreSQL Row Level Security (RLS).

---

## Tenant Identity Resolution

```
1. Login → JWT populated with schoolId from users.school_id
2. Every Server Action/tRPC call → requireAuth() reads session.user.schoolId
3. requireSchool(ctx) → validates school is active using ctx.schoolId
4. All DB queries must filter: WHERE school_id = ctx.schoolId
5. SUPER_ADMIN: schoolId = null (platform-wide)
   → Impersonation: sm_impersonation cookie (HMAC-signed) carries schoolId
   → requireAuth() resolves impersonation → returns target schoolId
```

---

## Tenant Isolation Trace

```
Request (Student from School A)
  ↓
JWT (schoolId = school_A_uuid)
  ↓
middleware.ts (authenticated check only)
  ↓
Server Action / tRPC Resolver
  ↓
requireAuth() → ctx.schoolId = school_A_uuid
  ↓
requireSchool(ctx) → validates school A is active
  ↓
Drizzle Query: WHERE school_id = ctx.schoolId (EXPECTED)
  ↓
PostgreSQL (no RLS — all data visible at DB level)
```

---

## Tenant Isolation Verification

| Component | Isolation Verified | Method | Risk |
|-----------|-------------------|--------|------|
| users table | PARTIAL | (schoolId, email) unique constraint | Correct |
| students table | PARTIAL | schoolId FK on all queries | Assumed |
| fee_invoices | PARTIAL | schoolId FK | Assumed |
| fee_payments | PARTIAL | schoolId FK | Assumed |
| staff table | PARTIAL | schoolId FK | Assumed |
| admission_applications | PARTIAL | schoolId FK | Assumed — submitApplication accepts schoolId from client! |
| student_attendance | PARTIAL | schoolId FK | Assumed |
| audit_logs | PARTIAL | schoolId FK | Assumed |
| tRPC context | YES | session.user.schoolId | VERIFIED |
| S3 file paths | UNKNOWN | prefix may not be school-scoped | NOT VERIFIED |
| BullMQ jobs | UNKNOWN | Job payload tenant scoping | NOT VERIFIED |
| Redis cache keys | PARTIAL | schoolId in key for rate-limit | Assumed |
| Email delivery | UNKNOWN | Recipient derived from school context | NOT VERIFIED |

---

## Cross-Tenant Vulnerability Analysis

### Admission Application — CONFIRMED CROSS-TENANT RISK (P1)

```
admissions.ts submitApplication uses publicProcedure and accepts schoolId
from client-supplied input. An attacker can supply any school's UUID and
write admission data to a different tenant. (SEC-005)
```

### S3 File Access — UNKNOWN

```
Student documents are stored at s3Key values like:
  admissions/{uuid}-{filename}

Without a school-scoped prefix (e.g., schools/{schoolId}/admissions/...),
a user from school A who learns a school B document's S3 key could potentially
access it via the presigned URL mechanism. Verification required.
```

### In-Memory School Cache — PARTIAL RISK (P2)

```
requireSchool() caches school records in a per-process Map with 60s TTL.
On Render.com (single process) this is mitigated.
On multi-process / serverless deployments, cache invalidation is not propagated
across instances. A suspended school could still serve requests.
```

### Background Workers — UNKNOWN

```
reportCard.ts and retention.ts workers process jobs from BullMQ.
The job payload must include schoolId for every operation.
If a job is processed without proper tenant scoping, it could affect wrong tenants.
Not reviewed — risk is UNKNOWN.
```

---

## Multi-Tenancy Strengths

1. **schoolId on every table** — consistently applied across all 17 schema files.
2. **Unique constraints scoped to tenant** — e.g., `(schoolId, email)`, `(schoolId, admissionNumber)`, etc.
3. **Copy-on-provision template system** — template data is deep-cloned at provisioning; changes to global templates never auto-propagate to existing schools.
4. **Impersonation audit trail** — `impersonation_sessions` table logs every super-admin cross-tenant access.
5. **JWT carries schoolId immutably** — users cannot change their own tenant context.

---

## Multi-Tenancy Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| No PostgreSQL RLS | P2 | Application-only isolation — a query bug leaks cross-tenant data |
| S3 paths not verified as school-scoped | P2 | Could allow cross-tenant file access |
| BullMQ worker tenant scoping unverified | P2 | Background jobs could process wrong tenant |
| submitApplication accepts client-supplied schoolId | P1 | Direct cross-tenant write |
| Server Action tenant scoping unaudited | P1 | Unknown coverage |

---

## Recommended Improvements

1. **Immediate:** Fix `submitApplication` to derive schoolId from URL context, not client payload.
2. **Pre-launch:** Audit all Server Actions for `requireSchool()` coverage.
3. **Pre-launch:** Verify S3 key structure includes schoolId prefix.
4. **Pre-launch:** Verify BullMQ job payloads include schoolId and workers scope queries correctly.
5. **Post-launch:** Consider PostgreSQL RLS as defense-in-depth for critical tables (students, fee_payments, audit_logs).
