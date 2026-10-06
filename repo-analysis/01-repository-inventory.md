# 01 — Repository Inventory
## SchoolMitra ERP

---

## Monorepo Structure

```
schoolmitra-erp/                     # Root monorepo (pnpm workspace)
├── backend/                         # @schoolmitra/backend — tRPC routers, business logic, workers
│   └── src/
│       ├── lib/                     # Domain engines and utilities
│       ├── server/                  # tRPC root router, context, middleware, routers
│       ├── types/                   # TypeScript type declarations
│       └── workers/                 # BullMQ workers (reportCard, retention)
├── database/                        # @schoolmitra/database — Drizzle schema, migrations, seeds
│   └── src/
│       ├── schema/                  # 17 domain schema files
│       ├── migrations/              # SQL migration files (CONFLICT: see below)
│       ├── index.ts                 # DB connection pool export
│       ├── migrate.ts               # Migration runner
│       ├── seed.ts                  # Seed data
│       ├── factory_reset.ts         # Development reset script
│       └── manage_super_admin.ts    # CLI for super admin creation
├── frontend/                        # @schoolmitra/frontend — Next.js 14 App Router
│   └── src/
│       ├── app/                     # Next.js App Router pages and layouts
│       │   ├── (admin)/             # School admin role group
│       │   ├── (principal)/         # Principal role group
│       │   ├── (teacher)/           # Teacher role group
│       │   ├── (accountant)/        # Accountant role group
│       │   ├── (hr-manager)/        # HR Manager role group
│       │   ├── (librarian)/         # Librarian role group
│       │   ├── (transport-manager)/ # Transport Manager role group
│       │   ├── (parent)/            # Parent role group
│       │   ├── (student)/           # Student role group
│       │   ├── (driver)/            # Driver role group
│       │   ├── (super-admin)/       # Super Admin platform group
│       │   ├── (auth)/              # Login, forgot password
│       │   ├── actions/             # Next.js Server Actions (changePassword, onboard)
│       │   ├── api/                 # API routes (trpc handler, auth handler, webhooks, health)
│       │   ├── onboard/             # School onboarding flow
│       │   └── platform/            # Platform-level pages
│       ├── components/              # Shared UI components
│       ├── features/                # Feature slices (academics, admissions, attendance, fees, hr)
│       ├── lib/                     # Frontend lib (auth re-exports, trpc client)
│       ├── middleware.ts            # Next.js middleware (auth guard)
│       └── types/                   # TypeScript types
│   ├── e2e/                         # Playwright E2E tests
│   ├── Dockerfile                   # ⚠️ BROKEN — references apps/web not frontend/
│   └── next.config.mjs              # Next.js configuration
├── packages/
│   ├── validators/                  # @schoolmitra/validators — Zod schemas
│   ├── dpdp/                        # @schoolmitra/dpdp — DPDP consent purpose definitions
│   ├── domain-events/               # @schoolmitra/domain-events — event type definitions
│   └── i18n/                        # @schoolmitra/i18n — internationalization
├── infra/infra/                     # ⚠️ Empty nested directory — no IaC content found
├── render.yaml                      # Render.com deployment configuration
├── turbo.json                       # Turborepo pipeline configuration
├── pnpm-workspace.yaml              # pnpm workspace definition
├── package.json                     # Root scripts
├── tsconfig.base.json               # Shared TypeScript config
├── .env                             # Root environment variables (development)
├── .gitignore
├── .husky/                          # Git hooks (husky)
└── scratch/                         # Development scratch files
```

---

## Technology Stack

| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| Language | TypeScript | ^5.4.x | Strict mode in most packages |
| Runtime | Node.js | >=20.0.0 | |
| Package Manager | pnpm | 9.7.0 | Frozen lockfile enforced |
| Build System | Turborepo | ^2.0.0 | Parallel builds |
| Frontend Framework | Next.js | 14.2.3 | App Router, RSC, Server Actions |
| UI Library | Radix UI | Various | Accordion, Dialog, Select, etc. |
| Styling | Tailwind CSS | ^3.4.3 | + tailwind-merge, CVA |
| Forms | React Hook Form | ^7.81.0 | + Zod resolvers |
| State (server) | TanStack Query | ^5.28.0 | via tRPC client |
| Tables | TanStack Table | ^8.15.3 | |
| Charts | Recharts | ^2.12.3 | |
| Maps | Leaflet / React-Leaflet | ^1.9.4 / ^4.2.1 | Transport tracking |
| Icons | Lucide React | ^0.359.0 | |
| Backend API | tRPC | ^11.0.0 | server + client |
| Serialization | superjson | ^2.2.1 | tRPC transformer |
| Database | PostgreSQL | Production (external) | |
| ORM | Drizzle ORM | ^0.30.10 | |
| Drizzle Kit | drizzle-kit | ^0.20.18 | Schema generation |
| Authentication | NextAuth v5 beta | ^5.0.0-beta.16 | JWT strategy |
| Auth Adapter | @auth/drizzle-adapter | ^1.1.0 | |
| Password Hashing | bcryptjs | ^2.4.3 | |
| Encryption | Node.js crypto (built-in) | — | AES-256-CBC |
| OTP/TOTP | otplib | ^12.0.1 | |
| Queue/Jobs | BullMQ | ^5.4.2 | |
| Cache/Pub-Sub | ioredis | ^5.3.2 | |
| Object Storage | AWS SDK v3 | ^3.1085.0 | S3 + presigner |
| Payments | Razorpay | ^2.9.2 | |
| Email | Nodemailer | ^6.9.13 | |
| SMS | (placeholder) | — | otplib + interface present |
| PDF Generation | @react-pdf/renderer | ^3.4.0 | Report cards, receipts |
| Excel Export | xlsx | ^0.18.5 | ⚠️ Known vulnerabilities |
| Validation | Zod | ^3.25.76 | |
| Logging | pino | ^10.3.1 | pino-pretty for dev |
| HTTP security | Custom (next.config) | — | CSP, HSTS, X-Frame |
| Testing (unit) | Vitest | ^1.5.0 | |
| Testing (component) | Testing Library | ^15.0.2 | |
| Testing (E2E) | Playwright | ^1.61.1 | |
| Linting | ESLint | ^8.57.0 | eslint-config-next |
| Formatting | Prettier | ^3.2.0 | |
| Git Hooks | Husky | ^9.0.0 | |
| Commit Linting | commitlint | ^19.0.0 | conventional commits |
| Deployment | Render.com | Starter plan | Single web service |
| Container | Dockerfile | — | ⚠️ BROKEN paths |

---

## Database Schema Domains (17 files)

| File | Domain | Key Tables |
|------|--------|------------|
| `core.ts` | Foundation | schools, academic_years, roles, permissions, users, sessions, audit_logs, super_admin_users |
| `people.ts` | Person Registry | persons, person_identities, person_relations |
| `students.ts` | Student Data | students, student_family_members, student_medical_records, student_class_history, student_documents, alumni |
| `academics.ts` | Academic Management | classes, sections, subjects, class_subjects, timetable_periods, lesson_plans, assignments, assessments, syllabus_units/chapters/topics |
| `fees.ts` | Fee Management | fee_heads, fee_structures, fee_concessions, fee_invoices, fee_payments, fee_refunds, payment_gateway_logs |
| `hr.ts` | HR & Payroll | departments, designations, staff, leave_types, leave_requests, salary_components, payroll_runs, payslips, salary_templates, staff_documents, staff_loans, leave_balances |
| `attendance.ts` | Attendance | student_attendance, staff_attendance, attendance_notifications |
| `admissions.ts` | Admissions | admission_applications, admission_documents, admission_workflow_steps, waitlist |
| `examinations.ts` | Examinations | exam_types, exams, mark_entries, grade_rules, report_card_jobs |
| `dpdp.ts` | DPDP Compliance | consent_purposes, consent_records, privacy_notices, rights_requests, dpdp_grievances, data_breach_log, vendor_register, data_retention_policies |
| `superadmin.ts` | Platform Admin | global_template_profiles, global_template_*, platform_announcements, impersonation_sessions |
| `communication.ts` | Messaging | (tables unknown) |
| `transport.ts` | Transport | (tables unknown) |
| `library.ts` | Library | (tables unknown) |
| `hostel.ts` | Hostel | (tables unknown) |
| `inventory.ts` | Inventory | (tables unknown) |
| `drivers.ts` | Driver data | (tables unknown) |

---

## Migration Files (⚠️ SEQUENCE CONFLICT)

| File | Status |
|------|--------|
| `0000_dark_garia.sql` | OK — initial schema |
| `0001_lame_shooting_star.sql` | ⚠️ CONFLICT |
| `0001_perf_indexes.sql` | ⚠️ CONFLICT — same sequence number |
| `0002_auth_tokens.sql` | ⚠️ CONFLICT |
| `0002_cuddly_colossus.sql` | ⚠️ CONFLICT — same sequence number |
| `0003_watery_vapor.sql` | OK |
| `0004_handy_major_mapleleaf.sql` | OK |
| `0005_hr_phase1_master_data.sql` | OK |
| `0006_admission_blood_group.sql` | ⚠️ CONFLICT |
| `0006_huge_ultimates.sql` | ⚠️ CONFLICT — same sequence number |
| `0007_fee_heads_priority_and_matrix.sql` | OK |
| `0008_admission_transport_hostel_optin.sql` | OK |
| `0009_core_module_hardening.sql` | OK — immutability triggers |

**3 sequence conflicts: 0001, 0002, 0006 — P0 production blocker.**

---

## E2E Test Inventory (Playwright)

| File | Coverage |
|------|----------|
| `auth.spec.ts` | Login, logout, session management |
| `academics.spec.ts` | Academic management flows |
| `admission.spec.ts` | Admission application workflow |
| `attendance.spec.ts` | Attendance marking |
| `dpdp.spec.ts` | DPDP consent flows |
| `fee.spec.ts` | Fee collection |
| `library.spec.ts` | Library operations |
| `multitenancy.spec.ts` | Subdomain routing, tenant isolation |
| `rbac.spec.ts` | Role-based access control |
| `report-card.spec.ts` | Report card generation |
| `security.spec.ts` | Auth bypass prevention, rate limiting (PARTIALLY SKIPPED) |
| `transport.spec.ts` | Transport operations |

**Note:** `security.spec.ts` has commented-out assertions. CI pipeline is UNKNOWN — test execution on deployment is unconfirmed.

---

## Backend Workers

| File | Purpose |
|------|---------|
| `reportCard.ts` | BullMQ worker — generates PDF report cards asynchronously |
| `retention.ts` | BullMQ worker — DPDP data retention enforcement |

---

## Environment Variables (Referenced)

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | JWT signing | **YES** | ⚠️ Hardcoded fallback |
| `ENCRYPTION_KEY` | AES-256 PII encryption | **YES** | ⚠️ Hardcoded fallback |
| `DATABASE_URL` | PostgreSQL connection | YES | None |
| `educore_REDIS_URL` / `REDIS_URL` | Redis connection | YES | Localhost fallback |
| `S3_BUCKET` | Document storage bucket | YES | `schoolmitra-docs` fallback |
| `AWS_ACCESS_KEY_ID` | S3 access | YES | None |
| `AWS_SECRET_ACCESS_KEY` | S3 secret | YES | None |
| `RAZORPAY_KEY_ID` | Payment gateway | YES | None |
| `RAZORPAY_SECRET` | Payment gateway | YES | None |
| `CRON_SECRET` | Cron job auth | YES | `dev-cron-secret-fallback` |
| `TEST_AUTH_USER` | ⚠️ Auth bypass for testing | NO | None (must not be set in prod) |
| `NODE_VERSION` | Render.com node version | YES | 20.18.0 |
| `NEXT_OUTPUT_STANDALONE` | Docker standalone output | NO | Not set |

---

## External Dependencies Inventory

| Provider | Purpose | PII Shared |
|----------|---------|------------|
| Render.com | Hosting | Server environment |
| PostgreSQL | Primary database | ALL |
| Redis | Cache, BullMQ, rate limiting | Session tokens, lockout keys |
| AWS S3 | Document/photo storage | Student documents, photos |
| Razorpay | Payment processing | Payment amounts (no card data) |
| Nodemailer (SMTP) | Email delivery | Email addresses |
| otplib | OTP generation (local) | None |
| AWS SES (likely SMTP) | Email service | Email addresses |

---

## CI/CD and Infrastructure

| Artifact | Status |
|----------|--------|
| GitHub Actions / GitLab CI | NOT FOUND |
| Dockerfile | BROKEN (wrong paths) |
| render.yaml | Present — build + deploy only, no test step |
| infra/ directory | Present but empty (nested `infra/infra/`) |
| Helm / K8s manifests | NOT FOUND |
| Terraform / Pulumi | NOT FOUND |
