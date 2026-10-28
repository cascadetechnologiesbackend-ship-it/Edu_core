# Sprint S20 Phase 0: Evidence-Based Gap Audit & Baseline Report

**Sprint ID**: S20-DIGITAL-TWIN-AND-UIUX  
**Version**: 20.0.0 (Target: v11.30.0)  
**Baseline Git Commit**: `790b4de` (`main`)  
**Timestamp**: 2026-10-25T23:12:00+05:30  
**Status**: AUDIT COMPLETE — BASELINE CERTIFIED  

---

## 1. Monorepo State & Compile Verification

| Package | Path | Type-check Status | Time |
|---|---|---|---|
| `@schoolmitra/database` | `database/` | PASS (`tsc --noEmit`) | <3s |
| `@schoolmitra/backend` | `backend/` | PASS (`tsc --noEmit`) | <4s |
| `@schoolmitra/domain-events` | `packages/domain-events/` | PASS (`tsc --noEmit`) | <2s |
| `@schoolmitra/dpdp` | `packages/dpdp/` | PASS (`tsc --noEmit`) | <2s |
| `@schoolmitra/entity-engine` | `packages/entity-engine/` | PASS (`tsc --noEmit`) | <3s |
| `@schoolmitra/validators` | `packages/validators/` | PASS (`tsc --noEmit`) | <2s |
| `@schoolmitra/frontend` | `frontend/` | PASS (`tsc --noEmit`) | ~20s |
| **All Monorepo Packages** | `pnpm type-check` | **PASS (7/7 packages, Exit Code 0)** | **26.17s** |

---

## 2. Database Migration & Ledger Audit

- **Audit Command**: `pnpm --filter @schoolmitra/database db:check-migrations`
- **Audit Result**: Audited 55 migration files (`0000_dark_garia.sql` to `0054_dual_role_teacher_assignments.sql`). All sequence numbers are unique and 100% synchronized with `meta/_journal.json`.
- **Latest Migration**: `0054_dual_role_teacher_assignments.sql` (timestamp `1795000000000`, `idx: 54`).
- **Next Migration Number**: `0055_school_provisions.sql` (timestamp `1795100000000`, `idx: 55`).

---

## 3. Dependency Inventory & Zero New Dependencies Check

The following dependencies required for S20 are already present in `frontend/package.json`:
- **UI Primitives**: `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-select`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-checkbox`
- **Data Table**: `@tanstack/react-table` (v8.15.3)
- **Spreadsheet / Export Engine**: `exceljs` (v4.4.0)
- **Background Jobs**: `bullmq` (v5.4.2), `ioredis` (v5.3.2)
- **Notifications**: `sonner` (v1.4.41)
- **Icons & Styling**: `lucide-react` (v0.359.0), `tailwindcss` (v3.4.3), `tailwind-merge` (v2.2.2), `clsx` (v2.1.0), `class-variance-authority` (v0.7.0)
- **Validation**: `zod` (v3.25.76)

**Verdict**: **Zero new npm dependencies are needed.**

---

## 4. Test Suite Baseline Audit

- **Unit Test Runner**: `vitest run` in `frontend/`
- **Active Tests Audited**: 73 test files (642 tests).
- **Passed**: 69 test files (630 tests).
- **Pre-existing Failures**: 4 files (`assignmentPopulationE2E.test.ts`, `classHubAssignmentE2E.test.ts`, `classHubAssignmentSurfaces.test.ts`) failed due to unmocked `db.query.classTeacherAssignments` in S15 mock setup.
- **Invariant**: Sprint S20 will add isolated tests (`s20-*.test.ts`) and maintain 100% of the 69 passing test suites without regressions.

---

## 5. Non-Negotiable Safety Invariants for Live Pilot School

1. No modification or drop of existing columns or tables.
2. `database/src/seed.ts` is strictly prohibited.
3. No automatic activation of unconfirmed prices or statutory rates.
4. Tenant isolation enforced on every query via `withTenant(schoolId)` or `eq(table.schoolId, schoolId)`.
5. Existing Parent, Teacher, and Student PWAs are protected against any visual or functional regressions.
