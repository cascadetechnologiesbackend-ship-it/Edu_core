# CI Baseline Status and Lint Diagnostic Record

**Repository:** `cascadetechnologiesbackend-ship-it/Edu_core`  
**Verified Baseline HEAD:** `9a14b7ad8ba46b77cb55983216bee98270bd2850`  
**Evaluation Branch:** `engineering/phase-02-tenant-security`  
**Evaluation Date:** 2026-11-25  
**Governing Directive:** `EDUCORE_MASTER_ENGINEERING_EXCELLENCE` Phase 02 Execution Requirement 5  

---

## 1. Executive Summary & Integrity Statement

In compliance with the Phase 02 Execution Directive principle of **"No Self-Certification Without Verifiable Evidence"**, this document formally records the existing CI and static analysis baseline for the SchoolMitra repository.

> **Explicit CI Status Notice:**  
> The continuous integration (CI) lint gate is **NOT GREEN** on repository baseline `9a14b7a`.  
> While the dependency security audit gate (`scripts/audit-dependencies.mjs`), database migration journal checks (`db:check-migrations`), and TypeScript type checking (`pnpm run type-check`) pass, the frontend ESLint gate (`next lint`) fails closed due to existing React Hook rule violations.  
> In accordance with Phase 02 boundaries, these lint rules have **NOT** been disabled or suppressed with `eslint-disable`. Their remediation is assigned to authorized Frontend Quality Phases (Phase 04 / Phase 05).

---

## 2. Monorepo Package Lint Coverage Audit

An audit of package configurations across the workspace reveals an asymmetry in static analysis coverage:

| Package | Path | `lint` Script Present? | Current Status |
| :--- | :--- | :--- | :--- |
| **Root Workspace** | `package.json` | Yes (`turbo run lint`) | Fails due to `@schoolmitra/frontend` failure |
| **Frontend** | `frontend/package.json` | Yes (`next lint`) | **FAIL** (4 errors, 19 warnings) |
| **Backend** | `backend/package.json` | **NO** | Missing lint pipeline (Relies on `type-check` only) |
| **Database** | `database/package.json` | **NO** | Missing lint pipeline |
| **DPDP** | `packages/dpdp/package.json` | **NO** | Missing lint pipeline |
| **Entity Engine** | `packages/entity-engine/package.json` | **NO** | Missing lint pipeline |
| **Domain Events** | `packages/domain-events/package.json` | **NO** | Missing lint pipeline |
| **Custom ESLint Plugin** | `packages/eslint-plugin-schoolmitra/package.json` | **NO** | Missing lint pipeline |
| **Validators** | `packages/validators/package.json` | Yes (`eslint src/`) | **PASS** |

### Remediation Roadmap for Package Linting:
Adding uniform ESLint configurations and `lint` scripts to `backend`, `database`, `packages/dpdp`, `packages/entity-engine`, `packages/domain-events`, and `packages/eslint-plugin-schoolmitra` is scheduled under **Phase 04 (Code Quality, Static Analysis & Monorepo Tooling)**.

---

## 3. Frontend ESLint Baseline Diagnostic (`next lint`)

Execution command:
```bash
pnpm --filter @schoolmitra/frontend run lint
```

### A. Blocking Errors (4 Failures)

All four blocking errors are violations of `react-hooks/rules-of-hooks` caused by calling React hooks conditionally or following an early `return` statement:

#### 1 & 2. `frontend/src/app/(admin)/hr/HRDashboardClient.tsx`
- **Lines:**
  - Line 118, Column 37: `Error: React Hook "useState" is called conditionally. React Hooks must be called in the exact same order in every component render. Did you accidentally call a React Hook after an early return? react-hooks/rules-of-hooks`
  - Line 121, Column 3: `Error: React Hook "useEffect" is called conditionally. React Hooks must be called in the exact same order in every component render. Did you accidentally call a React Hook after an early return? react-hooks/rules-of-hooks`
- **Root Cause:**
  In `HRDashboardClient.tsx`, an early return guard check is executed prior to lines 118 and 121, resulting in `useState` and `useEffect` hooks being invoked conditionally.
- **Phase Boundary Justification:**
  Belongs to the HR module client architecture in **Phase 04 / Phase 05**. Modifying frontend component state flow in Phase 02 would violate the authorized scope of **Multi-Tenancy, Data Integrity and Security Remediation**.

#### 3. `frontend/src/components/parent/modals/SyllabusDetailModal.tsx`
- **Lines:**
  - Line 57, Column 53: `Error: React Hook "useState" is called conditionally. React Hooks must be called in the exact same order in every component render. Did you accidentally call a React Hook after an early return? react-hooks/rules-of-hooks`
- **Root Cause:**
  A modal open/closed early return check precedes the `useState` declaration for internal tab/accordion state.
- **Phase Boundary Justification:**
  Parent PWA component maintenance belongs to **Phase 04**.

#### 4. `frontend/src/components/parent/SiblingPaymentCard.tsx`
- **Lines:**
  - Line 37, Column 27: `Error: React Hook "useState" is called conditionally. React Hooks must be called in the exact same order in every component render. react-hooks/rules-of-hooks`
- **Root Cause:**
  Hook initialized after conditional sibling fee resolution.
- **Phase Boundary Justification:**
  Fee UI and parent payment client components belong to **Phase 04**.

---

### B. Warnings Summary (19 Warnings)

| File | Line | Rule | Description |
| :--- | :--- | :--- | :--- |
| `src/app/(admin)/academics/AssignmentsTab.tsx` | 137 | `react-hooks/exhaustive-deps` | Missing dependency: `loadData` |
| `src/app/(admin)/academics/LessonPlansTab.tsx` | 71 | `react-hooks/exhaustive-deps` | Missing dependency: `loadPlans` |
| `src/app/(admin)/academics/reports/ReportsClient.tsx` | 113 | `react-hooks/exhaustive-deps` | Missing dependency: `selectedClass` |
| `src/app/(admin)/attendance/AttendanceManager.tsx` | 114 | `react-hooks/exhaustive-deps` | Missing dependency: `initialStudents` |
| `src/app/(admin)/hr/HRDashboardClient.tsx` | 126 | `react-hooks/exhaustive-deps` | Missing dependency: `activeTab` |
| `src/app/(admin)/hr/staff/[id]/Staff360Client.tsx` | 127 | `react-hooks/exhaustive-deps` | Missing dependencies: `activeTab`, `validTabs` |
| `src/app/(admin)/school/collect-fees/CounterCollectionClient.tsx` | 941 | `@next/next/no-img-element` | Raw `<img>` element instead of `next/image` |
| `src/app/(admin)/settings/school-setup/page.tsx` | 1084 | `@next/next/no-img-element` | Raw `<img>` element instead of `next/image` |
| `src/app/(admin)/transport/GPSTrackingTab.tsx` | 120 | `react-hooks/exhaustive-deps` | Missing dependency: `livePosition` |
| `src/app/layout.tsx` | 97 | `@next/next/no-page-custom-font` | Custom font loaded outside `_document.js` |
| `src/components/finance/FinanceTabs.tsx` | 104 | `react-hooks/exhaustive-deps` | Complex logical expression in hook dependencies |
| `src/components/forms/AddressAutofill.tsx` | 66 | `react-hooks/exhaustive-deps` | Missing dependencies: `onChange`, `value` |
| `src/components/layout/Sidebar.tsx` | 63 | `react-hooks/exhaustive-deps` | Missing dependency: `onCloseMobile` |
| `src/components/layout/TopProgressBar.tsx` | 40 | `react-hooks/exhaustive-deps` | Missing dependency: `navState` |
| `src/components/parent/BusLiveMap.tsx` | 41 | `react-hooks/exhaustive-deps` | Complex expressions in dependency array (4 instances) |
| `src/components/teacher/AttendanceWorkbench.tsx` | 205 | `react-hooks/exhaustive-deps` | Missing dependency: `selectedSectionId` |
| `src/components/teacher/HomeroomWorkspaceView.tsx` | 83, 143 | `react-hooks/exhaustive-deps` | Missing dependencies: `fetchMatrix`, `fetchRoster` |
| `src/components/ui/CommandPalette.tsx` | 86 | `react-hooks/exhaustive-deps` | Missing dependency: `setOpen` |

---

## 4. Operational Sign-Off for Phase 02

- **Phase 02 Scope Adherence:** No frontend files were modified, and no rules were bypassed.
- **Fail-Closed Integrity:** CI accurately reflects test, type, and lint signals.
- **Next Phase Action:** Phase 04 authorization will schedule the systematic correction of these React hook ordering defects and the establishment of uniform monorepo lint scripts.
