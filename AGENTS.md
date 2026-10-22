# Edu_core Agent Instructions & Guidelines

## Active UI/UX & Module Specification
The repository follows the authoritative UI/UX, workflow, design feel, and architecture specifications:
- **Active Track**: [docs/student-pwa-spec.json](file:///v:/Cascade/2026/Edu_core/docs/student-pwa-spec.json) (Student PWA Specification v1.0 — Student Identity Provisioning, PWA Shell, Home Feed, Homework Center, Timetable & Marks, Omnibox, Offline Support)
- **Predecessor Specs**:
  - [docs/academic-feed-spec.json](file:///v:/Cascade/2026/Edu_core/docs/academic-feed-spec.json) (Academic Feed Specification v1.0 — Phases F1–F7 landed on main at head 2fdf08bc, v11.21.0)
  - [docs/entity-engine-spec.json](file:///v:/Cascade/2026/Edu_core/docs/entity-engine-spec.json) (Entity Engine Specification v1.1 — Phases E1–E7 landed on main at head 6354f4fa, v11.20.0)
  - [docs/teacher-pwa-spec.json](file:///v:/Cascade/2026/Edu_core/docs/teacher-pwa-spec.json) (Teacher PWA Specification v1.0 — Phases T1–T10 landed on main at head d7491df6)
  - [docs/parent-pwa-spec.json](file:///v:/Cascade/2026/Edu_core/docs/parent-pwa-spec.json) (Parent PWA Specification v1.0–v1.2 — Phases P1–P16 landed on main at head c6dff507, v11.18.0)
  - [docs/uiux-spec.json](file:///v:/Cascade/2026/Edu_core/docs/uiux-spec.json) (AMS/ClassHub/Student 360 Specification v1.2 — Phases 1–11 landed on main)

### Execution Rules for Active Track (Student PWA):
1. **Spec Compliance**: All modifications to the Student App/PWA, Student Identity Provisioning, Admin Student Access Queue, Home Feed, Homework Center, Timetable Grid, Marks & Attendance Views, Syllabus Tracker, Student Omnibox, and Offline Submissions must strictly follow `docs/student-pwa-spec.json`.
2. **Phase Boundaries**: Work one phase per agent task using the `implementation_order` phases (S1 through S7) as strict task boundaries. Never mix phases in a single session.
3. **Landed Foundations Integrity**: Teacher PWA, Parent PWA, and Academic Feed (F1-F7) landed on main and must not regress. Do not modify teacher grading columns or F6 roster behaviors.
4. **Pre-edit Verification**: Before modifying any file listed in `files_in_scope`, read it in full to verify anchors and existing state.
5. **Zero-Clutter High-Intent Rule (AC-5)**: The home feed contains only what today's data says matters. Calm state renders only greeting + date + today strip. No card renders unconditionally.
6. **Zero New Dependencies & Single Permitted Migration**:
   - Do NOT add new npm dependencies.
   - At most ONE migration permitted (`student_content` on `assignment_submissions`), only if required after verification.
7. **Security, Tenant Isolation & DPDP Integrity**:
   - RBAC, tenant isolation (`withTenant`), and DPDP constraints strictly take precedence over UI convenience.
   - Minor-safety: no student email required; claim flow uses admission number + DOB with rate limiting.
   - Student never sees another student's data. All queries inside withTenant/RLS. All writes audit-logged.
   - Every phase must pass typecheck, build, and page-render smoke tests before commit.


## Role PWA & Zero-Clutter Architecture Standards
For all role-based applications (Parent, Teacher, Student, Driver, Admin), follow:
- [.agents/rules/role-spec-driven-architecture.md](file:///v:/Cascade/2026/Edu_core/.agents/rules/role-spec-driven-architecture.md)
- **Zero-Clutter Invariant**: No card renders unconditionally. Calm state renders only the identity/today strip.
- **Strict Click Budgets**: All primary user workflows must complete in 2 to 4 taps.
- **DPDP Act 2023 Compliance & Bilingual Dignity**: English + Hindi support across all cards; zero shame words.
- **Schema Registration**: All new tables must be cataloged in `packages/entity-engine/src/catalog/entityGraph.ts` with no duplicate keys.

