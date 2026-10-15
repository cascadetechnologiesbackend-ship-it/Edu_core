# S11 Layer 0 Evidence: Pre-Flight and Baseline Verification

**Spec ID**: `edu-core-s11-exam-cross-module-integration`  
**Version**: `11.0.0`  
**Date**: October 15, 2026  
**Git HEAD**: `bffd662` (`origin/main`)  
**Database**: PostgreSQL 16 on AWS RDS `ap-south-2`  
**In-Memory / Queue**: Amazon ElastiCache Serverless for Valkey 7.2 (`educore-valkey`)  

---

## 1. Baseline State & Prior Sprint Verification

The pre-flight audit confirms that all prior sprint artifacts (S8 through S10 plus the Valkey cloud migration) are fully executed, committed, pushed to `origin/main`, and verified.

### 1.1 Git Status & Commit Verification
- **Current HEAD**: `bffd662` (`feat(cache): wire Valkey as primary engine in workers, cache, and rate limiters with Redis fallback`)
- **Remote Synchronization**: `origin/main` is identical to local `main` at `bffd662`.
- **Working Tree**: Clean (`git status` reports nothing to commit).

### 1.2 Migration Chain Integrity
Verification of `database/src/migrations/meta/_journal.json` and `pnpm --filter @schoolmitra/database run db:check-migrations`:
```
Auditing 39 migration files in V:\Cascade\Edu_core\Edu_core\database\src\migrations...
✅ All migration sequence numbers are unique and synchronized with journal.
```
- `0035_examinations_enum_and_alterations` (idx 35) ✅
- `0036_examinations_new_tables` (idx 36) ✅
- `0037_board_exam_blueprint` (idx 37) ✅
- `0038_usage_events_telemetry` (idx 38) ✅
- **Confirmed Next Migration Number**: Exactly **`0039`** (`0039_student_subject_enrollments.sql`).

### 1.3 RBAC CI Static Guard
Execution of `node scripts/audit-exam-rbac.mjs`:
```
================================================================================
          S10 EXAMINATION SUBSYSTEM: RBAC CRUD & ROUTE GUARD AUDIT          
================================================================================

Auditing 7 examination server action files for requireExamPermission guards...
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions.ts -> lockExam()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions.ts -> unlockExam()
  ✓ [READ / QUERY]       frontend/src/app/(admin)/exams/actions.ts -> generateMeritList()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/admitCardActions.ts -> saveAdmitCardSettings()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/admitCardActions.ts -> toggleAdmitCardHold()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/admitCardActions.ts -> releaseAdmitCardHold()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/analyticsActions.ts -> generateMeritList()
  ✓ [READ / QUERY]       frontend/src/app/(admin)/exams/actions/analyticsActions.ts -> generateRankSheet()
  ✓ [READ / QUERY]       frontend/src/app/(admin)/exams/actions/analyticsActions.ts -> exportCohortAnalytics()
  ✓ [READ / QUERY]       frontend/src/app/(admin)/exams/actions/marksActions.ts -> saveMarkEntries()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/marksActions.ts -> lockMarks()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/marksActions.ts -> unlockMarks()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/resultActions.ts -> createReportCardSetup()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/resultActions.ts -> publishResults()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/resultActions.ts -> configureResultSettings()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/resultActions.ts -> setResultHold()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/resultActions.ts -> generateResultSnapshots()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/resultActions.ts -> issueTopperCertificate()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/resultActions.ts -> generateMeritList()
  ✓ [READ / QUERY]       frontend/src/app/(admin)/exams/actions/resultActions.ts -> retryFailedReportCardJob()
  ✓ [READ / QUERY]       frontend/src/app/(admin)/exams/actions/resultActions.ts -> getReportCardJobDownloadUrl()
  ✓ [READ / QUERY]       frontend/src/app/(admin)/exams/actions/resultActions.ts -> recoverStuckReportCardJobs()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> createExamSchedule()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> deleteExamSchedule()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> publishDatesheet()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> setMarkDistribution()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/setupActions.ts -> createExam()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/setupActions.ts -> updateExam()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/setupActions.ts -> deleteExam()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/setupActions.ts -> createExamComponent()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/setupActions.ts -> deleteExamComponent()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/setupActions.ts -> createCocurricularArea()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/setupActions.ts -> saveCocurricularGrade()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/setupActions.ts -> saveClassSpecificGradeRule()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/setupActions.ts -> loadBoardDefaultsForSchool()
  ✓ [READ / QUERY]       frontend/src/app/(admin)/exams/actions/setupActions.ts -> getBoardTermPlanPreview()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/setupActions.ts -> createBoardTermPlan()

Auditing 17 examination routes for assertRouteAccess & session checks...
  ✓ [REDIRECT ROUTE]     frontend/src/app/(admin)/exams/page.tsx (safe HTTP redirect)
  ✓ [PROTECTED ROUTE]    frontend/src/app/(admin)/exams/dashboard/page.tsx
  ✓ [PROTECTED ROUTE]    frontend/src/app/(admin)/exams/manage/page.tsx
  ✓ [PROTECTED ROUTE]    frontend/src/app/(admin)/exams/schedule/page.tsx
  ✓ [PROTECTED ROUTE]    frontend/src/app/(admin)/exams/admit-cards/page.tsx
  ✓ [PROTECTED ROUTE]    frontend/src/app/(admin)/exams/marks/page.tsx
  ✓ [PROTECTED ROUTE]    frontend/src/app/(admin)/exams/report-cards/page.tsx
  ✓ [PROTECTED ROUTE]    frontend/src/app/(admin)/exams/report-cards/setups/page.tsx
  ✓ [PROTECTED ROUTE]    frontend/src/app/(admin)/exams/report-cards/settings/page.tsx
  ✓ [PROTECTED ROUTE]    frontend/src/app/(admin)/exams/analytics/page.tsx
  ✓ [PROTECTED ROUTE]    frontend/src/app/(admin)/exams/usage/page.tsx
  ✓ [REDIRECT ROUTE]     frontend/src/app/(admin)/exams/results/page.tsx (safe HTTP redirect)
  ✓ [REDIRECT ROUTE]     frontend/src/app/(admin)/exams/[id]/page.tsx (safe HTTP redirect)
  ✓ [REDIRECT ROUTE]     frontend/src/app/(admin)/exams/[id]/marks/page.tsx (safe HTTP redirect)
  ✓ [PROTECTED ROUTE]    frontend/src/app/(teacher)/teacher/grading/page.tsx
  ✓ [PROTECTED ROUTE]    frontend/src/app/(parent)/portal/admit-cards/page.tsx
  ✓ [PROTECTED ROUTE]    frontend/src/app/(parent)/portal/report-cards/page.tsx

Verifying ROLE_MODULE_ACCESS_MATRIX isolation boundaries...
  ✓ TEACHER strictly excluded from /exams matrix (retains /teacher/grading).
  ✓ ACCOUNTANT strictly bounded to /exams/admit-cards fee verification.
  ✓ PARENT role strictly excluded from administrative /exams.

================================================================================
✅ ALL EXAMINATION RBAC GUARDS, ACTIONS & ROUTES VERIFIED (0 ERRORS)
```

### 1.4 Test Suite Baseline Proof
```
pnpm --filter @schoolmitra/backend exec vitest run src/lib/__tests__/examPermissions.test.ts
✓ src/lib/__tests__/examPermissions.test.ts (10 tests) 12ms
Test Files: 1 passed (1), Tests: 10 passed (10)

pnpm --filter @schoolmitra/backend exec vitest run src/lib/__tests__/examDataIsolation.test.ts
✓ src/lib/__tests__/examDataIsolation.test.ts (12 tests) 465ms
Test Files: 1 passed (1), Tests: 12 passed (12)
```

---

## 2. Cross-Module Touchpoints Inventory for S11

| Target Subsystem | Schema / Tables | Existing Touchpoints | S11 Integration Extension |
| :--- | :--- | :--- | :--- |
| **Academics** | `subjects`, `classes`, `class_subjects` | Class-level `is_elective` flag exists without student enrollment table. | Add `student_subject_enrollments` (migration 0039), enrollment UI, backfill, grade engine dash sentinel `"-"`. |
| **Attendance** | `student_attendance`, `attendance_notifications` | Day-wise and period-wise attendance. Exam `isAbsent` flags isolated on marks. | Sync exam absences into `student_attendance` (`source: 'EXAM'`), parent portal badges, dashboard trend chart. |
| **Communication** | `notices`, `events`, `push_notification_logs`, `sms_logs`, `user_push_subscriptions` | Web push subscriptions and SMS logs exist; exam lifecycle events silent. | Wire 4 events: Result Release, Admit Cards Released, Datesheet Published, Bulk Job Done. Push + in-app, SMS fallback toggle. |
| **Calendar** | `academic_calendar_events`, `events` | `calendar_event_type` already contains `'EXAM'`. Exam datesheets not populated. | Datesheet publish/unpublish bi-directional sync to `academic_calendar_events`. |
| **Timetable** | `timetable_periods`, `bell_schedule`, `timetable_substitutions` | Periods and substitutions live; exam scheduling ignores them. | Timetable-aware clash detection (room, invigilator, class) + availability-ranked invigilator picker. |
| **Mark Distributions** | `exam_mark_distributions`, `exam_components` | Manual entry required per exam/class/subject. | 1-click automated distribution generation from `class_subjects` with `subjects` defaults. |
| **Today Surfaces** | Dashboard pages for Admin, Teacher, Parent, Student | No exam lifecycle cards; manual navigation needed. | Role-specific Today cards within UX-R08 2-tap limit, command search registration, offline PWA cache isolation. |

---

## 3. Pre-Flight Conclusion

All Layer 0 pre-flight requirements are satisfied:
- Commit `bffd662` is confirmed.
- Migration journal is verified at `0038`, with `0039` confirmed as the next sequence number.
- RBAC guard is green (0 errors).
- All baseline tests pass.
- Proceeding immediately to **Layer 1: Student Subject Enrollment Foundation**.
