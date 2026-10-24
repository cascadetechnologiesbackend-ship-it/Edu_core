# Release Verdict: S16 Dual-Role Teacher Architecture (v16.0.0)

**Specification**: `S16-DUAL-ROLE-TEACHER-AUTH`  
**Title**: Dual-Role Teacher Architecture: Class Teacher vs Subject Teacher — Schema Invariants, Scope Engine, Guards, Teacher Workspaces, Boundary Tests  
**Version**: `16.0.0`  
**Baseline HEAD**: `f1efeecdb08c1d11494dfb165a443ec940c65b1e` (`v11.25.0`)  
**Parent Spec**: `S15-CLASS-HUB-ASSIGNMENT-SURFACES@15.0.0` (landed main at `10e00818`)  
**Status**: **SIGNED OFF / PRODUCTION READY**  
**Date**: 2026-10-24  

---

## 1. Executive Summary

Specification `S16-DUAL-ROLE-TEACHER-AUTH` delivers the architectural separation of roles in the Multi-Role School ERP:
1. **Condition A (Subject Teacher — Horizontal / Instructional Scope)**:
   - $M:N$ mapping: A faculty member can teach subjects across multiple classes and sections.
   - Strict boundaries: Access is restricted strictly to allocated subjects and sections.
   - Tamper attempts or cross-section student injections trigger an atomic transaction abort and machine-readable `403 SUBJECT_TEACHER_FORBIDDEN` or `403 CROSS_SECTION_STUDENT_TAMPER_ATTEMPT`.
2. **Condition B (Class Teacher / Homeroom Lead — Vertical / Administrative Scope)**:
   - $1:1$ invariant: Exactly one active Class Teacher per section per academic year, and at most one active homeroom per teacher per academic year.
   - Administrative override: Authorizes full Student 360 overview, compiled report card matrix sign-off, morning homeroom roll-call, and section leave approvals.
   - DPDP Act 2023 Statutory Shield: Fee information is decoupled server-side as categorical status badges (`PAID` | `DUE` | `OVERDUE`) only; financial balances, line items, and parent banking fields are NEVER queried or returned.

All 9 sequential layers (L0 through L8) have been fully executed, verified, and committed with zero new external npm dependencies, single additive database migration (`0054_dual_role_teacher_assignments.sql`), full backward compatibility with `sections.classTeacherId`, PostgreSQL Row-Level Security active on assignment tables, and all 13 boundary/fee tests passing.

---

## 2. Flaw Disposition Matrix

| Flaw ID | Severity | Description | Status | Layer Landed | Commit SHA |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **S16-F01** | **P0** | Exam marks read/write path had zero teacher allocation check. | **CLOSED** | L5 | `7343450` |
| **S16-F02** | **P0** | IDOR: `saveExamMarks` blindly accepted arbitrary cross-section student IDs. | **CLOSED** | L5 | `7343450` |
| **S16-F03** | **P0** | Class teacher designation lacked academic-year scoping, effective dating, and uniqueness invariants. | **CLOSED** | L1, L2 | `be4fad3`, `1c48d9b` |
| **S16-F04** | **P1** | `sectionSubjectTeachers` lacked academic year scoping, primary flag, and had a bypassable uniqueness predicate. | **CLOSED** | L1 | `be4fad3` |
| **S16-F05** | **P1** | Attendance guards did not distinguish daily morning roll-call (homeroom) from period attendance (subject). | **CLOSED** | L5 | `7343450` |
| **S16-F06** | **P1** | Scope engine lacked effective-date window enforcement and suffered grade-wide fallback collisions. | **CLOSED** | L4 | `0f8a2fe` |
| **S16-F07** | **P1** | Teacher PWA lacked Class Teacher workspace (homeroom roster, Student 360, compiled report card matrix). | **CLOSED** | L6 | `40fd729` |
| **S16-F08** | **P1** | DPDP fee boundary unverified for teacher-visible student data. | **CLOSED** | L7 | `fabedf7` |
| **S16-F09** | **P2** | Admin allocation UI lacked the one-homeroom-per-teacher conflict warning. | **CLOSED** | L2 | `1c48d9b` |

---

## 3. Acceptance Criteria Verification

- [x] **AC-1: Six Formal Boundary Tests Passing**: All 6 prompt boundary tests pass in CI (`dualRoleBoundaryTests.test.ts`), including the future-effective_to uniqueness case and the transaction-aborted IDOR case.
- [x] **AC-2: Exam Marks Hardened Write Path**: `saveExamMarks` and `getExamMarksRoster` reject unallocated teachers (403 `SUBJECT_TEACHER_FORBIDDEN`) and cross-section student IDs (403 `CROSS_SECTION_STUDENT_TAMPER_ATTEMPT`, 0 writes).
- [x] **AC-3: Class Teacher 1:1 Invariant & Conflict Warning**: Assigning a teacher as class teacher of a second section in the same academic year fails at the database partial unique index (`cta_single_teacher_year_idx`) AND surfaces a conflict warning naming the existing homeroom in the admin UI with one-click transfer.
- [x] **AC-4: Mirror Integrity**: `sections.classTeacherId` and `class_teacher_assignments` agree for the active year at all times (verified by `dualRoleBoundaryTests.test.ts`), and pre-existing consumers work unchanged.
- [x] **AC-5: Daily Roll-Call vs Period Attendance Split**: Daily roll-call requires class teacher override (`assertClassTeacherOverride`); period attendance requires subject allocation (`assertSubjectTeacherPermission`); leave approvals require the student's section class teacher.
- [x] **AC-6: Teacher PWA Dual Workspace**: Segmented pill switcher renders Homeroom tab only when `homeroomSection != null`. Dual-role teachers switch seamlessly; subject-only teachers see subject workspace. Homeroom Student 360 shows fee status badge and zero financial fields.
- [x] **AC-7: Report Card Sign-Off**: Class teacher can enter holistic remarks, assign conduct grade (`A+` to `Needs Improvement`), and sign off the compiled report card. Class teacher cannot edit other teachers' subject marks.
- [x] **AC-8: RLS Defense-in-Depth**: Row-Level Security enabled on `class_teacher_assignments`, `section_subject_teachers`, and `homeroom_report_remarks` with fail-closed tenant isolation.
- [x] **AC-9: Scope Engine Hardening**: Returns effective-date valid allocations only (`effectiveFrom <= today AND (effectiveTo IS NULL OR effectiveTo >= today)`). Grade-wide fallback excluded when section override exists.
- [x] **AC-10: Evidence Chain Complete**: All release evidence files (`docs/release-evidence/s16-l0.md` through `s16-l8.md`) exist with recorded commit SHAs.

---

## 4. Layer Execution & Git Commit History

| Layer | Commit SHA | Description | Evidence File |
| :--- | :--- | :--- | :--- |
| **L0** | `fe53168` | Pre-flight baseline gate and scopeResolver audit | [s16-l0.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s16-l0.md) |
| **L1** | `be4fad3` | Schema: `class_teacher_assignments`, `section_subject_teachers` extension, `homeroom_report_remarks` | [s16-l1.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s16-l1.md) |
| **L2** | `1c48d9b` | Assignment write-path unification & S15 conflict warnings with one-click transfer | [s16-l2.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s16-l2.md) |
| **L3** | `237fd36` | RLS defense-in-depth on the assignment and remarks tables | [s16-l3.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s16-l3.md) |
| **L4** | `0f8a2fe` | Scope engine hardening with date windows and fallback collision fix | [s16-l4.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s16-l4.md) |
| **L5** | `7343450` | Guard module (`teacherAuthGuards.ts`), exam marks IDOR closure, attendance split | [s16-l5.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s16-l5.md) |
| **L6** | `40fd729` | Teacher PWA dual workspace (`HomeroomWorkspaceView`, `TeacherScopeContext`, `TeacherWorkspaceSwitcher`) | [s16-l6.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s16-l6.md) |
| **L7** | `fabedf7` | DPDP fee boundary, statutory consent, and response-shape tests | [s16-l7.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s16-l7.md) |
| **L8** | `eecde05` | Six formal boundary tests, guard matrix, and cross-school isolation | [s16-l8.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s16-l8.md) |
| **L9** | `9a19142` | Release verdict & final sign-off documentation | [s16-verdict.md](file:///v:/Cascade/2026/Edu_core/docs/release-evidence/s16-verdict.md) |

---

## 5. Automated Test & Typecheck Verification

- **Boundary Tests Suite (`dualRoleBoundaryTests.test.ts`)**: 8 passed, 0 failed.
- **DPDP Fee Boundary Suite (`teacherFeeBoundary.test.ts`)**: 5 passed, 0 failed.
- **Frontend Typecheck (`tsc --noEmit`)**: 0 errors.
- **Backend Typecheck (`tsc --noEmit`)**: 0 errors.
- **Dependency & Migration Invariant**: 0 new npm packages; 1 additive migration (`0054_dual_role_teacher_assignments.sql`).

---

## 6. Explicit Residual Risks & Operational Notes

1. **RLS Scope**: In accordance with Open Decision OD1, PostgreSQL Row-Level Security is strictly enabled on the two teacher assignment tables (`class_teacher_assignments`, `section_subject_teachers`) and the new holistic remarks table (`homeroom_report_remarks`). Rollout across all remaining core tables continues under the separately tracked RLS tranche.
2. **Historical Class Teacher Scoping**: In accordance with Open Decision OD4, initial backfill for `class_teacher_assignments` populated active records for the current academic year from `sections.class_teacher_id`. Prior years remain empty archives rather than fabricating unverified historical designations.

---

## 7. Sign-Off

All architecture invariants, security closures, guard boundaries, UI workspace surfaces, and test assertions specified in `S16-DUAL-ROLE-TEACHER-AUTH` have been met with rigorous evidence. Specification S16 is hereby marked **COMPLETE** and approved for production release.
