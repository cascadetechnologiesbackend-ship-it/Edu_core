# Layer 4 Evidence: Setup UI, Exam Drawer Wizard & Standards Configuration

**Sprint**: S8 Offline Examinations (`edu-core-s8-examinations-module-rebuild`)  
**Timestamp**: 2026-10-15T00:20:00+05:30  
**Head Commit Prior to Layer**: `bdb2438`  
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0`, `SCHOOL-ERP-UIUX-SPEC.md v2.0`, `RULES.md`

---

## 1. Executive Summary

Layer 4 delivers the administrative front-end for Stage 1 of the Offline Examination lifecycle:
1. **Flat Route Architecture**:
   - `/exams/dashboard`: Operations command center featuring KPI cards (Total Exams, Active Schedules, Marks Locked, Results Released), a full 6-stage lifecycle pipeline strip, and an active examinations datatable with status badges and lifecycle direct-action links.
   - `/exams/manage`: Unified assessment standards management featuring:
     - 3-Step Exam Setup Wizard: Step 1 (Title, Type, Dates) -> Step 2 (Class Scope multi-selection) -> Step 3 (Sub-components & weights).
     - Co-Curricular Assessment Areas: Non-scholastic area configuration.
     - Class-Specific Grade Scale Rules: Primary, Middle, Secondary, Senior Secondary percentage brackets and grade points.
   - `/exams`: Backward-compatible redirect to `/exams/dashboard` per Amendment 5.
2. **UI/UX Spec & Performance Compliance**:
   - Strict adherence to SchoolMitra UI/UX guidelines: Dark mode tokens, accessible forms, responsive layout, clear error states, and no raw placeholder text.
   - Query budget compliance: Queries memoized and scoped under `< 6` database queries per page load using `withDataPhaseTiming` and `assertQueryBudget`.

---

## 2. Route & Component Manifest

| Route | Type | Purpose | Query Budget Limit |
|---|---|---|---|
| `/exams` | Server Page | Backward-compatible redirect to `/exams/dashboard` (Amendment 5) | 0 queries |
| `/exams/dashboard` | RSC | Operations command center, live KPIs, exams data table | max 6 queries |
| `/exams/manage` | RSC + Client | Wizard, cocurricular manager, grading scale rules | max 6 queries |
| `ExamManageClient.tsx` | Client Component | 3-step progressive exam creation wizard & tabs | N/A (Client) |

---

## 3. Amendment 5 Backward-Compatibility Verification

- Accessing `/exams` triggers `redirect("/exams/dashboard")`.
- Existing navigation links to `/exams` automatically land on the new command center.
