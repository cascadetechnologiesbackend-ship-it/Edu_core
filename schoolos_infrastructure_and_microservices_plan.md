# SchoolOS Infrastructure & Microservices Master Plan V1.0

This master architectural blueprint documents the current infrastructure, domain-isolated Git branching strategy, Turborepo multi-app microservices workspace layout, multi-tenancy database model, and execution roadmap for evolving **`Edu_core`** into **`SchoolOS`** (built to scale for 10,000+ schools).

---

## 1. Current Infrastructure Breakdown

The current **`Edu_core`** infrastructure is active and healthy:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Turborepo Monorepo                                │
│  apps/web (Next.js 14 App Router @ http://localhost:3002)                   │
│  packages/dpdp  │  packages/validators  │  packages/i18n                    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      ▼                            ▼                            ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│ PostgreSQL 16│             │   Redis 7    │             │ MinIO (S3)   │
│ Port: 5444   │             │ Port: 6379   │             │ Ports: 9000/1│
│ DB: school.. │             │ Cache/Queues │             │ S3 Buckets   │
└──────────────┘             └──────────────┘             └──────────────┘
```

* **Frontend & Web Portal**: Next.js 14 App Router on `http://localhost:3002`.
* **Database Layer**: PostgreSQL 16 Alpine on port `5444` (`schoolmitra_erp`). Features `pgcrypto` for AES-256 PII column encryption, schema-per-tenant (`tenant_<udiseCode>`), and database-enforced append-only triggers on `audit_logs`.
* **Cache & Event Queue**: Redis 7 Alpine on port `6379` for rate-limiting, session management, and BullMQ background queue processing.
* **Object Storage**: MinIO S3-compatible service (Port 9000 API / 9001 Console) serving pre-signed document and photo URLs (15-min TTL).

---

## 2. Domain-Isolated Git Branching Strategy

To support multi-team parallel development across core business domains without code conflicts:

```
                          ┌──> domain/identity ───> feat/oauth2-totp
                          ├──> domain/people ─────> feat/unified-person-model
                          ├──> domain/admissions ──> feat/multi-step-wizard
                          ├──> domain/academics ───> feat/timetable-scheduler
main (Production) <── staging ┼──> domain/finance ─────> feat/razorpay-v2
                          ├──> domain/attendance ──> feat/biometric-sync
                          ├──> domain/exams ───────> feat/pdf-report-cards
                          └──> domain/transport ───> feat/live-gps-ping
```

### Branch Hierarchy Rules:
1. **`main`**: Production-ready releases only. Tagged with SemVer (`v1.0.0`, `v1.1.0`).
2. **`staging`**: Pre-production integration testing branch.
3. **`domain/<domain-name>`** (e.g., `domain/identity`, `domain/academics`, `domain/finance`): Long-lived domain integration branches.
4. **`feat/<domain>-<feature>`**: Short-lived feature branches created from the respective domain branch and merged back via Pull Request.

---

## 3. Microservices Workspace Architecture (Turborepo Multi-App)

Without creating external repositories, all 14 microservices and the unified API Gateway are organized inside the `apps/` directory of the `Edu_core` monorepo:

```
Edu_core/
├── apps/
│   ├── api-gateway/            # Unified Entry Point (JWT, Rate Limiting, DPDP Router)
│   ├── web/                    # Next.js Management Portal UI
│   └── services/               # Microservices Suite
│       ├── identity/           # Auth, TOTP, RBAC Permissions Matrix
│       ├── people/             # Unified Person Core & Profile Extensions
│       ├── admissions/         # Multi-step Admission Workflows & Verification
│       ├── academics/          # Classrooms, Subjects, Timetables, Homework
│       ├── finance/            # Fee Structures, Invoices, Razorpay Webhooks
│       ├── attendance/         # Student/Staff Registers & Alert Triggers
│       ├── examinations/       # Exams, Marks Grid, PDF Report Card Generator
│       ├── hr/                 # Staff Directory, Leave Approvals, Payroll Runs
│       ├── library/            # Barcode Books Catalog, Issue/Return Checkout
│       ├── transport/          # Vehicles, Bus Stops, Live GPS Tracking
│       ├── communication/      # Push Notifications, SMS, Email Dispatcher
│       ├── hostel/             # Room Allocation, Bed Management
│       └── inventory/          # Stock Transactions, Item Requisitions
└── packages/
    ├── dpdp/                   # DPDP Act 2023 Consent & Audit Engine
    ├── validators/             # Shared Zod Input/Output Schemas
    └── domain-events/          # Shared Event Interfaces & Publisher SDK
```

---

## 4. Multi-Tenancy & Database Architecture

* **Engine**: PostgreSQL 16 with schema-per-tenant partitioning (`tenant_<udiseCode>`).
* **Tenant Isolation**: Every microservice executes DB operations wrapped inside `withTenant(tenantSlug, callback)` using `SET LOCAL search_path TO tenant_<udiseCode>, public`.
* **Domain Ownership**: Microservices own their respective domain tables (e.g., `services/identity` owns `users`/`sessions`, `services/people` owns `persons`/`student_profiles`).

---

## 5. Inter-Microservice Event Bus (Redis + BullMQ)

Microservices communicate asynchronously via **Domain Events** to ensure high performance and loose coupling:

```
[Admissions Microservice]
        │
        ▼ Publishes `StudentEnrolledEvent`
┌─────────────────────────────────────────────────────────┐
│              Redis 7 + BullMQ Event Bus                 │
└───────┬───────────────────┬───────────────────┬─────────┘
        │                   │                   │
        ▼                   ▼                   ▼
[Library Service]    [Transport Service] [Communication Service]
Auto-create Library  Map Default Bus    Dispatch Welcome SMS/Email
Card Member          Stop               to Parents
```

---

## 6. Execution Roadmap & Phase Plan

### Phase 1: Repository Restructuring & Shared Packages (Weeks 1–2)
* Create `packages/domain-events` containing the standard event publisher and definitions.
* Establish domain branches (`domain/identity`, `domain/people`, `domain/academics`, etc.).
* Set up `apps/api-gateway` shell.

### Phase 2: Core Domain Services Refactoring (Weeks 3–4)
* Implement `persons` core schema in `packages/validators` and database layer.
* Extract business logic from Server Actions into dedicated Domain Services (`AdmissionsDomainService`, `StudentsDomainService`, `FinanceDomainService`).

### Phase 3: Pending Microservices Development (Weeks 5–6)
* Develop UI and microservice handlers for pending modules:
  * **Communication**: Push notification templates and dispatch logs.
  * **Hostel**: Room allotment grids and bed management.
  * **Inventory**: Stock item requisitions and transaction logs.

### Phase 4: Production Staging & E2E Validation (Week 7)
* Run end-to-end integration test suites across all 14 microservices via API Gateway.
* Execute multi-tenant load testing simulating 10,000 requests/minute.

---
