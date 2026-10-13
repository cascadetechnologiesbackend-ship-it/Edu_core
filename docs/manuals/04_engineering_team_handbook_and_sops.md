# SchoolMitra ERP — Engineering Team Handbook & SOPs

> **Document Classification**: Company Team Handbook & Standard Operating Procedures (SOPs)  
> **Target Audience**: Software Engineers, DevOps Team, QA Engineers, Engineering Managers  
> **Status**: Living Engineering Handbook  
> **Version**: 2.0.0  
> **Last Updated**: October 2026

---

## 1. Engineering Culture & Quality Principles

1. **Safety First**: Production regressions in an ERP stop school attendance, block fee payments, and impact children. Every change requires automated tests and strict type checking.
2. **Explicit over Implicit**: No hidden magic. Database queries, schema migrations, and role validations must be clear, transparent, and auditable.
3. **Defense in Depth**: Every Server Action validates authorization with `requireAuth()`, validates inputs with Zod schemas, and catches database constraints cleanly.
4. **Zero Downtime Discipline**: Schema migrations must be backwards-compatible; code must tolerate running simultaneously with both previous and incoming database states.

---

## 2. Developer Onboarding & Local Workstation Setup

### 2.1 Prerequisites
- **Node.js**: `v20.18.0` LTS (use `nvm` or `fnm`)
- **Package Manager**: `pnpm` `v9.7.0` (enabled via `corepack enable`)
- **Docker & Docker Compose**: For local PostgreSQL, Redis, and MinIO S3 emulation
- **Git**: Configured with signing keys and proper email identity

### 2.2 First-Time Repository Setup

```bash
# 1. Clone the repository
git clone https://github.com/cascadetechnologies/Edu_core.git
cd Edu_core

# 2. Install workspace dependencies
pnpm install

# 3. Initialize local environment variables
cp .env.example .env

# 4. Spin up local development services (Postgres, Redis, MinIO)
docker compose up -d

# 5. Execute database migrations & initial seeding
pnpm --filter @schoolmitra/database db:migrate
pnpm --filter @schoolmitra/database db:seed

# 6. Launch development server with hot-reload
pnpm dev
```

The application will be accessible at:
- **Main Web Application**: `http://localhost:3000`
- **MinIO S3 Console**: `http://localhost:9001` (`minioadmin` / `minioadmin`)
- **Database Connection**: `postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp`

---

## 3. Monorepo Structure & Package Toolchain

The repository is managed via **Turborepo** and **pnpm workspaces**:

```
Edu_core/
├── apps/
│   ├── frontend/             # Next.js 14 App Router (UI, Server Actions, PWA)
│   └── backend/              # Domain services, tRPC router, BullMQ background workers
├── packages/
│   ├── database/             # Drizzle ORM schema, migrations, seeders
│   ├── domain-events/        # Event bus definitions & audit events
│   ├── dpdp/                 # DPDP Act 2023 compliance libraries & consent graphs
│   ├── validators/           # Shared Zod validation schemas
│   └── i18n/                 # Multi-language translation dictionaries
├── docs/                     # Architecture manuals, SOPs, and runbooks
└── turbo.json                # Pipeline orchestration cache configuration
```

### Essential Turbo Commands

| Command | Action | Scope |
| :--- | :--- | :--- |
| `pnpm dev` | Starts Next.js and backend workers concurrently with hot reload | Workspace |
| `pnpm build` | Executes type-checking and builds production bundles | Workspace |
| `pnpm test` | Runs unit and integration test suites via Vitest | Workspace |
| `pnpm lint` | Executes ESLint with custom SchoolMitra compliance rules | Workspace |
| `pnpm --filter @schoolmitra/database db:generate` | Generates a new migration SQL file from schema changes | Database package |
| `pnpm --filter @schoolmitra/database db:migrate` | Applies pending migrations to the configured database | Database package |

---

## 4. Code Standards & Architecture Guidelines

### 4.1 TypeScript Strictness & Typing Invariants
- `strict: true` and `noImplicitAny: true` are mandatory across all `tsconfig.json` files.
- Never use the `any` type for domain models or database rows. Always derive types directly from Drizzle schema definitions:

```typescript
// Good: Type derived directly from source of truth
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import { students } from "@schoolmitra/database/schema";

export type Student = InferSelectModel<typeof students>;
export type NewStudent = InferInsertModel<typeof students>;
```

### 4.2 Next.js Server Components vs. Client Components
- **Default to React Server Components (RSC)**: Pages, layouts, data fetching tables, and read-only views must remain server components to eliminate client bundle overhead.
- **Client Components (`"use client"`)**: Restricted strictly to interactive leaves (modals, forms, date pickers, dropdowns, optimistic buttons).
- **Server Action Validation**: Every Server Action must validate inputs through Zod before querying the database:

```typescript
"use server";

import { requireAuth } from "@/lib/auth/guards";
import { createSchoolSchema } from "@schoolmitra/validators";
import { db } from "@/server/db";
import { schools } from "@schoolmitra/database/schema";

export async function createSchoolAction(rawData: unknown) {
  // 1. Authorization Guard
  await requireAuth(["SUPER_ADMIN"]);

  // 2. Schema Input Validation
  const result = createSchoolSchema.safeParse(rawData);
  if (!result.success) {
    return { success: false, errors: result.error.flatten().fieldErrors };
  }

  // 3. Database Execution
  try {
    const [newSchool] = await db.insert(schools).values(result.data).returning();
    return { success: true, school: newSchool };
  } catch (error) {
    return { success: false, message: "Database insertion failed" };
  }
}
```

---

## 5. Git Workflow & PR Quality Gates

### 5.1 Branching Model (Trunk-Based Development)
- `main`: Production-ready branch deployed to AWS ECS staging / production.
- Feature branches: `feat/<jira-id>-short-description` (e.g., `feat/EDU-104-pwa-png-icons`).
- Fix branches: `fix/<jira-id>-short-description` (e.g., `fix/EDU-105-enum-ilike-cast`).

### 5.2 Conventional Commit Standards
All commits must follow the Conventional Commits specification enforced by Husky:
- `feat:` A new user-facing feature
- `fix:` A bug fix
- `docs:` Documentation-only changes
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` Performance improvements
- `test:` Adding or refactoring tests
- `chore:` Build process, tooling, or dependency updates

### 5.3 Automated Pre-Commit & CI Gates
Before a PR can merge:
1. **Pre-commit hook (`husky`)**: Runs `pnpm lint-staged` ensuring formatting and types pass.
2. **CI Pipeline**:
   - `turbo run type-check`: Zero TypeScript compiler errors.
   - `turbo run lint`: Zero ESLint warnings or errors.
   - `turbo run test`: 100% test suite pass rate.
   - PR requires 1 senior engineer code review approval.

---

## 6. Database Migration & Schema Evolution SOP

### 6.1 Creating a Migration
1. Modify the schema definitions in `packages/database/src/schema/*.ts`.
2. Generate the migration SQL:
   ```bash
   pnpm --filter @schoolmitra/database db:generate
   ```
3. Inspect the generated SQL file in `packages/database/src/migrations/` to verify safe column defaults and indexing.
4. Test the migration locally against test Docker instances:
   ```bash
   pnpm --filter @schoolmitra/database db:migrate
   ```

### 6.2 Zero-Downtime Migration Rules
- **Rule 1: Additive Changes First**: Add new columns as `nullable` or with a safe `DEFAULT`. Never add a non-null column without a default in a single migration.
- **Rule 2: Two-Phase Column Renames**:
  - Phase 1: Add new column, write to both columns in application code.
  - Phase 2: Backfill data, switch reads to new column, drop old column in subsequent release.
- **Rule 3: Enums and Pattern Matching**: When filtering PostgreSQL enum columns with `ILIKE`, always cast the column explicitly: `sql`${col}::text ILIKE ${val}``.

### 6.3 Database Factory Reset SOP (AWS RDS)
When resetting an environment to a clean slate while preserving Super Admin credentials:
1. Run the audited factory reset script:
   ```bash
   node scratch/reset_rds_database.cjs
   ```
2. The script:
   - Drops all dynamic `tenant_%` schemas with `CASCADE`.
   - Truncates all 134 application tables with `RESTART IDENTITY CASCADE`.
   - Preserves `super_admin_users` and `drizzle.__drizzle_migrations`.
   - Reactivates primary Super Admin accounts (`is_active = true`).

---

## 7. Production Deployment & Rollback SOP

### 7.1 Standard AWS ECS Production Rollout
1. Merge PR to `main` branch.
2. Build and tag the multi-stage Docker image:
   ```bash
   docker buildx build --platform linux/amd64 -t 144911976586.dkr.ecr.ap-south-1.amazonaws.com/educore-app:latest --push .
   ```
3. Trigger ECS rolling service update:
   ```bash
   aws ecs update-service --cluster educore-cluster --service educore-service --force-new-deployment --region ap-south-1
   ```
4. Verify the deployment:
   ```bash
   aws ecs describe-services --cluster educore-cluster --services educore-service --region ap-south-1 --query "services[0].deployments"
   ```
5. Confirm ALB target group status:
   - Targets must transition to `healthy` on `/api/health`.

### 7.2 Emergency Rollback Procedure
If critical errors or elevated 5XX metrics occur post-deployment:
1. Identify the previous stable task definition revision (e.g., `educore-task:14`).
2. Point the ECS service back to the known good revision immediately:
   ```bash
   aws ecs update-service --cluster educore-cluster --service educore-service --task-definition educore-task:14 --region ap-south-1
   ```
3. Fargate will immediately initiate a rolling drain of the faulty tasks and replace them with the stable revision.

---

## 8. Incident Response & Escalation Matrix

### 8.1 Severity Level Classification

| Severity | Definition | Target Response (MTTA) | Target Resolution (MTTR) | Escalation |
| :--- | :--- | :--- | :--- | :--- |
| **P1 — Critical** | Complete platform outage, ALB returning 5XX, data corruption, or active security breach. | `< 15 minutes` | `< 1 hour` | CTO, Lead Architect, DevOps Lead |
| **P2 — Major** | Core module unavailable (e.g. fee collection failing, attendance roll call offline). | `< 30 minutes` | `< 4 hours` | Lead Backend Engineer, Module Owner |
| **P3 — Minor** | Non-critical feature glitch (e.g. PDF export formatting bug, report filter error). | `< 2 hours` | `< 24 hours` | Feature Team Engineer |
| **P4 — Low** | Cosmetic UI bug, minor typo, or enhancement request. | `< 1 business day` | Next Sprint | Sprint Backlog |

### 8.2 DPDP Data Breach Response Protocol
Under the Digital Personal Data Protection Act 2023, data fiduciaries must notify the Data Protection Board and affected principals upon identifying a personal data breach:
1. **Immediate Containment**: Isolate compromised tokens or sessions; revoke AWS IAM access keys or database credentials involved.
2. **Log Logging**: Record incident details in the `data_breach_log` table within 2 hours of detection.
3. **Forensic Audit**: Query `audit_logs` and CloudWatch access logs to determine the exact scope of compromised data principals.
4. **Regulatory Notification**: Prepare statutory report detailing breach nature, affected records, containment actions, and grievance contacts.
