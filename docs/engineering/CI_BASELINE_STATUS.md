# CI Baseline Status and Lint Diagnostic Record

**Repository:** `cascadetechnologiesbackend-ship-it/Edu_core`  
**Verified Baseline HEAD:** `9a14b7ad8ba46b77cb55983216bee98270bd2850`  
**Active Branch:** `engineering/phase-02-tenant-security`  
**Evaluation Date:** 2026-11-25  
**Governing Directive:** `EDUCORE_ENGINEERING_EXCELLENCE_PHASE02_CONTINUATION` v1.1.0  

---

## 1. Executive Summary & Verification State

In compliance with the Phase 02 Directive principle of **"No Self-Certification Without Verifiable Evidence"**, this document formally records the continuous integration (CI) and static analysis baseline for the SchoolMitra repository.

### Current Status:
- **Frontend ESLint Gate (`pnpm --filter @schoolmitra/frontend run lint`):** **PASS (0 Errors, 19 Informational Warnings)**.
- **Root-Cause Remediation:** The 4 blocking `react-hooks/rules-of-hooks` errors across `HRDashboardClient.tsx`, `SiblingPaymentCard.tsx`, and `SyllabusDetailModal.tsx` have been **fully resolved at their root causes** by lifting hooks above early return guards.
- **Zero Rule Suppression:** Zero ESLint rules were disabled, and zero `eslint-disable` annotations were introduced.
- **Regression Suite:** Added `frontend/src/components/parent/modals/__tests__/SyllabusDetailModal.test.tsx` verifying async data loading, tab switching, and state preservation (5/5 passed).
- **Workspace Package Coverage Gap:** 6 workspace packages (`backend`, `database`, `packages/dpdp`, `packages/entity-engine`, `packages/domain-events`, `packages/eslint-plugin-schoolmitra`) currently lack `lint` commands in their `package.json`. Establishing uniform package lint scripts is scheduled for **Phase 04 (Code Quality & Monorepo Tooling)**.

---

## 2. Monorepo Package Lint Coverage Audit

| Package | Path | `lint` Script Present? | Current Status | Notes |
| :--- | :--- | :---: | :---: | :--- |
| **Root Workspace** | `package.json` | Yes (`turbo run lint`) | **PASS** | Validates packages defining a `lint` pipeline |
| **Frontend** | `frontend/package.json` | Yes (`next lint`) | **PASS** | **0 errors**, 19 warnings (Re-tested after Phase 02 fix) |
| **Validators** | `packages/validators/package.json` | Yes (`eslint src/`) | **PASS** | Strict TypeScript ESLint configuration |
| **Backend** | `backend/package.json` | **NO** | Missing Script | Relies on `type-check` only; scheduled Phase 04 |
| **Database** | `database/package.json` | **NO** | Missing Script | Relies on `type-check` + `db:check-migrations`; scheduled Phase 04 |
| **DPDP** | `packages/dpdp/package.json` | **NO** | Missing Script | Relies on `type-check`; scheduled Phase 04 |
| **Entity Engine** | `packages/entity-engine/package.json` | **NO** | Missing Script | Relies on `type-check`; scheduled Phase 04 |
| **Domain Events** | `packages/domain-events/package.json` | **NO** | Missing Script | Relies on `type-check`; scheduled Phase 04 |
| **Custom Plugin** | `packages/eslint-plugin-schoolmitra/package.json` | **NO** | Missing Script | Scheduled Phase 04 |

---

## 3. Frontend ESLint Remediation Record (`next lint`)

Command executed:
```bash
pnpm --filter @schoolmitra/frontend run lint
```
Result: **Command exited with code 0 (Zero Errors).**

### A. Remediated Root Causes

#### 1 & 2. `frontend/src/app/(admin)/hr/HRDashboardClient.tsx`
- **Violations:** `useState` (line 118) and `useEffect` (line 121) were called conditionally after `if (userRole === "TEACHER") return null;`.
- **Root-Cause Fix:** Lifted `useState<HRTabKey>` and `useEffect` to execute unconditionally at the top level of the component before role evaluation. Updated effect dependency logic to use functional state update `setActiveTab((prev) => (prev !== normalized ? normalized : prev))`, preventing unnecessary re-renders and navigation loops.

#### 3. `frontend/src/components/parent/SiblingPaymentCard.tsx`
- **Violation:** `useState` (line 37) was called after `if (siblings.length < 2) return null;`.
- **Root-Cause Fix:** Lifted `const [paid, setPaid] = useState(false);` above the length guard. Preserved payment success behavior and toast notifications.

#### 4. `frontend/src/components/parent/modals/SyllabusDetailModal.tsx`
- **Violation:** `useState` (line 57) was called after `if (!data || !data.subjects || data.subjects.length === 0) return null;`.
- **Root-Cause Fix:** Lifted `useState` and added an unconditional synchronization `useEffect` that:
  1. Handles initial null data followed by asynchronously loaded data without hook errors.
  2. Synchronizes the selected subject when input data or `initialSubjectId` changes.
  3. Preserves a user's valid manual subject selection when refreshed data contains the active subject.
  4. Tested via Vitest in `SyllabusDetailModal.test.tsx` (5/5 tests passing).

---

### B. Remaining Warnings Summary (19 Informational Warnings)

The remaining 19 warnings are non-blocking informational notices:
- `react-hooks/exhaustive-deps`: 15 instances in administrative workbench components (e.g. `AttendanceManager.tsx`, `HomeroomWorkspaceView.tsx`, `AssignmentsTab.tsx`).
- `@next/next/no-img-element`: 2 instances in thermal receipt preview and school logo upload.
- `@next/next/no-page-custom-font`: 1 font loading notice in `app/layout.tsx`.

These warnings are scheduled for systematic cleanup under **Phase 07 (Frontend Quality & Design System Verification)**.
