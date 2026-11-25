# SchoolMitra ERP — Repository Intelligence & Discovery (Phase 00)
**Directive**: `EDUCORE_MASTER_ENGINEERING_EXCELLENCE` v1.0.0  
**Audit Date**: November 25, 2026  
**Commit Baseline**: `9a14b7ad8ba46b77cb55983216bee98270bd2850` (v11.59.1 on `main`)  
**Repository**: [github.com/cascadetechnologiesbackend-ship-it/Edu_core](https://github.com/cascadetechnologiesbackend-ship-it/Edu_core)

---

## 1. Executive Summary & Monorepo Topology
SchoolMitra ERP is a multi-tenant SaaS educational operating platform tailored for K-10 Indian schools, engineered to ensure strict compliance with the **Digital Personal Data Protection (DPDP) Act 2023** and the **SchoolMitra Product Destination Charter**.

The repository is structured as a `pnpm` monorepo orchestrated with Turborepo (`turbo` 2.10.4):

```
Edu_core (root)
├── apps / workspaces
│   ├── frontend/             # Next.js 14.2.25 App Router, React 18, Tailwind CSS, Lucide
│   ├── backend/              # Node.js 20, tRPC v11, BullMQ 5.4.2, Domain Services & Workers
│   └── database/             # PostgreSQL 16, Drizzle ORM 0.30.10, 58 Schema Migrations
├── packages/
│   ├── entity-engine/        # Dynamic Entity Graph, Field Catalog, Relationship Metadata
│   ├── dpdp/                 # Consent Registry, Data Retention Engine, PII Obfuscation
│   ├── domain-events/        # Event Contracts, Typed Domain Event Bus
│   ├── validators/           # Shared Zod Schemas (v3.25.76) for Auth, Fees, Admissions, etc.
│   └── eslint-plugin-schoolmitra # Custom ESLint Rules enforcing multi-tenant isolation
└── scripts/                  # CI/CD Gates, Security Audits, Token Linters, Rehearsals
```

---

## 2. Inventory of Workspace Packages

| Package Name | Workspace Directory | Private | Version | Core Responsibilities & Technologies |
| :--- | :--- | :---: | :---: | :--- |
| `schoolmitra-erp` | `/` (root) | Yes | `11.59.1` | Root workspace, Turbo pipeline, Husky pre-commit hooks, commitlint. |
| `@schoolmitra/frontend` | `frontend/` | Yes | `11.59.1` | Next.js 14 App Router, Radix UI, TanStack Query & Table, Tailwind, Playwright. |
| `@schoolmitra/backend` | `backend/` | Yes | `11.59.1` | tRPC v11 router, NextAuth v5-beta.16, BullMQ workers, ioredis/Valkey, AWS S3. |
| `@schoolmitra/database` | `database/` | Yes | `11.59.1` | Drizzle ORM, PostgreSQL connection pools, 58 sequential migrations. |
| `@schoolmitra/entity-engine` | `packages/entity-engine/` | Yes | `11.59.1` | Entity graph definitions, dynamic field registry, schema reflection. |
| `@schoolmitra/dpdp` | `packages/dpdp/` | Yes | `11.59.1` | DPDP Act 2023 consent records, erasure lifecycle, PII audit trails. |
| `@schoolmitra/domain-events`| `packages/domain-events/` | Yes | `11.59.1` | Cross-service typed event signatures, payload validation. |
| `@schoolmitra/validators` | `packages/validators/` | Yes | `11.59.1` | Canonical Zod schemas, role enums, API request/response contracts. |
| `eslint-plugin-schoolmitra` | `packages/eslint-plugin-schoolmitra/`| Yes | `11.59.1` | AST linters banning direct `db` queries without `withTenant` wrapper. |

---

## 3. Database Schema & Migration Inventory
The database engine is PostgreSQL 16 accessed via Drizzle ORM (`0.30.10`).
- **Migration Count**: 58 sequentially journaled migration scripts in `database/src/migrations/`.
- **Journal Integrity**: Verified by `pnpm --filter @schoolmitra/database run db:check-migrations` (0 sequence gaps, unique hashes).
- **Core Schema Domains** (19 schema files in `database/src/schema/`):
  1. `core.ts`: `schools`, `academicYears`, `terms`, `sessions`, `auditLogs`.
  2. `people.ts`: `users`, `userRoles`, `roles`, `staffProfiles`, `guardians`.
  3. `students.ts`: `students`, `studentEnrollments`, `studentGuardians`, `admissions`.
  4. `fees.ts`: `feeCategories`, `feeStructures`, `feeInvoices`, `feePayments`, `feeDiscounts`.
  5. `studentFeeAdvances.ts`: `studentFeeAdvances`, `advanceTransactions`.
  6. `accounts.ts`: `chartOfAccounts`, `journalEntries`, `journalLines`, `bankAccounts`.
  7. `academics.ts`: `classes`, `sections`, `subjects`, `classSubjects`, `timetableSlots`.
  8. `attendance.ts`: `studentAttendance`, `staffAttendance`, `attendanceRegisters`.
  9. `examinations.ts`: `exams`, `examSchedules`, `examMarks`, `gradeScales`, `reportCards`.
  10. `hr.ts`: `staffLeaves`, `leaveBalances`, `salaryStructures`, `payrollRuns`, `payslips`.
  11. `transport.ts`: `transportRoutes`, `routeStops`, `vehicles`, `transportAllocations`.
  12. `drivers.ts`: `driverProfiles`, `driverVehicles`, `driverLicenses`.
  13. `inventory.ts`: `inventoryCategories`, `inventoryItems`, `inventoryTransactions`.
  14. `library.ts`: `libraryBooks`, `bookIssues`, `bookReturns`, `libraryMembers`.
  15. `hostel.ts`: `hostelRooms`, `hostelBeds`, `hostelAllocations`.
  16. `communication.ts`: `notifications`, `smsLogs`, `emailLogs`, `pushSubscriptions`.
  17. `dpdp.ts`: `dpdpConsents`, `dpdpGrievances`, `dpdpPurgeLogs`, `dpdpAuditEvents`.
  18. `superadmin.ts`: `platformAdmins`, `platformAuditLogs`, `tenantOnboardingRequests`.
  19. `workerHeartbeats.ts`: `workerHeartbeats`, `scheduledJobRuns`.

---

## 4. Background Workers & Queue Architecture
Background tasks run via BullMQ over Valkey/Redis:
- **Finance Automation Worker** (`backend/src/workers/financeAutomation.ts`):
  - Job: `recomputeAgingAndOverdue` (Daily scan at 00:05 IST).
  - Job: `applyLateFees` (ACC-08 automated fine calculator).
  - Job: `generateMonthlyInvoices` (Recurring billing engine).
- **Retention & DPDP Purge Worker** (`backend/src/workers/retention.ts`):
  - Job: `enforceRetentionPolicies` (Permanent purge after 30-day grace period).
- **Communication Dispatch Worker** (`backend/src/workers/communication.ts`):
  - Job: WebPush, SMS notifications, parent event alerts.
- **Worker Heartbeat Monitor** (`database/src/schema/workerHeartbeats.ts`):
  - Telemetry tracking for BullMQ worker health and SLA adherence.

---

## 5. Security & Verification Tooling
The repository features custom verification scripts in `scripts/`:
- `scripts/audit-dependencies.mjs`: Scans `pnpm audit` JSON output against `.audit-exceptions.json`.
- `scripts/audit-color-tokens.mjs`: AST/regex linter checking for raw Tailwind colors (`slate`, `emerald`, `amber`, hex codes).
- `scripts/audit-exam-rbac.mjs`: Asserts strict role authorization across examination routes.
- `scripts/audit-unscoped-writes.mjs`: Verifies mutations execute under tenant constraints.
- `scripts/d1-honesty-scanner.mjs`: Confirms UI metrics (attendance, fees) do not fabricate synthetic 100% data.
- `scripts/check-bundle-budgets.mjs`: Validates Next.js route bundle sizes against strict thresholds.
