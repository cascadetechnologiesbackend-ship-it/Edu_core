---
name: spec-driven-role-pwa
description: End-to-end recipe for implementing spec-driven role PWAs (Parent, Teacher, Student, Driver) with Zero-Clutter feed engines, catalog indexing, and strict click budgets.
---

# Spec-Driven Role PWA Implementation Recipe

Use this skill when developing or extending role-based PWA modules in the SchoolMitra ERP.

## Phase Implementation Cycle
1. **Schema & Migration**:
   - Define Drizzle schema with tenant FK (`schoolId`) and RLS policies.
   - Generate numbered migration (`00xx_*.sql`) with `--> statement-breakpoint`.
   - Update `meta/_journal.json` with monotonically increasing timestamp and `database/src/migrations/catalog.ts`.
   - Register table and relations in `packages/entity-engine/src/catalog/entityGraph.ts` (verify no duplicate keys).
2. **Pure Feed Engine (`derive<Role>Feed.ts`)**:
   - Define card payload types, tiers ($T0, T1, T2$), and priority numbers.
   - Implement pure derivation logic returning only cards matching real data conditions.
   - Implement automated suppression rules (leave approved $\to$ suppress absence; open query $\to$ suppress fee overdue).
   - Implement multi-ward/multi-entity merging (`mergeMultiWardFeeds`).
3. **UI Components & Workflows Hub**:
   - Create card components with bilingual text support and `<span data-testid="ward-chip">`.
   - Implement two-way server actions using `withTenant(school.id)` and typed transaction callbacks `tx: Db`.
   - Build or update `/more` Workflows Hub with search, category tabs, and live status chips.
   - Verify click budgets ($\le 2$ taps for payment, $\le 3$ for booking/editing, $\le 4$ for applications).
4. **Testing & Quality Assurance**:
   - Write phase-specific Vitest suite covering edge cases, suppression, zero-clutter, and click budgets.
   - Run `pnpm --filter <package> test`.
   - Run monorepo type-check `pnpm run type-check` across all 7 packages.
   - Stage and commit with clean conventional message.
