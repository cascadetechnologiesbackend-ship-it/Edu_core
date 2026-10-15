# S12 Layer 1 Evidence: Marks Entry Hardening & max_marks Integrity

**Spec**: `edu-core-s12-exam-wiring-integrity-flaw-closure@12.0.0`
**Layer**: 1 — Marks entry hardening and max_marks population
**Commit Date**: 2026-10-15
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0` + `RULES.md` (Rule Zero PF-R00)

---

## 1. Executive Summary

In baseline HEAD `98f16d6`, `saveMarkEntries` inserted rows into `mark_entries` omitting `max_marks` and `passing_marks`. Because `mark_entries.max_marks` was declared `numeric NOT NULL DEFAULT 100.00` in the legacy schema, every exam paper saved through the UI was assigned a hardcoded `100.00` ceiling regardless of the actual distribution or schedule specification (e.g. 50-mark, 25-mark, or 80-mark papers were graded against 100). Furthermore, `calculateGrade` did not reject non-finite numbers (`NaN <= 0` is false), causing `parseFloat(null)` to silently grade students as `E`. Finally, `saveMarkEntries` accepted raw arrays without bounds validation, class membership checks, elective enrollment verification, or batch size caps.

Layer 1 closes Flaw F1 and Flaw F8 end to end.

---

## 2. Changes Implemented

### 2.1 Database Schema & Migration 0040 (`database/src/migrations/0040_exam_integrity_closure.sql`)
1. **Migration 0040** registered in `database/src/migrations/meta/_journal.json` at monotonic timestamp `1793600000000` (idx: 40).
2. Added `exam_schedule_id` and `exam_span_source_id` columns with partial unique indexes to `academic_calendar_events` (for Layer 7 structural idempotency).
3. Backfilled `mark_entries.max_marks` for all existing rows using the hierarchical fallback chain:
   ```sql
   UPDATE mark_entries m
   SET max_marks = COALESCE(
     (SELECT d.max_marks FROM exam_mark_distributions d WHERE d.exam_id = m.exam_id AND d.subject_id = m.subject_id AND d.component_id IS NOT DISTINCT FROM m.component_id LIMIT 1),
     (SELECT s.max_marks FROM exam_schedules s WHERE s.exam_id = m.exam_id AND s.subject_id = m.subject_id LIMIT 1),
     (SELECT sub.max_marks FROM subjects sub WHERE sub.id = m.subject_id LIMIT 1),
     100.00
   );
   ```
4. Applied migration locally via `pnpm --filter @schoolmitra/database run db:migrate` with exit code 0.

### 2.2 Fail-Fast Engine Guards (`backend/src/lib/gradeEngine.ts`)
Hardened `calculateGrade` against non-finite or non-positive `maxMarks` and `practicalMaxMarks`:
```typescript
if (typeof input.maxMarks !== "number" || !Number.isFinite(input.maxMarks) || input.maxMarks <= 0) {
  throw new Error(`Invalid maxMarks: expected positive finite number, received ${input.maxMarks}`);
}
if (input.practicalMaxMarks !== undefined && input.practicalMaxMarks !== null) {
  if (typeof input.practicalMaxMarks !== "number" || !Number.isFinite(input.practicalMaxMarks) || input.practicalMaxMarks <= 0) {
    throw new Error(`Invalid practicalMaxMarks: expected positive finite number, received ${input.practicalMaxMarks}`);
  }
}
```

### 2.3 Hardened Marks Entry (`frontend/src/app/(admin)/exams/actions/marksActions.ts`)
1. **Zod Validation Schema (`saveMarkEntriesSchema`)**:
   - UUID validation on `examId`, `classId`, `subjectId`, `studentId`, `componentId`.
   - `marksObtained` validated to be non-negative.
   - Batch size hard-capped at 500 entries per request.
2. **Distribution-Backed Ceilings**:
   - Fetches `exam_mark_distributions` for `(examId, subjectId, componentId)`.
   - Falls back to `exam_schedules` -> `subjects` -> default `100.00/33.00`.
   - Populates `max_marks` and `passing_marks` on every inserted and updated row in `mark_entries`.
3. **Integrity Checks**:
   - Verifies all student IDs are actively enrolled in `input.classId` via `student_enrollments`.
   - Verifies elective subject enrollments via `student_subject_enrollments` when `subject.isElective` is true.
   - Rejects out-of-bounds marks (`marksObtained > distributionMaxMarks`) unless `isAbsent` or `isMedicalExempt`.
   - Returns structured accept/reject summary with individual reasons.

---

## 3. Automated Verification & Test Results

### 3.1 Flaw Inversion Test (`backend/src/lib/__tests__/s12FlawCaptures.test.ts`)
```
✓ src/lib/__tests__/s12FlawCaptures.test.ts (3 tests)
  ✓ Flaw F1: calculateGrade throws "Invalid maxMarks: expected positive finite number" on NaN/null
  ✓ Flaw F2: Unenrolled elective baseline capture
  ✓ Flaw F6: Quiet-hours clock UTC vs IST capture
```

### 3.2 Marks Integrity Unit Test (`backend/src/lib/__tests__/marksIntegrity.test.ts`)
```
✓ src/lib/__tests__/marksIntegrity.test.ts (5 tests)
  ✓ validates well-formed payload with present student
  ✓ rejects negative marks obtained
  ✓ rejects batches larger than 500 entries (DoS guard)
  ✓ allows null marksObtained when student is absent or exempt
  ✓ enforces distribution bounds check (marks <= maxMarks unless absent)
```

### 3.3 Typecheck
- `pnpm type-check`: All 6 packages typecheck cleanly with 0 errors.
