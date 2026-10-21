# Edu_core Agent Instructions & Guidelines

## Active UI/UX & Module Specification
The repository follows the authoritative UI/UX, workflow, design feel, and architecture specifications:
- **Active Track**: [docs/parent-pwa-spec.json](file:///v:/Cascade/2026/Edu_core/docs/parent-pwa-spec.json) (Parent PWA Specification v1.0 — Zero-Clutter, High-Intent Event-Driven Feed)
- **Predecessor & Foundation**: [docs/uiux-spec.json](file:///v:/Cascade/2026/Edu_core/docs/uiux-spec.json) (AMS/ClassHub/Student 360 Specification v1.2 — Phases 1–9 landed on main; Phases 10–11 are PAUSED and will resume later)

### Execution Rules for Active Track (Parent PWA):
1. **Spec Compliance**: All modifications to the Parent App/PWA, Parent Feed, Bus Live Card, Fee Payment Card, Notification Matrix, and Parent Event Engine must strictly follow `docs/parent-pwa-spec.json`.
2. **Phase Boundaries**: Work one phase per agent task using the `implementation_order` phases (P1 through P8) as strict task boundaries. Never mix phases in a single session.
3. **Paused AMS Phases**: AMS Phases 10–11 are PAUSED. Do not implement them in this track. Do not break their anchors or shared component import contracts.
4. **Pre-edit Verification**: Before modifying any file listed in `files_in_scope`, read it in full to verify anchors and existing state.
5. **Zero-Clutter High-Intent Rule (AC-P1)**: The home feed contains only what today's data says matters. With all invoices paid, no bus pass, attendance PRESENT, and no notices, the home feed renders only the calm Today strip and child header. No card renders unconditionally.
6. **Zero New Dependencies**:
   - Do NOT add new npm dependencies.
   - Use already-installed packages: `@tanstack/react-query`, `@radix-ui/*`, `sonner`, `recharts`, `tailwindcss-animate`, `leaflet`, `react-leaflet`, `next-intl`, `date-fns`, `razorpay`, `bullmq`, `ioredis`, `@schoolmitra/domain-events`.
7. **Security & DPDP Integrity**:
   - RBAC, tenant isolation, and DPDP constraints strictly take precedence over UI convenience.
   - `sw.js` privacy rules must remain intact byte-for-byte; authenticated HTML is never cached.
   - Parent-facing copy never uses shame words (defaulter, risk score, churn); all copy remains calm, dignified, and explainable.

## Role PWA & Zero-Clutter Architecture Standards
For all role-based applications (Parent, Teacher, Student, Driver, Admin), follow:
- [.agents/rules/role-spec-driven-architecture.md](file:///v:/Cascade/2026/Edu_core/.agents/rules/role-spec-driven-architecture.md)
- **Zero-Clutter Invariant**: No card renders unconditionally. Calm state renders only the identity/today strip.
- **Strict Click Budgets**: All primary user workflows must complete in 2 to 4 taps.
- **DPDP Act 2023 Compliance & Bilingual Dignity**: English + Hindi support across all cards; zero shame words.
- **Schema Registration**: All new tables must be cataloged in `packages/entity-engine/src/catalog/entityGraph.ts` with no duplicate keys.

