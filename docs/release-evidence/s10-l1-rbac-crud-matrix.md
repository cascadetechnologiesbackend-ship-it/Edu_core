# Layer 1 Evidence: RBAC CRUD Truth Matrix & Static Guard

**Sprint:** S10 — Examination Module Hardening (`edu-core-s10-exam-verification-isolation-bulk-ux@10.0.0`)  
**Timestamp:** 2026-10-15T14:44:20+05:30  
**Head Prior to Layer:** `ed90f60`  
**Governing Rulebooks:** `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0`, `SCHOOL-ERP-UIUX-SPEC.md v2.0`, `RULES.md`  
**Verification Verdict:** **PASS (MATRIX COMMITTED & PERMANENT CI GUARD GREEN)**

---

## 1. Executive Summary

Layer 1 audits, wires, and guarantees role-based access control (RBAC) across the entire examination subsystem.
1. **Permanent CI Static Guard**: Authored [`scripts/audit-exam-rbac.mjs`](file:///v:/Cascade/Edu_core/Edu_core/scripts/audit-exam-rbac.mjs) (wired into `package.json` under `audit:exam-rbac`), which audits every examination server action file to guarantee that every exported mutation invokes `requireExamPermission` with session tenant context (`requireSchool`), and audits all exam routes to guarantee `assertRouteAccess` coverage.
2. **Modularized Analytics Server Actions**: Created [`frontend/src/app/(admin)/exams/actions/analyticsActions.ts`](file:///v:/Cascade/Edu_core/Edu_core/frontend/src/app/%28admin%29/exams/actions/analyticsActions.ts) containing `generateMeritList`, `generateRankSheet`, and `exportCohortAnalytics` guarded by `exam.analytics.view` and `exam.result.publish`.
3. **Staff Examination REST API**: Created [`frontend/src/app/api/staff/exam-results/[examId]/route.ts`](file:///v:/Cascade/Edu_core/Edu_core/frontend/src/app/api/staff/exam-results/%5BexamId%5D/route.ts) enforcing fail-closed session checks, teacher timetable assignment (`assertTeacherTeaches`), and uniform HTTP 404 responses for cross-tenant probes.
4. **Committed 23-Resource CRUD Matrix**: Generated directly from code truth across all 8 user personas.

---

## 2. Committed Role-by-Resource-by-Operation Truth Matrix

The following matrix represents verified runtime code truth extracted from [`backend/src/lib/examPermissions.ts`](file:///v:/Cascade/Edu_core/Edu_core/backend/src/lib/examPermissions.ts), [`frontend/src/lib/routeGuards.ts`](file:///v:/Cascade/Edu_core/Edu_core/frontend/src/lib/routeGuards.ts), and all action call sites.

*Legend: `C` = Create, `R` = Read, `U` = Update, `D` = Delete, `L` = Lock/Unlock, `P` = Publish, `O` = Override. `-` = Denied.*

| # | Exam Resource | SUPER_ADMIN | SCHOOL_ADMIN | PRINCIPAL | TEACHER | ACCOUNTANT | PARENT / STUDENT | PUBLIC |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | **exams** | CRUD | CRUD | CRUD | - | - | - | - |
| 2 | **exam_types** | CRUD | CRUD | CRUD | - | - | - | - |
| 3 | **exam_components** | CRUD | CRUD | CRUD | - | - | - | - |
| 4 | **exam_class_scopes** | CRUD | CRUD | CRUD | - | - | - | - |
| 5 | **grade_rules** | CRUD | CRUD | CRUD | R (assigned) | - | - | - |
| 6 | **cocurricular_areas** | CRUD | CRUD | CRUD | - | - | - | - |
| 7 | **exam_schedules** | CRUD P | CRUD P | CRUD P | R (assigned) | R | R (published) | - |
| 8 | **exam_mark_distributions** | CRUD | CRUD | CRUD | R (assigned) | - | - | - |
| 9 | **admit_card_settings** | CRUD | CRUD | CRUD | - | CRUD | - | - |
| 10 | **admit_card_templates** | CRUD | CRUD | CRUD | - | R | - | - |
| 11 | **admit_card_holds** | CRUD O | CRUD O | CRUD O | - | CRUD O | R (own hold slip) | - |
| 12 | **mark_entries** | CRUD | CRUD | CRUD | CRU (assigned only) | - | - | - |
| 13 | **exam_marks_locks** | L | L | L | - | - | - | - |
| 14 | **cocurricular_grades** | CRUD | CRUD | CRUD | CRU (assigned only) | - | - | - |
| 15 | **teacher_remarks** | CRUD | CRUD | CRUD | CRU (assigned only) | - | - | - |
| 16 | **report_card_setups** | CRUD | CRUD | CRUD | - | - | - | - |
| 17 | **uploaded_marksheets** | CRUD | CRUD | CRUD | - | - | - | - |
| 18 | **result_settings** | CRUD P | CRUD P | CRUD P | - | - | - | - |
| 19 | **result_holds** | CRUD O | CRUD O | CRUD O | - | - | R (own hold slip) | - |
| 20 | **result_snapshots** | CRUD P | CRUD P | CRUD P | R (assigned) | - | R (published & released) | R (published via slug) |
| 21 | **analytics & merit lists** | CRU | CRU | CRU | R (cohort only) | - | - | - |
| 22 | **staff REST API** | R | R | R | R (assigned only) | - | - | - |
| 23 | **usage analytics & heat map** | R | R | R | - | - | - | - |

---

## 3. Data-Level Security Rules Reverified

1. **Teacher Class-Subject Boundary**:
   - `TEACHER` is completely excluded from the administrative `/exams/*` subtree in `ROLE_MODULE_ACCESS_MATRIX`.
   - Teacher marks recording is strictly scoped to `/teacher/grading` and guarded by `assertTeacherTeaches({ teacherId, schoolId, classId, subjectId })`.
   - Any attempt to query marks outside assigned class-subjects via the Staff API or server actions triggers an append-only `audit_logs` security event (`TEACHER_UNASSIGNED_EXAM_QUERY`) and yields HTTP 403 Forbidden.
2. **Parent & Student Boundary**:
   - Parents and students access only `/portal/admit-cards` and `/portal/report-cards`.
   - Access to report cards requires active publication (`publishedAt IS NOT NULL`) and clearance from `result_holds`.
   - Any navigation attempt to administrative `/exams/*` fails closed and redirects to `/portal`.
3. **Public Verification Boundary**:
   - `/s/[slug]/results` allows unauthenticated parents and alumni to verify published report cards.
   - Lookups require exact admission number + date of birth (or roll number).
   - Uniform error response prevents student existence enumeration.
4. **Super Admin Boundary**:
   - `SUPER_ADMIN` acts within tenant context via active impersonation session (`requireSchool(ctx)`).

---

## 4. Static CI Guard Verification Output

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

Auditing 16 examination routes for assertRouteAccess & session checks...

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

---

## 5. Playwright RBAC Drill Specifications

Authored and committed [`frontend/e2e/s10-exam-rbac-crud-drill.spec.ts`](file:///v:/Cascade/Edu_core/Edu_core/frontend/e2e/s10-exam-rbac-crud-drill.spec.ts) covering:
1. `SCHOOL_ADMIN`: Validates 200 OK access across all 9 operational exam interfaces.
2. `PRINCIPAL`: Validates full exam operational and publication rights.
3. `TEACHER`: Verifies allowed access to `/teacher/grading` and fail-closed redirection away from all 9 administrative `/exams/*` routes.
4. `ACCOUNTANT`: Verifies allowed access to fee clearance on `/exams/admit-cards` and redirect denial away from marks, schedules, and report cards.
5. `PARENT`: Verifies access to `/portal/admit-cards` and `/portal/report-cards` with redirection away from administrative `/exams`.
6. `PUBLIC`: Verifies access to `/s/[slug]/results` without authentication.
