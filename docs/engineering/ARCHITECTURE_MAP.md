# SchoolMitra ERP — System Architecture Map (Phase 00)
**Directive**: `EDUCORE_MASTER_ENGINEERING_EXCELLENCE` v1.0.0  
**Audit Date**: November 25, 2026  
**Baseline Version**: `11.59.1`

---

## 1. Monorepo Structural Layers

```mermaid
flowchart TD
    subgraph ClientLayer ["Client / Consumer Layer"]
        BrowserAdmin["Admin Portal (Desktop Browser)"]
        BrowserTeacher["Teacher PWA (Mobile/Desktop)"]
        BrowserParent["Parent PWA (Mobile)"]
        BrowserStudent["Student PWA (Mobile)"]
    end

    subgraph PresentationLayer ["Frontend Application (@schoolmitra/frontend)"]
        NextRouter["Next.js 14.2.25 App Router"]
        ServerComponents["React Server Components (RSC)"]
        ClientComponents["React Client Components (RCC)"]
        TRPCClient["tRPC React Query Client (@trpc/client v11)"]
        RadixTailwind["Apple HIG Semantic UI (Tailwind + Radix)"]
    end

    subgraph APILayer ["Backend Application (@schoolmitra/backend)"]
        TRPCRouter["tRPC v11 Router (trpc.ts)"]
        AuthMiddleware["Server Auth & Session Guard (serverAuth.ts)"]
        TenantContext["Multi-Tenant Context Engine (tenant.ts withTenant)"]
        DomainServices["Domain Service Engines (Fees, Attendance, Exams)"]
        QueueProducers["BullMQ Job Dispatchers"]
    end

    subgraph DataProtectionLayer ["Compliance Layer (@schoolmitra/dpdp)"]
        ConsentEngine["DPDP Consent Verification"]
        PIIMasking["AES-256 PII Encryption / Masking"]
        RetentionPurge["Data Retention & Purge Lifecycle"]
    end

    subgraph PersistenceLayer ["Database & Infrastructure (@schoolmitra/database)"]
        DrizzleORM["Drizzle ORM 0.30.10"]
        PostgresPool["PostgreSQL 16 Connection Pool"]
        RLS["PostgreSQL Row-Level Security (FORCE RLS)"]
        ValkeyRedis["Valkey / Redis (Queues, Rate Limiting, Cache)"]
        S3Storage["AWS S3 / Cloudflare R2 (Encrypted Documents)"]
    end

    subgraph AsyncWorkerLayer ["Background Execution (@schoolmitra/backend/workers)"]
        BullMQWorkers["BullMQ Consumer Processes"]
        FinanceWorker["Finance Automation (Invoices, Late Fees)"]
        RetentionWorker["DPDP Retention & Data Purge"]
        CommWorker["Push & Notification Dispatcher"]
    end

    BrowserAdmin --> NextRouter
    BrowserTeacher --> NextRouter
    BrowserParent --> NextRouter
    BrowserStudent --> NextRouter

    NextRouter --> ServerComponents
    NextRouter --> ClientComponents
    ClientComponents --> TRPCClient
    TRPCClient --> TRPCRouter
    ServerComponents --> AuthMiddleware

    TRPCRouter --> AuthMiddleware
    AuthMiddleware --> TenantContext
    TenantContext --> DomainServices
    DomainServices --> DataProtectionLayer
    DataProtectionLayer --> DrizzleORM
    DomainServices --> QueueProducers

    QueueProducers --> ValkeyRedis
    ValkeyRedis --> BullMQWorkers
    BullMQWorkers --> FinanceWorker
    BullMQWorkers --> RetentionWorker
    BullMQWorkers --> CommWorker
    FinanceWorker --> DrizzleORM
    RetentionWorker --> DrizzleORM

    DrizzleORM --> PostgresPool
    PostgresPool --> RLS
    DomainServices --> S3Storage
```

---

## 2. Multi-Tenancy Resolution Lifecycle

Every request operates strictly under a single school tenant:
1. **Host Header Resolution**:
   - Subdomain mapping: `<slug>.schoolmitra.com` resolves `schools.slug`.
   - Local development: `<subdomain>.localhost:3002` resolves tenant.
   - Cloud deployment fallback (*.onrender.com, *.vercel.app): Tenant derived from authenticated session cookie.
2. **Session Context Injection**:
   - `serverAuth.ts` reads encrypted JWT session and extracts `user.schoolId` and `user.role`.
   - Impersonation: `SUPER_ADMIN` can assume tenant context via cryptographically signed `x-school-impersonation` cookie with mandatory reason audit logging.
3. **Database Tenant Isolation (`withTenant`)**:
   - Calls `db.transaction()` and executes:
     ```sql
     SET LOCAL app.current_school_id = '<school_uuid>';
     ```
   - PostgreSQL Row Level Security (RLS) inspects `current_setting('app.current_school_id', true)` to enforce row isolation.
   - **Architectural Invariant**: All operations inside `withTenant` MUST execute against the transaction client `tx`, never the unconfigured global pool `db`.

---

## 3. Data Protection & Privacy Architecture (DPDP Act 2023)
- **Zero-Storage for Student Phone/Email**: Minor students authenticate via `admissionNumber` + `dateOfBirth` with rate-limited claim sessions.
- **PII Obfuscation**: Aadhaar numbers masked to last 4 digits (`XXXX-XXXX-1234`).
- **Encrypted Field-Level Storage**: Government IDs and bank details encrypted with AES-256-GCM via `@schoolmitra/dpdp`.
- **Purpose-Specific Consents**: Academic, health, and transport processing require explicit verifiable parental consent before activation.

---

## 4. External Integrations Map

| Provider | Service / Protocol | Monorepo Usage | Security Controls |
| :--- | :--- | :--- | :--- |
| **Valkey / Redis** | Redis v7 / Valkey Protocol | Rate Limiter, BullMQ Queues, School Cache | TLS in transit, circuit breaker, bounded retry |
| **Razorpay** | REST API & Webhooks | Fee Collection, Online Payments | HMAC-SHA256 signature verification, idempotent ledger |
| **AWS S3 / R2** | S3 API (Signed URLs) | Student Documents, Staff KYC, Reports | SSE-KMS encryption, private buckets, presigned URLs (60s TTL) |
| **WebPush / VAPID** | RFC 8291 WebPush Protocol | PWA Real-Time Alerts | VAPID keypair authentication, rate-limited dispatch |
| **Nodemailer** | SMTP with STARTTLS | System Alerts, Staff Invoices | Async worker dispatch, no raw user transport options |
