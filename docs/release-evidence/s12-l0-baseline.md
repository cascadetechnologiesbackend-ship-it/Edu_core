# Sprint S12 Release Evidence: Layer 0 Pre-flight, Schema Probes & Flaw Confirmation

**Sprint:** S12 (`edu-core-s12-exam-wiring-integrity-flaw-closure`)  
**Version:** `12.0.0`  
**Layer:** Layer 0 — Pre-flight, Schema Probes, and Flaw Confirmation  
**Date:** 2026-10-15  
**Baseline HEAD:** `98f16d6f449ed81c32ca6ac9ce276ba01d3d612d`  
**Parent Release:** `v11.0.0` (`edu-core-s11-exam-cross-module-integration`)  
**Verdict:** **PASS (Baseline Verified & Flaws Proven)**

---

## 1. Baseline Environment & Journal Verification

1. **Git State:**
   - Commit: `98f16d6f449ed81c32ca6ac9ce276ba01d3d612d`
   - Git Tag: `v11.0.0`
   - Monorepo clean status confirmed: zero untracked files in master tree prior to Layer 0.

2. **Drizzle Migration Ledger & Journal Status (`database/src/migrations/meta/_journal.json`):**
   - Verified entries 0 to 39 present with strictly monotonic timestamps (`1783958891444` -> `1793500000000`).
   - Latest 5 migrations in journal:
     - `idx: 35`: `0035_examinations_enum_and_alterations` (`when: 1793100000000`)
     - `idx: 36`: `0036_examinations_new_tables` (`when: 1793200000000`)
     - `idx: 37`: `0037_board_exam_blueprint` (`when: 1793300000000`)
     - `idx: 38`: `0038_usage_events_telemetry` (`when: 1793400000000`)
     - `idx: 39`: `0039_student_subject_enrollments` (`when: 1793500000000`)
   - **Next migration index:** `idx: 40`, Tag: `0040_exam_integrity_closure`, Target timestamp: `1793600000000`.

---

## 2. Live Database Schema Probes

Empirical queries executed against local PostgreSQL instance (`5444/schoolmitra_erp`):

### 2.1 `mark_entries` Schema & Data Inspection
- **Columns & Nullability (`information_schema.columns`):**
  - `id`: `uuid`, `NOT NULL`, default `gen_random_uuid()`
  - `school_id`: `uuid`, `NOT NULL`
  - `exam_id`: `uuid`, `NOT NULL`
  - `student_id`: `uuid`, `NOT NULL`
  - `subject_id`: `uuid`, `NOT NULL`
  - `component_id`: `uuid`, `NULLABLE`
  - `marks_obtained`: `numeric`, `NULLABLE`
  - `max_marks`: `numeric`, `NOT NULL`, default `NULL` in catalog (legacy created pre-0035 with 100 default)
  - `practical_marks`: `numeric`, `NULLABLE`
  - `practical_max_marks`: `numeric`, `NULLABLE`
  - `is_absent`: `boolean`, `NOT NULL`, default `false`
  - `is_medical_exempt`: `boolean`, `NOT NULL`, default `false`
  - `is_practical_absent`: `boolean`, `NOT NULL`, default `false`
- **Data Distribution:**
  - Total existing rows: `1,201`
  - Rows with `max_marks = 100.00`: `1,201` (100%)
  - Rows with `max_marks IS NULL`: `0`
  - **Empirical Finding for Flaw F1:** Because `saveMarkEntries` omits `max_marks` from its SQL `INSERT`, every row written relies on the legacy 100.00 ceiling. When an exam paper is 50, 80, or 25 marks, or when components (Theory 80 / Practical 20) are entered, rows are evaluated against 100.00 ceiling, producing false failures or wrong grades.

### 2.2 `schools` Schema & Timezone Inspection
- Columns: `id`, `name`, `board`, `udise_code`, `address`, `city`, `state`, `pincode`, `phone`, `email`, `principal_name`, `logo_s3_key`, `established_year`, `is_active`, `feature_flags`, `subscription_tier`, `subscription_expires_at`, `created_at`, `updated_at`, `deleted_at`, `slug`, `status`, `school_type`, `suspension_reason`, `provisioning_manifest`, `website`, `motto`, `about`, `social_handles`, `theme_colors`.
- **Finding:** No dedicated `timezone` column exists on `schools`. All schools are Indian schools (UDISE, State/CBSE boards). Canonical IANA timezone is `Asia/Kolkata` (IST, UTC+05:30). Layer 4 will default to `Asia/Kolkata` for quiet hours computation.

### 2.3 Portal Result Read Path Inspection
- Analyzed:
  - `frontend/src/app/(parent)/portal/report-cards/page.tsx`
  - `frontend/src/app/s/[slug]/results/lookup/route.ts`
- **Finding for Flaw F11:** Portal reads query `resultSnapshots` directly and reimplement visibility logic inline (`!isWithheld && !isScheduled && !isHold && !isHardFeeBlocked`), omitting calls to `gradeEngine.resolveResultVisibility`. Layer 8 will align these read paths.

### 2.4 Daily Attendance Percentage Consumers
- Analyzed:
  - `frontend/src/app/(admin)/dashboard/page.tsx` (line 512)
  - `frontend/src/app/(parent)/parent/dashboard/page.tsx` (line 213)
  - `frontend/src/app/(student)/student/dashboard/page.tsx` (line 120)
- **Finding for Flaw F7:** None of these consumer views filter `source = 'EXAM'`. An exam-day absence currently double-counts against general daily attendance rates. Layer 5 will exclude `source = 'EXAM'` from daily calculations per Open Decision D2.

---

## 3. Baseline Flaw Capture Tests (`s12FlawCaptures.test.ts`)

A dedicated test suite was constructed and executed to prove the three P0 flaws on HEAD `98f16d6`:

```
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/s12FlawCaptures.test.ts (3 tests) 79ms
   ✓ Flaw F1: NaN maxMarks silent failure (proves parseFloat(null) yields NaN and calculateGrade produces 'E' without throwing)
   ✓ Flaw F2: Unenrolled elective subjects drag students into failure (proves un-enrolled elective gets 0 marks and 'E' grade)
   ✓ Flaw F6: Quiet-hours clock uses server-local / UTC time (proves 22:30 IST / 17:00 UTC evaluates as false in UTC)

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

---

## 4. Layer 0 Exit Gate

- [x] Baseline HEAD `98f16d6` confirmed.
- [x] Journal entries 0-39 verified; next migration confirmed as `0040`.
- [x] Schema columns, defaults, nullabilities probed and documented.
- [x] P0 flaws captured and proved via test suite.
- [x] Ready to proceed to Layer 1 (Marks Entry Hardening & max_marks Population).
