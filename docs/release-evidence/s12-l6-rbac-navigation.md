# S12 Layer 6 Evidence: RBAC Permissions, Principal View-Only Enrollments & Section Resolution

**Spec**: `edu-core-s12-exam-wiring-integrity-flaw-closure@12.0.0`
**Layer**: 6 — RBAC Permissions & Navigation Matrix Resolution (Flaws F8, F9)
**Commit Date**: 2026-10-15
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0` + `RULES.md` (Rule Zero PF-R00)

---

## 1. Executive Summary

In baseline HEAD `a37fa74`, elective enrollment and RBAC matrix navigation had two notable flaws:
1. **Privilege Escalation on Elective Enrollments (F8)**: `enrollmentEngine.ts` guarded mutations with `exam.setup.manage`. However, `examPermissions.ts` grants `exam.setup.manage` to `PRINCIPAL`, while deliberately excluding `exam.enrollments.manage` from the `PRINCIPAL` role (`ALL_EXAM_PERMISSIONS.filter((p) => p !== "exam.enrollments.manage")`). This mismatch allowed principals to modify student enrollments and execute bulk backfills contrary to the organizational permission model.
2. **Missing Section Name Resolution in Matrix Grid (F9)**: `getClassEnrollmentMatrix` hardcoded `sectionName: null` for all students, leaving the UI table unable to differentiate student sections in multi-section classes.
3. **Unprotected Enrollment Client Actions**: The client-side enrollment management page rendered active mutation buttons ("Run Mandatory Backfill", "Save All Changes", elective toggle checkboxes, and individual row save buttons) regardless of the user's role permissions.

Layer 6 resolves these issues:
- Replaced permission guards across `assignStudentElectives`, `bulkAssignElectiveBySection`, and `backfillMandatoryEnrollments` with `exam.enrollments.manage`.
- Replaced direct `db` queries with `withTenant(schoolId, ...)` to satisfy fail-closed RLS on all tenant tables under Migration 0041.
- Updated `getClassEnrollmentMatrix` to query `sections` for the class and map each student's `currentSectionId` to their resolved `sectionName`.
- Updated `page.tsx` to compute `canManage = hasExamPermission(ctx.role, "exam.enrollments.manage")` and pass it to `EnrollmentClient`.
- In `EnrollmentClient.tsx`:
  - When `canManage === false`, replaces mutation buttons with a `Read-Only Mode` badge, disables elective toggles with non-interactive badges, and hides the row "Action" column and "Save" buttons.
  - Displays `st.sectionName` in each student row: `Adm: {st.admissionNumber} • Sec: {st.sectionName} • Roll: {st.rollNumber}`.

---

## 2. Changes Implemented

### 2.1 Engine Guard Hardening & Section Resolution (`backend/src/lib/enrollmentEngine.ts`)
- Switched permission guard from `exam.setup.manage` to `exam.enrollments.manage`.
- Added section mapping in `getClassEnrollmentMatrix`:
```typescript
const classSections = await scopedDb.query.sections.findMany({
  where: and(eq(sections.classId, classId), eq(sections.schoolId, schoolId)),
});
const sectionMap = new Map<string, string>();
for (const sec of classSections) {
  sectionMap.set(sec.id, sec.name);
}
...
sectionName: st.currentSectionId ? sectionMap.get(st.currentSectionId) ?? null : null,
```
- Wrapped all mutation and query routines in `withTenant(schoolId, async (scopedDb) => { ... })`.

### 2.2 Server Component & Route Guard (`frontend/src/app/(admin)/exams/setup/enrollments/page.tsx`)
```typescript
const canManage = hasExamPermission(ctx.role, "exam.enrollments.manage");
...
<EnrollmentClient
  classes={data.classes}
  sections={data.sections}
  canManage={canManage}
/>
```

### 2.3 Client UI Adaptive Controls (`frontend/src/app/(admin)/exams/setup/enrollments/EnrollmentClient.tsx`)
- Props accepts `canManage?: boolean`.
- Top action bar renders `Read-Only Mode` shield badge when `!canManage`.
- Renders `st.sectionName` alongside admission number and roll number.
- Table elective pills render as non-interactive status badges for read-only roles.
- Action column and Save buttons hidden when `!canManage`.

---

## 3. Test Evidence

### 3.1 Unit & Integration Test Suite (`backend/src/lib/__tests__/examEnrollments.test.ts`)
```
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/examEnrollments.test.ts (7 tests) 386ms
   ✓ 1.1: backfillMandatoryEnrollments creates ACTIVE records for non-electives
   ✓ 1.2: assignStudentElectives enrolls student in elective with ACTIVE status
   ✓ 1.3: resolveEffectiveSubjects renders enrolled elective with real marks and unenrolled with dash sentinel
   ✓ 1.4: getClassEnrollmentMatrix returns full class roster with accurate elective state & resolved sectionName
   ✓ 1.5: Cross-tenant isolation probe: School A admin cannot mutate School B student enrollments
   ✓ 1.6: Idempotent backfill preserves existing elective assignments on re-run
   ✓ 1.7: PRINCIPAL role fails closed on enrollment modification (requires exam.enrollments.manage)

 Test Files  1 passed (1)
      Tests  7 passed (7)
```

### 3.2 Permission Matrix Verification (`backend/src/lib/__tests__/examPermissions.test.ts`)
```
 ✓ src/lib/__tests__/examPermissions.test.ts (10 tests) 7ms
   ✓ PRINCIPAL role includes all exam permissions EXCEPT exam.enrollments.manage
   ✓ SCHOOL_ADMIN and SUPER_ADMIN have full exam permissions including exam.enrollments.manage
```

### 3.3 Strict TypeScript Verification
- Backend `tsc --noEmit`: Exit code 0 (Clean).
- Frontend `tsc --noEmit`: Exit code 0 (Clean).

---

## 4. Rule Zero Verification
- No regression on existing exam or attendance suites.
- All database operations execute under tenant-isolated contexts (`withTenant`).
- Fail-closed permission checking strictly enforced on server action layer and domain engine layer.
