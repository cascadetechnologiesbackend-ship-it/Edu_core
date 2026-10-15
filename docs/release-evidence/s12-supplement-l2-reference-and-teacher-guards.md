# Sprint S12.1 Layer 2: Reference & Teacher Authorization Guards Evidence

- **Specification**: `edu-core-s12-supplemental-security-and-release-closure` (v12.1.0)
- **Defects Closed**: 
  - `SEC-AUTH-002` (P0: `assertTeacherTeaches` broad fallback permitted teachers to access any class/subject in the school)
  - `SEC-REF-004` (P1: `createExam` lacked `examTypeId` ownership validation, duplicate class check, and atomic scope creation)
- **Files Modified**:
  - `backend/src/lib/examPermissions.ts`
  - `frontend/src/app/(admin)/exams/actions/setupActions.ts`
  - `backend/src/lib/__tests__/examSecurityGuards.test.ts`
- **Date**: 2026-10-15
- **Status**: CLOSED & VERIFIED (PASS)

---

## 1. Remediation Details

### 1.1 SEC-AUTH-002: Teacher Assignment Strict Scoping
- **Removed Broad Fallback**: In `backend/src/lib/examPermissions.ts`, the permissive query checking whether a teacher has *any* assignment in the school was completely eliminated.
- **Fail-Closed Context**: Teacher operations without explicit `classId` and `subjectId` parameters fail closed (`return false`).
- **Exact Assignment Verification**:
  1. Checks direct `classSubjects` matching `schoolId`, `classId`, `subjectId`, and `assignedTeacherId`.
  2. If `sectionId` is provided, resolves the corresponding `classSubject` record and checks active entry in `sectionSubjectTeachers` matching `classSubjectId`, `sectionId`, `teacherId`, and `isActive: true`.
  3. All database errors and missing records fail closed (`return false`).
- **Administrative Bypass Preserved**: Roles `SUPER_ADMIN`, `SCHOOL_ADMIN`, and `PRINCIPAL` maintain school-wide operational access.

### 1.2 SEC-REF-004: Exam Creation Reference Integrity
- **Exam Type Validation**: `createExam` verifies `examTypeId` against `examTypes` matching the server-derived `school.id`. Foreign exam types are rejected with `{ examTypeId: ["Exam type not found or does not belong to this school"] }`.
- **Duplicate Class Rejection**: Submitted `classIds` are checked for uniqueness; duplicate IDs are rejected with `{ classIds: ["Duplicate class IDs submitted"] }`.
- **Class Scope Ownership**: Every `classId` is validated against `classes` matching `school.id` and `deletedAt IS NULL`.
- **Atomic Transaction Boundary**: The `exams` row insert and `examClassScopes` junction inserts are wrapped in `db.transaction(...)`. A failure during scope creation or relationship validation rolls back the exam creation, ensuring no orphaned exam shells are left in the database.
- **Auxiliary Setup Mutations**:
  - `createExamComponent`: verifies `examId` and `examTypeId` ownership with `school.id`.
  - `deleteExamComponent`: verifies component belongs to `school.id`.
  - `saveCocurricularGrade`: verifies `examId`, `studentId`, and `areaId` belong to `school.id`.
  - `saveClassSpecificGradeRule`: verifies `classId` belongs to `school.id`.

---

## 2. Empirical Verification Results

### Test Suite: `backend/src/lib/__tests__/examSecurityGuards.test.ts`
- **Tests**: 11 passed, 0 failed
- **Execution Date**: 2026-10-15

| Test Case | Description | Result |
| :--- | :--- | :---: |
| 1.1 | Exact matching active teacher assignment succeeds | **PASS** |
| 1.2 | Teacher assigned to class A / subject A is denied access to class B / subject B in same school | **PASS** |
| 1.3 | Unrelated assignment in same school fails closed (no broad fallback) | **PASS** |
| 1.4 | Cross-tenant: Teacher from school B is denied access to school A exam subject | **PASS** |
| 1.5 | Missing class or subject scope fails closed for teacher operations | **PASS** |
| 1.6 | Missing teacherId or schoolId fails closed | **PASS** |
| 1.7 | School admin and Principal retain school-wide evaluation access | **PASS** |
| 2.1 | Foreign school exam type rejected | **PASS** |
| 2.2 | Foreign school class ID rejected | **PASS** |
| 2.3 | Duplicate class IDs in classIds are rejected | **PASS** |
| 2.4 | Atomic boundary: Partial scope failure leaves no orphaned exam or scope rows | **PASS** |

---

## 3. Verification Checksum
- `pnpm --filter @schoolmitra/backend test -- examSecurityGuards` -> PASS (11/11 tests)
- `pnpm type-check` -> PASS (6/6 packages clean)
- Baseline Flaw Status: `SEC-AUTH-002` -> **CLOSED**
- Baseline Flaw Status: `SEC-REF-004` -> **CLOSED**
