# S12.1 Layer 0 Evidence: Supplemental Baseline Reconciliation & Audit

**Spec**: `edu-core-s12-supplemental-security-and-release-closure@12.1.0`
**Layer**: L0 — Reconcile repository state, baseline captures, workflow audit
**Commit Date**: 2026-10-15
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0` + `RULES.md` (Rule Zero PF-R00)

---

## 1. Executive Summary

This document reconciles the repository baseline, workflow runs, open defect findings, and migration journal state prior to executing the security and release closures required by `edu-core-s12-supplemental-security-and-release-closure` v12.1.0.

---

## 2. Baseline & Repository Reconciliation

### 2.1 Git State
- **Upstream Origin Baseline**: `98f16d6f449ed81c32ca6ac9ce276ba01d3d612d` (`chore(release): configure automated SemVer workflow and sync baseline v11.0.0`)
- **Current Local Branch HEAD**: `f44f7c9acdb124cc224b878763c53b45a7373813`
- **S12 Integrated History**:
  1. `502c879`: `feat(exam-integrity): layer 0 pre-flight, schema probes, and flaw confirmation`
  2. `83ebadd`: `feat(exam-integrity): layer 1 marks entry hardening and max_marks population`
  3. `f44f7c9`: `feat(exam-integrity): layer 2 enrollment-aware result snapshots and unified rule resolver`
- **Working Tree**: Clean (`git status` reports nothing to commit).

### 2.2 GitHub Workflow Runs Audit
Direct GitHub Actions API verification against `cascadetechnologiesbackend-ship-it/Edu_core`:
1. **CI Pipeline** (`id: 38746920766`, head SHA: `98f16d6`):
   - **Conclusion**: `failure`
   - **Failing Job**: `Build, Lint, Test & Security Validation`
   - **Failing Step**: `Run Backend Unit & Integration Tests (Non-Owner Role S5-T3)`
   - **Root Cause**:
     - `backend/src/lib/__tests__/s4_rls_proofs.test.ts`: Migration 0034 relaxed RLS policies with `IS NULL OR = ''` allow-arms, causing un-scoped writes and attendance entries to succeed rather than throw RLS violations under non-owner role `schoolmitra_app_login`.
     - `backend/src/workers/__tests__/retentionLifecycle.test.ts`: Non-UUID string fixture `"school-retention-test-123"` caused Postgres error `22P02: invalid input syntax for type uuid`.
2. **Deploy Pipeline** (`id: 38747666177`, head SHA: `98f16d6`):
   - **Conclusion**: `skipped` (due to CI pipeline failure).
3. **Automated SemVer & Release** (`id: 38746920790`, head SHA: `98f16d6`):
   - **Conclusion**: `skipped`.

### 2.3 Migration Journal State
- Migration directory: `database/src/migrations/`
- Current journal: `database/src/migrations/meta/_journal.json`
- Latest migration: `0040_exam_integrity_closure.sql` (`idx: 40`, `when: 1793600000000`)
- Next sequential migration: **`0041_fail_closed_rls.sql`** (`idx: 41`, `when: 1793700000000`)

---

## 3. Defect Classification Table

| Defect ID | Severity | Description | Current State | Target Resolution Layer |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-RLS-001** | P0 | Migration 0034 permits access when `app.current_school_id` is NULL or empty on 13 tenant tables. | OPEN (Confirmed via Migration 0034 inspection) | S12.1 Layer 1 (Migration 0041) |
| **SEC-AUTH-002** | P0 | `assertTeacherTeaches` fallback returns `true` if teacher has *any* assignment in the school. | OPEN (Confirmed in `examPermissions.ts:173-181`) | S12.1 Layer 2 |
| **SEC-API-003** | P0 | Staff exam results API only checks `exam.schoolId !== userSchoolId` if `userSchoolId` is truthy; loads exam unscoped. | OPEN (Confirmed in `frontend/src/app/api/staff/exam-results/[examId]/route.ts:42`) | S12.1 Layer 3 |
| **SEC-REF-004** | P0 | `createExam` inserts `examTypeId` and `classIds` without school verification; non-atomic scope insertion. | OPEN (Confirmed in `setupActions.ts:41-99`) | S12.1 Layer 2 |
| **REL-CI-005** | P1 | 13 backend test failures in baseline CI run `38746920766`. | OPEN (Confirmed via test run logs) | S12.1 Layer 4 |
| **REL-DEPLOY-006** | P1 | `deploy.yml` and `release.yml` allow `workflow_dispatch` without validating target SHA passed CI. | OPEN (Confirmed in `.github/workflows/deploy.yml` & `release.yml`) | S12.1 Layer 5 |
| **REL-AUDIT-007** | P1 | Dependency security audit in CI has unconditional `continue-on-error: true`. | OPEN (Confirmed in `.github/workflows/ci.yml:166`) | S12.1 Layer 5 |
| **REL-BRANCH-008** | P1 | Branch protection on `main` is unverified / requires administrator action. | UNVERIFIED (API returns 401 without admin token) | S12.1 Layer 6 |

---

## 4. Exit Criteria Verification

- [x] Current branch and exact baseline are recorded (`f44f7c9` on `main`).
- [x] Every defect is rechecked against current source and classified as open.
- [x] Existing CI failures are captured without weakening assertions.
- [x] Migration sequencing is unambiguous: Migration 0040 applied; Migration 0041 designated for RLS fail-closed closure.
