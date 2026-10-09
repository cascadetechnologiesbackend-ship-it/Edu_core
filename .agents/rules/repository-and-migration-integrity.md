# Repository, Migration & Multi-Tenant Security Guardrails

## 1. Git Tracking & Monorepo Acceptance
- **Never declare any milestone, phase, or feature complete** unless all related files and packages are confirmed to be tracked by Git (`git status --short`, `git ls-files <dir>`).
- Passing tests (`tsc`, `next build`, Vitest, Playwright) on the local filesystem do NOT prove Git readiness.
- If newly created packages, migrations, or modules appear as untracked (`??`), stop and report a tracking defect.

## 2. Database Migration & Ledger Invariants
- **NEVER manually manipulate `drizzle.__drizzle_migrations`**:
  - No `UPDATE drizzle.__drizzle_migrations SET hash = ...`.
  - No manual `INSERT` or `DELETE` on migration ledger records.
- **Strict Monotonic Migration Timestamps (`_journal.json`)**:
  - Migration timestamps (`when` / `folderMillis`) in `_journal.json` MUST be strictly monotonically increasing.
  - NEVER lower or renumber existing timestamps in `_journal.json`. Drizzle's migrator uses `lastDbMigration.created_at < migration.folderMillis` from the single highest record in `drizzle.__drizzle_migrations`. Lowering historical timestamps causes Drizzle to silently skip all intermediate migrations on persistent staging/production databases.
- **Mandatory Migration Journal Synchronization (`_journal.json`)**:
  - Creating a `.sql` file in `database/src/migrations/` is INSUFFICIENT on its own. Drizzle's migration engine reads `meta/_journal.json` to determine the execution sequence and unapplied migrations.
  - Every migration file MUST have a corresponding entry in `database/src/migrations/meta/_journal.json` with correct `idx`, `version: "7"`, `when: <timestamp>`, `tag: <filename_without_ext>`, and `breakpoints: true`.
  - Run and verify `pnpm db:check-migrations` to guarantee the journal and filesystem remain 100% synchronized before committing.
- **Pre-Migration Ledger Sanitization in `migrate.ts`**:
  - The migration entrypoint (`migrate.ts`) must detect and normalize known legacy or out-of-order timestamps in `drizzle.__drizzle_migrations` before invoking `migrate()`.
  - If core relations expected from earlier migrations are missing, sanitize false future ledger records so unapplied migrations execute in sequence.
- **Mandatory Statement Breakpoints (`--> statement-breakpoint`)**:
  - Every migration file configured with `"breakpoints": true` in `_journal.json` MUST separate individual DDL statements with `--> statement-breakpoint`.
  - Without breakpoints, Drizzle executes the entire file as one query block, triggering transaction limitations on PostgreSQL enum alterations (`ALTER TYPE ... ADD VALUE`) and masking granular failure lines.
- **Relation Existence Guards in Multi-Step Migrations**:
  - When a migration alters a table or enum introduced in an earlier migration (e.g., `ALTER TABLE "account_ledger_transactions" ADD COLUMN ...`), ensure the base relation exists (`CREATE TABLE IF NOT EXISTS` or conditional execution) as defense-in-depth against out-of-order execution.
- **Clean Database Reproducibility**:
  - Every migration file and sequence must be 100% reproducible from scratch on a clean, disposable PostgreSQL database.
  - If a migration fails or is renamed, investigate and resolve the root schema difference rather than forcing hashes in the database ledger.
- **Index & DDL Verification**:
  - Always verify DDL statements (especially partial unique indexes like `sst_active_unique_idx`) against live PostgreSQL system catalogs (`pg_indexes`, `pg_constraint`), not just migration files.

## 3. Strict Multi-Tenant Isolation
- **Mandatory `schoolId` Filter**:
  - Every `SELECT`, `UPDATE`, `DELETE`, and `COUNT` query on tenant-scoped tables MUST include `eq(table.schoolId, activeSchool.id)`.
  - Never assume a foreign key (e.g. `studentId`) guarantees tenant isolation; always combine with `schoolId`.
- **Tenant Context Resolution**:
  - Resolve tenant via `requireSchool(ctx)` or `getActiveTenant()`. If tenant cannot be resolved, return 404 or redirect immediately.

## 4. Next.js 14 Server Action Boundaries & Security
- **Authentication & Authorization Guardrails**:
  - EVERY server action that performs a database mutation MUST begin with `requireAuth([...allowedRoles])` and `requireSchool(ctx)`.
  - NEVER accept user IDs, auditor IDs (`approvedById`, `collectedById`), or `schoolId` from client hidden inputs. Always derive them from the verified session context (`ctx.userId`, `school.id`).
- **Export Rules for `"use server"` Files**:
  - Only `async function` declarations may be exported.
  - NEVER use `export * from ...` inside a `"use server"` file.
  - NEVER export synchronous functions, constants, types, or variables from a `"use server"` file.
  - Place synchronous pure helpers, authorization logic, and calculations in server-only helper modules without `"use server"` (e.g., `lib/` or `actions/auth-helper.ts`).
- **Safe Path Revalidation**:
  - Wrap `revalidatePath(...)` in a `try/catch` block to prevent unhandled invariant crashes (`Invariant: static generation store missing`) when actions are executed in test scripts or CLI contexts.

## 5. Domain Service & Event Publishing Integrity
- **Single Source of Truth for Business Writes**:
  - All financial transactions, enrollments, and status changes MUST execute through their domain service (e.g., `FinanceDomainService.recordFeePayment()`), rather than ad-hoc inline SQL queries in UI actions or webhooks.
- **Domain Event Publishing**:
  - Mutations must publish domain events (e.g., `FeePaidEvent`, `StudentEnrolledEvent`) so that auxiliary systems (SMS/WhatsApp notifications, audit ledgers, accounting sync) trigger reliably.

## 6. Verification & Testing Hierarchy
- Strictly distinguish between verification tiers:
  1. **Tier 1 — Compile Verified**: TypeScript (`tsc --noEmit`) and Next.js build (`next build`) pass with Exit Code 0.
  2. **Tier 2 — Runtime / Integration Reachable**: Routes respond with valid HTTP status codes and database mutations execute correctly via server actions.
  3. **Tier 3 — Visual Browser QA**: Real browser session with interactive DOM assertions, click events, and viewport rendering.
- Never report Tier 1 or 2 as proof of Tier 3.

## 7. Domain Invariants (Academic Management System)
- **Section Teacher Precedence**: If an active allocation exists for `(class_subject_id, section_id)`, that section teacher has exclusive authority. Class-level subject teacher fallback applies only when no active section allocation exists.
- **Timetable Conflict Precedence**: Double-booking (teacher, room, class mapping) must be checked and validated prior to database insertion.
- **Lesson Plan Schema**: `lesson_plans` links to syllabus topics via `syllabus_topic_id`. Never introduce `section_id` into lesson plans.
