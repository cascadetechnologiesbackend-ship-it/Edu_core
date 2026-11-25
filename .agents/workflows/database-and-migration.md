---
description: Checklist for database schema changes, migrations, queries, caching, and RLS (Categories C, D, F, M).
---

# Database & Migration Workflow

Use this workflow whenever modifying schemas, writing SQL migrations, optimizing queries, or configuring caching.

## 1. Schema & Query Design (Category C)
- [ ] **Normalization & Integrity**: Use proper foreign keys, `NOT NULL`, and `CHECK` constraints to prevent inconsistent data.
- [ ] **Indexing**: Add indexes on frequently queried `WHERE`, `JOIN`, `ORDER BY`, and `school_id` columns.
- [ ] **Connection Pooling**: Keep runtime traffic on pooled connections (`DATABASE_URL` with `-pooler`) and migrations on direct connections (`MIGRATION_DATABASE_URL`).
- [ ] **Soft Deletes & Audit**: Use soft deletes where historical/financial recovery is required, and log sensitive mutations to audit tables.
- [ ] **Caching & Invalidation**: Cache hot read-heavy data (e.g., Redis with in-memory fallback) and invalidate keys on writes.

## 2. Safe Migrations & RLS (Categories C, D, F)
- [ ] **Idempotency**: Write migrations using `IF NOT EXISTS` / `IF EXISTS` / `to_regclass(...) IS NOT NULL` guards.
- [ ] **Multi-Tenant RLS**: Enable and force Row-Level Security (`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`) on all tenant-scoped tables.
- [ ] **Role Grants**: Ensure `schoolmitra_app` has the required `SELECT/INSERT/UPDATE/DELETE` grants on new tables.
- [ ] **Pre-Deploy Verification**: Test all migrations locally against PostgreSQL 16 (non-superuser + `SET ROLE schoolmitra_app`) before merging.

## 3. Backup & Recovery (Category M)
- [ ] **Destructive Changes**: Never drop columns/tables with live data without a verified backup and phased deprecation plan.
