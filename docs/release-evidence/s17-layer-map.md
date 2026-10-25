# Layer Reconstruction Map: S17 HR & Staff Management Hub (v17.0.0)

> [!NOTE]  
> **Status**: Backfilled Reconstruction (Post-Landed Evidence Chain Restoration)  
> **Original Landing Commit**: `6871a716` (`feat(hr): S17 HR & Staff Hub - Overview, Directory, Allocations, Structure spokes; live data counts; OD1-4 (v11.27.0)`)  
> **Authoritative Baseline**: `307b5718` (v11.26.0) → Released as `4d79b17b` (v11.28.0)  
> **Addressed Flaw**: `S18-F06` (S17 landed as a single commit with only `s17-verdict.md`; granular layer mapping reconstructed here per specification)

---

## 1. Executive Layer-to-File Reconstruction Manifest

The single landing commit `6871a716` encapsulated 9 logical layers conforming to the specification `docs/release-evidence/s17-verdict.md`. This document reconstructs the per-layer accountability boundaries:

### Layer L0: Pre-Flight & Baseline Health Verification
- **Objectives**: Confirmed git HEAD at `307b5718`, three-way version match at `v11.26.0`, and green baseline test suites (`teachingStaffCache`, `teachingStaffResolver`, `assignmentRbacAndIsolation`, `scopeResolver`).
- **Files**:
  - `frontend/src/app/(admin)/hr/__tests__/teachingStaffCache.test.ts` (test environment mock sync)
  - `frontend/src/app/(admin)/hr/__tests__/teachingStaffResolver.test.ts` (test environment mock sync)
  - `frontend/src/app/(admin)/academics/__tests__/assignmentRbacAndIsolation.test.ts` (mock alignment)

### Layer L1: Multi-Tenant RLS Safety & Server-Side PII Masking
- **Objectives**: Solved `S17-F01` (0 member counts in departments/designations due to un-scoped queries) by wrapping all root data loading in `withTenant(school.id)`. Solved `S17-F04` (raw emails in directory payload) by masking email addresses server-side to `a***@domain.com` before sending to client components.
- **Files**:
  - `frontend/src/app/(admin)/hr/page.tsx`
  - `frontend/src/app/(admin)/hr/actions.ts` (`revealStaffEmail`, `revealStaffPii`)

### Layer L2: Overview Hub Spoke (Zero-Clutter High-Intent Hub)
- **Objectives**: Solved `S17-F03` by building the primary landing overview spoke for the HR module with live staff census, teaching coverage metrics, and actionable leave queues. Enforced calm state with call-to-action when school has zero staff.
- **Files**:
  - `frontend/src/app/(admin)/hr/tabs/OverviewTab.tsx`

### Layer L3: Directory Spoke & Staff 360 Linkage
- **Objectives**: Solved `S17-F05`, `S17-F06`, and `S17-F07`. Consolidated duplicate "Add Staff" buttons, introduced audited email reveal modal, rendered dual-role teacher allocation badges (`CT: [Section]`, `[N] Subjects`), and linked directory rows to Staff 360.
- **Files**:
  - `frontend/src/app/(admin)/hr/tabs/StaffTab.tsx`

### Layer L4: Direct Academic Allocations Spoke & Conflict Detection
- **Objectives**: Solved `S17-F02`, `S17-F08`, and `S17-F09`. Built dedicated Allocations spoke with two sub-tabs (Homeroom Class Teachers and Subject Lead Allocations). Implemented bidirectional conflict detection (TW-3) with confirmation prompts. Authorized `HR_MANAGER` role with audited writes. Enforced dual cache invalidation (TW-2).
- **Files**:
  - `frontend/src/app/(admin)/hr/tabs/AllocationsTab.tsx`
  - `frontend/src/app/(admin)/hr/actions.ts` (`getStaffAllocationOverview`, `hrAssignClassTeacher`, `hrAssignSubjectTeacher`)

### Layer L5: Structure Spoke (Departments & Designations Unification)
- **Objectives**: Unified fragmented Departments and Designations tabs into a unified Structure spoke with live active staff counts and designation counts computed via tenant transactions.
- **Files**:
  - `frontend/src/app/(admin)/hr/tabs/StructureTab.tsx`
  - `frontend/src/app/(admin)/hr/tabs/DepartmentsTab.tsx`
  - `frontend/src/app/(admin)/hr/tabs/DesignationsTab.tsx`

### Layer L6: Intent-Based Universal Hub Navigation & Role Matrix
- **Objectives**: Transformed HR navigation from flat tabs to 7 dedicated hub spokes (Overview, Directory, Allocations, Structure, Leaves, Payroll, Settings). Enforced OD2 role visibility matrix and normalizes legacy query parameter tabs.
- **Files**:
  - `frontend/src/app/(admin)/hr/HRDashboardClient.tsx`

### Layer L7: Administrative Settings Spoke
- **Objectives**: Gated salary template creation and school HR configurations behind `SCHOOL_ADMIN` and `SUPER_ADMIN` in a dedicated Settings spoke.
- **Files**:
  - `frontend/src/app/(admin)/hr/tabs/SettingsTab.tsx`
  - `frontend/src/app/(admin)/hr/tabs/TemplatesTab.tsx`

### Layer L8: Legacy Route Hard-Cut & Deprecation Redirects
- **Objectives**: Deprecated legacy `(hr-manager)/hr/dashboard` route with an immediate HTTP 307 redirect to `/hr?tab=overview` per OD3.
- **Files**:
  - `frontend/src/app/(hr-manager)/hr/dashboard/page.tsx`

### Layer L9: Automated Guard Matrix & CI Verification
- **Objectives**: Authored automated 8-test guard matrix suite asserting fail-closed RBAC access control across all 4 HR roles and multi-tenant isolation.
- **Files**:
  - `frontend/src/app/(admin)/hr/__tests__/s17-guard-matrix.test.ts`
  - `package.json`, `frontend/package.json`, `backend/package.json` (Bumped to `11.27.0`)
  - `docs/release-evidence/s17-verdict.md`

---

## 2. Integrity Certification
This backfilled reconstruction restores per-layer granularity to the S17 release evidence, fulfilling specification AC-7 and permanently closing flaw `S18-F06`.
