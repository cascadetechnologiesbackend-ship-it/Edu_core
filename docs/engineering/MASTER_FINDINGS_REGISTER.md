# SchoolMitra ERP — Master Findings Register (Phase 00)
**Directive**: `EDUCORE_MASTER_ENGINEERING_EXCELLENCE` v1.0.0  
**Audit Date**: November 25, 2026  
**Auditor Principle**: `Inspect_First_Design_Second_Implement_Third_Verify_Continuously`  
**Classification Standard**: P1 (Critical / Data Integrity / Multi-Tenancy / Security Breach), P2 (High / Architectural Flaw / Compliance / Performance / UI Degradation)

---

## Summary Register of Confirmed Findings

| Finding ID | Severity | Category | Title | Affected Subsystems | Live Status |
| :--- | :---: | :---: | :--- | :--- | :---: |
| **EDU-P1-001** | **P1 (Critical)** | C02 Data Integrity | Background Worker Queries Circumvent Tenant Context Transaction | `backend/src/workers/financeAutomation.ts`, `retention.ts` | **REMEDIATED (Phase 02)** |
| **EDU-P1-002** | **P1 (Critical)** | C03 Security / Ops | Wildcard `advisoryId: "*"` in Dependency Security Audit Registry | `.audit-exceptions.json`, `scripts/audit-dependencies.mjs` | **REMEDIATED (Phase 02)** |
| **EDU-P1-003** | **P1 (Critical)** | C02/C03 Multi-Tenancy | Database Row-Level Security (RLS) Completeness Verification | `database/src/schema/`, 59 migrations | **REMEDIATED (Phase 02)** |
| **EDU-P2-001** | **P2 (High)** | C06 Scalability | Distributed Rate Limiting Fallback State Partitioning on Redis Drop | `backend/src/lib/rateLimiter.ts` | **PENDING (Phase 03)** |
| **EDU-P2-002** | **P2 (High)** | C03 Security | Super Admin Session Validation Bypasses Active Account Check | `backend/src/lib/serverAuth.ts` | **REMEDIATED (Phase 02)** |
| **EDU-P2-003** | **P2 (High)** | C03 Security | Content Security Policy Allows `'unsafe-inline'` in Production | `frontend/next.config.mjs` | **PENDING (Phase 03)** |
| **EDU-P2-004** | **P2 (High)** | C08 DevSecOps | Monorepo CI Pipeline Omits Backend and Shared Package Linting | `.github/workflows/ci.yml` | **PENDING (Phase 04)** |
| **EDU-P2-005** | **P2 (High)** | C05 Frontend / UX | 12,302 Color Escapes Across 340 Files Violating Apple HIG Theming | `frontend/src/app/`, 10 core administrative modules | **PENDING (Phase 05)** |

---

## Detailed Finding Forensic Analysis

### Finding EDU-P1-001: Background Worker Queries Circumvent Tenant Context Transaction
- **Severity**: Critical (P1)
- **Category**: C02 (Data Architecture & Integrity) & C03 (Multi-Tenancy)
- **Affected Files**:
  - `backend/src/workers/financeAutomation.ts` (lines 41-55, 65-75, 120-135)
  - `backend/src/workers/retention.ts` (lines 35-50)
- **Forensic Diagnosis**:
  In `financeAutomation.ts`, BullMQ executes jobs wrapped with `await withTenant(schoolId, async () => { ... })`. However, the internal functions `recomputeAgingAndOverdue` and `applyLateFees` directly call the global connection pool:
  ```typescript
  // Flawed pattern in financeAutomation.ts line 41:
  const res = await db.update(feeInvoices)...
  ```
  Because `withTenant` executes `SET LOCAL app.current_school_id` on an isolated database transaction client `tx`, querying the unconfigured global `db` pool bypasses the transaction context. If the global connection does not have `SET LOCAL` applied, PostgreSQL Row-Level Security policies can either fail closed (throwing an error) or allow cross-tenant data processing.
- **Remediation Strategy**:
  Refactor all domain functions invoked by BullMQ workers to accept `tx: any` as an explicit parameter (or pass `tx` from `withTenant(schoolId, async (tx) => ...)`). Update ESLint rules in `packages/eslint-plugin-schoolmitra` to ban bare `db` calls inside worker processors.

---

### Finding EDU-P1-002: Wildcard `advisoryId: "*"` in Dependency Security Audit Registry
- **Severity**: Critical (P1)
- **Category**: C03 (Security) & C08 (DevSecOps)
- **Affected Files**:
  - `.audit-exceptions.json` (lines 9, 17, 25, 34, 42, 50, 58, 66, 74, 82, 90, 98)
  - `scripts/audit-dependencies.mjs` (line 92)
- **Forensic Diagnosis**:
  The audit exceptions registry contains entries with `"advisoryId": "*"`, such as:
  ```json
  {
    "package": "next",
    "advisoryId": "*",
    "severity": "critical"
  }
  ```
  `scripts/audit-dependencies.mjs` matches vulnerabilities using `if (e.package === pkgName && (!e.advisoryId || e.advisoryId === advId || e.advisoryId === "*")) return true;`. Consequently, any new critical zero-day advisory discovered on `next`, `next-auth`, `drizzle-orm`, or `nodemailer` will be silently ignored. Furthermore, the live audit run flagged 4 unapproved High-severity vulnerabilities (`follow-redirects` x3, `zod` x1).
- **Remediation Strategy**:
  1. Remove all wildcard `*` advisory IDs. Replace them with specific, ratified GHSA/CVE IDs.
  2. Remediate or pin `follow-redirects` and `zod` to patched versions.
  3. Enforce that any exception requires a valid security ticket, exact CVE-ID, mitigating architectural controls, and an expiry date within 90 days.

---

### Finding EDU-P1-003: Database Row-Level Security (RLS) Completeness Verification
- **Severity**: Critical (P1)
- **Category**: C02 (Data Integrity) & C03 (Multi-Tenancy)
- **Affected Files**:
  - `database/src/schema/*.ts` (all 19 schema files)
  - `database/src/migrations/0041_fail_closed_rls.sql`
- **Forensic Diagnosis**:
  Migration `0041_fail_closed_rls.sql` established fail-closed RLS on initial core tables. Over subsequent feature cycles (Phases E1–E7, F1–F7, Student PWA, Teacher PWA), 17 additional migration files were generated up to migration 0058. An exhaustive table-by-table verification is required to guarantee that `ALTER TABLE ... FORCE ROW LEVEL SECURITY` and `CREATE POLICY ...` are applied to all newly created domain tables containing `schoolId`.
- **Remediation Strategy**:
  Execute an automated schema audit script querying PostgreSQL system catalogs (`pg_tables`, `pg_class.relrowsecurity`) to verify 100% of tenant tables enforce `relrowsecurity = true` and `relforcerowsecurity = true`.

---

### Finding EDU-P2-001: Distributed Rate Limiting Fallback State Partitioning on Redis Drop
- **Severity**: High (P2)
- **Category**: C06 (Performance & Scalability) & C07 (Reliability)
- **Affected Files**:
  - `backend/src/lib/rateLimiter.ts` (lines 78–125)
- **Forensic Diagnosis**:
  In `rateLimiter.ts`, when Redis/Valkey fails or circuit breaks, the code falls back to `memoryRateLimitMap`. In a multi-replica containerized deployment (e.g., Kubernetes, Render, AWS ECS), each node maintains an isolated in-memory map. A malicious actor can bypass the rate limit by spraying requests across different pods. Additionally, `if (memoryRateLimitMap.size > 10000) memoryRateLimitMap.clear()` resets all rate limits globally on a single pod.
- **Remediation Strategy**:
  Introduce a fail-closed partition policy for sensitive authentication endpoints (e.g., `/api/auth/callback/credentials`, student DOB claim flow), and replace naive `clear()` with a bounded LRU eviction cache that preserves active penalty windows.

---

### Finding EDU-P2-002: Super Admin Session Validation Bypasses Active Account Check
- **Severity**: High (P2)
- **Category**: C03 (Security & Identity)
- **Affected Files**:
  - `backend/src/lib/serverAuth.ts` (lines 31–32)
- **Forensic Diagnosis**:
  In `serverAuth.ts`, `getCachedSession()` checks:
  ```typescript
  // Super admins skip school-level active checks unless impersonating
  if (session.user.role !== "SUPER_ADMIN") { ... }
  ```
  If a platform super admin is deactivated in the database (`users.isActive = false`), their existing session cookie continues to authenticate successfully until JWT expiration because the active account query is completely bypassed.
- **Remediation Strategy**:
  Always query `users.isActive` from the database for ALL roles, including `SUPER_ADMIN`. For `SUPER_ADMIN`, perform the query in the global platform context via `withAuthContext`.

---

### Finding EDU-P2-003: Content Security Policy Allows `'unsafe-inline'` in Production
- **Severity**: High (P2)
- **Category**: C03 (Application Security)
- **Affected Files**:
  - `frontend/next.config.mjs` (lines 75–78)
- **Forensic Diagnosis**:
  The production HTTP security header configuration contains:
  ```javascript
  script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com https://www.clarity.ms https://scripts.clarity.ms
  ```
  The presence of `'unsafe-inline'` disables standard browser XSS mitigation for injected scripts.
- **Remediation Strategy**:
  Implement dynamic cryptographic nonces (`'nonce-<base64>'`) generated per-request in Next.js middleware and propagate via HTTP response headers to replace `'unsafe-inline'`.

---

### Finding EDU-P2-004: Monorepo CI Pipeline Omits Backend and Shared Package Linting
- **Severity**: High (P2)
- **Category**: C08 (DevSecOps)
- **Affected Files**:
  - `.github/workflows/ci.yml` (lines 99–101)
- **Forensic Diagnosis**:
  The CI workflow step `Run Monorepo Lint` executes:
  ```yaml
  - name: Run Monorepo Lint
    run: pnpm --filter @schoolmitra/frontend run lint
  ```
  This command only checks the frontend package. Static code quality, multi-tenant linting rules in `@schoolmitra/eslint-plugin-schoolmitra`, and type safety checks on `@schoolmitra/backend`, `@schoolmitra/database`, and `@schoolmitra/dpdp` are not enforced in CI linting.
- **Remediation Strategy**:
  Change the CI step to `pnpm run lint` across the monorepo root via Turborepo (`turbo run lint`), ensuring all 8 packages are checked in every PR.

---

### Finding EDU-P2-005: 12,302 Color Escapes Across 340 Files Violating Apple HIG Theming
- **Severity**: High (P2)
- **Category**: C05 (Frontend Architecture, UX & Design System)
- **Affected Files**:
  - `frontend/src/app/(admin)/` (Admissions, Academics, Exams, Fees, Accounts, Transport, HR, DPDP, Settings)
  - `scripts/audit-color-tokens.mjs`
- **Forensic Diagnosis**:
  The live AST linter `node scripts/audit-color-tokens.mjs` detected **12,302 color token escapes across 340 files**:
  - `slate`: 4,438 occurrences
  - `emerald`: 2,337 occurrences
  - `amber`: 1,705 occurrences
  - `rose`: 1,018 occurrences
  - `hex` values: 1,407 occurrences
  - `blue_other`: 718 occurrences
  Screenshots submitted by the user confirm that key administrative modules (Admissions wizard, Academics Hub, Exam Operations, Fee Matrix, DPDP Centre, Settings Dashboard, POS Counter Terminal, Student 360, Teacher 360) render inconsistent dark navy backgrounds (`bg-slate-900`, `bg-[#0a0f1d]`, etc.) rather than the ratified Apple HIG semantic token system with module-scoped primary, secondary, and accent colors.
- **Remediation Strategy**:
  Execute Phase 05 of the Engineering Excellence roadmap: define module-scoped semantic color themes conforming to Apple HIG design principles in `packages/theme` or Tailwind config, replace raw color tokens systematically, and enforce zero escapes via CI color guards.
