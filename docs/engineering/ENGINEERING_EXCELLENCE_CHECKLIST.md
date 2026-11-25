# SchoolMitra ERP — Engineering Excellence Master Checklist

**Directive ID:** `EDUCORE_ENGINEERING_EXCELLENCE_PHASE02_CONTINUATION`  
**Version:** 1.1.0  
**Governing Charter:** `docs/product-destination-charter.json`  
**Architectural Baseline:** Turborepo Monorepo (Next.js 14 App Router, Node.js backend, PostgreSQL/Neon, Drizzle ORM, BullMQ, Redis/Valkey)  
**Operating Principle:** `Inspect_First_Design_Second_Implement_Third_Verify_Continuously`  
**Applicability Rule:** Every concept is evaluated against SchoolMitra's destination sentence (500-2000 students, Indian K-12 school running full academic year on zero Excel registers). Optional technologies are designated as `FUTURE` or `NOT APPLICABLE` if unneeded.

---

## Domain 01 — Backend Architecture and System Design

### 1.1 Stateless Service Architecture
- **Description:** HTTP API services and Next.js server actions maintain zero local in-memory session or business state.
- **Evaluation Criteria:** All session state resides in signed encrypted cookies / Redis; horizontal autoscaling requires no session affinity (sticky sessions).
- **SchoolMitra Fit:** Essential. Multi-replica cloud deployment on Render/AWS must scale horizontally without dropped sessions.

### 1.2 Horizontal and Vertical Scaling Strategy
- **Description:** Clear operational thresholds for scaling application compute vs database capacity.
- **Evaluation Criteria:** Application tier scales horizontally; database scales vertically (compute units/vCPU in Neon) or via read replicas only when justified.
- **SchoolMitra Fit:** Essential. Peak workloads occur during 8:00–9:30 AM attendance and monthly fee collection days.

### 1.3 Reverse Proxy & Ingress Gateway
- **Description:** Edge termination of TLS, DDoS rate limiting, payload size enforcement, and security header injection.
- **Evaluation Criteria:** Cloudflare/Nginx/Render edge proxy limits body size to 1MB, filters malformed requests, and injects strict security headers.
- **SchoolMitra Fit:** Essential. Protects internal Next.js and Node.js servers from raw exposure.

### 1.4 API Gateway Necessity Evaluation
- **Description:** Determination of whether a standalone API Gateway (e.g. Kong, Envoy) is required vs monorepo unified gateway.
- **Evaluation Criteria:** Monorepo tRPC + Next.js App Router already provides unified routing, authentication middleware, and type-safe schema validation.
- **SchoolMitra Fit:** `NOT APPLICABLE` / `FUTURE`. Introducing a standalone gateway introduces unnecessary network hops, latency, and operational cost without functional benefit for current single-monorepo deployment.

### 1.5 Monolith vs Microservices Architecture
- **Description:** Preservation of modular monorepo boundaries vs premature decomposition into distributed services.
- **Evaluation Criteria:** Codebase organized into distinct workspace packages (`frontend`, `backend`, `database`, `packages/dpdp`, `packages/entity-engine`, `packages/validators`, `packages/domain-events`).
- **SchoolMitra Fit:** `IMPLEMENTED` (Modular Monorepo). Monolithic modular deployment preserves transactional ACID boundaries for fee ledgers and admissions while enabling rapid developer velocity.

### 1.6 Container Consistency (Docker)
- **Description:** Identical runtime container definitions across local development, CI automated tests, staging, and production.
- **Evaluation Criteria:** Multi-stage `Dockerfile` with non-root user execution, minimal alpine/debian-slim base images, and zero compiler dev-dependencies in final image.
- **SchoolMitra Fit:** Essential. Eliminates environment drifts between local Windows dev and Linux cloud runners.

### 1.7 Infrastructure as Code (IaC)
- **Description:** Declarative definition of all cloud resources (PostgreSQL database, Redis/Valkey cache, S3 buckets, CDN, DNS).
- **Evaluation Criteria:** Terraform / Docker Compose definitions versioned in repository; zero manual portal-click provisioning.
- **SchoolMitra Fit:** Partial / Staged. Docker Compose exists for local development; cloud infrastructure scripts scheduled for Phase 05.

### 1.8 Production-Like Staging Environments
- **Description:** Dedicated pre-production staging environment with identical database schema, RLS policies, and sanitised synthetic data.
- **Evaluation Criteria:** Staging environment automated via CI pipeline; migrations validated on staging before production execution.
- **SchoolMitra Fit:** Essential for migration safety (specifically Migration 0059 rollout).

---

## Domain 02 — API Engineering and Reliability

### 2.1 API Versioning and Backward Compatibility
- **Description:** Explicit versioning strategy for public/external APIs and mobile endpoints.
- **Evaluation Criteria:** URL path versioning (`/api/v1/`) or tRPC contract deprecation ladders. Breaking changes forbidden without deprecation notices.
- **SchoolMitra Fit:** Essential for Parent PWA, Teacher PWA, and future mobile sync.

### 2.2 Standardized HTTP Errors & Contracts
- **Description:** Consistent error response schema with machine-readable error codes and safe localized human messages.
- **Evaluation Criteria:** Uniform `{ success: false, error: { code, message, details? } }` schema across all endpoints; zero stack trace leakage to clients.
- **SchoolMitra Fit:** Essential. Standardized error handler maps database constraints into user-friendly responses.

### 2.3 Dependency & Operation Timeouts
- **Description:** Strict upper bounds on all network, database, and external gateway requests.
- **Evaluation Criteria:** OLTP database queries: 2,000ms ceiling; analytical reports: 30,000ms on dedicated session; external payment gateway calls: 5,000ms.
- **SchoolMitra Fit:** `IMPLEMENTED` (`withReportSession` budgets 30s; standard OLTP queries budgeted 2s).

### 2.4 Exponential Backoff and Retries
- **Description:** Automatic retry with jitter for transient network failures on idempotent operations.
- **Evaluation Criteria:** BullMQ worker jobs and payment webhook sync configure exponential backoff (e.g. 1s, 2s, 4s, 8s) up to max 5 attempts.
- **SchoolMitra Fit:** Essential. Configured in background notification queues and payment reconciliation.

### 2.5 Idempotency and Replay Defense
- **Description:** Preventing duplicate execution of financial transactions and critical updates.
- **Evaluation Criteria:** Unique `idempotencyKey` header or database unique constraint on `(school_id, transaction_ref)`; payment gateway webhook deduplication via `event_id`.
- **SchoolMitra Fit:** Essential. Duplicate payment collections or invoice generations are strictly prevented.

### 2.6 Circuit Breaker Implementation
- **Description:** Failing fast when external dependencies (SMS gateway, payment gateway, Redis) suffer prolonged outages.
- **Evaluation Criteria:** Circuit breaker opens after 5 consecutive failures; fallback prevents connection pool exhaustion.
- **SchoolMitra Fit:** Partial. Redis connection error handling exists; SMS provider fallback scheduled for Phase 03.

### 2.7 Distributed Rate Limiting
- **Description:** Multi-tier rate limiting preventing brute-force authentication and API denial of service.
- **Evaluation Criteria:** Redis-backed sliding window rate limiter; sensitive auth endpoints budgeted at 5 attempts / 15 mins per IP; fail-closed on partition.
- **SchoolMitra Fit:** Scheduled for Phase 03 (SPEC-004).

### 2.8 Webhook Cryptographic Signature Verification
- **Description:** Verification of incoming webhook signatures (Razorpay, Stripe) using HMAC-SHA256 secret.
- **Evaluation Criteria:** Verification executed against raw request buffer before parsing JSON; rejects forged or altered payloads.
- **SchoolMitra Fit:** `IMPLEMENTED` in payment gateway webhook handlers.

---

## Domain 03 — Database Engineering and Data Management

### 3.1 Indexing and Query Execution Plans
- **Description:** Exhaustive indexing on all foreign keys, tenant query filters (`school_id`), search hashes, and compound sort orders.
- **Evaluation Criteria:** Every tenant query utilizes an index scan (`Index Scan using ...`); zero sequential table scans on tables with >1,000 rows.
- **SchoolMitra Fit:** Essential. Core queries evaluated via `EXPLAIN (ANALYZE, BUFFERS)`.

### 3.2 Database Migration Safety & Zero Downtime
- **Description:** Reversible, non-blocking DDL migrations.
- **Evaluation Criteria:** `ADD COLUMN` uses nullable or default with no full table lock; `CREATE INDEX CONCURRENTLY`; journal synchronization enforced via `db:check-migrations`.
- **SchoolMitra Fit:** `IMPLEMENTED` (Migration journal integrity checked via automated CI script).

### 3.3 Connection Pooling & Resource Limits
- **Description:** Strict client connection budgets preventing database process exhaustion.
- **Evaluation Criteria:** PgBouncer / Neon connection pooling enabled; application pool size bounded (`max: 20`); idle timeouts enforced.
- **SchoolMitra Fit:** `IMPLEMENTED` in `database/src/index.ts` and `neonEnv.ts`.

### 3.4 Read Replica Requirements Evaluation
- **Description:** Assessing whether heavy analytical reporting workloads require an asynchronous read replica.
- **Evaluation Criteria:** Workload analysis indicates 95% of traffic is OLTP; analytical report sessions are constrained via `withReportSession` (30s ceiling).
- **SchoolMitra Fit:** `FUTURE`. Read replicas will be introduced when a single school tenant exceeds 10,000 students or regional multi-school rollups saturate primary read IOPS.

### 3.5 Soft Deletes and Retention Lifecycles
- **Description:** DPDP-compliant data lifecycles with 30-day soft-delete grace period before permanent hard-purge.
- **Evaluation Criteria:** Core entities define `deletedAt`; `executeRetentionPolicy()` purges data only after legal hold checks and 30-day expiration.
- **SchoolMitra Fit:** `IMPLEMENTED` in `backend/src/workers/retention.ts`.

### 3.6 Row-Level Security (RLS) & FORCE RLS
- **Description:** Database-level tenant boundary enforcement binding table owners and application roles.
- **Evaluation Criteria:** 100% of tenant tables enforce `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`; queries filter by `app.current_school_id`.
- **SchoolMitra Fit:** `PARTIAL` (Migration 0041 active; Migration 0059 authored and verified in local/CI test mode).

### 3.7 Server-Side Input Validation
- **Description:** Strict validation of all inputs regardless of frontend client controls.
- **Evaluation Criteria:** All mutations validated using Zod schemas in `@schoolmitra/validators`; reject unexpected properties (strip/strict).
- **SchoolMitra Fit:** `IMPLEMENTED` across all tRPC and server action endpoints.

### 3.8 Bilingual Data Handling & Unicode (UTF-8)
- **Description:** Flawless storage and rendering of regional Indian languages (Kannada, Hindi) alongside English.
- **Evaluation Criteria:** Database collation `UTF-8`; bilingual text fields support Kannada Unicode without truncation or question-mark encoding.
- **SchoolMitra Fit:** `IMPLEMENTED` (Bilingual dignity invariant in parent and teacher PWAs).

### 3.9 Timezone Consistency (UTC Storage & IST Presentation)
- **Description:** All timestamps stored in UTC (`timestamp with time zone`) and displayed in Indian Standard Time (`Asia/Kolkata`, UTC+5:30).
- **Evaluation Criteria:** Database stores UTC; client rendering formats dates in IST; quiet-hours workers calculate time in IST.
- **SchoolMitra Fit:** `IMPLEMENTED` across database schema and BullMQ schedulers.

---

## Domain 04 — Authentication and Identity Management

### 4.1 Multi-Role Authentication & Session Lifecycle
- **Description:** Secure session tokens with live account active status verification.
- **Evaluation Criteria:** NextAuth JWT / database sessions check live `users.isActive` and assigned roles on every request; deactivated accounts fail closed immediately.
- **SchoolMitra Fit:** `IMPLEMENTED` in `backend/src/lib/serverAuth.ts` (Phase 02 remediation).

### 4.2 Role-Based Access Control (RBAC) & Tenant Boundaries
- **Description:** Hierarchical role boundaries separating Super Admin, School Admin, Teacher, Accountant, Parent, and Student.
- **Evaluation Criteria:** `requireAuth(allowedRoles)` enforced on all server actions and API routes; queries strictly scoped by `withTenant(schoolId)`.
- **SchoolMitra Fit:** `IMPLEMENTED` across backend server actions.

### 4.3 Multi-Factor Authentication (2FA) & SSO Evaluation
- **Description:** Two-factor authentication for high-privilege administrative accounts.
- **Evaluation Criteria:** TOTP / SMS 2FA for Super Admin and School Fee Administrators; Enterprise SAML/SSO for large educational trusts.
- **SchoolMitra Fit:** `FUTURE` / Phase 03. 2FA prioritized for Super Admin; single schools use phone/email OTP.

### 4.4 Cookie Security Attributes
- **Description:** Defense against session hijacking and XSS token theft.
- **Evaluation Criteria:** Session cookies strictly configure `HttpOnly; Secure; SameSite=Lax` (or `Strict`); zero JavaScript access to authentication tokens.
- **SchoolMitra Fit:** `IMPLEMENTED` in NextAuth cookie options.

### 4.5 Brute-Force Protection & Account Lockout
- **Description:** Progressive delay and account lockout after repeated failed login attempts.
- **Evaluation Criteria:** 5 failed login attempts trigger 15-minute account lock; CAPTCHA or backoff enforced; audit log records `FAILED_LOGIN`.
- **SchoolMitra Fit:** Scheduled for Phase 03 (Rate limiting and lockout).

---

## Domain 05 — Application Security

### 5.1 SQL Injection Prevention
- **Description:** Strict elimination of dynamic SQL string concatenation.
- **Evaluation Criteria:** 100% of queries use parameterised sql template tags (`sql`...``) or Drizzle typed schema builders.
- **SchoolMitra Fit:** `IMPLEMENTED` across monorepo database queries.

### 5.2 Cross-Site Scripting (XSS) Defense & Content Security Policy
- **Description:** Strict CSP headers and automatic React context escaping.
- **Evaluation Criteria:** Content Security Policy disables `'unsafe-inline'` via dynamic per-request nonces; HTML sanitization on rich text inputs.
- **SchoolMitra Fit:** Phase 03 (SPEC-006).

### 5.3 Cross-Site Request Forgery (CSRF) Protection
- **Description:** Defense against forged cross-origin state-changing requests.
- **Evaluation Criteria:** SameSite cookie enforcement; Next.js server actions cryptographic origin header verification.
- **SchoolMitra Fit:** `IMPLEMENTED` by Next.js Server Action architecture and NextAuth CSRF tokens.

### 5.4 Server-Side Request Forgery (SSRF) Defense
- **Description:** Preventing malicious internal network probing via user-supplied URLs.
- **Evaluation Criteria:** Strict domain whitelisting on outbound HTTP requests (e.g. webhook delivery, image downloads); internal IP ranges (`10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`) blocked.
- **SchoolMitra Fit:** Essential for PDF generation and webhook testing.

### 5.5 File Upload Validation & Antivirus Scanning
- **Description:** Safe handling of student photos, Aadhaar proof cards, and payment receipts.
- **Evaluation Criteria:** Direct presigned S3 uploads; magic-number MIME type verification; maximum file size (5MB for images, 10MB for PDFs); executable extensions strictly rejected.
- **SchoolMitra Fit:** `IMPLEMENTED` in S3 presigned URL generation.

### 5.6 Dependency Security Auditing
- **Description:** Automated fail-closed scanning for high and critical CVEs in npm packages.
- **Evaluation Criteria:** `scripts/audit-dependencies.mjs` enforces exact GHSA IDs, zero wildcards, 90-day maximum expiry; blocks PR merge on violation.
- **SchoolMitra Fit:** `IMPLEMENTED` (Phase 02 remediation).

### 5.7 Cryptographic Data Encryption at Rest & In Transit
- **Description:** AES-256-GCM encryption for sensitive student PII (Aadhaar, blood group, emergency contacts) and TLS 1.3 in transit.
- **Evaluation Criteria:** Application-layer encryption using `ENCRYPTION_KEY` before database writes; HTTPS enforced on all endpoints.
- **SchoolMitra Fit:** `IMPLEMENTED` via `backend/src/lib/encryption.ts`.

---

## Domain 06 — Concurrency and Background Operations

### 6.1 Transaction Boundary Integrity & Worker Tenant Context
- **Description:** Mandatory transaction propagation across all background asynchronous workers.
- **Evaluation Criteria:** Worker processors receive mandatory `tx: TenantTransaction`; zero unconfigured global `db` calls inside tenant workers.
- **SchoolMitra Fit:** `IMPLEMENTED` in `financeAutomation.ts` and `retention.ts` (Phase 02 remediation).

### 6.2 Reliable Background Queue Processing (BullMQ & Redis)
- **Description:** Asynchronous execution of long-running tasks (fee reminder ladder, report card generation, SMS dispatch, retention purges).
- **Evaluation Criteria:** BullMQ jobs define unique job IDs for deduplication; exponential backoff retries; dead-letter queue (DLQ) for permanent failures.
- **SchoolMitra Fit:** `IMPLEMENTED` across notification and retention workers.

### 6.3 Graceful Worker Shutdown
- **Description:** Preventing job corruption and connection leaks during container deployment and restarts.
- **Evaluation Criteria:** `SIGTERM` / `SIGINT` signal handlers pause BullMQ queue intake, await active job completion (up to 15s), and close Redis and Postgres pool connections cleanly.
- **SchoolMitra Fit:** Scheduled for Phase 04 / Phase 05.

### 6.4 Concurrent Ledger & Payment Race Condition Prevention
- **Description:** Pessimistic row locking on fee invoices during payment collection.
- **Evaluation Criteria:** Invoices locked via `.for("update")` inside tenant transaction client `tx` during settlement; prevents double-collection under concurrent POS requests.
- **SchoolMitra Fit:** `IMPLEMENTED` in `financeAutomation.ts` (Phase 02 remediation).

---

## Domain 07 — Performance and Resource Management

### 7.1 Measurable Bundle & Performance Budgets
- **Description:** Enforcing maximum JavaScript bundle sizes and Next.js client component limits.
- **Evaluation Criteria:** Initial JS bundle <180KB gzip; Largest Contentful Paint (LCP) <2.5s; First Input Delay (FID) / INP <100ms.
- **SchoolMitra Fit:** Enforced via `scripts/check-bundle-budgets.mjs` and Next.js compiler.

### 7.2 Memory Leak Detection & Worker Profiling
- **Description:** Profiling Node.js heap allocation and BullMQ worker memory over long-running shifts.
- **Evaluation Criteria:** Zero unbounded memory growth in background worker processes; memory usage capped and monitored.
- **SchoolMitra Fit:** Scheduled for Phase 06.

### 7.3 Content Delivery Network (CDN) Strategy
- **Description:** Edge caching of static assets, school logos, and compiled JavaScript.
- **Evaluation Criteria:** Static assets served via CDN with immutable cache headers (`Cache-Control: public, max-age=31536000, immutable`).
- **SchoolMitra Fit:** Configured via Next.js asset prefix and Cloudflare CDN.

---

## Domain 08 — Logging, Monitoring and Observability

### 8.1 Structured JSON Logging & Zero PII Leakage
- **Description:** Machine-readable JSON logs with automatic masking of sensitive data.
- **Evaluation Criteria:** Pino logger outputs structured JSON with `{ timestamp, level, context, traceId, schoolId }`; passwords, tokens, Aadhaar numbers, and student names strictly redacted.
- **SchoolMitra Fit:** `IMPLEMENTED` in `backend/src/lib/logger.ts`.

### 8.2 Tamper-Evident Audit Logging
- **Description:** Immutable record of all administrative, financial, and DPDP consent operations.
- **Evaluation Criteria:** Database trigger prevents UPDATE or DELETE on `audit_logs`; records actor user ID, action, resource, timestamp, and IP address.
- **SchoolMitra Fit:** `IMPLEMENTED` in `database/src/schema/core.ts` and migration triggers.

### 8.3 Distributed Tracing & Correlation IDs
- **Description:** End-to-end trace correlation tracking a user request from frontend to backend and into asynchronous BullMQ background jobs.
- **Evaluation Criteria:** `X-Correlation-ID` generated at ingress and propagated across tRPC and worker job metadata.
- **SchoolMitra Fit:** Scheduled for Phase 06.

---

## Domain 09 — Development Lifecycle and Quality Engineering

### 9.1 Comprehensive Automated Test Pyramid
- **Description:** Multi-layered test coverage: Unit tests, Integration tests, Contract tests, and E2E Playwright tests.
- **Evaluation Criteria:** Unit tests verify business algorithms; integration tests verify database and RLS policies; E2E tests verify high-stakes user journeys (J1–J10).
- **SchoolMitra Fit:** `IMPLEMENTED` (Vitest suites for backend, frontend, database; Playwright for E2E).

### 9.2 Strict Monorepo Linting & Static Analysis
- **Description:** Complete static analysis coverage across all workspace packages.
- **Evaluation Criteria:** `pnpm run lint` executes across all 8 packages; zero React Hook violations; zero unhandled promise rejections.
- **SchoolMitra Fit:** `PARTIAL` (Frontend lint passing; package-level lint scripts for 6 packages scheduled for Phase 04).

### 9.3 Semantic Versioning & Branching Controls
- **Description:** Structured Git branching strategy protecting production stability.
- **Evaluation Criteria:** Work developed on feature branches (`engineering/**`); `main` protected by CI verification gates; zero direct commits to `main`.
- **SchoolMitra Fit:** `IMPLEMENTED` (Current development on `engineering/phase-02-tenant-security`).

---

## Domain 10 — Infrastructure and Operational Resilience

### 10.1 Environment Configuration & Secrets Isolation
- **Description:** Absolute separation of secrets between Development, Staging, and Production.
- **Evaluation Criteria:** Zero production credentials or keys stored in source control; production secrets injected via environment variables at runtime.
- **SchoolMitra Fit:** `IMPLEMENTED` (.env templates and gitignore).

### 10.2 Automated Backup & Disaster Recovery (RPO/RTO)
- **Description:** Daily automated database backups with point-in-time recovery (PITR) and documented restoration drills.
- **Evaluation Criteria:** Recovery Point Objective (RPO) <1 hour; Recovery Time Objective (RTO) <4 hours; monthly restoration drills to verify backup integrity.
- **SchoolMitra Fit:** Scheduled for Phase 06.

### 10.3 Health Check Probes
- **Description:** Deep and shallow health check endpoints for container orchestrators.
- **Evaluation Criteria:** `/api/health` returns HTTP 200 for shallow liveness; `/api/health/deep` verifies PostgreSQL and Redis connectivity for readiness.
- **SchoolMitra Fit:** `IMPLEMENTED` in backend API health router.

---

## Domain 11 — Privacy, Compliance and Governance (DPDP Act 2023)

### 11.1 Verifiable Parental Consent & Minor Safety
- **Description:** Strict compliance with Indian Digital Personal Data Protection Act 2023 for minors under 18.
- **Evaluation Criteria:** Verifiable parental consent recorded before processing student personal data; zero student email requirements; claim flow uses admission number + DOB with rate limiting.
- **SchoolMitra Fit:** `IMPLEMENTED` in `packages/dpdp` and parent consent workflows.

### 11.2 Purpose Limitation & Data Minimization
- **Description:** Only collecting data strictly necessary for school educational delivery.
- **Evaluation Criteria:** Aadhaar stores only last 4 digits (never 12 digits); financial cards never stored (Razorpay PCI-DSS tokenization); zero tracking ads or third-party behavioral analytics.
- **SchoolMitra Fit:** `IMPLEMENTED` across database schema and product charter.

### 11.3 Data-Subject Rights & Grievance Redressal
- **Description:** Workflows enabling parents and staff to exercise rights of access, correction, erasure, and grievance filing.
- **Evaluation Criteria:** DPDP Compliance Centre provides SLA-tracked rights queue; automated export to machine-readable JSON/PDF; 72-hour breach notification readiness.
- **SchoolMitra Fit:** `IMPLEMENTED` in `frontend/src/app/(admin)/dpdp` and `packages/dpdp`.
