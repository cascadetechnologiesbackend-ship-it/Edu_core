# Layer 6 Release Evidence: Setup Wizard Preselection & Board Term Plan Creator

**Spec**: `edu-core-s9-board-exam-blueprint-seeding@9.0.0`  
**Layer**: Layer 6 — Setup Wizard Preselection & Term Plan Creator  
**Timestamp**: 2026-10-15T14:08:00+05:30  
**Git Branch**: `main`  

---

## 1. Summary of Changes

Layer 6 brings the board examination blueprint experience directly into active operational workflows through automated class preselection, one-click term plan provisioning, proportional calendar scheduling, and progressive dashboard onboarding, rigorously adhering to User Amendments 1, 2, 4, 5, 6, 7, 8, 10, and 11:

1. **Harden `requireExamPermission` & Session Derivation (Amendments 1 & 2)**:
   - Server action `createBoardTermPlan` enforces `requireExamPermission(ctx, "exam.setup.manage")` using the full server auth context.
   - Tenant `schoolId` is derived strictly from `requireSchool(ctx)`, rejecting any client-supplied school identifier.

2. **Wizard Class Scope Intersection (Amendment 4)**:
   - `ExamManageClient.tsx` inspects `applicableClassGroups` on the selected `exam_type`.
   - When proceeding from Step 1 to Step 2, only classes whose educational level matches the exam type's applicable category (e.g., Nursery–UKG, Class 1–5, Class 6–8, Class 9–10, Class 11–12) are auto-preselected.
   - The user retains full control to toggle individual classes, with an informative notice indicating the blueprint category match.

3. **Term Plan Idempotency Key (Amendment 5)**:
   - Term shells are keyed on `(schoolId, academicYearId, name)`.
   - Running term plan creation on a school that already has term exams safely skips existing shells without duplicating datesheets, subject allocations, or student marks.

4. **Proportionally Derived Placeholder Dates (Amendment 6)**:
   - Built `computeProportionalDates(yearStart, yearEnd, proportion, durationDays)`.
   - Exam windows are spaced across the active academic year window based on the board blueprint's `defaultProportion` (e.g. Periodic Test 1 at ~25%, Half-Yearly at ~50%, Annual at ~92%), maintaining chronological sequence within the active session.

5. **Term Plan Confirmation Drawer (UX-P09 & Amendment 7)**:
   - Created `BoardTermPlanCard.tsx` client component featuring a slide-over Confirmation Drawer.
   - Drawer queries `getBoardTermPlanPreview()` to render exact term names, proportional date windows, active class scope pills, and component breakdowns before the user confirms creation.

6. **Explicit Component Mapping on Term Shells (Amendment 8)**:
   - Created exam shells automatically provision their respective blueprint components (e.g. CBSE Half-Yearly receives 80% Theory Paper + 20% Internal Assessment; ICSE receives 80% Written Paper + 20% Project / SUPW).
   - Component insertion strictly respects `exam_components_exam_type_unique` on `(examId, examTypeId)`, assigning distinct exam type references for multi-component assessments.

7. **First-Run Progressive Onboarding (UX-P10 & Amendment 10)**:
   - In `frontend/src/app/(admin)/exams/dashboard/page.tsx`, when a school has board defaults loaded but 0 configured exams, `BoardTermPlanCard` renders as the primary prominent hero card.
   - Once examination shells exist, it gracefully demotes into a compact utility bar.

8. **Audit Trail Verification (Amendment 11)**:
   - Every execution of `createBoardTermPlan` logs a persistent compliance record to `audit_logs`:
     - `action: "WRITE"`
     - `tableName: "examinations"`
     - `purposeId: "exam_setup"`
     - `metadata`: includes `board`, `academicYearId`, `createdExamsCount`, and `skippedExamsCount`.

---

## 2. Test Verification & Audit Assertions

### Integration Test Suite (`backend/src/lib/__tests__/examTermPlan.test.ts`)
- **Amendment 1 & 2 RBAC**: Asserts session-scoped permission check succeeds for `SCHOOL_ADMIN` and rejects unscoped callers or unauthorized roles (`TEACHER`).
- **Amendment 4 Scopes**: Asserts terms intersect active school classes matching their educational group.
- **Amendment 6 Dates**: Asserts that `Periodic Test 1` startDate < `Half-Yearly` startDate < `Annual` startDate.
- **Amendment 8 Components**: Asserts that `Half-Yearly Examination` has 2 distinct components (80% Theory, 20% Internal Assessment).
- **Amendment 5 Idempotency**: Asserts that Pass 2 on existing term shells creates 0 duplicates and skips all terms.
- **Amendment 11 Audit**: Explicitly asserts row in `audit_logs` matching `purposeId`, actor email, and created count.

```
 ✓ src/lib/__tests__/examTermPlan.test.ts  (2 tests) 324ms
 Test Files  1 passed (1)
      Tests  2 passed (2)
```

### Full Backend S9 Test Suite
```
 ✓ src/lib/__tests__/examBoardBlueprints.test.ts  (10 tests) 21ms
 ✓ src/lib/__tests__/examPermissions.test.ts      (10 tests) 11ms
 ✓ src/lib/__tests__/examSeeding.test.ts          (6 tests)  17ms
 ✓ src/lib/__tests__/examBackfill.test.ts         (2 tests)  166ms
 ✓ src/lib/__tests__/examTermPlan.test.ts         (2 tests)  324ms

 Test Files  5 passed (5)
      Tests  30 passed (30)
```

---

## 3. AST Safety & TypeScript Verification

- **AST Scanner**: `node scripts/audit-unscoped-writes.mjs` → `0 findings found` across 52 server actions.
- **TypeScript**: `pnpm type-check` → `Tasks: 6 successful, 6 total` (0 errors across monorepo).
