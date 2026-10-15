# S11 Layer 1 Evidence: Student Subject & Elective Enrollment Foundation

**Spec**: edu-core-s11-exam-cross-module-integration (v11.0.0)  
**Layer**: 1 — Student Subject & Elective Enrollment Foundation  
**Date**: 2026-10-15  
**Git Branch**: `main`  

---

## 1. Overview & Data Gap Resolution
Prior to S11, `classSubjects.isElective` marked whether a subject was elective for an entire class, but no table recorded student-level elective enrollments. Grade calculation and marks entry assumed whole-class cohorts, risking erroneous zero-marks or missing enrollments.

Layer 1 definitively resolves this gap:
1. **Database Migration (`0039_student_subject_enrollments.sql`)**:
   - Creates `student_subject_enrollments` table with fields `id`, `school_id`, `student_id`, `class_subject_id`, `is_elective_taken`, `enrollment_status`, `enrolled_at`, `updated_at`.
   - Adds unique constraint `unique(student_id, class_subject_id)` plus partial index for single active enrollment per pair.
   - Adds `source` (`DEFAULT 'MANUAL'`) and `exam_schedule_id` to `student_attendance` (preparing for Layer 2 sync).
   - Adds `sms_notifications_enabled` to `result_settings` (preparing for Layer 3 communication toggle).
   - Idempotent migration backfill: For every existing active student in a class, creates `ACTIVE` enrollment records for all mandatory (`is_elective = false`) class subjects, leaving electives unassigned until school admin assignment.
2. **Drizzle Schema & Typed Enums**:
   - `enrollmentStatusEnum` (`ACTIVE`, `DROPPED`, `COMPLETED`).
   - `studentSubjectEnrollments` schema in `database/src/schema/academics.ts` with bi-directional relations to students, classSubjects, and school.
3. **Grade Engine Dash Sentinel (`"-"`)**:
   - Updated `resolveEffectiveSubjects` in `backend/src/lib/gradeEngine.ts`: Unenrolled elective subjects are resolved into `unenrolledSubjects` carrying the `"-"` (`UNENROLLED_SENTINEL`) grade sentinel, cleanly excluded from percentage and max-marks computation so unenrolled students are not penalized.
4. **Enrollment Engine (`backend/src/lib/enrollmentEngine.ts`)**:
   - `getStudentSubjectEnrollments(schoolId, studentId)`: Fetches active enrollments.
   - `getClassEnrollmentMatrix(schoolId, classId)`: Renders full roster with mandatory checkmarks and elective toggle statuses.
   - `assignStudentElectives(schoolId, studentId, assignments, ctx)`: Atomically updates student elective choices with audit logging.
   - `bulkAssignElectiveBySection(schoolId, sectionId, classSubjectId, isTaken, ctx)`: Rapid bulk assignment across entire section.
   - `backfillMandatoryEnrollments(schoolId)`: Re-runnable idempotent backfill for newly provisioned schools.
5. **RBAC Matrix Registration & Page Route Audit**:
   - Added `exam.enrollments.manage` permission (assigned to `SUPER_ADMIN` and `SCHOOL_ADMIN`; `PRINCIPAL` excluded).
   - Created `/exams/setup/enrollments` under `assertRouteAccess` and guarded with `requireExamPermission(ctx, "exam.enrollments.manage")`.
   - Audited with `scripts/audit-exam-rbac.mjs` (0 errors across 18 routes and 8 action files).

---

## 2. Test Execution Evidence

### Vitest Unit & Integration Suite (`src/lib/__tests__/examEnrollments.test.ts`)
```
✓ src/lib/__tests__/examEnrollments.test.ts (6 tests)
  ✓ 1.1: backfillMandatoryEnrollments creates ACTIVE records for non-electives and leaves electives unassigned
  ✓ 1.2: assignStudentElectives successfully toggles elective choice for a student
  ✓ 1.3: gradeEngine resolveEffectiveSubjects renders dash sentinel "-" for unenrolled electives without penalty
  ✓ 1.4: getClassEnrollmentMatrix returns full class roster with accurate elective state
  ✓ 1.5: Cross-tenant isolation probe: School A admin cannot mutate School B student enrollments
  ✓ 1.6: Idempotent re-run of backfill does not duplicate records or overwrite elective choices
```

### RBAC Permissions Audit (`examPermissions.test.ts`)
```
✓ src/lib/__tests__/examPermissions.test.ts (10 tests)
  ✓ SCHOOL_ADMIN has all 13 permissions
  ✓ PRINCIPAL has 12 permissions (all except exam.enrollments.manage)
  ✓ TEACHER has ONLY exam.marks.entry per Amendment 2
```

### RBAC Static AST Guard (`scripts/audit-exam-rbac.mjs`)
```
Auditing 8 examination server action files for requireExamPermission guards...
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/enrollmentActions.ts -> assignStudentElectivesAction()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/enrollmentActions.ts -> bulkAssignSectionElectiveAction()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/enrollmentActions.ts -> runMandatoryBackfillAction()
  ✓ [READ / QUERY]       frontend/src/app/(admin)/exams/actions/enrollmentActions.ts -> getEnrollmentMatrixAction()
Auditing 18 examination routes for assertRouteAccess & session checks...
  ✓ [PROTECTED ROUTE]    frontend/src/app/(admin)/exams/setup/enrollments/page.tsx
✅ ALL EXAMINATION RBAC GUARDS, ACTIONS & ROUTES VERIFIED (0 ERRORS)
```

---

## 3. Cross-Tenant Isolation Verification
- Tested in `1.5`: `assignStudentElectives` called with School A context targeting a student belonging to School B is rejected fail-closed with `Forbidden: Student does not belong to this school`.
- All database queries enforce strict `eq(studentSubjectEnrollments.schoolId, schoolId)`.

---

## 4. Conclusion
Layer 1 is complete, verified, and adheres to all architectural constraints.
Ready for Layer 2: Exam Attendance Sync.
