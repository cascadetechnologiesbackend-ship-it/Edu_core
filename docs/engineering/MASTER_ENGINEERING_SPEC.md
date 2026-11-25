# SchoolMitra ERP — Master Engineering Specification (Phase 01)
**Directive**: `EDUCORE_MASTER_ENGINEERING_EXCELLENCE` v1.0.0  
**Status**: Ready for Implementation Gate Approval  
**Date**: November 25, 2026

---

## 1. Specification Index & Coverage

This master engineering specification defines the exact technical designs, invariants, and implementation contracts required to remediate all confirmed findings (EDU-P1-001 through EDU-P2-005) and advance SchoolMitra ERP from its baseline score of 7.12 to an evidence-backed 10.00 maturity score.

| Spec ID | Finding Remediated | Target Subsystem | Severity |
| :--- | :--- | :--- | :---: |
| **SPEC-001** | `EDU-P1-001` (Worker Tenant DB) | Background Workers / Transaction Engine | P1 |
| **SPEC-002** | `EDU-P1-002` (Wildcard Audit Exceptions) | DevSecOps / Dependency Audit Gate | P1 |
| **SPEC-003** | `EDU-P1-003` (Tenant RLS Completeness) | PostgreSQL 16 / Drizzle Migrations | P1 |
| **SPEC-004** | `EDU-P2-001` (Rate Limiter Fallback) | Rate Limiter / Redis Circuit Breaker | P2 |
| **SPEC-005** | `EDU-P2-002` (Super Admin Active Check) | Session Authentication Engine (`serverAuth.ts`) | P2 |
| **SPEC-006** | `EDU-P2-003` (CSP 'unsafe-inline') | Next.js HTTP Security Headers & Middleware | P2 |
| **SPEC-007** | `EDU-P2-004` (CI Monorepo Lint) | GitHub Actions CI Pipeline (`ci.yml`) | P2 |
| **SPEC-008** | `EDU-P2-005` (Apple HIG Module Theming) | Frontend Design System (10 Core Modules) | P2 |

---

## 2. SPEC-001: Background Worker Tenant Context & Transaction Propagation

### 2.1 Problem Statement
Background jobs running in BullMQ workers (`backend/src/workers/financeAutomation.ts`, `retention.ts`) invoke domain functions that query the global `db` pool directly. Although the worker establishes tenant isolation via `withTenant(schoolId, async (tx) => ...)`, passing no transaction client to the inner functions causes queries to execute on unconfigured connections, bypassing PostgreSQL RLS context.

### 2.2 Technical Invariants
1. **Mandatory `tx` Propagation**: Every function executed within a tenant context must accept a database client/transaction handle parameter: `client: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0] = db`.
2. **Worker Context Wrapper**:
   ```typescript
   export async function processFinanceJob(job: Job) {
     const { schoolId } = job.data;
     await withTenant(schoolId, async (tx) => {
       await recomputeAgingAndOverdue(schoolId, tx);
       await applyLateFees(schoolId, tx);
     });
   }
   ```
3. **AST Lint Enforcement**: `@schoolmitra/eslint-plugin-schoolmitra` rule `no-unscoped-worker-db` will fail the build if `db.` is invoked inside worker processors without `tx`.

---

## 3. SPEC-002: Zero-Wildcard Dependency Security Audit & Advisory Remediation

### 3.1 Problem Statement
`.audit-exceptions.json` contains entries with `"advisoryId": "*"` for major packages (`next`, `drizzle-orm`, `nodemailer`, etc.). Furthermore, 4 unapproved High-severity advisories currently fail the audit gate: `follow-redirects` (GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c, GHSA-mrwp-f3q8-3g9p) and `zod` (GHSA-mrhx-c7xc-m3w5).

### 3.2 Technical Invariants
1. **Zero Wildcard Policy**: No entry in `.audit-exceptions.json` may use `*` for `advisoryId`. Every exception must specify the exact GHSA or CVE identifier (e.g., `GHSA-mrhx-c7xc-m3w5`).
2. **Mandatory Metadata Fields**:
   - `package`: Exact npm package name.
   - `advisoryId`: Exact CVE or GHSA identifier.
   - `severity`: Must match advisory severity (`high` or `critical`).
   - `reason`: Specific architectural mitigation explaining why the system is not vulnerable.
   - `ticket`: Issue tracking ticket ID.
   - `expiresAt`: ISO 8601 date, maximum 90 days from registration date.
3. **Automated Audit Gate Enforcement**: `scripts/audit-dependencies.mjs` will strictly reject any entry containing `advisoryId: "*"` with exit code 1.
4. **Dependency Patching**: Pin or update `follow-redirects` and `zod` to remediated versions.

---

## 4. SPEC-003: Exhaustive Row-Level Security (RLS) System Catalog Audit

### 4.1 Problem Statement
PostgreSQL RLS must be active and forced on 100% of tables containing tenant data (`schoolId`). Gaps in newer migrations could expose data in the event of an unscoped raw query.

### 4.2 Technical Invariants
1. **System Catalog Query**:
   ```sql
   SELECT relname, relrowsecurity, relforcerowsecurity 
   FROM pg_class 
   JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
   WHERE nspname = 'public' AND relkind = 'r' AND relname IN (
     SELECT table_name FROM information_schema.columns WHERE column_name = 'school_id'
   );
   ```
2. **Enforcement Rule**: Every table with a `school_id` column must have `relrowsecurity = true` and `relforcerowsecurity = true`.
3. **Fail-Closed Policy**: If any table lacks RLS, a migration script will immediately apply:
   ```sql
   ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
   ALTER TABLE <table_name> FORCE ROW LEVEL SECURITY;
   CREATE POLICY tenant_isolation_policy ON <table_name>
     USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);
   ```

---

## 5. SPEC-004: Distributed Rate Limiter Hardening & Bounded LRU Fallback

### 5.1 Problem Statement
In `backend/src/lib/rateLimiter.ts`, the in-memory fallback uses a simple `Map<string, number[]>` that resets completely when reaching 10,000 keys (`memoryRateLimitMap.clear()`). In multi-replica cloud environments, rate limit counters are not shared during Redis partition, allowing brute-force attempts.

### 5.2 Technical Invariants
1. **Fail-Closed on High-Stakes Auth**: For authentication endpoints (password verification, student DOB claim, OTP validation), if Redis/Valkey is unreachable, enforce strict per-process throttle with a maximum of 5 attempts before returning HTTP 429.
2. **Bounded LRU Eviction**: Replace naive `clear()` with a proper LRU cache algorithm that purges only expired timestamps rather than resetting active penalty tracking.

---

## 6. SPEC-005: Super Admin Account Active State Verification & Session Revocation

### 6.1 Problem Statement
`backend/src/lib/serverAuth.ts` line 32 bypasses database checks if `session.user.role === "SUPER_ADMIN"`. A deactivated Super Admin (`users.isActive = false`) can continue executing platform administrative operations until session expiration.

### 6.2 Technical Invariants
1. **Universal Active Status Verification**:
   ```typescript
   // In serverAuth.ts getCachedSession():
   const [u] = await client
     .select({ isActive: users.isActive })
     .from(users)
     .where(eq(users.id, session.user.id))
     .limit(1);

   if (!u || !u.isActive) {
     return null; // Immediately invalidate session
   }
   ```
2. **Context Resolution**: For `SUPER_ADMIN`, execute the check inside `withAuthContext` (unscoped platform context) rather than `withTenant`.

---

## 7. SPEC-006: Content Security Policy Nonce-Based Script Execution

### 7.1 Problem Statement
`frontend/next.config.mjs` allows `'unsafe-inline'` in production `script-src`, weakening defenses against Cross-Site Scripting (XSS).

### 7.2 Technical Invariants
1. **Dynamic CSP Nonce Generation**:
   Generate a cryptographic 128-bit random nonce in Next.js middleware per request:
   ```typescript
   const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
   ```
2. **Header Enforcement**:
   Replace `'unsafe-inline'` with `'nonce-${nonce}'` and `'strict-dynamic'`.
3. **Whitelisted Payment & Analytics Origins**:
   Explicitly authorize Razorpay (`https://checkout.razorpay.com`, `https://cdn.razorpay.com`) and Microsoft Clarity (`https://www.clarity.ms`).

---

## 8. SPEC-007: Monorepo Turborepo Lint & Test CI Integration

### 8.1 Problem Statement
`.github/workflows/ci.yml` runs lint only on `@schoolmitra/frontend`, leaving backend, database, dpdp, and entity-engine unchecked during PR validation.

### 8.2 Technical Invariants
1. **Monorepo Lint Step**:
   Replace `pnpm --filter @schoolmitra/frontend run lint` with `pnpm run lint` (`turbo run lint`), ensuring all packages pass ESLint.
2. **Dependency Audit Gate**:
   Add `node scripts/audit-dependencies.mjs` as a mandatory blocking step in the CI pipeline before building or testing.

---

## 9. SPEC-008: Module-Scoped Apple HIG Semantic Design System Architecture

### 9.1 Problem Statement
12,302 color escapes exist across 340 files in 10 core administrative modules. Screens render inconsistent dark navy backgrounds (`bg-slate-900`, `bg-[#0a0f1d]`) rather than Apple HIG dark neutral surfaces with module-scoped primary, secondary, and accent colors.

### 9.2 Module Scope Color Palette Matrix (Apple HIG Principles)

| Module | Primary Role | Apple Accent | Primary Token | Secondary Token | Tertiary Token | Highlight / Badge |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Admissions & Intake** | Onboarding & KYC | Apple Purple | `purple-500` | `purple-400` | `purple-950/40` | `purple-400/20` |
| **2. Academics & Classes** | Curriculum & ClassHub | Apple Blue | `blue-500` | `blue-400` | `blue-950/40` | `blue-400/20` |
| **3. Exams & Evaluation** | Testing & Marks | Apple Indigo | `indigo-500` | `indigo-400` | `indigo-950/40` | `indigo-400/20` |
| **4. Fee Matrix** | Setup & Pricing | Apple Emerald | `emerald-500` | `emerald-400` | `emerald-950/40` | `emerald-400/20` |
| **5. Accounts Hub & POS** | Cashier & Ledger | Apple Green | `green-500` | `green-400` | `green-950/40` | `green-400/20` |
| **6. Transport Operations** | Fleet & Routes | Apple Amber | `amber-500` | `amber-400` | `amber-950/40` | `amber-400/20` |
| **7. HR & Staff (Teacher 360)** | Staff Lifecycle | Apple Cyan | `cyan-500` | `cyan-400` | `cyan-950/40` | `cyan-400/20` |
| **8. DPDP Compliance** | Privacy & Consents | Apple Teal | `teal-500` | `teal-400` | `teal-950/40` | `teal-400/20` |
| **9. School Settings** | Configuration | Apple Gray/Slate | `zinc-400` | `zinc-500` | `zinc-900/60` | `zinc-400/20` |
| **10. Student 360 Profile** | High-Stakes Identity | Apple System Blue | `blue-500` | `sky-400` | `blue-950/30` | `blue-400/20` |

### 9.3 Surface & Canvas Rules (Apple Dark Theme Standard)
- **App Shell / Window Canvas**: `#000000` (Pure Apple Dark Canvas)
- **Primary Elevated Card**: `#1c1c1e` (Apple Secondary System Background)
- **Secondary Nested Card**: `#2c2c2e` (Apple Tertiary System Background)
- **Border / Separator**: `rgba(255, 255, 255, 0.08)` (Apple Separator Standard)
- **Typography**: SF Pro Display / Text hierarchy (`text-white`, `text-zinc-400`, `text-zinc-500`).
