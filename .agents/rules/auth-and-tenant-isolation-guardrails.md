---
description: Guardrails for multi-role authentication, school provisioning grants, tenant HMAC isolation, and basePath-safe PWA/login assets
globs: ["backend/src/lib/auth/**", "backend/src/lib/tenant.ts", "frontend/src/app/(auth)/**", "frontend/src/app/api/auth/**", "frontend/src/app/api/demo/**", "frontend/src/app/actions/onboard.ts", "database/src/migrations/**"]
---

# Auth, School Provisioning & Tenant Isolation Guardrails

## 1. Runtime DB Role Grants (`schoolmitra_app`)
- The Next.js application pool connects as `schoolmitra_app` (non-superuser, RLS-enforced).
- Whenever adding or modifying migrations (especially security hardening or `REVOKE ALL` blocks), verify `schoolmitra_app` retains required privileges on:
  - **Auth & Sessions:** `SELECT, UPDATE` on `super_admin_users`; `SELECT, INSERT, UPDATE, DELETE` on `sessions`, `password_reset_tokens`, `email_verification_tokens`; `SELECT, INSERT, UPDATE` on `impersonation_sessions`; `SELECT, INSERT` on `platform_audit_logs`.
  - **School Provisioning:** `SELECT, INSERT, UPDATE` on `schools` so `/onboard` and Super Admin provisioning succeed.
  - **All New Tenant Tables:** Explicit `GRANT` + RLS policies (`USING` and `WITH CHECK` on `school_id`) registered in `database/src/migrations/meta/_journal.json` so Render `preDeployCommand` (`db:migrate`) executes them.

## 2. Tenant HMAC Secret Parity (`withTenant` vs `migrate.ts`)
- `TenantSecurityService.getSigningSecret()` in `backend/src/lib/tenant.ts` MUST stay aligned with `database/src/migrate.ts`:
  - Resolve `DATABASE_TENANT_HMAC_KEY || ENCRYPTION_KEY || AUTH_SECRET`.
  - In `NODE_ENV === "production"`, still fail fast if the resolved secret is missing or `< 32` characters (never fall back to a hardcoded dev string).
- Never let `withTenant()` throw inside NextAuth `authorize()` due to an unaligned env var name — that breaks login for every tenant role (`SCHOOL_ADMIN`, `PRINCIPAL`, `TEACHER`, `ACCOUNTANT`, `PARENT`, `STUDENT`, `DRIVER`) with `error=Configuration`.

## 3. Zero Hardcoded Login Credentials
- NEVER hardcode passwords or Super Admin emails in client components (`login-form.tsx`, `DemoTopBanner.tsx`, quick-fill buttons) or auth providers.
- Super Admin credentials (`SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`) must come strictly from environment variables (`.env` / Render env) for seeding (`manage_super_admin.ts`, `migrate.ts`).
- Demo role launches and role switching must:
  1. Resolve active demo schools (`feature_flags->>'demo_tenant' = 'true'`) and role emails from PostgreSQL (`/api/demo/personas`, `/api/demo/launch`).
  2. Authenticate via a short-lived HMAC-signed `demoToken` verified against PostgreSQL `demo_tenant === true` in `authorize()` (never permitted for `super_admin_users` or non-demo schools).

## 4. `NEXT_PUBLIC_BASE_PATH` (`/educore`) Asset & Auth Safety
- Prefix all static `<Image>` / `<link>` / `navigator.serviceWorker.register(...)` / `fetch("/api/...")` URLs with `process.env.NEXT_PUBLIC_BASE_PATH || ""`.
- Keep `frontend/public/manifest.json` URLs relative (`./icon.svg`, `./?source=pwa`) and derive `SW_BASE_PATH` dynamically in `frontend/public/sw.js` from `self.location.pathname`.
