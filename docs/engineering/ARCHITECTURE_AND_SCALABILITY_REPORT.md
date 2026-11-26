# Architecture and Scalability Report

**Branch**: `engineering/enterprise-excellence-10-10`  
**Audit Date**: November 26, 2026

---

## 1. Monorepo Topology

SchoolMitra (`Edu_core`) is organized as a `pnpm` + Turborepo monorepo:
- `frontend/`: Next.js App Router application (Admin, Teacher, Parent, Student, Driver portals, plus API routes).
- `backend/`: Core backend services, tRPC routers, tenant context (`backend/src/lib/tenant.ts`), and background workers (`backend/src/workers/importExportWorker.ts`).
- `database/`: Drizzle ORM schemas, migration sequence (`0000`–`0064`), and `check-migrations.ts`.
- `packages/`: Shared internal packages (e.g., `@schoolmitra/dpdp`, `@schoolmitra/validators`, `packages/entity-engine`).

---

## 2. Background Worker & Data Exchange Architecture

- **Import/Export Engine**: `backend/src/workers/importExportWorker.ts` processes asynchronous import/export jobs with tenant-scoped execution.
- **API Surface**:
  - `frontend/src/app/api/import-export/export/route.ts`
  - `frontend/src/app/api/import-export/jobs/[jobId]/route.ts`
- **Academic Workflows**:
  - `frontend/src/app/(admin)/academics/classes/class-teacher-actions.ts`

---

## 3. Scalability & External Infra

| Area | Status | Notes |
| :--- | :--- | :--- |
| Monorepo workspace structure | **Verified** | Confirmed across `frontend/`, `backend/`, `database/`, `packages/`. |
| Async import/export worker | **Verified** | Implemented in `backend/src/workers/importExportWorker.ts`. |
| Render / S3 / Redis live scaling | **Blocked** | External cloud credentials and runtime metrics unavailable in local workspace. |
