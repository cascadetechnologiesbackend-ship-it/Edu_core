# Layer 5 Evidence: Schedule & Mark Distributions UI

**Sprint**: S8 Offline Examinations (`edu-core-s8-examinations-module-rebuild`)  
**Timestamp**: 2026-10-15T00:26:00+05:30  
**Head Commit Prior to Layer**: `8d53a75`  
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0`, `SCHOOL-ERP-UIUX-SPEC.md v2.0`, `RULES.md`

---

## 1. Executive Summary

Layer 5 delivers Stage 2 (Timetables, Datesheets & Component Mark Distributions) of the Offline Examination lifecycle:
1. **Flat Route Architecture (`/exams/schedule`)**:
   - Examination switcher dropdown (persisted via `?examId=...` query param).
   - Class filter dropdown for quick section-level timetable isolation.
   - Timetable Cards / Table displaying: Exam Date, Start Time, Duration in minutes, Class, Subject (Name + Code), Maximum Marks, Passing Criteria, Room / Hall number, and Portal Publication badge.
   - Interactive Modal Forms:
     - **Add Schedule**: Modal supporting date, start time, duration, max/passing marks, and optional room allocation.
     - **Mark Distribution**: Per-subject sub-component breakdown modal (mapping sub-components created in Stage 1 to specific passing/max marks via `setMarkDistribution`).
     - **Publish Datesheet**: Batch release action updating `datesheetPublishedAt` and `datesheetPublishedById`, exposing schedules to student and parent portals.
2. **Amendment 5 Backward-Compatible Redirect**:
   - `/exams/[id]` permanently redirects to `/exams/schedule?examId=[id]`.
3. **Performance & Compliance**:
   - Database queries scoped under `< 6` queries per request using `withDataPhaseTiming` and `assertQueryBudget`.
   - Strict typing across frontend and backend actions.

---

## 2. Verification Evidence

- `pnpm type-check` across all 6 packages passes with 0 errors.
- `/exams/[id]` redirects cleanly to `/exams/schedule?examId=[id]`.
