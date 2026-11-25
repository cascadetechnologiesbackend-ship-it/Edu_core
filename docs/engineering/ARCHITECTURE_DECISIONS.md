# SchoolMitra ERP — Architecture Decision Records (ADRs)
**Directive**: `EDUCORE_MASTER_ENGINEERING_EXCELLENCE` v1.0.0  
**Status**: Ratified Architectural Standards  
**Date**: November 25, 2026

---

## Index of Architecture Decision Records

| ADR ID | Title | Status | Date |
| :--- | :--- | :---: | :---: |
| **ADR-001** | Mandatory Transaction Handle (`tx`) Propagation in Worker Tenant Execution | **Accepted** | 2026-11-25 |
| **ADR-002** | Exact CVE-ID Whitelisting with Zero-Wildcard Policy in Dependency Audits | **Accepted** | 2026-11-25 |
| **ADR-003** | Strict Multi-Tenant Row-Level Security (RLS) Policy on All Table Entities | **Accepted** | 2026-11-25 |
| **ADR-004** | Fail-Closed Distributed Rate Limiting & Bounded Memory Eviction | **Accepted** | 2026-11-25 |
| **ADR-005** | Cryptographic Nonces for Content Security Policy Script Execution | **Accepted** | 2026-11-25 |
| **ADR-006** | Module-Scoped Apple HIG Semantic Design Token System | **Accepted** | 2026-11-25 |

---

## ADR-001: Mandatory Transaction Handle (`tx`) Propagation in Worker Tenant Execution

### Context
SchoolMitra ERP enforces multi-tenancy at the database layer via PostgreSQL Row-Level Security (RLS) policies conditioned on `current_setting('app.current_school_id', true)`. In `backend/src/lib/tenant.ts`, `withTenant(schoolId, callback)` opens a transaction and issues `SET LOCAL app.current_school_id = schoolId`. 
Background BullMQ workers invoked domain functions (`recomputeAgingAndOverdue`, `applyLateFees`, `enforceRetentionPolicies`) without passing the transaction handle `tx`. These functions called `db.update(...)` or `db.query...` on the global pool, bypassing the transaction context.

### Decision
All tenant-scoped helper functions executed inside `withTenant` or background workers MUST accept a mandatory database transaction client handle `tx: Parameters<Parameters<typeof db.transaction>[0]>[0]`. Tenant-scoped helper functions MUST NOT use an optional parameter defaulting to the global `db` pool. When invoked inside `withTenant(schoolId, async (tx) => ...)`, `tx` MUST be explicitly passed to all child queries and domain functions. Platform/system operations must remain explicitly separated from tenant-scoped operations. AST linting rules in `@schoolmitra/eslint-plugin-schoolmitra` will enforce this invariant statically.

### Consequences
- **Positive**: Guaranteed tenant isolation inside asynchronous worker threads; eliminates risk of unauthenticated cross-tenant queries.
- **Negative**: Requires signature updates for background worker domain helpers.

---

## ADR-002: Exact CVE-ID Whitelisting with Zero-Wildcard Policy in Dependency Audits

### Context
`.audit-exceptions.json` contained entries with `"advisoryId": "*"`, allowing any newly reported vulnerability on packages like `next`, `next-auth`, or `drizzle-orm` to pass CI without review.

### Decision
1. Eliminate all `"advisoryId": "*"` wildcard records. Every exception must list the exact GitHub Security Advisory (GHSA) or Common Vulnerabilities and Exposures (CVE) identifier.
2. Every exception must include: package name, exact advisory ID, severity, architectural mitigation rationale, tracking ticket, and an expiration date not exceeding 90 days.
3. `scripts/audit-dependencies.mjs` will fail-closed if any wildcard entry is encountered.

### Consequences
- **Positive**: True zero-day vulnerability protection; prevents security blind spots in production dependencies.
- **Negative**: Requires disciplined quarterly review of expired exceptions.

---

## ADR-003: Strict Multi-Tenant Row-Level Security (RLS) Policy on All Table Entities

### Context
As new modules (Academics, Student PWA, Teacher 360, DPDP) were added across 58 migrations, certain tables may lack `FORCE ROW LEVEL SECURITY`.

### Decision
All tables containing a `school_id` foreign key MUST have both `ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` enabled. An automated migration verification test will run system catalog queries (`pg_class.relrowsecurity`, `relforcerowsecurity`) to assert 100% RLS coverage on every CI run.

In PostgreSQL, `FORCE ROW LEVEL SECURITY` enforces RLS policies even against the table owner; however, roles with `SUPERUSER` attributes or `BYPASSRLS` privileges completely bypass RLS. Therefore, application connections MUST connect using a dedicated non-superuser, non-BYPASSRLS database login (such as `schoolmitra_app_login`), while schema migrations run under the table owner identity.

### Consequences
- **Positive**: Defense-in-depth database security; prevents data leaks even if an application query omits `where(eq(table.schoolId, schoolId))`.
- **Negative**: Requires strict role separation between migration execution and application runtime connections.

---

## ADR-004: Fail-Closed Distributed Rate Limiting & Bounded Memory Eviction

### Context
`backend/src/lib/rateLimiter.ts` fell back to an in-memory `Map` during Redis connection drops. In multi-pod cloud deployments, in-memory state is partitioned per container, allowing distributed attacks. Naively calling `.clear()` on 10,000 keys reset rate limits globally.

### Decision
1. Sensitive endpoints (login, password reset, minor DOB claim flow) MUST fail-closed or operate under aggressive per-pod throttling (maximum 5 attempts) when Redis/Valkey is unreachable.
2. The in-memory fallback will employ an LRU eviction strategy that removes only expired keys rather than clearing active penalty counters.

### Consequences
- **Positive**: Prevents brute-force credential stuffing during cloud network partitions.
- **Negative**: Slightly stricter throttling for end users if Redis experiences degradation.

---

## ADR-005: Cryptographic Nonces for Content Security Policy Script Execution

### Context
`frontend/next.config.mjs` included `'unsafe-inline'` in `script-src` to allow third-party scripts (Razorpay payment SDK, Microsoft Clarity analytics). This disabled browser XSS defenses.

### Decision
Adopt per-request cryptographic nonces generated in Next.js middleware and propagated via HTTP response headers:
```
Content-Security-Policy: script-src 'self' 'nonce-<base64>' 'strict-dynamic' https://checkout.razorpay.com https://www.clarity.ms;
```

### Consequences
- **Positive**: Full compliance with modern web security standards; prevents execution of unauthorized injected scripts.
- **Negative**: Requires passing nonces to any inline Next.js `<Script>` components.

---

## ADR-006: Module-Scoped Apple HIG Semantic Design Token System

### Context
Administrative screens in SchoolMitra ERP suffered from 12,302 hardcoded color escapes across 340 files (raw `slate-900`, `emerald-500`, `amber-500`, hex values), creating visual inconsistency and dark navy styling that conflicted with Apple Human Interface Guidelines (HIG).

### Decision
Implement a unified, module-scoped Apple HIG design system:
1. **Neutral Base Surfaces**: Pure black `#000000` canvas, `#1c1c1e` primary elevated cards, `#2c2c2e` secondary nested cards, `rgba(255, 255, 255, 0.08)` hairline borders.
2. **Module-Scoped Accents**:
   - Admissions: Apple Purple
   - Academics & Classes: Apple Blue
   - Exams & Evaluation: Apple Indigo
   - Fee Matrix: Apple Emerald
   - Accounts Hub & POS: Apple Green
   - Transport: Apple Amber
   - HR & Staff: Apple Cyan
   - DPDP Compliance: Apple Teal
   - Settings: Apple Zinc
   - Student 360: Apple System Blue
3. **CI Color Guard**: Run `node scripts/audit-color-tokens.mjs` in CI to prevent regression of raw color escapes.

### Consequences
- **Positive**: Cohesive, world-class Apple HIG user experience; instant cognitive recognition of module context for school administrators and staff.
- **Negative**: Requires systematic refactoring of component classes across the 10 administrative modules.
