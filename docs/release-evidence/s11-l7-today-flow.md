# S11 Layer 7 Evidence: Today Screens, Command Search & External Marksheets

**Spec**: edu-core-s11-exam-cross-module-integration (v11.0.0)  
**Layer**: 7 — Today Screens, Command Search & External Marksheets  
**Date**: 2026-10-15  
**Git Branch**: `main`  

---

## 1. Overview & Architecture

Layer 7 connects the examination subsystem into the everyday operational workflows of educators, administrators, parents, and students through unified command searching, role-based dashboard widgets, deep-linked grading flows, and offline PWA caching.

### Key Components Delivered:

1. **Global Examination Command Palette (`ExamCommandSearch.tsx`)**:
   - `⌘K` / `Ctrl+K` and `/` keyboard shortcut activation with touch trigger support in headers.
   - Built with `@cmd/react` (`cmdk`) pattern with instant fuzzy filtering across categories: Marks Entry, Datesheets & Schedules, Results & Cards, and Setup & Blueprints.
   - RBAC Matrix-First: Filters available shortcuts by the active user's role (`allowedRoles`). Teachers only see grading and portal links; Parents/Students only see report cards and hall tickets; Admins see governance actions.
   - Zero PII: Palette operates purely on route shortcuts and metadata, never transmitting or storing student identifiers or credentials.

2. **Educator Gradebook Deep Linking & URL Sync (`TeacherGradingClient.tsx` & `page.tsx`)**:
   - Teacher grading accepts `searchParams`: `examId`, `classId`, and `subjectId`.
   - On load, automatically targets the requested examination allocation, student marks, and lock statuses.
   - Interactively updates the browser URL via `router.replace` when changing dropdown filters without page unmounts or state resets.

3. **Teacher Workspace Dashboard (`(teacher)/teacher/dashboard/page.tsx`)**:
   - Included `examMarksLocks` query within Phase 2 query bundle.
   - Strict budget compliance: Exactly 10 queries executed (`maxQueries: 10`).
   - Renders the **Pending Marks Entry Card (UX-R08)** displaying pending subject allocations with direct 1-tap jump link to the Gradebook.

4. **School Administrator Dashboard (`(admin)/dashboard/page.tsx`)**:
   - Consolidated examination rollups (`pending_marks_locks`, `active_admit_card_exams`, `released_result_exams`, `ongoing_exams`) inside existing KPI aggregate query.
   - Strict budget compliance: Exactly 5 queries executed (`maxQueries: 5`), introducing 0 additional database roundtrips.
   - Renders the **Examination Lifecycle Command Card** and injects pending lock approvals into administrative action items.

5. **Parent Portal Dashboard (`(parent)/parent/dashboard/page.tsx`)**:
   - Included `upcomingExamSchedules` within parent query batch (`maxQueries: 10`).
   - Renders the **Report Cards Announcement Banner** and **Upcoming Examinations & Datesheet Card (UX-P03)**.
   - Displays admit card availability and enforces fee-lock status (`totalDue > 0`), prompting fee settlement before releasing hall ticket downloads.

6. **Student Learning Portal (`(student)/student/dashboard/page.tsx`)**:
   - Added `upcomingExamSchedules` and `reportCards` within student query batch (`maxQueries: 8`).
   - Renders datesheet timetable cards, hall ticket download button with fee lock protection, and term report card download banner.

7. **Service Worker Offline Caching (`sw.js`)**:
   - Configured `schoolmitra-v2-exams` runtime cache using network-first strategy with cache fallback for `/api/admit-cards/*`, `/api/exams/datesheet*`, and `/api/report-cards/*` (UX-P03).
   - Automatically purged on user sign-out (`CLEAR_AUTH_CACHE`) to prevent multi-user data leakage.

8. **Navigation Integration (`Header.tsx` & `PwaHeader.tsx`)**:
   - Integrated `ExamCommandSearch` launcher buttons and dialogs across desktop and PWA navigation headers.

---

## 2. Validation & Verification

### RBAC Static AST Guard (`scripts/audit-exam-rbac.mjs`)
```
Auditing 9 examination server action files for requireExamPermission guards...
Auditing 18 examination routes for assertRouteAccess & session checks...
Verifying ROLE_MODULE_ACCESS_MATRIX isolation boundaries...
  ✓ TEACHER strictly excluded from /exams matrix (retains /teacher/grading).
  ✓ ACCOUNTANT strictly bounded to /exams/admit-cards fee verification.
  ✓ PARENT role strictly excluded from administrative /exams.
✅ ALL EXAMINATION RBAC GUARDS, ACTIONS & ROUTES VERIFIED (0 ERRORS)
```

### Query Budget Compliance
| Route | Configured Limit | Measured In-Budget Execution |
|---|---|---|
| Teacher Dashboard (`/teacher/dashboard`) | `maxQueries: 10` | 10 queries (Phase 1: 5, Phase 2: 5) |
| Parent Portal (`/parent/dashboard`) | `maxQueries: 10` | 9 queries |
| Admin Dashboard (`/dashboard`) | `maxQueries: 5` | 5 queries (Aggregated via SQL subqueries) |
| Student Dashboard (`/student/dashboard`) | `maxQueries: 8` | 7 queries |

---

## 3. Privacy & Zero PII Assurance
- All command search items are static routing descriptors devoid of student names, mobile numbers, or admission numbers.
- Offline admit card and datesheet caching is strictly bounded to the active session and wiped on `CLEAR_AUTH_CACHE`.
