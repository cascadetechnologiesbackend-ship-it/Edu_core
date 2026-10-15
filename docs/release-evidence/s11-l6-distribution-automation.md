# S11 Layer 6 Evidence: Mark Distribution Automation Engine

**Spec**: edu-core-s11-exam-cross-module-integration (v11.0.0)  
**Layer**: 6 — Mark Distribution Automation  
**Date**: 2026-10-15  
**Git Branch**: `main`  

---

## 1. Overview & Architecture
Prior to S11, configuring component mark distributions across classes and subjects was a completely manual, cell-by-cell process prone to human error, omissions of elective rules, and unintentional overwrites of existing marks.

Layer 6 introduces the **Mark Distribution Automation Engine** (`backend/src/lib/distributionAutomation.ts`):
1. **Scope Resolution (`examClassScopes`)**:
   - Queries `examClassScopes` for the exam. If class scopes are defined, generation strictly evaluates only scoped classes. If undefined, it evaluates all active classes in the school or requested classes.
2. **Subject Classification & Elective Filtering**:
   - Mandatory subjects (`isElective = false`): Automatically included.
   - Elective subjects (`isElective = true`): Evaluated against `studentSubjectEnrollments`. Included **IF AND ONLY IF** at least one student in that school has an `ACTIVE` enrollment (`isElectiveTaken = true`). Elective subjects with 0 enrolled students are strictly excluded, eliminating phantom distribution rows.
3. **Blueprint & Component Mark Inheritance**:
   - Inherits default `maxMarks` and `passingMarks` from the `subjects` master table.
   - If `examComponents` are configured for the exam, expands across components (e.g. Theory 70%, Practical 30%) with proportional weight calculations. If no components exist, generates a unified whole-paper distribution.
4. **Ensure Semantics & Idempotency**:
   - Existing customized rows in `examMarkDistributions` are marked `PRESERVE_EXISTING` and remain untouched. Generation inserts missing rows only.
5. **Immutability Guard**:
   - Prohibits modification or regeneration of rows where student marks already exist in `markEntries` (`PROTECTED_HAS_MARKS`).
6. **Preview & Modal UI (`DistributionsAutomationModal.tsx`)**:
   - Provides an interactive preview modal (`previewOnly = true`) displaying proposed rows categorized by `CREATE`, `PRESERVE_EXISTING`, and `PROTECTED_HAS_MARKS` with class filters and commitment guards.
   - Wired into both Exam Manage (`/exams/manage`) and Exam Schedule (`/exams/schedule`).
7. **Server Action & RBAC Guard (`distributionActions.ts`)**:
   - Exposes `generateDistributionsAction` and `previewDistributionsAction` guarded by `requireExamPermission(ctx.role, "exam.schedule.manage")` and `verifyExamOwnership`.

---

## 2. Test Execution Evidence

### Vitest Unit & Integration Suite (`src/lib/__tests__/distributionAutomation.test.ts`)
```
✓ src/lib/__tests__/distributionAutomation.test.ts (8 tests)
  ✓ 6.1: Preview mode generates proposals without mutating the database
  ✓ 6.2: Negative test: Excludes elective subjects with 0 enrolled students
  ✓ 6.3: Inherits default maxMarks and passingMarks from subjects table
  ✓ 6.4: Commits generated distributions and inserts them into exam_mark_distributions
  ✓ 6.5: Ensure-semantics idempotency: Re-running generation preserves existing customized rows without alteration
  ✓ 6.6: Immutability guard: Prohibits alteration or deletion when student mark entries already exist
  ✓ 6.7: Expands across exam components with weighted distribution
  ✓ 6.8: Tenant isolation probe: School A distribution generation never affects School B
```

### RBAC Static AST Guard (`scripts/audit-exam-rbac.mjs`)
```
Auditing 9 examination server action files for requireExamPermission guards...
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/distributionActions.ts -> generateDistributionsAction()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/distributionActions.ts -> previewDistributionsAction()
Auditing 18 examination routes for assertRouteAccess & session checks...
✅ ALL EXAMINATION RBAC GUARDS, ACTIONS & ROUTES VERIFIED (0 ERRORS)
```

### TypeScript Validation
```
pnpm --filter @schoolmitra/frontend exec tsc --noEmit: EXIT 0 (0 errors)
pnpm --filter @schoolmitra/backend exec tsc --noEmit: EXIT 0 (0 errors)
```

---

## 3. Cross-Tenant Isolation Verification
- Probed in `6.8`: When School B requests mark distribution generation passing School A's exam ID, the engine fails closed with `success: false` and message `"Exam not found in this school"`. Tenant examination data, scopes, and distributions are strictly partitioned by `school_id`.
