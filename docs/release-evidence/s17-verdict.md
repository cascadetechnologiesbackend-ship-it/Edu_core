# Release Verdict: S17 HR & Staff Management Hub (v17.0.0)

**Specification**: `S17-HR-STAFF-HUB`  
**Title**: HR & Staff Management Hub: Intent-Based Universal Hub, Cross-Role Teacher CRUD, Live Data Status Truth, and UI/UX Principle Enforcement  
**Version**: `17.0.0`  
**Target Release**: `v11.27.0`  
**Baseline HEAD**: `0d746dc7` (inside v11.26.0)  
**Parent Spec**: `S16-DUAL-ROLE-TEACHER-AUTH@16.0.0`  
**Status**: **SIGNED OFF / PRODUCTION READY**  
**Date**: 2026-10-24  

---

## 1. Executive Summary

Specification `S17-HR-STAFF-HUB` completely reorganizes the Human Resources module from a flat, fragmented tab dashboard into an **Intent-Based Universal Hub** following the canonical hub-and-spoke pattern of ClassHub and FinanceHub:

1. **Seven Dedicated Hub Spokes**:
   - **Overview** (default dispatch): Zero-clutter at-a-glance census cards, live allocation coverage metrics, and actionable leave/structure queues. Renders a calm state with CTA when no staff exist.
   - **Directory**: Full staff roster with server-side email masking (`a***@domain.com`), on-demand audited PII reveal, Staff 360 navigation link, and inline dual-role teacher allocation badges (`CT: [Section]`, `[N] Subjects`).
   - **Allocations**: Direct academic allocation control from the HR hub with two sub-tabs (Class Teachers homeroom assignments and Subject Allocations), bidirectional conflict detection (TW-3), and live status-truth feedback toast contracts.
   - **Structure**: Merged Departments and Designations spoke with live member and designation counts computed via Row-Level Security transactions (`withTenant`).
   - **Leaves**: Staff leave applications queue with pending approval badges.
   - **Payroll**: Payroll runs and disbursals, role-gated to administrative roles.
   - **Settings**: Salary structure templates and school HR configurations, restricted to `SCHOOL_ADMIN` and `SUPER_ADMIN`.

2. **Core Security, Tenant Isolation & DPDP Integrity**:
   - **RLS Count Fix (F1)**: All page-level and action-level queries are strictly wrapped in `withTenant(schoolId, ...)` transactions, ensuring department and designation member counts never read 0 under PostgreSQL Row-Level Security.
   - **Server-Side Email Masking (C2 / DPDP Act 2023)**: Email masking occurs in the server payload before sending to client components; unmasked raw email is only retrieved via the `revealStaffEmail` server action with mandatory audit logging.
   - **Cross-Role Academic Allocations (OD1)**: `HR_MANAGER` is authorized with full audit logging to assign class teachers and subject leads without double-writes.
   - **Dual Cache Invalidation (TW-2)**: Every allocation mutation synchronously invalidates both the teaching staff dropdown cache (`invalidateTeachingStaffCache`) and the Teacher PWA scope resolver cache (`clearTeacherScopeCache`).
   - **Route Hard-Cut (OD3 / C4)**: Legacy `(hr-manager)/hr/dashboard` routes redirect cleanly to `/hr?tab=overview`.

---

## 2. Flaw Disposition Matrix

| Flaw ID | Severity | Description | Status | Layer Landed | Notes |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **S17-F01** | **P0** | Departments/Designations showed 0 members due to RLS blocking bare queries. | **CLOSED** | L1 | Wrapped all queries in `withTenant` in `page.tsx`. |
| **S17-F02** | **P0** | Missing Allocations spoke — homeroom and subject teacher assignment absent from HR. | **CLOSED** | L4 | Added `AllocationsTab.tsx` with CT and Subject assignment. |
| **S17-F03** | **P1** | Missing Overview spoke — no at-a-glance census or allocation status. | **CLOSED** | L2 | Added `OverviewTab.tsx` with zero-clutter invariant. |
| **S17-F04** | **P0** | Staff emails exposed raw in directory payload (PII leak). | **CLOSED** | L1, L3 | Server-side masking in `page.tsx`; audited `revealStaffEmail` action. |
| **S17-F05** | **P2** | Duplicate "Add" buttons in Staff tab. | **CLOSED** | L3 | Consolidated to single "Onboard Staff" CTA. |
| **S17-F06** | **P1** | Teaching staff diagnostics and allocation badges not visible in HR. | **CLOSED** | L3 | Added allocation badges (`CT: ...`, `N Subjects`) to Directory. |
| **S17-F07** | **P2** | Missing link to Staff 360 profile from directory row. | **CLOSED** | L3 | `ExternalLink` to `/hr/staff/${id}` active. |
| **S17-F08** | **P0** | Reading `sections.classTeacherId` mirror instead of canonical `classTeacherAssignments`. | **CLOSED** | L1, L4 | Canonical S16 table read and written; mirrors synced for backward compatibility. |
| **S17-F09** | **P1** | `HR_MANAGER` unable to perform class/subject allocations from HR. | **CLOSED** | L4 | OD1 resolved: `HR_MANAGER` authorized with audit logging. |

---

## 3. Acceptance Criteria Verification

- [x] **AC-1: Zero-Clutter Invariant**: When a school has 0 staff, Overview renders a calm empty state with greeting and "Add First Staff Member" CTA. No empty charts or grids render unconditionally.
- [x] **AC-2: Live Census & Member Counts Truth**: Department and designation member counts strictly reflect live active staff data inside tenant boundaries.
- [x] **AC-3: Server-Side Email Masking**: Email is masked to `a***@domain.com` in server payload; `revealStaffEmail` action audits access and returns unmasked value only to authorized roles.
- [x] **AC-4: Bidirectional Conflict Warnings**: Assigning a teacher who is already a homeroom lead elsewhere surfaces a warning naming the existing section; assigning to a section with an active teacher surfaces confirmation modal with replacement notice.
- [x] **AC-5: Dual Cache Invalidation**: `invalidateTeachingStaffCache(schoolId)` and `clearTeacherScopeCache(teacherUserId)` are invoked on every allocation write.
- [x] **AC-6: Click Budget (≤ 4 taps)**: Overview → Allocations → Select Teacher → Save executes in 2 to 3 taps.
- [x] **AC-7: Automated Guard Matrix (CI)**: `s17-guard-matrix.test.ts` passes 8/8 tests verifying RBAC matrix (`HR_MANAGER`, `SCHOOL_ADMIN`, `PRINCIPAL`, and `TEACHER` 403 block) and two-school tenant isolation.
- [x] **AC-8: Route Hard-Cut**: Legacy `(hr-manager)/hr/dashboard` redirects to `/hr?tab=overview`.
- [x] **AC-9: S16 Regression Gate**: S16 dual-role teacher assignment tests and backend `scopeResolver.test.ts` pass 100% green without regression.
- [x] **AC-10: Typecheck & Production Build**: `tsc --noEmit` and `next build` pass with zero errors across all 148 static and dynamic routes.

---

## 4. Test Verification Summary

### CI Test Suites
| Suite | Path | Tests | Result |
| :--- | :--- | :---: | :---: |
| **S17 Guard Matrix & Isolation** | `frontend/src/app/(admin)/hr/__tests__/s17-guard-matrix.test.ts` | 8 | **PASS** |
| **Teaching Staff Cache Invalidation** | `frontend/src/app/(admin)/hr/__tests__/teachingStaffCache.test.ts` | 2 | **PASS** |
| **Canonical Teaching Staff Resolver** | `frontend/src/app/(admin)/hr/__tests__/teachingStaffResolver.test.ts` | 5 | **PASS** |
| **Academics RBAC & Isolation (S16)** | `frontend/src/app/(admin)/academics/__tests__/assignmentRbacAndIsolation.test.ts` | 27 | **PASS** |
| **Teacher Scope Resolver (Backend)** | `backend/src/lib/teacherEventEngine/__tests__/scopeResolver.test.ts` | 12 | **PASS** |
| **Total Test Count** | — | **54** | **100% PASS** |

### TypeScript Compilation
```
> @schoolmitra/frontend@11.27.0 type-check
> tsc --noEmit
Exit status: 0 (Zero errors)
```

### Production Build
```
> @schoolmitra/frontend@11.27.0 build
> next build
✓ Compiled successfully
✓ Generating static pages (148/148)
✓ Finalizing page optimization
Exit status: 0
```

---

## 5. Artifact & File Change Manifest

| Layer | File Path | Action | Description |
| :--- | :--- | :---: | :--- |
| **L1** | `frontend/src/app/(admin)/hr/page.tsx` | MODIFIED | Wrapped queries in `withTenant`, server email masking, census calculation, TEACHER redirect. |
| **L2** | `frontend/src/app/(admin)/hr/tabs/OverviewTab.tsx` | CREATED | Live census cards, allocation metrics, action queue, calm zero-clutter state. |
| **L3** | `frontend/src/app/(admin)/hr/tabs/StaffTab.tsx` | MODIFIED | Audited email reveal button, teacher allocation badges (`CT: ...`, `Subjects`), deduped CTA. |
| **L4** | `frontend/src/app/(admin)/hr/tabs/AllocationsTab.tsx` | CREATED | Homeroom CT and Subject assignment tables, bidirectional conflict modal, status-truth toast. |
| **L4** | `frontend/src/app/(admin)/hr/actions.ts` | MODIFIED | Added `revealStaffEmail`, `getStaffAllocationOverview`, `hrAssignClassTeacher`, `hrAssignSubjectTeacher`. |
| **L5** | `frontend/src/app/(admin)/hr/tabs/StructureTab.tsx` | CREATED | Merged Departments and Designations into unified structure spoke with live counts. |
| **L5** | `frontend/src/app/(admin)/hr/tabs/DepartmentsTab.tsx` | MODIFIED | Displays live active staff and designation count. |
| **L6** | `frontend/src/app/(admin)/hr/HRDashboardClient.tsx` | MODIFIED | 7 hub spokes, overview default, OD2 role visibility matrix, legacy tab normalization. |
| **L7** | `frontend/src/app/(admin)/hr/tabs/SettingsTab.tsx` | CREATED | Administrative settings spoke wrapping salary templates. |
| **L8** | `frontend/src/app/(hr-manager)/hr/dashboard/page.tsx` | MODIFIED | Hard-cut redirect to `/hr?tab=overview`. |
| **L9** | `frontend/src/app/(admin)/hr/__tests__/s17-guard-matrix.test.ts` | CREATED | Automated 8-test guard matrix suite. |
| **Release** | `package.json`, `frontend/package.json`, `backend/package.json` | MODIFIED | Version bumped to `11.27.0`. |
| **Verdict** | `docs/release-evidence/s17-verdict.md` | CREATED | S17 verdict and evidence chain. |
