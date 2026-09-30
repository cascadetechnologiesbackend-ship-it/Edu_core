# Repository & Migration Integrity Guardrails

## 1. Git Tracking & Milestone Acceptance
- **Never declare any milestone, phase, or feature complete** unless all related files and packages are confirmed to be tracked by Git (`git status --short`, `git ls-files <dir>`).
- Passing tests (`tsc`, `next build`, Vitest, Playwright) on the local filesystem do NOT prove Git readiness.
- If newly created packages, migrations, or modules appear as untracked (`??`), stop and report a tracking defect.

## 2. Database Migration & Ledger Invariants
- **NEVER manually manipulate `drizzle.__drizzle_migrations`**:
  - No `UPDATE drizzle.__drizzle_migrations SET hash = ...`.
  - No manual `INSERT` or `DELETE` on migration ledger records.
- **Clean Database Reproducibility**:
  - Every migration file and sequence must be 100% reproducible from scratch on a clean, disposable PostgreSQL database.
  - If a migration fails or is renamed, investigate and resolve the root schema difference rather than forcing hashes in the database ledger.
- **Index & DDL Verification**:
  - Always verify DDL statements (especially partial unique indexes like `sst_active_unique_idx`) against live PostgreSQL system catalogs (`pg_indexes`, `pg_constraint`), not just migration files.

## 3. Next.js 14 Server Action Boundaries
- **Export Rules for `"use server"` Files**:
  - Only `async function` declarations may be exported.
  - NEVER use `export * from ...` inside a `"use server"` file.
  - NEVER export synchronous functions, constants, types, or variables from a `"use server"` file.
  - Place synchronous pure helpers, authorization logic, and calculations in server-only helper modules without `"use server"` (e.g., `actions/auth-helper.ts` or `lib/`).
- **Safe Path Revalidation**:
  - Wrap `revalidatePath(...)` in a `try/catch` block to prevent unhandled invariant crashes (`Invariant: static generation store missing`) when actions are executed in test scripts or CLI contexts.

## 4. Verification & Testing Hierarchy
- Strictly distinguish between verification tiers:
  1. **Tier 1 — Compile Verified**: TypeScript (`tsc --noEmit`) and Next.js build (`next build`) pass with Exit Code 0.
  2. **Tier 2 — Runtime / Integration Reachable**: Routes respond with valid HTTP status codes and database mutations execute correctly via server actions.
  3. **Tier 3 — Visual Browser QA**: Real browser session with interactive DOM assertions, click events, and viewport rendering.
- Never report Tier 1 or 2 as proof of Tier 3.

## 5. Domain Invariants (Academic Management System)
- **Section Teacher Precedence**: If an active allocation exists for `(class_subject_id, section_id)`, that section teacher has exclusive authority. Class-level subject teacher fallback applies only when no active section allocation exists.
- **Timetable Conflict Precedence**: Double-booking (teacher, room, class mapping) must be checked and validated prior to database insertion.
- **Lesson Plan Schema**: `lesson_plans` links to syllabus topics via `syllabus_topic_id`. Never introduce `section_id` into lesson plans.
