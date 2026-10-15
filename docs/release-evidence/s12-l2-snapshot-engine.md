# S12 Layer 2 Evidence: Enrollment-Aware, Distribution-Backed Result Snapshots

**Spec**: `edu-core-s12-exam-wiring-integrity-flaw-closure@12.0.0`
**Layer**: 2 — Result Snapshot Engine & Elective Enrollment Enforcement
**Commit Date**: 2026-10-15
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0` + `RULES.md` (Rule Zero PF-R00)

---

## 1. Executive Summary

In baseline HEAD `98f16d6`, `generateResultSnapshots` looped over all class subjects indiscriminately without querying `student_subject_enrollments`. As a result, students who did not choose an elective subject (e.g. Music, Computer Science) were assigned `0` marks and grade `"E"`, dragging them into false compartments or failure. Furthermore, `isAbsent` and `isMedicalExempt` flags were hardcoded to `false` during snapshot creation, and grade rules were resolved solely by `classId` without class-group fallback. Finally, existing snapshot checks were executed in an N+1 sequential loop across all students.

Layer 2 closes Flaws F2, F3, F4, and F5 completely:
1. Filters subjects against active elective enrollments in `student_subject_enrollments`. Unenrolled electives receive `grade: UNENROLLED_SENTINEL` (`"-"`) and are excluded from fail/compartment counts and totals.
2. Flows `isAbsent` and `isMedicalExempt` from `mark_entries` into `calculateGrade` to produce legitimate `"AB"` and `"ME"` sentinels.
3. Implements unified grade rule resolution in `backend/src/lib/gradeRuleResolver.ts` (`classId` -> `classGroup` -> CBSE default).
4. Aggregates components via `calculateComponentMarks` when components exist, eliminating double-counting.
5. Replaces N+1 snapshot lookups with a single indexed batch query.

---

## 2. Changes Implemented

### 2.1 Unified Grade Rule Resolver (`backend/src/lib/gradeRuleResolver.ts`)
- Created `resolveGradeRules(schoolId, classId, classGroup, dbOrTx)`:
  1. Checks `grade_rules WHERE school_id = :schoolId AND class_id = :classId`.
  2. Falls back to `grade_rules WHERE school_id = :schoolId AND class_group = :classGroup`.
  3. Falls back to `getCBSEDefaultRules()`.
- Exported `gradeToClassGroup(gradeLevel)` for pure grade level mapping (eliminating the need to import React JSX from `ReportCardPDF.tsx` in backend workers).

### 2.2 Hardened Snapshot Generation (`frontend/src/app/(admin)/exams/actions/resultActions.ts`)
1. **Elective Enrollment Enforcement:**
   - Queries `student_subject_enrollments` for `(schoolId, studentIds, enrollmentStatus = 'ACTIVE', isElectiveTaken = true)`.
   - For an elective subject where student is not enrolled:
     ```typescript
     {
       subjectId: sub.id,
       subjectName: sub.name,
       subjectCode: sub.code ?? null,
       totalObtained: 0,
       totalMax: 0,
       percent: 0,
       grade: UNENROLLED_SENTINEL, // "-"
       gradePoint: 0,
       isPassed: true, // Excluded from failure penalty
     }
     ```
2. **Component Marks Aggregation:**
   - Queries `exam_mark_distributions` and `exam_components`.
   - If component entries exist for `(student, subject)`, aggregates Theory + Practical via `calculateComponentMarks(components, 33)`.
3. **Absenteeism and Medical Exemption Sentinels:**
   - Flows `isAbsent` and `isMedicalExempt` flags from `mark_entries` into `calculateGrade`.
   - Produces `"AB"` (failed, 0 grade points) and `"ME"` (exempted, not penalized).
4. **Batch Snapshot Upsert:**
   - Queries existing current snapshots for all students in the class in a single SQL query (`inArray(resultSnapshots.studentId, studentIds)`).
   - O(1) in-memory lookup replaces N+1 round-trips.

---

## 3. Automated Verification & Test Results

### 3.1 Unit Tests (`backend/src/lib/__tests__/resultSnapshotIntegrity.test.ts`)
```
✓ src/lib/__tests__/resultSnapshotIntegrity.test.ts (10 tests)
  ✓ gradeToClassGroup: maps kindergarten, 1-5, 6-8, 9-10, 11-12
  ✓ resolveGradeRules: returns class-specific rules when present
  ✓ resolveGradeRules: falls back to CBSE default rules when empty
  ✓ buildResultSnapshotPayload: excludes unenrolled electives from failure/compartment counts and totals (totalMax = 200, NOT 300)
  ✓ calculateGrade: handles absent ("AB") and medical exempt ("ME") flags without throwing
  ✓ calculateComponentMarks: aggregates components correctly (88/100, isPassed: true)
```

### 3.2 Full Typecheck
- Verified via `pnpm type-check` across all 7 packages.
