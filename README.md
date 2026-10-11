# SchoolMitra ERP

> Enterprise-grade, multi-tenant school management ERP for Nursery through Class 10, engineered with statutory compliance for India's **Digital Personal Data Protection (DPDP) Act 2023**, immutable double-entry financial ledgers, and zero-trust tenant isolation.

---

## 1. System Architecture

SchoolMitra is structured as a high-performance TypeScript monorepo orchestrated via [Turborepo](https://turbo.build/) and [pnpm](https://pnpm.io/):

```
├── frontend/             # Next.js 14 App Router (React 18, Tailwind CSS, PWA, Server Actions)
├── backend/              # Node.js Worker & API runtime (BullMQ, Express, Redis connection factory)
├── database/             # Drizzle ORM schemas, migration runner, RLS tenant isolation policies
├── packages/
│   ├── dpdp/             # DPDP Act 2023 compliance engine (consent, audit trail, right-to-erasure)
│   ├── validators/       # Shared Zod schemas for input validation & contract enforcement
│   └── domain-events/    # Event schemas for asynchronous domain event messaging
└── docs/
    └── release-evidence/ # Empirical before/after verification logs backing all security claims
```

### Core Architectural Pillars
- **Zero-Trust Multi-Tenancy**: Defense-in-depth tenant isolation enforced at the application layer via `withTenant()` and at the database layer via PostgreSQL Row Level Security (RLS) policies keyed on `app.current_school_id`.
- **Double-Entry Financial Accounting**: Real-time balancing ledger with `FOR UPDATE` pessimistic row locking, idempotency keys, and payment state machine transitions guarding against double credit or fee drift.
- **DPDP Act 2023 Compliance**: Field-level AES-256-GCM authenticated encryption for PII, HMAC-SHA256 blind indexing for searchable fields, purpose-bound access control, 24-hour consent withdrawal enforcement, and lifecycle-safe data retention workers.
- **Offline-First PWA Shell**: Service worker caching restricted strictly to static assets, navigation fallbacks (`/offline`), and explicit `CLEAR_AUTH_CACHE` signaling upon sign-out.

---

## 2. Prerequisites & Local Setup

### Requirements
- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 9.0.0`
- **PostgreSQL**: `>= 15.0`
- **Redis**: `>= 7.0`
- **S3-compatible Object Storage**: AWS S3 or MinIO for local development

### Quickstart

1. **Clone and install dependencies**:
   ```bash
   git clone https://github.com/cascadetechnologiesbackend-ship-it/Edu_core.git
   cd Edu_core
   pnpm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` into each package or root `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Run database migrations and seed**:
   ```bash
   pnpm db:migrate
   pnpm --filter @schoolmitra/database run db:seed-coa
   ```

4. **Start development servers**:
   ```bash
   pnpm dev
   ```
   Web interface available at `http://localhost:3002`.

---

## 3. Environment Contract

| Variable | Description | Required In Production |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string with SSL | Yes |
| `REDIS_URL` | Redis connection URL (`rediss://...`) | Yes |
| `NEXTAUTH_SECRET` | Secret key for JWT session tokens (min 32 bytes) | Yes |
| `ENCRYPTION_KEY` | 32-byte hex/base64 key for AES-256-GCM PII encryption | Yes (Fails fast if missing) |
| `AWS_REGION` | AWS / S3 target region (e.g. `ap-south-1`) | Yes |
| `AWS_ACCESS_KEY_ID` | S3 IAM access key | Yes |
| `AWS_SECRET_ACCESS_KEY` | S3 IAM secret key | Yes |
| `AWS_S3_BUCKET_NAME` | Primary S3 storage bucket | Yes |
| `RAZORPAY_KEY_ID` | Razorpay payment gateway key | Yes |
| `RAZORPAY_KEY_SECRET` | Razorpay payment webhook/verification secret | Yes |
| `SMS_PROVIDER` | `twilio`, `fast2sms`, or `mock` (mock fails in prod) | Yes |
| `ALLOW_MOCK_SMS_IN_PROD`| Emergency override to allow mock SMS in production | No (Default: `false`) |

---

## 4. Database Migrations & Integrity

Migrations are sequentially versioned SQL files located in `database/src/migrations/`:

```bash
# Verify migration sequence numbering and journal synchronization
pnpm --filter @schoolmitra/database run db:check-migrations

# Execute outstanding forward migrations
pnpm db:migrate

# Seed standard Chart of Accounts
pnpm --filter @schoolmitra/database run db:seed-coa
```

> **Zero-Downtime Migration Rule**: Never perform destructive schema alterations (`DROP COLUMN`, `RENAME COLUMN`) in a single step. All column migrations use additive expansions followed by phased code rollouts.

---

## 5. Verification & Testing

Every code change must pass full verification without relaxed or skipped assertions:

```bash
# Run full monorepo type-check (all 6 packages)
pnpm run type-check

# Run backend unit & integration tests
pnpm --filter @schoolmitra/backend test

# Run frontend server action & unit tests
pnpm --filter @schoolmitra/frontend test

# Run bundle budget enforcement check
node frontend/scripts/check-bundle-budgets.mjs

# Run Playwright end-to-end suite (including cross-tenant isolation)
pnpm run test:e2e
```

---

## 6. Production Deployment Flow

Production infrastructure is declared in `render.yaml`:
1. **Build Step**: Packages are built in non-mutating mode (`pnpm run build`). No database migrations run during build.
2. **Pre-Deploy Command**: The web service runs migrations in an isolated pre-deploy step:
   ```bash
   pnpm --filter @schoolmitra/database run db:migrate && pnpm --filter @schoolmitra/database run db:seed-coa
   ```
3. **Multi-Service Topology**:
   - `educore-web`: Next.js web application server.
   - `educore-finance-worker`: Dedicated BullMQ worker processing fee rollups, reminders, and payment reconciliations.
   - `educore-retention-worker`: DPDP Act retention and consent withdrawal worker.
4. **Health Probes**: Liveness and readiness exposed at `/api/health` (includes database, Redis, and Git commit SHA tracking).

---

## 7. License & Compliance

Confidential and Proprietary. All rights reserved. Complies with DPDP Act 2023 statutory obligations for educational institutions handling minor data.
