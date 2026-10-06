# Server Action Authorization Audit Report (REQ-9)

**Audit Date:** 2026-10-06  
**Auditor:** Automated Engine (`audit-server-actions.js` & `eslint-plugin-schoolmitra`)  
**Status:** ✅ 100% Compliant (0 Unguarded Server Action Files)

---

## Executive Summary
All files designated with the `"use server"` directive have been audited across the monorepo (`frontend/src` and `backend/src`). 
Every action executing database mutations either:
1. Enforces session and tenant access via `requireAuth()` or `requireAuth([...roles])`.
2. Uses NextAuth session retrieval within authorized pages.
3. Is explicitly documented with a file-level `// PUBLIC:` annotation (such as public onboarding or sign-out).

---

## Inventory of 31 Server Action Files

| # | File Path | DB Access | Auth Guard | Annotation | Status |
|---|-----------|-----------|------------|------------|--------|
| 1 | `frontend/src/app/(admin)/academics/actions/assessment.actions.ts` | YES | `requireAuth` | None | PASS |
| 2 | `frontend/src/app/(admin)/academics/actions/calendar.actions.ts` | YES | `requireAuth` | None | PASS |
| 3 | `frontend/src/app/(admin)/academics/actions/class-setup.actions.ts` | YES | `requireAuth` | None | PASS |
| 4 | `frontend/src/app/(admin)/academics/actions/reports.actions.ts` | YES | `requireAuth` | None | PASS |
| 5 | `frontend/src/app/(admin)/academics/actions/syllabus.actions.ts` | YES | `requireAuth` | None | PASS |
| 6 | `frontend/src/app/(admin)/academics/actions/timetable.actions.ts` | YES | `requireAuth` | None | PASS |
| 7 | `frontend/src/app/(admin)/academics/actions.ts` | YES | `requireAuth` | None | PASS |
| 8 | `frontend/src/app/(admin)/admissions/new/actions.ts` | YES | `requireAuth` | None | PASS |
| 9 | `frontend/src/app/(admin)/admissions/[id]/actions.ts` | YES | `requireAuth` | None | PASS |
| 10 | `frontend/src/app/(admin)/attendance/actions.ts` | YES | `requireAuth` | None | PASS |
| 11 | `frontend/src/app/(admin)/dpdp/actions.ts` | YES | `requireAuth` | None | PASS |
| 12 | `frontend/src/app/(admin)/exams/actions.ts` | YES | `requireAuth` | None | PASS |
| 13 | `frontend/src/app/(admin)/exams/[id]/marks/actions.ts` | YES | `requireAuth` | None | PASS |
| 14 | `frontend/src/app/(admin)/fees/collect/actions.ts` | YES | `requireAuth` | None | PASS |
| 15 | `frontend/src/app/(admin)/fees/concessions/actions.ts` | YES | `requireAuth` | None | PASS |
| 16 | `frontend/src/app/(admin)/fees/structures/actions.ts` | YES | `requireAuth` | None | PASS |
| 17 | `frontend/src/app/(admin)/hr/actions.ts` | YES | `requireAuth` | None | PASS |
| 18 | `frontend/src/app/(admin)/library/actions.ts` | YES | `requireAuth` | None | PASS |
| 19 | `frontend/src/app/(admin)/settings/exam-types/actions.ts` | YES | `requireAuth` | None | PASS |
| 20 | `frontend/src/app/(admin)/settings/grading/actions.ts` | YES | `requireAuth` | None | PASS |
| 21 | `frontend/src/app/(admin)/settings/school-setup/actions.ts` | YES | `requireAuth` | None | PASS |
| 22 | `frontend/src/app/(admin)/students/[id]/class-history/actions.ts` | YES | `requireAuth` | None | PASS |
| 23 | `frontend/src/app/(admin)/students/[id]/fees/actions.ts` | YES | `requireAuth` | None | PASS |
| 24 | `frontend/src/app/(admin)/transport/actions.ts` | YES | `requireAuth` | None | PASS |
| 25 | `frontend/src/app/(parent)/portal/actions.ts` | YES | `requireAuth` | None | PASS |
| 26 | `frontend/src/app/(super-admin)/super-admin/announcements/page.tsx` | YES | `requireAuth` | None | PASS |
| 27 | `frontend/src/app/(super-admin)/super-admin/schools/page.tsx` | YES | `requireAuth` | None | PASS |
| 28 | `frontend/src/app/actions/changePassword.ts` | YES | `requireAuth` | None | PASS |
| 29 | `frontend/src/app/actions/onboard.ts` | YES | PUBLIC | `// PUBLIC: Initial school registration` | PASS |
| 30 | `frontend/src/app/platform/schools/new/actions.ts` | YES | `requireAuth(["SUPER_ADMIN"])` | None | PASS |
| 31 | `backend/src/lib/auth/actions.ts` | NO | PUBLIC | `// PUBLIC: NextAuth sign-out` | PASS |

---

## Remediation Details (GAP-003)
1. **`platform/schools/new/actions.ts`**: Migrated from unchecked inline `auth()` to `requireAuth(["SUPER_ADMIN"])`.
2. **`dpdp/actions.ts`**: Migrated `updateVendorDpaStatus` and `markBreachParentsNotified` to strict `requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"])`.
3. **`backend/src/lib/auth/actions.ts`**: Added explicit `// PUBLIC: NextAuth sign-out` comment.
