# Edu_core Architecture & Security Invariants (RULES)

These rules are non-negotiable across all development, refactoring, and performance optimizations.

---

## 1. Authentication & Security
- **Fail-Closed RBAC (GT-03)**: Any unlisted route or undefined/unknown role MUST result in DENY.
- **No Over-Projection in Auth**: `authorize()` queries against `users` and `superAdminUsers` must strictly project required columns (`id`, `email`, `fullName`, `passwordHash`, `isActive`, `mustChangePassword`, `schoolId`, `totpEnabled`, `totpSecret`), NEVER `select *`.
- **Production Secret Hard-Fail**: If `AUTH_SECRET` / `NEXTAUTH_SECRET` is unset in `production`, the server MUST refuse to boot, mirroring `ENCRYPTION_KEY`.
- **No Error Message Leaks**: Server catch blocks and `apiAuth` handlers must NEVER return raw `error.message` to clients; log real errors internally via `pino` and return generic messages with error tracing IDs.
- **Append-Only Audit Logs**: `audit_logs` is append-only. The database trigger `trg_audit_logs_append_only` strictly blocks `UPDATE` and `DELETE`.

---

## 2. Multi-Tenancy & Data Isolation
- **Subdomain = Tenant, Path = Role Workspace**: Every tenant query must be server-side scoped by `ctx.schoolId` (from authenticated session). Client-supplied `schoolId` is NEVER trusted for authorization.
- **Authenticated Encryption**: Sensitive PII columns (`mobile_encrypted`, `aadhaar_encrypted`, `first_name_encrypted`, `last_name_encrypted`) must use authenticated encryption (AES-256-GCM) with key separation (HKDF).
- **Prohibited Keys**: Responses must never expose prohibited projection keys (`PROHIBITED_PARENT_LEDGER_KEYS`, `PROHIBITED_STUDENT_FEE_CARD_KEYS`) or unencrypted raw columns.

---

## 3. Caching & Performance
- **Zero Service-Worker Caching of Dynamic Authenticated Data**: The Service Worker MUST NEVER cache authenticated Server Component (RSC) or API responses across user sessions. Precache and cache-first strategies are strictly reserved for immutable static assets (`_next/static`, icons, fonts, offline shell).
- **No Dynamic Prefetch Storms**: Force-dynamic tenant routes must NEVER be prefetched via speculationrules or mouse hover handlers. Keep `prefetch={false}` on dynamic sidebar links.
- **Redis Circuit Breaker**: All Redis commands must enforce strict connection timeouts (`connectTimeout: 1000, commandTimeout: 1000`). If Redis is not in `ready` state, execution must immediately bypass to in-memory/DB without thread blocking.

---

## 4. UI / UX & 120 FPS
- **Compositor Animations Only**: Animate ONLY `transform` and `opacity`. NEVER animate `width`, `height`, `top`, `left`, or `box-shadow` during interactive transitions.
- **Single Source of Truth for Roles**: `roleConfig` must have exactly one source in the repository.
- **Touch Action Manipulation**: Interactive elements must define `touch-action: manipulation` to eliminate 300ms mobile tap delays.
- **Accessibility & Motion**: Respect `@media (prefers-reduced-motion: reduce)` globally.
