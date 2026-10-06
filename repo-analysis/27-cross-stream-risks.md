# 27 — Cross-Stream Risk Analysis
## SchoolMitra ERP

Cross-stream risks are failures that occur at the intersection of two or more system dimensions. These are often the hardest to catch and the most dangerous in production.

---

## RISK-001 — Authentication × Configuration
### Hardcoded Secrets Make Auth Breakable Without Compromise

**Streams:** Authentication, Configuration, Security

**Description:** The JWT signing secret and AES encryption key both have publicly-visible hardcoded fallbacks. A misconfigured production environment (forgotten env var) silently uses these known values.

**Chain:**
```
Developer forgets AUTH_SECRET on Render.com
  → resolveAuthSecret() returns known fallback
  → All JWT tokens are signed with a public key
  → Attacker reads source code
  → Attacker crafts JWT with { role: "SUPER_ADMIN", schoolId: null }
  → All school tenants accessible without credentials
  → All encrypted PII decryptable (ENCRYPTION_KEY also fallback)
```

**Severity:** P0  
**Prevention:** TASK-001 — Fail-fast startup validation

---

## RISK-002 — Authorization × Multi-tenancy
### Server Actions Authorization Coverage Cannot Be Verified

**Streams:** Authorization, Multi-tenancy, Backend

**Description:** tRPC procedures have middleware-enforced auth. Server Actions require explicit `requireAuth()` calls. There is no linting or framework guarantee that Server Actions call `requireAuth()`. The majority of features use Server Actions.

**Chain:**
```
Feature Server Action file missing requireAuth()
  → Next.js executes action on behalf of any HTTP caller
  → Action queries DB without schoolId context
  → Response contains data from wrong/any tenant
```

**Risk:** Any Server Action omitting `requireAuth()` is an unauthenticated endpoint with cross-tenant exposure.

**Severity:** P1 (per instance) — TASK-009 must audit all Server Actions

---

## RISK-003 — Migrations × Deployment
### Duplicate Migration Numbers = Schema Drift in Production

**Streams:** Database, Deployment, CI/CD

**Description:** Three pairs of migrations share sequence numbers. The Drizzle migration runner tracks applied migrations by name in the journal. Deploying with duplicate-numbered files causes the journal to diverge from actual schema.

**Chain:**
```
render.yaml: preDeployCommand = db:migrate
  → Drizzle reads journal → finds 0001 applied
  → Skips 0001_perf_indexes.sql (journal says 0001 done)
  → Performance indexes never created
  → High-traffic queries do full table scans
  → Latency spikes → user complaints

OR:

  → 0002_auth_tokens.sql skipped
  → password_reset_tokens table does not exist
  → Password reset feature crashes with DB error
```

**Severity:** P0 — TASK-003 must resolve before any deployment

---

## RISK-004 — Backend × Database (Transactions)
### Fee Assignment Partial Failure = Inconsistent Financial State

**Streams:** Backend, Database, Transactions

**Description:** `autoAssignFeeStructuresToStudent()` runs inside a loop without a wrapping transaction. A process crash or network error mid-loop creates partial invoice assignment.

**Chain:**
```
Admin activates fee structure for Class 6
  → autoAssignFeeStructuresForClass() called for 45 students
  → Student 1-30: invoices created successfully
  → Process crash (OOM, deploy, timeout)
  → Student 31-45: no invoices
  → Finance report shows ₹X missing
  → Admin doesn't know invoices are missing
  → Students not notified of fee obligations
```

**Severity:** P1 — TASK-008

---

## RISK-005 — Multi-tenancy × Caching
### In-Memory School Cache Does Not Invalidate on School Suspension

**Streams:** Multi-tenancy, Caching, Authorization

**Description:** `requireSchool()` caches school records in an in-memory Map with 60s TTL. Suspension is not immediately enforced — the school continues to serve requests from cache.

**Chain:**
```
Platform admin suspends school (schools.isActive = false)
  → requireSchool() has schoolA cached for remaining TTL (up to 60s)
  → Requests from schoolA continue to succeed
  → In multi-instance deployment: each instance has own cache
  → Suspension may never propagate to all instances if traffic is low
```

**Severity:** P2 — TASK-014 (Redis-backed cache with explicit invalidation)

---

## RISK-006 — Background Jobs × Multi-tenancy
### BullMQ Workers May Not Scope Queries to Tenant

**Streams:** Async Jobs, Multi-tenancy, Database

**Description:** Background workers (`reportCard.ts`, `retention.ts`) process BullMQ jobs. If job payloads do not include schoolId or if worker queries lack WHERE schoolId = ..., cross-tenant data exposure is possible.

**Chain:**
```
Worker picks up reportCard job from queue
  → Job payload does not include schoolId
  → Worker queries "all report cards due for generation"
  → Worker generates report cards for ALL schools
  → PDF uploaded to S3 with wrong tenant prefix
  → Parent from school A can access school B student's report card
```

**Status:** UNKNOWN — worker code was not fully reviewed. Must be verified.  
**Severity:** P1 (if unscoped)

---

## RISK-007 — Integrations × Financial Data
### Razorpay Webhook Without Signature Verification = Fake Payments

**Streams:** Integrations, Backend, Financial Data

**Description:** `/api/webhooks/*` bypasses JWT authentication in middleware. If Razorpay webhook handler does not verify the HMAC signature using RAZORPAY_SECRET, any actor can POST fake payment confirmations.

**Chain:**
```
Attacker sends POST /api/webhooks/razorpay with body:
  { event: "payment.captured", payload: { payment: { entity: { id: "fake", amount: 50000 } } } }
  → Handler (if not verified) marks fee_invoice as PAID
  → Student appears paid in system
  → School loses revenue
  → Financial reports corrupted
```

**Status:** Webhook handler not reviewed. Severity depends on implementation.  
**Severity:** P1 if verification absent

---

## RISK-008 — Frontend × Backend
### tRPC Router vs Server Actions Authorization Surface Mismatch

**Streams:** Frontend, Backend, Authorization

**Description:** The tRPC root router contains only 3 routers. All other features use Server Actions. The tRPC middleware chain (rate limiting, auth, role check) does not apply to Server Actions. Users interacting with Server Actions get no automatic rate limiting or role enforcement from tRPC middleware.

**Chain:**
```
User hits Server Action endpoint rapidly (fee payment, grade update)
  → No tRPC rate limiting applies
  → Server Action may not call requireAuth()
  → Action succeeds without authentication
  → No audit trail created
```

**Severity:** P1 (per unauthenticated action) — TASK-009

---

## RISK-009 — Observability × Privacy
### Production Logs May Inadvertently Contain PII

**Streams:** Observability, Privacy, DPDP Compliance

**Description:** When structured logging is enabled for production, log entries must be audited to ensure no PII fields (names, contacts, Aadhaar, bank data) are included. The `auditLogger.ts` comment notes "metadata must NEVER contain PII field values" but this constraint is not enforced programmatically.

**Chain:**
```
Developer adds debug logging for fee invoice creation
  → Logs include student name (decrypted at application layer)
  → Names appear in pino JSON log output
  → Logs shipped to logging platform (Render.com logs, external SIEM)
  → DPDP Act: personal data processing requires consent and purpose
  → Log processing is not covered by admission consent purpose
  → Data breach / compliance violation
```

**Severity:** P2 — Needs log schema review when enabling production logging (TASK-010)

---

## RISK-010 — CI/CD × Schema
### Deploy Without Tests May Ship Broken Migration + Incompatible Code

**Streams:** CI/CD, Database, Deployment

**Description:** `render.yaml` runs `db:migrate` then starts the application. If a migration fails partway through and the application starts anyway, the application runs against a partially-migrated schema.

**Chain:**
```
Migration 0009 adds NOT NULL column to students table
  → Migration fails on 50,000 existing rows (constraint violation)
  → preDeployCommand fails
  → Render.com may still start the application (depending on exit code handling)
  → Application queries expect new column
  → 500 errors on student pages
  → No CI test ran before deployment detected the issue
```

**Severity:** P1 — TASK-006 (CI), TASK-003 (migration fix)
