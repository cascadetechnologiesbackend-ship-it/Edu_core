# Edu_core Agent Instructions & Guidelines

## Active UI/UX & Module Specification
The repository follows the authoritative UI/UX, workflow, design feel, and architecture specifications:
- **Active Track**: [docs/entity-engine-spec.json](file:///v:/Cascade/2026/Edu_core/docs/entity-engine-spec.json) (Entity Engine Specification v1.1 — Omnibox NER, DPDP PII Scan Enforcement, Role Omniboxes & Catalog Completeness)
- **Predecessor Specs**:
  - [docs/teacher-pwa-spec.json](file:///v:/Cascade/2026/Edu_core/docs/teacher-pwa-spec.json) (Teacher PWA Specification v1.0 — Phases T1–T10 landed on main at head d7491df6)
  - [docs/parent-pwa-spec.json](file:///v:/Cascade/2026/Edu_core/docs/parent-pwa-spec.json) (Parent PWA Specification v1.0–v1.2 — Phases P1–P16 landed on main at head c6dff507, v11.18.0)
  - [docs/uiux-spec.json](file:///v:/Cascade/2026/Edu_core/docs/uiux-spec.json) (AMS/ClassHub/Student 360 Specification v1.2 — Phases 1–11 landed on main)

### Execution Rules for Active Track (Teacher PWA):
1. **Spec Compliance**: All modifications to the Teacher App/PWA, Attendance Workbench, Grading Queue, Marks Entry Grid, My Day Timeline, Substitution Card, and Teacher Event Engine must strictly follow `docs/teacher-pwa-spec.json`.
2. **Phase Boundaries**: Work one phase per agent task using the `implementation_order` phases (T1 through T10) as strict task boundaries. Never mix phases in a single session.
3. **Landed Foundations Integrity**: Parent PWA, Leave Queue (`TeacherLeaveQueue`), and PTM Client (`TeacherPTMClient`) landed on main and must not regress. Do not break their anchors or shared component contracts.
4. **Pre-edit Verification**: Before modifying any file listed in `files_in_scope`, read it in full to verify anchors and existing state.
5. **Zero-Clutter High-Intent Rule (AC-T1)**: The home feed contains only what today's data says matters. With all sections marked, no grading backlog, no open exam window, and no pending requests, the home feed renders only the calm Today strip and IdentityHeader with a day-complete strip. No card renders unconditionally.
6. **Zero New Dependencies**:
   - Do NOT add new npm dependencies.
   - Use already-installed packages: `@tanstack/react-query`, `@radix-ui/*`, `sonner`, `recharts`, `tailwindcss-animate`, `leaflet`, `react-leaflet`, `next-intl`, `date-fns`, `razorpay`, `bullmq`, `ioredis`, `@schoolmitra/domain-events`.
7. **Security, Tenant Isolation & DPDP Integrity**:
   - RBAC, tenant isolation (`withTenant`), and DPDP constraints strictly take precedence over UI convenience.
   - `sw.js` privacy rules must remain intact byte-for-byte; authenticated HTML is never cached. Offline attendance operates via client-side IndexedDB and reconnect listeners.
   - Teacher-facing copy never exposes other teachers' payroll, other sections' marks, or any parent's fee amounts (status badges only). All copy remains calm, dignified, and explainable.

## Role PWA & Zero-Clutter Architecture Standards
For all role-based applications (Parent, Teacher, Student, Driver, Admin), follow:
- [.agents/rules/role-spec-driven-architecture.md](file:///v:/Cascade/2026/Edu_core/.agents/rules/role-spec-driven-architecture.md)
- **Zero-Clutter Invariant**: No card renders unconditionally. Calm state renders only the identity/today strip.
- **Strict Click Budgets**: All primary user workflows must complete in 2 to 4 taps.
- **DPDP Act 2023 Compliance & Bilingual Dignity**: English + Hindi support across all cards; zero shame words.
- **Schema Registration**: All new tables must be cataloged in `packages/entity-engine/src/catalog/entityGraph.ts` with no duplicate keys.

