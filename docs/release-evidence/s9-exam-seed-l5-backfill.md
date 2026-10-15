# Layer 5 Release Evidence: Legacy Tenant Backfill, One-Click Defaults Action & RBAC Hardening

**Spec**: `edu-core-s9-board-exam-blueprint-seeding@9.0.0`  
**Layer**: Layer 5 — Legacy Tenant Backfill & One-Click Defaults  
**Timestamp**: 2026-10-15T13:45:00+05:30  
**Git Branch**: `main`  

---

## 1. Summary of Changes

Layer 5 delivers backfill automation, RBAC hardening, and one-click blueprint provisioning for existing/legacy school tenants, rigorously implementing User Amendments 1, 2, 3, and 11:

1. **Harden `requireExamPermission` Signature (Amendment 1)**:
   - Updated `requireExamPermission(ctx: ServerAuthContext, permission: ExamPermission)` to take the full server context rather than a bare role string.
   - Preserves S8 fail-closed authorization: validates permission against the role and verifies that non-`SUPER_ADMIN` callers have a resolved `schoolId`.
   - Updated all exam actions in `frontend/src/app/(admin)/exams/actions/setupActions.ts` and `frontend/src/app/(admin)/exams/actions.ts` to pass full `ctx`.

2. **Session-Scoped `loadBoardDefaultsForSchool` Server Action (Amendment 2)**:
   - Implemented in `frontend/src/app/(admin)/exams/actions/setupActions.ts`.
   - Derives `schoolId` strictly from `requireSchool(ctx)`, rejecting any client-supplied `schoolId` to eliminate tenant-scoping holes.
   - Enforces `requireExamPermission(ctx, "exam.setup.manage")`.
   - Invokes `seedExamBoardDefaults(schoolId, board, gradingScale, executor, { activeClassGroups })`.
   - Writes immutable compliance audit log to `audit_logs` with `purposeId: "exam_setup"`, recording counts of newly inserted exam types, grade rules, and cocurricular areas.

3. **Per-Class Override Preservation in `seedExamBoardDefaults` (Amendment 3)**:
   - In `backend/src/lib/examSeeding.ts`, the ensure-pattern for `grade_rules` filters `isNull(gradeRules.classId)`.
   - Preserves existing per-class override rows (`class_id IS NOT NULL`) with identical grade letters without collision or blocking blueprint seeding.

4. **CLI Backfill Script (`scripts/backfill-exam-blueprints.mjs`)**:
   - Supports `--dry-run`, `--all`, and `--school-id <uuid>`.
   - Iterates active schools, detects affiliation board, dynamically computes active class groups from configured classes, and previews or applies blueprint defaults idempotently.
   - Successfully verified against all 40 active schools in test environment.

5. **Exams Setup UI Blank-Slate State & Active Badge**:
   - Updated `frontend/src/app/(admin)/exams/manage/page.tsx` to query school affiliation `board`.
   - Enhanced `frontend/src/app/(admin)/exams/manage/ExamManageClient.tsx`:
     - Displays "Board Blueprint Defaults Active" status badge when defaults are already seeded.
     - When unseeded, displays a dedicated empty-state card ("Load Board Blueprint Defaults") with one-click action to seed defaults matching the school's board without manual data entry.

---

## 2. Test Verification & Audit Assertions (Amendment 11)

### A. RBAC Tests (`backend/src/lib/__tests__/examPermissions.test.ts`)
10 tests verifying:
- Non-super-admin with missing schoolId throws `ExamAuthorizationError`.
- `SUPER_ADMIN` with `null` schoolId succeeds (platform scope).
- Valid roles (`SCHOOL_ADMIN`, `PRINCIPAL`, `EXAM_OFFICER`) succeed on permitted operations.
- Roles without permissions fail closed.

```
 ✓ src/lib/__tests__/examPermissions.test.ts  (10 tests) 9ms
```

### B. Backfill, Idempotency & Audit Assertions (`backend/src/lib/__tests__/examBackfill.test.ts`)
- Explicitly seeds a per-class override row (`classId IS NOT NULL`) with grade `"TEST_OVR"`.
- Runs `seedExamBoardDefaults`, asserting the class override remains untouched and uncollided (Amendment 3).
- **Amendment 11 Assertion**: Explicitly queries `audit_logs` and verifies:
  - `userId`, `userEmail`, `userRole` match the caller.
  - `action` is `"WRITE"`, `tableName` is `"examinations"`.
  - `purposeId` is `"exam_setup"` (or test purpose ID).
  - `metadata` records inserted counts for `examTypesInserted`, `gradeRulesInserted`, `cocurricularInserted`.
- Runs a second pass and asserts 0 duplicate rows inserted (idempotency).

```
 ✓ src/lib/__tests__/examBackfill.test.ts  (2 tests) 155ms
```

---

## 3. AST Safety & TypeScript Verification

- **AST Write Scanner**: `node scripts/audit-unscoped-writes.mjs` → `0 findings found` across 52 server actions.
- **TypeScript**: `pnpm type-check` → `Tasks: 6 successful, 6 total` with 0 errors.
