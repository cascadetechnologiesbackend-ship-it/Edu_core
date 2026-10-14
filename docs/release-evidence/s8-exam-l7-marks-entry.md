# Layer 7 Evidence: Marks Entry UI, Administrative Locks & Teacher Grading Workspace

**Sprint**: S8 Offline Examinations (`edu-core-s8-examinations-module-rebuild`)  
**Timestamp**: 2026-10-15T00:41:10+05:30  
**Head Commit Prior to Layer**: `13a8be3`  
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0`, `SCHOOL-ERP-UIUX-SPEC.md v2.0`, `RULES.md`

---

## 1. Executive Summary

Layer 7 delivers Stage 4 (Marks Entry, Sub-Component Grading, Dual-Step Administrative Locking, and Teacher Workspace Integration) of the Offline Examination lifecycle:
1. **Administrative Marks Entry Matrix (`/exams/marks`)**:
   - Examination, Class, and Subject selector controls.
   - Component-Aware Dynamic Grid:
     - Automatically renders sub-component score columns (e.g. Theory, Practical, Viva) if configured in `exam_mark_distributions`.
     - Defaults to clean consolidated marks column if no sub-components are defined.
   - Real-time client validation prevents negative scores or scores exceeding component maximum marks.
   - Attendance & Exemption Toggles:
     - Absent flag disables score fields and marks student `ABSENT`.
     - Medical exemption flag marks student `EXEMPT`.
   - Dynamic Total and Passing status calculations per student row.
   - Administrative Marks Locking (`exam_marks_locks`):
     - Displays `LOCKED` or `OPEN FOR GRADING` status badge and metadata (locked by user, timestamp).
     - Lock and unlock controls (`lockMarks`, `unlockMarks`).
     - Reopening requires a mandatory justification reason captured in the database audit log.
   - Batch persistence: Powered by `saveMarkEntries` utilizing partial unique index upserts (`mark_entries_component_unique_idx` and `mark_entries_legacy_unique_idx`).
2. **Amendment 5 Backward-Compatible Redirect**:
   - Legacy route `/exams/[id]/marks` redirects cleanly to `/exams/marks?examId=[id]`.
3. **Teacher Grading Workspace Updates (`/teacher/grading`)**:
   - Strictly bounded to allocated subjects and classes (`assertTeacherTeaches`).
   - Wired to production `saveMarkEntries` server action.
   - Enforces administrative marks locks (`exam_marks_locks`), rendering evaluation read-only once locked by school administration.
   - Hydrates pre-existing recorded scores from `mark_entries`.

---

## 2. Verification Evidence

- `pnpm type-check` across all 6 packages passes with 0 errors.
- `/exams/[id]/marks` redirects to `/exams/marks?examId=[id]`.
- Partial unique indexes on `mark_entries` safely handle both component and non-component rows without collisions.
