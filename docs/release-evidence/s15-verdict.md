# Release Verdict: S15 Class Hub Assignment Surfaces (v15.0.0)

**Specification**: `S15-CLASS-HUB-ASSIGNMENT-SURFACES`  
**Version**: `15.0.0`  
**Baseline HEAD**: `77e5a7ca07ba9839cea169cbab39e26a40928bc1` (`v11.24.0`)  
**Parent Spec**: `S14-TEACHER-ASSIGNMENT-POPULATION@14.0.0`  
**Status**: **SIGNED OFF / PRODUCTION READY**  
**Date**: 2026-10-24  

---

## 1. Executive Summary

Specification `S15-CLASS-HUB-ASSIGNMENT-SURFACES` addresses user feedback on v11.24.0 wherein the teacher dropdown appeared empty in the Subject Workspace *"Assign Section Teacher"* modal, existing sections had no edit surface to assign or change a Class Teacher, and existing subjects had no edit surface to assign or change a Subject Lead Teacher.

An exhaustive pre-flight audit revealed that the underlying PostgreSQL database on *New Horizen School* had active teaching staff (Priya Sharma `NH-T01`), but the Class Hub UI rendered both assignment categories read-only for existing records, silently swallowed teacher fetch errors, rendered identity as raw emails, and lacked diagnostic feedback when no faculty were provisioned.

Across Layers L0 through L8, both teacher assignment categories (Class Teacher and Subject Lead Teacher) have been made fully editable at the Class Hub, dropdown errors and empty states are surfaced with actionable diagnostics linking directly to HR faculty management, teacher identity is resolved canonically as `Name (EMP-CODE)` via decrypted staff records, and all mutations are verified under a comprehensive 64-test automated suite.

---

## 2. Flaw Disposition Matrix

| Flaw ID | Description | Status | Layer Landed | Commit SHA |
| :--- | :--- | :--- | :--- | :--- |
| **S15-F01** | Class Hub: No UI to set/change class teacher on EXISTING section. | **CLOSED** | L2 | `5175610` |
| **S15-F02** | Class Hub + Subject Workspace: No UI to set/change LEAD teacher on EXISTING subject. | **CLOSED** | L3 | `22cfafe` |
| **S15-F03** | Teacher-list failures silently swallowed; empty dropdowns carry zero diagnosis. | **CLOSED** | L1 | `8831a3f` |
| **S15-F04** | Teacher identity rendered as raw email across Class Hub surfaces. | **CLOSED** | L4 | `4123814` |
| **S15-F05** | Class readiness checklist blind to class teachers and section overrides. | **CLOSED** | L5 | `0f1a79b` |
| **S15-F06** | Assignment edit paths and reflections at Class Hub not under a verified guard matrix. | **CLOSED** | L6, L7 | `b732ed6`, `98a8acd` |

---

## 3. Acceptance Criteria Verification

- [x] **AC-1: Section Class Teacher Edit Surface**: Existing sections feature an Edit action opening an `AppModal` (`size="sm"`) with a searchable teacher dropdown, room number, capacity, and current assignment pre-populated.
- [x] **AC-2: Subject Lead Teacher Edit Surface**: Existing subjects feature a *"Change Lead"* quick action in the Class Hub Subjects table and a prominent *"Change"* button in the Subject Workspace header with canonical teacher selection.
- [x] **AC-3: Dropdown Observability & Empty Diagnostics**: Failures to load teachers display an alert banner; empty teacher lists display a prominent diagnostic card linking directly to `/hr?tab=designations` with a clear explanation of `isTeaching: true` designation requirements.
- [x] **AC-4: Canonical Identity Resolution**: Raw emails eliminated. All dropdowns, badges, section cards, subject rows, and timetable cells render decrypted faculty names and codes (`Name (EMP-CODE)`).
- [x] **AC-5: Class Readiness Integration**: Overview checklist reflects section class teacher assignment status alongside subject assignments, providing clear alerts when sections require teacher assignment.
- [x] **AC-6: RBAC Guard Matrix**: Verified across 29 test cases: `SUPER_ADMIN`, `SCHOOL_ADMIN`, and `PRINCIPAL` permitted; `TEACHER`, `HR_MANAGER`, `ACCOUNTANT`, `STUDENT`, `PARENT`, and `DRIVER` strictly rejected (`FORBIDDEN`); unauthenticated requests fail closed (`UNAUTHORIZED`).
- [x] **AC-7: Multi-Tenant Isolation**: Enforced on every database write and read through session-derived `schoolId` and `withTenant`. Cross-tenant updates between School A and School B strictly rejected (`Invalid class specified`).
- [x] **AC-8: Downstream Cache Reflection**: Every assignment write (`saveSection`, `saveClassSubject`, `assignSectionTeacher`) invalidates `clearTeacherScopeCache()` and revalidates relevant Next.js routes (`/academics`, `/academics/classes/[id]`, `/academics/classes/[id]/subjects/[id]`).

---

## 4. Layer Execution & Git Commit History

| Layer | Commit SHA | Description | Evidence File |
| :--- | :--- | :--- | :--- |
| **L0** | `713e9f8` | Pre-flight baseline gate and flaw confirmation | [s15-l0.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s15-l0.md) |
| **L1** | `8831a3f` | Dropdown observability & empty-state diagnostics | [s15-l1.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s15-l1.md) |
| **L2** | `5175610` | Section edit & class teacher assignment surfaces | [s15-l2.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s15-l2.md) |
| **L3** | `22cfafe` | Subject lead teacher edit at Class Hub & Workspace | [s15-l3.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s15-l3.md) |
| **L4** | `4123814` | Canonical teacher identity resolution (`Name (EMP-CODE)`) | [s15-l4.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s15-l4.md) |
| **L5** | `0f1a79b` | Class readiness checklist integration & section prompts | [s15-l5.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s15-l5.md) |
| **L6** | `b732ed6` | RBAC guard matrix & multi-tenant isolation test suite | [s15-l6.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s15-l6.md) |
| **L7** | `98a8acd` | End-to-end 7-step assignment walkthrough & full regression | [s15-l7.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s15-l7.md) |
| **L8** | *(Current)* | Release verdict & final sign-off documentation | [s15-verdict.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s15-verdict.md) |

---

## 5. Automated Test & Typecheck Verification

- **Vitest Academics Suite**: 4 test files, 64 tests total, 64 passed, 0 failed.
- **Frontend Typecheck (`tsc --noEmit`)**: 0 errors.
- **Backend Typecheck (`tsc --noEmit`)**: 0 errors.
- **Dev Server Health Check (`/api/health`)**: Status 200 OK.
- **Schema & Dependency Invariant**: 0 new npm dependencies; 0 database migrations.

---

## 6. Sign-Off

All implementation requirements, behavioral invariants, and design principles established in `S15-CLASS-HUB-ASSIGNMENT-SURFACES` have been satisfied and rigorously verified. Specification S15 is hereby marked **COMPLETE** and approved for production release.
