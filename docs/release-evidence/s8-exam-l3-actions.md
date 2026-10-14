# Layer 3 Evidence: Server Actions Layer, Teacher Scoping & RBAC Guards

**Sprint**: S8 Offline Examinations (`edu-core-s8-examinations-module-rebuild`)  
**Timestamp**: 2026-10-15T00:16:00+05:30  
**Head Commit Prior to Layer**: `e26a456`  
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0`, `SCHOOL-ERP-UIUX-SPEC.md v2.0`, `RULES.md`

---

## 1. Executive Summary

Layer 3 constructs the Server Actions layer for all six stages of the Offline Examination lifecycle. It replaces legacy monolithic mutation functions with modular, strictly typed, RBAC-guarded actions adhering to:
1. **Amendment 1 (Uniqueness NULL Hole Resolution)**: Two partial unique indexes (`WHERE component_id IS NULL` and `WHERE component_id IS NOT NULL`) are respected during SQL upsert in `saveMarkEntries`.
2. **Amendment 2 (Teacher Route & Mutation Boundary)**: `TEACHER` is excluded from all setup, schedule, admit card, locking, and result publishing actions. `TEACHER` is restricted exclusively to `saveMarkEntries` via `assertTeacherTeaches`.
3. **Database Schema & Enum Precision**: Normalizes fee lock modes to `"OFF" | "SOFT" | "HARD"` (matching `feeLockModeEnum`), uses `currentClassId` and encrypted fields (`firstNameEncrypted`, `lastNameEncrypted`), and removes legacy assumptions.

---

## 2. Modular File Structure

| Action File | Stage Covered | Core Actions | RBAC Roles Allowed |
|---|---|---|---|
| `actions/setupActions.ts` | Stage 1: Setup | `createExam`, `updateExam`, `deleteExam`, `createExamComponent`, `createCocurricularArea`, `saveCocurricularGrade`, `upsertGradeRule` | `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL` |
| `actions/scheduleActions.ts` | Stage 2: Schedule | `createExamSchedule`, `deleteExamSchedule`, `publishDatesheet`, `setMarkDistribution` | `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL` |
| `actions/admitCardActions.ts` | Stage 3: Admit Cards | `saveAdmitCardSettings`, `toggleAdmitCardHold`, `releaseAdmitCardHold` | `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `ACCOUNTANT` |
| `actions/marksActions.ts` | Stage 4: Marks Entry & Locking | `saveMarkEntries`, `lockMarks`, `unlockMarks` | `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL` (`TEACHER` permitted for `saveMarkEntries` only) |
| `actions/resultActions.ts` | Stage 5 & 6: Results, Freezing & Certs | `createReportCardSetup`, `publishResults`, `configureResultSettings`, `setResultHold`, `generateResultSnapshots`, `issueTopperCertificate` | `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL` |
| `actions.ts` | Facade & Legacy Re-exports | Re-exports all modular actions + `lockExam`, `unlockExam`, `generateMeritList` | Per-action guards |

---

## 3. Teacher Boundary & RBAC Enforcement

### 3.1 Teacher Role Mutation Matrix
- **`createExam`**: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`. `TEACHER` throws `HTTP 403 Forbidden: Insufficient permissions for exam.setup.manage`.
- **`createExamSchedule`**: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`. `TEACHER` throws `HTTP 403 Forbidden: Insufficient permissions for exam.schedule.manage`.
- **`saveAdmitCardSettings`**: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`, `ACCOUNTANT`. `TEACHER` throws `HTTP 403 Forbidden`.
- **`publishResults`**: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`. `TEACHER` throws `HTTP 403 Forbidden`.
- **`saveMarkEntries`**: `TEACHER` allowed **only if** `assertTeacherTeaches` confirms class/section/subject assignment:
  ```ts
  if (ctx.role === "TEACHER") {
    const isAssigned = await assertTeacherTeaches({
      teacherId: ctx.userId,
      schoolId: school.id,
      role: ctx.role,
      classId: input.classId,
      subjectId: input.subjectId,
      ...(input.sectionId ? { sectionId: input.sectionId } : {}),
    });
    if (!isAssigned) {
      return {
        success: false,
        message: "Unauthorized: You are not assigned to grade this class and subject.",
      };
    }
  }
  ```

---

## 4. Verification Evidence

### 4.1 Type-Check Across Monorepo
Executed: `pnpm type-check`
```
• turbo 2.10.4
   • Packages in scope: @schoolmitra/backend, @schoolmitra/database, @schoolmitra/domain-events, @schoolmitra/dpdp, @schoolmitra/frontend, @schoolmitra/validators, eslint-plugin-schoolmitra
   • Running type-check in 7 packages

 Tasks:    6 successful, 6 total
Cached:    5 cached, 6 total
  Time:    11.881s
```
**Verdict**: 0 type errors across all 6 workspace packages.

### 4.2 Unit Tests (`examActions.test.ts`)
Executed: `pnpm --filter @schoolmitra/frontend test "src/app/(admin)/exams/actions/__tests__/examActions.test.ts"`
```
 ✓ src/app/(admin)/exams/actions/__tests__/examActions.test.ts  (7 tests) 5ms
   ✓ Exam Server Actions RBAC & Teacher Scoping > Teacher cannot create exam (throws 403)
   ✓ Exam Server Actions RBAC & Teacher Scoping > Teacher cannot publish exam schedule (throws 403)
   ✓ Exam Server Actions RBAC & Teacher Scoping > Teacher cannot manage admit cards (throws 403)
   ✓ Exam Server Actions RBAC & Teacher Scoping > Teacher cannot publish results (throws 403)
   ✓ Exam Server Actions RBAC & Teacher Scoping > Teacher cannot lock marks (throws 403)
   ✓ Exam Server Actions RBAC & Teacher Scoping > Teacher can enter marks for assigned subject
   ✓ Exam Server Actions RBAC & Teacher Scoping > Teacher cannot enter marks for unassigned subject

 Test Files  1 passed (1)
      Tests  7 passed (7)
```
**Verdict**: All 7 RBAC and teacher mutation boundaries verified.
