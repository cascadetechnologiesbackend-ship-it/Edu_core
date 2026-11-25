# Production Readiness & Software Engineering Standards

This rule codifies the **Software Engineering & Production Readiness** reference guide (Categories A–M, Phases 1–5, and Core Engineering Principles) for every conversation in `Edu_core`.

## 1. The 12 Non-Negotiable Engineering Principles
1. **Never trust frontend validation as the only validation layer** — Always enforce schema/input validation on the backend.
2. **Never expose secrets or sensitive credentials in source code** — Use environment variables and secrets management.
3. **Never rely exclusively on frontend permissions for authorization** — Enforce RBAC + PostgreSQL RLS (`withTenant`) on every API route and database query.
4. **Never assume feature execution means secure implementation** — Explicitly check for IDOR, SQLi, XSS, CSRF, SSRF, mass assignment, path traversal, and open redirects.
5. **Never allow concurrent operations to corrupt shared business data** — Use database transactions, row locks, or idempotency keys for mutations, fees, and webhooks.
6. **Never deploy untested database migrations directly into production** — Test migrations locally/staging against PostgreSQL 16 (including `schoolmitra_app` role grants and RLS).
7. **Never treat database backups as sufficient without testing restoration** — Verify backup/restore procedures for critical data.
8. **Never assume an application is production-ready simply because it builds** — Run typecheck, automated tests, and smoke/E2E checks.
9. **Always verify tenant isolation in multi-tenant applications** — Confirm `security.set_verified_tenant_context` / `withTenant` prevents cross-tenant data leakage.
10. **Always test critical business workflows before production releases** — Validate auth, fees, attendance, exams, and demo flows end-to-end.
11. **Always maintain visibility into application errors and infrastructure health** — Use structured logging, error tracking, and `/api/health` checks.
12. **Always document important architectural and operational decisions** — Keep specs, migrations, and runbooks up to date.

---

## 2. Scenario-to-Workflow Routing
Apply the matching workflow checklist in `.agents/workflows/` whenever working on a scenario:

| Scenario / Task Type | Relevant Categories | Workflow to Follow |
|---|---|---|
| **API Routes, Backend Services, Auth, Webhooks, Queues** | B (API), D (Auth), E (Security), F (Data), G (Async), L (Time/UTF-8) | `.agents/workflows/api-and-backend-feature.md` |
| **Database Schema, Queries, Migrations, Caching, RLS** | C (Database), D (RLS), F (Encryption/Audit), M (DR) | `.agents/workflows/database-and-migration.md` |
| **Security Reviews, Tenant Isolation, DPDP/GDPR, Uploads** | D (Auth/RBAC), E (Vulnerabilities), F (Secrets/Privacy) | `.agents/workflows/security-and-tenant-audit.md` |
| **CI/CD, Deployments, Performance, Observability, Testing** | A (Infra), H (Perf/A11y), I (Observability), J (QA), K (Maintainability), M (DR) | `.agents/workflows/production-release-and-ops.md` |
