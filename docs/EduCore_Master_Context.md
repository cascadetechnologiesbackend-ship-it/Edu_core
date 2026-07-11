# EduCore — Master Context Documentation

**Version:** 1.0.0
**Date:** July 2026
**Classification:** Internal — Developer, Implementer, Auditor, Business Stakeholder Reference
**Maintained by:** EduCore Engineering & Product Team
**Privacy Officer:** *[To be named — see Section 7.7]*

---

## Table of Contents

1. [Introduction & Platform Overview](#1-introduction--platform-overview)
2. [Multi-Tenancy Architecture & Infrastructure](#2-multi-tenancy-architecture--infrastructure)
   - 2.1 [Isolation Model — Schema-per-Tenant](#21-isolation-model--schema-per-tenant)
   - 2.2 [Tenant Resolution & Routing](#22-tenant-resolution--routing)
   - 2.3 [Cloud & Hosting Architecture (AWS)](#23-cloud--hosting-architecture-aws)
   - 2.4 [Security & Certification Posture](#24-security--certification-posture)
   - 2.5 [Tech Stack](#25-tech-stack)
   - 2.6 [Integrations](#26-integrations)
   - 2.7 [Performance & Scalability](#27-performance--scalability)
3. [Core Modules, Sub-Modules & Workflows](#3-core-modules-sub-modules--workflows)
   - 3.1 [Module Overview Table](#31-module-overview-table)
   - 3.2 [Module Deep-Dives](#32-module-deep-dives)
4. [Database Core Schemas](#4-database-core-schemas)
   - 4.1 [ER Overview](#41-er-overview)
   - 4.2 [Table Definitions](#42-table-definitions)
5. [Roles, RBAC & CRUD Hierarchy](#5-roles-rbac--crud-hierarchy)
   - 5.1 [Role Enumeration & Hierarchy](#51-role-enumeration--hierarchy)
   - 5.2 [CRUD-by-Role Matrix](#52-crud-by-role-matrix)
   - 5.3 [Cross-Role Visibility Rules](#53-cross-role-visibility-rules)
   - 5.4 [User Creation & Identity Bootstrap](#54-user-creation--identity-bootstrap)
6. [Complete Lifecycles with Real-World Scenarios](#6-complete-lifecycles-with-real-world-scenarios)
   - 6.1 [Student Lifecycle](#61-student-lifecycle)
   - 6.2 [Teacher Lifecycle](#62-teacher-lifecycle)
   - 6.3 [HOD/Academic Head Lifecycle](#63-hodacademic-head-lifecycle)
   - 6.4 [Accountant/Finance Lifecycle](#64-accountantfinance-lifecycle)
   - 6.5 [Parent Lifecycle](#65-parent-lifecycle)
   - 6.6 [Admin/Super Admin Lifecycle](#66-adminsuper-admin-lifecycle)
   - 6.7 [RBAC Boundary Collaboration Example](#67-rbac-boundary-collaboration-example)
7. [DPDP Act 2023 & DPDP Rules 2025 Compliance](#7-dpdp-act-2023--dpdp-rules-2025-compliance)
   - 7.1 [Legal Basis & Fiduciary Structure](#71-legal-basis--fiduciary-structure)
   - 7.2 [Children's Data — Section 9 Obligations](#72-childrens-data--section-9-obligations)
   - 7.3 [Prohibited Processing Constraints](#73-prohibited-processing-constraints)
   - 7.4 [Purpose Limitation & Data Minimization](#74-purpose-limitation--data-minimization)
   - 7.5 [Data Principal Rights](#75-data-principal-rights)
   - 7.6 [Breach Notification Workflow](#76-breach-notification-workflow)
   - 7.7 [Compliance Posture & Privacy Officer](#77-compliance-posture--privacy-officer)
8. [Additional Features](#8-additional-features)
9. [Glossary](#9-glossary)

---

## 1. Introduction & Platform Overview

**EduCore** is a multi-tenant, cloud-native School ERP SaaS platform designed for Indian educational institutions serving Nursery/Pre-Primary through Grade 10 (K-10). It digitizes the full operational lifecycle of every stakeholder — student, parent, teacher, Head of Department (HOD), accountant, transport staff, librarian, and school administrator — under a unified platform governed by strict Role-Based Access Control (RBAC).

### 1.1 Target Market

| Segment | Description | Example Tenants |
|---|---|---|
| **SMB Schools** | Independent private schools, 200–1500 students | A single-campus CBSE school in Pune |
| **Mid-Market Chains** | 3–10 campus school chains | A trust running 5 ICSE schools in Maharashtra |
| **Enterprise / Trust** | Large multi-school boards, 10+ campuses | A state-level trust running 20+ schools |

### 1.2 Academic Scope

- **Grades covered:** Nursery, LKG, UKG (Pre-Primary) through Class 1–10
- **Curriculum boards:** CBSE, ICSE, IGCSE, State Boards (configurable per tenant)
- **Medium of instruction:** Configurable (English, Hindi, regional languages)

### 1.3 Core Design Principles

1. **Data isolation by design** — each school's data is schema-isolated; no cross-tenant leakage is architecturally possible.
2. **Least-privilege RBAC** — every role receives only the minimum access required for its function.
3. **DPDP-ready by design** — consent capture, retention, and deletion workflows meet India's DPDP Act 2023 obligations.
4. **India-first infrastructure** — all data stored and processed within AWS ap-south-1 (Mumbai); no cross-border transfer.
5. **Mobile-first for parents and teachers** — primary field-user touchpoints are Flutter mobile apps (Android + iOS).
6. **Audit-first** — every mutation to student, financial, or sensitive data is captured in an immutable audit log.

---

## 2. Multi-Tenancy Architecture & Infrastructure

### 2.1 Isolation Model — Schema-per-Tenant

EduCore uses a **schema-per-tenant** isolation model as its single architecture tier. Each school (tenant) gets a dedicated PostgreSQL schema within a shared RDS cluster. The `public` schema holds only platform-level tables.

#### 2.1.1 Isolation Model Comparison

| Model | Isolation Strength | Cost Efficiency | Migration Complexity | DPDP Story | EduCore Verdict |
|---|---|---|---|---|---|
| Shared DB, shared schema (tenant_id + RLS) | Low–Medium | Highest | Low | Requires rigorous RLS policy testing; hard to demonstrate per-tenant isolation to auditors | **Not chosen** |
| **Shared DB, schema-per-tenant** | **Medium–High** | **High** | **Medium** | **Strong isolation; schema-level backup/restore; clear boundary for regulators** | **Chosen** |
| DB-per-tenant | Highest | Lowest | High | Strongest compliance story; future upgrade path for large enterprise/trust tenants | Future option |

#### 2.1.2 Schema Layout

```
PostgreSQL Instance (RDS Multi-AZ)
+-- public schema            <- platform-level tables only
+-- school_greenwood schema  <- Greenwood Academy data
+-- school_lotus schema      <- Lotus Public School data
+-- school_stjohn schema     <- St. John's High School data
```

**Schema naming convention:** `school_<slug>` where `slug` is the tenant's unique identifier.

**Search path enforcement:** The NestJS API sets `SET search_path TO school_<slug>` at the start of every DB session via a `TenantConnectionMiddleware`. This is the primary isolation mechanism — application code never generates explicit schema prefixes.

**Connection pooling:** PgBouncer (transaction mode) runs as a sidecar per-service. The search path is set at the application layer before each query.

#### 2.1.3 Migration Strategy

1. A platform migration runner iterates through all schemas registered in `public.tenants`.
2. Flyway versioned SQL migrations are applied to each schema sequentially.
3. Per-schema migrations are wrapped in transactions; a rollback on one schema does not affect others.
4. A migration lock in `public.migration_locks` prevents concurrent runs.

### 2.2 Tenant Resolution & Routing

#### 2.2.1 Subdomain Routing

```
https://greenwood.educore.app   -> Tenant: school_greenwood
https://lotus.educore.app       -> Tenant: school_lotus
```

Custom domain mapping is also supported for enterprise tenants (e.g., `erp.greenwoodacademy.edu.in`).

#### 2.2.2 Tenant Resolution Flow

```
Browser / App Request
      |
      v
AWS CloudFront (CDN / Edge + WAF)
      | extracts subdomain or custom domain header
      v
AWS Application Load Balancer (ALB)
      | forwards X-Tenant-Slug header
      v
NestJS API Gateway (Tenant Middleware)
      |
      +- Reads X-Tenant-Slug from header
      +- Validates against public.tenants (Redis cache, TTL 5 min)
      +- Resolves tenant_id + schema_name
      +- Injects TenantContext into NestJS request scope
      +- Sets PostgreSQL search_path -> school_<slug>
```

#### 2.2.3 Tenant Context Propagation

```typescript
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  tenantId: string;       // UUID from public.tenants
  schemaName: string;     // e.g., 'school_greenwood'
  tenantSlug: string;     // e.g., 'greenwood'
  tenantPlan: TenantPlan; // 'standard' | 'enterprise'
}
```

Every repository receives this context via dependency injection. The `DatabaseService` uses it to set the PostgreSQL search path before executing any query.

### 2.3 Cloud & Hosting Architecture (AWS)

All EduCore infrastructure is deployed exclusively in **AWS ap-south-1 (Mumbai)**. High availability is achieved through **multi-AZ deployment** within Mumbai. No cross-region or cross-border data transfer occurs.

#### 2.3.1 Reference Architecture

```
AWS ap-south-1 (Mumbai)
+----------------------------------------------------------------------+
| CloudFront (CDN + WAF)        | S3 Buckets                          |
|                               |   educore-documents-prod            |
| Route 53 (DNS)                |   educore-media-prod                |
|                               |   educore-backups-prod              |
| AWS Cognito (Auth / MFA)      |   educore-static-prod               |
|                               |                                     |
| VPC (10.0.0.0/16)                                                   |
| +------------------------------------------------------------------+ |
| | Public Subnets (2 AZs)                                          | |
| |   ALB                  NAT Gateway                              | |
| +------------------------------------------------------------------+ |
| | Private App Subnets (2 AZs)                                     | |
| |   EKS Node Groups:                                              | |
| |     NestJS API Services  |  Next.js SSR                         | |
| |     Notification Worker  |  RabbitMQ (EC2)                      | |
| +------------------------------------------------------------------+ |
| | Private Data Subnets (2 AZs)                                    | |
| |   RDS PostgreSQL (Multi-AZ)  |  Amazon Redshift (Analytics)     | |
| |   ElastiCache Redis          |  AWS Secrets Manager             | |
| +------------------------------------------------------------------+ |
| Amazon QuickSight (BI Dashboards)                                    |
+----------------------------------------------------------------------+
```

#### 2.3.2 Compute — Amazon EKS

- **Cluster:** Single EKS cluster spanning 2 AZs (ap-south-1a, ap-south-1b).
- **Auto-scaling:** Kubernetes HPA (CPU/memory); Cluster Autoscaler for EC2 node groups.
- **Container registry:** Amazon ECR in ap-south-1.
- **CI/CD:** GitHub Actions → ECR → EKS rolling deployments via Helm charts.

#### 2.3.3 Database — Amazon RDS for PostgreSQL

- **Instance:** `db.r6g.2xlarge` primary, `db.r6g.xlarge` read replica.
- **Multi-AZ:** Synchronous standby in ap-south-1b; automatic failover ~60 seconds.
- **Encryption:** AES-256 at rest (AWS KMS CMK); TLS 1.3 in transit.
- **Backups:** Daily snapshots, 30-day retention; point-in-time recovery up to 35 days.
- **Read replica:** Dedicated for reporting queries, analytics ETL to Redshift, heavy workloads.

#### 2.3.4 Object Storage — Amazon S3

| Bucket | Purpose | Access Control |
|---|---|---|
| `educore-documents-prod` | Student/staff document vault | Private; presigned URLs (15-min expiry) |
| `educore-media-prod` | Profile photos, ID card images | Private; CloudFront signed URLs |
| `educore-backups-prod` | DB snapshots, export files | Private; S3 Object Lock (90-day compliance) |
| `educore-static-prod` | Next.js static assets | Public read via CloudFront |

All buckets: S3 Block Public Access enabled (except static), SSE-KMS encryption, versioning on documents and backups.

#### 2.3.5 DR / Backup Strategy

| Metric | Target |
|---|---|
| **RPO** | <= 15 minutes (RDS backups + transaction logs) |
| **RTO** | <= 60 minutes (RDS Multi-AZ automatic failover) |
| **Backup retention** | 30 days (RDS), 90 days (S3 with Object Lock) |
| **DR test frequency** | Quarterly failover drills |
| **Data residency** | All backups remain in ap-south-1 |

> **Note on cross-region DR:** EduCore's India-only strict data residency policy prohibits cross-region replication to non-Indian AWS regions. HA is achieved through Multi-AZ within Mumbai. When AWS adds a second Indian region, the DR strategy will be reviewed.

### 2.4 Security & Certification Posture

#### 2.4.1 Encryption

| Layer | Standard | Implementation |
|---|---|---|
| **Data at rest** | AES-256 | RDS KMS CMK, S3 SSE-KMS, EBS encryption |
| **Data in transit** | TLS 1.2+ (TLS 1.3 preferred) | CloudFront, ALB, RDS, internal service mesh |
| **Field-level encryption** | AES-256-GCM | Aadhaar numbers, health/medical data. Key in AWS Secrets Manager, rotated annually. |
| **Secrets management** | AWS Secrets Manager | DB credentials, API keys; automatic rotation every 90 days |

#### 2.4.2 Authentication & MFA

- **Identity Provider:** Amazon Cognito (User Pools).
- **Staff:** Email + password; TOTP MFA mandatory.
- **Parents:** Mobile OTP as primary auth; optional TOTP MFA.
- **Students:** School-issued credentials for Grade 5+; no direct login for Nursery–Grade 4.
- **Sessions:** JWT access tokens (15-min expiry) + refresh tokens (7-day, HttpOnly cookies, rotated on use).
- **Password policy (staff):** Min 10 chars, 1 uppercase, 1 number, 1 special; no reuse of last 5; lockout after 5 failed attempts.

#### 2.4.3 Certifications Roadmap

| Standard | Status | Notes |
|---|---|---|
| **ISO/IEC 27001** | Target Year 2 | ISMS implementation in progress |
| **SOC 2 Type II** | Target Year 3 | Required for enterprise/board-level sales |
| **DPDP Act 2023** | DPDP-ready by design | See Section 7 |
| **PCI DSS** | SAQ-A compliant | Razorpay handles card data; EduCore stores none |

### 2.5 Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| **Web Frontend** | Next.js 14 (App Router, TypeScript) | SSR for SEO; excellent dashboard ecosystem |
| **Mobile** | Flutter 3.x (Dart) | Single codebase for iOS + Android; strong real-time performance |
| **Backend API** | Node.js 20 LTS + NestJS 10 (TypeScript) | TypeScript-first; decorator-driven RBAC guards; excellent RabbitMQ/Redis integration; widely adopted in Indian SaaS |
| **API Style** | REST (primary) + GraphQL (reporting only) | REST for transactional CRUD; GraphQL via Apollo Server for flexible dashboard queries |
| **Primary Database** | PostgreSQL 16 (AWS RDS) | ACID compliance; schema-per-tenant isolation; rich JSON support |
| **Cache / Session** | Redis 7 (AWS ElastiCache) | Tenant context cache, session store, rate limiting |
| **Analytics Database** | Amazon Redshift | Columnar OLAP for role-scoped dashboards and multi-school trust rollups |
| **BI / Visualization** | Amazon QuickSight | Native Redshift integration; SPICE caching; row-level security for role-scoped reports |
| **Message Queue** | RabbitMQ 3.x (self-managed EC2) | Mature; flexible routing; notification pipelines, RFID events, background jobs |
| **ORM** | TypeORM + raw parameterized SQL | TypeORM for standard CRUD + migrations; raw SQL for complex reporting |
| **Authentication** | Amazon Cognito + NestJS JWT Guard | Cognito for user pool management/MFA; JWT validation in NestJS guards |
| **Infrastructure** | Terraform + Helm | Reproducible infra; Helm for EKS workload management |
| **CI/CD** | GitHub Actions -> ECR -> EKS | Automated build, test, container push, rolling deploy |

**Architecture style:** Modular monolith (single NestJS process, strongly bounded modules). Background workers run as separate EKS Deployments consuming from RabbitMQ.

### 2.6 Integrations

#### 2.6.1 RFID/NFC Integration (Bus & Gate)

**Hardware assumptions:**
- UHF RFID readers (865–867 MHz, India TRAI band) at bus boarding/deboarding points and school gates.
- Students carry RFID cards (ISO 18000-6C / EPC Gen2).
- Readers connect to an edge gateway (Raspberry Pi 4 or industrial IoT gateway) via RS-485/Wiegand.

**Data flow:**
```
RFID Reader (bus/gate)
      | RS-485 / Wiegand
      v
Edge Gateway (on-premise / on bus)
      | HTTPS TLS 1.3
      v
RFID Ingestion API (NestJS endpoint)
      |
      v
RabbitMQ Exchange: rfid.events
      |
      +-> Attendance Worker -> writes rfid_events + attendance_records
      +-> Notification Worker -> sends WhatsApp/push to parent
```

**Edge gateway responsibilities:**
- Buffer events locally if connectivity lost (SQLite on-device, max 24h).
- Authenticate using a per-device API key (provisioned at commissioning, stored in Secrets Manager).
- Send events: `device_id`, `rfid_tag_uid`, `event_timestamp` (NTP-synced), `event_type` (BOARD | DEBOARD | GATE_IN | GATE_OUT), `location_lat`, `location_lng`.

#### 2.6.2 Payment Gateway — Razorpay

| Feature | Details |
|---|---|
| **Integration** | Razorpay Payment Links + Orders API + Webhooks |
| **Methods supported** | UPI, UPI Autopay (NACH mandate), Debit/Credit cards, Net Banking, Wallets |
| **Recurring fees** | NACH mandate via Razorpay Subscriptions for monthly fee plans |
| **Webhooks** | payment.captured, payment.failed, refund.processed -> NestJS handler |
| **Idempotency** | gateway_order_id stored in fee_transactions; webhook dedup via gateway_payment_id unique constraint |
| **PCI compliance** | EduCore stores no raw card data; SAQ-A compliant |

#### 2.6.3 Notification Channels

| Channel | Provider | Use Cases |
|---|---|---|
| **WhatsApp Business** | Meta Cloud API via Gupshup (BSP) | Parent alerts — highest open rate in India |
| **In-app messaging** | Custom (NestJS WebSocket + Redis Pub/Sub) | Staff-to-staff, teacher-to-HOD, principal announcements |
| **Push notifications** | FCM (Android) + APNs (iOS) via Flutter | Real-time alerts in parent/teacher Flutter app |
| **Email** | AWS SES | Fee receipts, formal circulars, admission confirmations |
| **SMS** | AWS SNS (fallback) | Critical alerts when WhatsApp/push unavailable |

**Delivery tracking:** Every notification logged in `notification_log` with: channel, recipient_id, status (queued | sent | delivered | read | failed), provider_message_id, sent_at, delivered_at, read_at.

#### 2.6.4 Third-Party EdTech Integrations (Data Processor Model)

Third-party EdTech tools integrated with EduCore are classified as **Data Processors** under DPDP Act 2023 — not independent Data Fiduciaries. Requirements:

1. Signed **Data Processing Agreement (DPA)** before any data sharing.
2. DPA specifies: data categories, purpose, retention, deletion obligations, sub-processor restrictions.
3. Data shared via EduCore's **Integration API** (dedicated REST endpoints, OAuth 2.0 scoped tokens).
4. Integration API enforces: field-level filtering, per-integration rate limits, full audit logging of all shared data.
5. Parent/guardian consent must explicitly cover the third-party tool (separate `consent_records` entry with `processor_name`).

### 2.7 Performance & Scalability

| Concern | Solution |
|---|---|
| **Connection pooling** | PgBouncer transaction mode; max 20 DB connections per pod |
| **Noisy-neighbor isolation** | Per-tenant rate limiting via Redis token bucket; heavy queries routed to read replica |
| **Read-heavy reporting** | Dedicated RDS read replica; nightly ETL to Redshift for analytics |
| **Caching** | ElastiCache Redis: tenant config (5 min TTL), sessions (15 min), timetable (1 hr), fee structures (24 hr) |
| **Horizontal scaling** | Stateless NestJS API; HPA scales pods 2–20 at CPU > 70% |
| **Background job isolation** | Worker pods on separate EKS node group; RabbitMQ consumer concurrency configurable per queue |
| **Large file handling** | Multipart upload directly to S3 via presigned URLs; API never proxies file bytes |
| **Rate limiting** | 100 req/min per user, 5000 req/min per tenant (JWT + IP-based, enforced at WAF + ALB) |

---

## 3. Core Modules, Sub-Modules & Workflows

### 3.1 Module Overview Table

| Module | Sub-modules | Key Operations | Primary Roles | Automations |
|---|---|---|---|---|
| **Admissions / CRM** | Inquiry capture, Lead nurturing, Entrance test scheduling, Seat allocation, Document verification, Admission confirmation | Inquiry intake, lead follow-up, test scheduling, seat offer, document upload, finalization | Front Office, Principal, Admin | Auto-provision Student + Parent accounts on confirmation; welcome WhatsApp; 48h seat expiry reminder |
| **Student Information System** | Student master profile, Class/section assignment, Document vault, ID card generation, Alumni conversion | Create/update profile, assign class/section, upload documents, generate ID cards, mark alumni | Admin, Class Teacher, Front Office | Auto-assign to section on promotion; auto-generate ID card on photo upload; auto-convert to alumni on exit |
| **Attendance** | Daily class attendance, Leave requests, RFID gate/bus tracking, Defaulter reports | Mark attendance (RFID/QR/manual), approve leave, generate reports | Class Teacher, Transport Staff, Admin | Parent alert on absence within 10 min; auto-defaulter report at <75%; bus WhatsApp alert |
| **Academics** | Timetable engine, Curriculum/syllabus mapping, Lesson plans, Homework/assignments, Gradebook | Create timetables, map syllabus, upload lesson plans, assign homework, enter marks | Teacher, HOD, Admin | Push notification on homework assignment; timetable clash detection; syllabus completion alerts |
| **Examinations & Results** | Exam scheduling, Seating plans, Marks entry (maker-checker), Report card generation, Promotion engine | Schedule exams, assign seats, enter marks, generate report cards, run promotion engine | Teacher, HOD, Exam Coordinator, Admin | Auto-generate report card on marks finalization; promotion auto-computed; parent notification on publication |
| **Fees & Finance** | Fee structure builder, Invoicing, Online/offline collection, Receipts, Dues tracking, Refunds, Financial reports | Define fee structures, generate invoices, collect payments, issue receipts, process refunds | Accountant, Admin | Auto-invoice at year start; due-date reminders; Razorpay webhook -> instant receipt; NACH auto-debit |
| **HRM & Payroll** | Staff onboarding, Leave/attendance, Payroll runs, Statutory compliance, Performance appraisal | Onboard staff, manage leave, run payroll, generate payslips, file PF/ESI/TDS | HR Admin, Accountant, Principal | Auto-calculate payroll from attendance; leave balance auto-update; statutory due-date reminders |
| **Transportation** | Route/vehicle master, RFID boarding/deboarding, Live GPS tracking, Parent ETA notifications | Define routes, assign students, process RFID events, track GPS, notify parents | Transport Staff, Admin, Parent (read) | RFID board event -> parent WhatsApp in <30s; ETA notification at 10 min before stop; route deviation alert |
| **Library** | Catalogue management, Issue/return, Fines, Digital resources | Catalogue books, issue to students, process returns, calculate fines | Librarian, Student (read) | Auto-calculate fine on overdue; auto-reserve notification on availability |
| **LMS** | Content repository, Online assignments, Quizzes, Video lessons | Upload content, create assignments, build quizzes, track completion | Teacher, Student | Auto-grade objective quizzes; completion reminders; due-date notifications |
| **Communication** | Circulars, Parent-teacher messaging, Broadcast, PTM scheduling | Draft circulars, send targeted messages, schedule PTMs, broadcast announcements | Admin, Teacher, HOD, Parent | Auto-deliver broadcast across configured channels; PTM slot conflict detection |
| **Reports & Analytics** | Role-scoped dashboards, Academic trends, Attendance/fee analytics, Trust-level rollups | Generate reports, view dashboards, export data | All roles (scope-restricted) | Scheduled report delivery; QuickSight SPICE auto-refresh; anomaly alerts |

### 3.2 Module Deep-Dives

#### 3.2.1 Admissions / CRM

**Primary user flow:**
1. Parent fills an inquiry form (web or kiosk). System creates `admission_inquiries` (status: INQUIRY). WhatsApp sent with reference number.
2. Front Office staff nurtures the lead: follow-up calls logged, messages sent.
3. Entrance test scheduled. Parent receives confirmation.
4. Post-test: marks entered, seat allocation triggered (merit/quota rules).
5. Seat offer letter sent. 72-hour countdown for confirmation (configurable).
6. Parent confirms, uploads documents via token-based upload link.
7. Admin verifies documents, clicks **Confirm Admission**. System triggers:
   - Creates `students` record (admission number assigned).
   - Creates `parents` record and `student_guardian_map`.
   - Captures DPDP consent (OTP-verified — see Section 7.2).
   - Provisions parent app account.
   - Assigns fee structure; auto-generates invoices.
   - Sends welcome WhatsApp.

**Cross-module dependencies:** SIS (student profile), Fees (fee assignment), Communication (welcome notification).

**Automations:** Auto-duplicate detection on parent mobile + child name + DOB; 48h seat expiry reminder.

---

#### 3.2.2 Student Information System (SIS)

**Primary user flow:**
1. Student profile created (auto from Admissions or manually by Admin).
2. Admin assigns to class + section (`class_enrollments` record).
3. Documents uploaded to vault (S3, presigned URLs): BIRTH_CERTIFICATE, TRANSFER_CERTIFICATE, AADHAAR_PARENT, PHOTO, MEDICAL_CERTIFICATE, etc.
4. ID card auto-generated when photo is uploaded (PDF via Puppeteer, stored in S3).
5. At year-end, promotion engine updates `class_enrollments` for next year.
6. On exit: `enrollment_status` -> ALUMNI; DPDP retention/anonymization policy activated.

---

#### 3.2.3 Attendance

**QR method (classroom):**
1. Class Teacher opens Attendance in Flutter app for their section.
2. App generates session-specific QR (5-minute validity, unique per class/period).
3. Students scan with student app. API validates: QR valid, student in section, within time window.
4. After window closes, teacher marks remaining: ABSENT, LATE, or ON_LEAVE.
5. Absent parents receive WhatsApp alert within 10 minutes.

**RFID method (bus/gate):** Detailed in Section 2.6.1 and Section 6.1.

**Manual override:** Teacher marks with mandatory justification note. Audit trail captures justification. High volume of manual overrides triggers HOD alert.

**Leave requests:** Parent submits via app. Class Teacher approves/rejects. Approved leave pre-marks student as ON_LEAVE.

**Automations:** <75% monthly attendance -> auto-defaulter report to Teacher + HOD + parent; weekly attendance summary to parent (Friday evening).

---

#### 3.2.4 Academics

**Primary user flow:**
1. Admin configures academic calendar (term dates, holiday list) at year start.
2. HOD/Admin creates timetable: subjects assigned to class/section/period slots; auto-clash detection.
3. Subjects mapped to syllabus/curriculum (CBSE chapters from master repository, customizable per tenant).
4. Teachers create lesson plans linked to syllabus chapters.
5. Teachers assign homework: subject, section, instructions, optional attachment, due date.
6. Teachers enter marks in gradebook throughout the term.

**Gradebook:** Weighted scoring model configurable per class/board (class tests, mid-term, project, final exam — percentages configured by HOD).

---

#### 3.2.5 Examinations & Results

**Primary user flow:**
1. Exam Coordinator schedules exam: name, type (Unit Test, Mid-Term, Annual), dates, applicable classes.
2. Seating plan auto-generated (randomized across sections), exported as PDF.
3. **Maker-checker marks entry:** Teacher enters marks (DRAFT) -> HOD reviews and approves -> marks FINALIZED.
4. On finalization, report card PDFs auto-generated (Puppeteer, stored in S3, parent-accessible via presigned URL).
5. **Promotion engine** runs at year-end:

```
IF overall_percentage >= pass_percentage (e.g., 33% CBSE)
   AND no subject below minimum (e.g., 25%)
THEN -> PROMOTED to next class

IF overall_percentage >= pass_percentage
   BUT 1-2 subjects below minimum
THEN -> COMPARTMENT (re-exam eligible)

IF overall_percentage < pass_percentage
THEN -> DETAINED (repeat year)
```

6. Principal reviews decisions before committing. Parent notification sent on publication.

**Cross-module dependencies:** Attendance (attendance % as eligibility criterion), SIS (enrollment updated on promotion), Communication (result notification).

---

#### 3.2.6 Fees & Finance

**Primary user flow:**
1. Accountant creates fee structures at year start: fee head, amount per class/category, due dates, late fine rules.
2. Invoices auto-generated for all enrolled students.
3. Online payment via Razorpay (parent app); offline at school counter (manual entry by accountant).
4. Razorpay `payment.captured` webhook -> instant receipt PDF sent via WhatsApp + email.
5. Dues dashboard: outstanding balances by class, section, individual.
6. Auto-reminders: 3 days before due date, on due date, 7 days after.
7. Refunds processed via Razorpay Refunds API; tracked in `fee_transactions`.
8. Financial reports: day book, fee collection summary, outstanding dues — exportable Excel/PDF.

---

#### 3.2.7 HRM & Payroll

**Primary user flow:**
1. Admin onboards new staff: `staff` record, documents, user account, roles assigned.
2. Staff marks daily attendance (RFID gate scan or HR Admin manual entry).
3. Staff applies for leave via app; line manager approves/rejects.
4. Month-end payroll run: attendance fetched -> salary calculated (basic + HRA + DA - PF 12% - ESI 0.75% - TDS - LOP) -> payslips generated -> pending approval.
5. Principal/Admin approves. Accountant processes bank transfer.
6. Statutory compliance: PF ECR file, ESI contribution file, TDS Form 16/16A generated.

**Performance appraisal:** Annual cycle — self-appraisal -> HOD rating -> Principal final rating -> salary revision workflow.

---

#### 3.2.8 Transportation

**Primary user flow:**
1. Transport staff creates route master: stop names, sequence, timings (AM pickup, PM drop).
2. Vehicles assigned to routes (vehicle number, capacity, driver, GPS device ID).
3. Students assigned to routes and stops.
4. GPS device sends vehicle location every 30 seconds. Last 24h in hot storage; 30 days cold storage (S3 Glacier), then purged.
5. RFID boarding events trigger parent WhatsApp within 30 seconds.
6. ETA notifications sent when vehicle is 10 minutes from a stop.

**DPDP note:** GPS and RFID data collected for explicit purpose of student safety during transport. Retention: 30 days operational, 90 days cold, then deleted. Stated in consent record at admission.

---

#### 3.2.9 Library

**Primary user flow:**
1. Librarian catalogues books (ISBN, title, author, publisher, copies, location code).
2. Student requests a book. Librarian issues: `library_issues` record (book_id, student_id, issued_date, due_date).
3. On return: `returned_date` updated. If overdue, fine auto-calculated (configurable per-day rate) and `library_fines` record created.
4. Fines payable via Fees module (linked to `fee_transactions`).
5. Digital resources: Teachers upload e-books/PDFs accessible to students by class (RBAC-controlled).

---

#### 3.2.10 LMS (Learning Management System)

**Architectural constraint (DPDP):** No behavioral profiling, targeted recommendations based on inferred psychological profiles, or advertising-style personalization. Permitted: completion tracking and rule-based (not ML-inferred) grade-based content sequencing.

**Primary user flow:**
1. Teacher creates a course mapped to a subject and class/section.
2. Teacher uploads content: video lessons (S3/CloudFront), PDFs, slides.
3. Teacher creates online assignments with due dates; students submit via app.
4. Teacher creates quizzes (MCQ, true/false, short answer). MCQs auto-graded; others require manual grading.
5. Completion tracking: teacher sees a completion matrix (student x content item).

---

#### 3.2.11 Communication

**Primary user flow:**
1. Admin/Teacher drafts a circular: title, body, attachments, target audience (all parents, specific class/section).
2. System delivers across all configured channels for the target audience.
3. **Parent-teacher messaging:** Direct 1:1 between a parent and their child's teacher. Visible to: specific parent, specific teacher, Class Teacher, HOD only.
4. **PTM scheduling:** Teacher/Admin creates available slots. Parent books for their child's teacher. WhatsApp confirmation sent.
5. Delivery receipts: all messages logged in `notification_log` with delivery/read status.

---

#### 3.2.12 Reports & Analytics

**Architecture:** Nightly ETL extracts data from all tenant schemas into tenant-isolated tables in Amazon Redshift. QuickSight reads from Redshift with row-level security based on user role and tenant.

**Role-scoped dashboards:**

| Role | Dashboard Access |
|---|---|
| Super Admin | Cross-tenant: active tenants, total students, platform revenue, SLA metrics |
| School Admin / Principal | School-wide: attendance rates, fee collection, exam performance |
| HOD | Department: teacher attendance, subject-wise marks, curriculum completion |
| Teacher | My classes: attendance, assignment submissions, class gradebook |
| Accountant | Finance: daily/monthly collection, dues, payment mode breakdown |
| Parent | My child: attendance, grades, fee status, homework |

**Exports:** CSV, Excel (exceljs), PDF (Puppeteer for report cards; QuickSight native for analytics). All exports audit-logged. Bulk exports rate-limited: max 5 per user per hour.

---

## 4. Database Core Schemas

### 4.1 ER Overview

```
PUBLIC SCHEMA (Platform-level)
  tenants +-> tenant_domains
          +-> tenant_plans
  platform_users -> tenants

TENANT SCHEMA: school_<slug>
  users -> roles -> role_permissions -> permissions

  students -> users (1:1, grade 5+)
           -> classes -> sections
           -> consent_records (DPDP)
           -> rfid_events

  student_guardian_map -> students
                       -> parents -> users (1:1)

  staff -> users (1:1)
        -> staff_appraisals

  class_subject_teacher_map -> sections
                            -> subjects
                            -> staff (teachers)

  attendance_records -> students, sections, rfid_events

  fee_structures -> classes
  fee_transactions -> students, fee_structures

  exams -> classes
  exam_results -> exams, students, subjects

  transport_routes -> transport_vehicles
                   -> student_transport_assignments -> students

  consent_records -> students (data_subject) + parents (guardian)
  audit_logs (INSERT-only, tenant-level)
```

### 4.2 Table Definitions

> **Convention:**
> - All tenant-schema tables: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id UUID NOT NULL`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`.
> - `tenant_id` is present as defense-in-depth (schema provides primary isolation; `tenant_id` enables cross-schema platform audits).
> - Tables marked **[DPDP]** contain student PII, biometric, health, or location data requiring a `consent_records` foreign key.

---

#### `public.tenants`

```sql
CREATE TABLE public.tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  schema_name     TEXT NOT NULL UNIQUE,
  plan            TEXT NOT NULL DEFAULT 'standard',
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  contact_email   TEXT NOT NULL,
  contact_phone   TEXT,
  address         JSONB,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

---

#### `school_<slug>.users` [DPDP]

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  cognito_sub     TEXT NOT NULL UNIQUE,
  email           TEXT,
  phone           TEXT,
  display_name    TEXT NOT NULL,
  user_type       TEXT NOT NULL,   -- 'STUDENT' | 'PARENT' | 'STAFF' | 'ADMIN'
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  last_login_at   TIMESTAMPTZ,
  mfa_enabled     BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_cognito ON users(cognito_sub);
```

---

#### `school_<slug>.roles`, `user_roles`, `permissions`, `role_permissions`

```sql
CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            TEXT NOT NULL,   -- 'PRINCIPAL' | 'HOD' | 'TEACHER' | etc.
  scope           TEXT NOT NULL,   -- 'SCHOOL' | 'DEPARTMENT' | 'CLASS' | 'PLATFORM'
  is_system_role  BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope_entity_id UUID,            -- section_id for class-scoped; dept_id for dept-scoped
  granted_by      UUID REFERENCES users(id),
  granted_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role_id, scope_entity_id)
);

CREATE TABLE permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource        TEXT NOT NULL,   -- 'students' | 'fees' | 'results' | etc.
  action          TEXT NOT NULL,   -- 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  description     TEXT,
  UNIQUE(resource, action)
);

CREATE TABLE role_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);
```

---

#### `school_<slug>.students` [DPDP]

```sql
CREATE TABLE students (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  user_id             UUID REFERENCES users(id),           -- NULL for pre-grade-5
  admission_number    TEXT NOT NULL,
  roll_number         TEXT,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  date_of_birth       DATE NOT NULL,
  gender              TEXT,
  blood_group         TEXT,
  religion            TEXT,
  category            TEXT,                                -- 'GENERAL' | 'OBC' | 'SC' | 'ST'
  mother_tongue       TEXT,
  aadhaar_number      TEXT,                               -- field-level encrypted AES-256-GCM
  nationality         TEXT DEFAULT 'Indian',
  medical_conditions  TEXT,                               -- field-level encrypted [DPDP]
  emergency_contact   JSONB,
  photo_url           TEXT,
  rfid_card_uid       TEXT UNIQUE,
  enrollment_status   TEXT NOT NULL DEFAULT 'ACTIVE',     -- 'ACTIVE' | 'ALUMNI' | 'TRANSFERRED'
  admission_date      DATE NOT NULL,
  exit_date           DATE,
  exit_reason         TEXT,
  current_class_id    UUID REFERENCES classes(id),
  current_section_id  UUID REFERENCES sections(id),
  board               TEXT,
  medium              TEXT,
  consent_record_id   UUID REFERENCES consent_records(id), -- DPDP: parental consent FK
  anonymized_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, admission_number)
);

CREATE INDEX idx_students_tenant ON students(tenant_id);
CREATE INDEX idx_students_rfid ON students(rfid_card_uid);
CREATE INDEX idx_students_class ON students(current_class_id, current_section_id);
```

---

#### `school_<slug>.parents` [DPDP]

```sql
CREATE TABLE parents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL,
  user_id            UUID NOT NULL REFERENCES users(id),
  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  relation           TEXT NOT NULL,   -- 'FATHER' | 'MOTHER' | 'GUARDIAN'
  phone              TEXT NOT NULL,   -- OTP-verified; primary auth factor
  email              TEXT,
  aadhaar_number     TEXT,            -- field-level encrypted [DPDP]
  occupation         TEXT,
  address            JSONB,
  is_primary_contact BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parents_tenant ON parents(tenant_id);
CREATE INDEX idx_parents_phone ON parents(tenant_id, phone);
```

---

#### `school_<slug>.student_guardian_map`

```sql
CREATE TABLE student_guardian_map (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id   UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  relation    TEXT NOT NULL,
  is_emergency BOOLEAN DEFAULT false,
  can_pickup  BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, parent_id)
);
```

---

#### `school_<slug>.staff` [DPDP]

```sql
CREATE TABLE staff (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  user_id             UUID NOT NULL REFERENCES users(id),
  employee_id         TEXT NOT NULL,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  date_of_birth       DATE,
  gender              TEXT,
  phone               TEXT NOT NULL,
  email               TEXT NOT NULL,
  aadhaar_number      TEXT,           -- field-level encrypted [DPDP]
  pan_number          TEXT,           -- field-level encrypted [DPDP]
  department_id       UUID,
  designation         TEXT NOT NULL,
  joining_date        DATE NOT NULL,
  employment_type     TEXT,           -- 'PERMANENT' | 'CONTRACT' | 'PART_TIME'
  salary_structure_id UUID,
  bank_account        JSONB,          -- field-level encrypted [DPDP]
  pf_uan              TEXT,
  esi_number          TEXT,
  status              TEXT NOT NULL DEFAULT 'ACTIVE',
  exit_date           DATE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, employee_id)
);
```

---

#### `school_<slug>.classes` & `sections`

```sql
CREATE TABLE classes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  name          TEXT NOT NULL,     -- 'Nursery' | 'LKG' | 'UKG' | 'Class 1' .. 'Class 10'
  numeric_level INTEGER,           -- 0=Nursery, 1=LKG, 2=UKG, 3=Grade1 .. 12=Grade10
  academic_year TEXT NOT NULL,     -- '2025-26'
  board         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name, academic_year)
);

CREATE TABLE sections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  class_id         UUID NOT NULL REFERENCES classes(id),
  name             TEXT NOT NULL,  -- 'A' | 'B' | 'C'
  class_teacher_id UUID REFERENCES staff(id),
  capacity         INTEGER DEFAULT 40,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, name)
);
```

---

#### `school_<slug>.subjects` & `class_subject_teacher_map`

```sql
CREATE TABLE subjects (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name      TEXT NOT NULL,  -- 'Mathematics' | 'English' | 'Science'
  code      TEXT,
  type      TEXT,           -- 'THEORY' | 'PRACTICAL' | 'LANGUAGE'
  board     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE class_subject_teacher_map (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  section_id    UUID NOT NULL REFERENCES sections(id),
  subject_id    UUID NOT NULL REFERENCES subjects(id),
  teacher_id    UUID NOT NULL REFERENCES staff(id),
  academic_year TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(section_id, subject_id, academic_year)
);
```

---

#### `school_<slug>.attendance_records` [DPDP]

```sql
CREATE TABLE attendance_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  student_id     UUID NOT NULL REFERENCES students(id),
  section_id     UUID NOT NULL REFERENCES sections(id),
  subject_id     UUID REFERENCES subjects(id),        -- NULL for daily attendance
  date           DATE NOT NULL,
  period         INTEGER,                             -- NULL for daily; 1-8 for period-wise
  status         TEXT NOT NULL,                       -- 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE'
  capture_method TEXT NOT NULL,                       -- 'RFID' | 'QR' | 'MANUAL'
  marked_by      UUID REFERENCES users(id),
  rfid_event_id  UUID REFERENCES rfid_events(id),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, date, period)
);

CREATE INDEX idx_attendance_student_date ON attendance_records(student_id, date);
CREATE INDEX idx_attendance_section_date ON attendance_records(section_id, date);
```

---

#### `school_<slug>.rfid_events` [DPDP]

```sql
CREATE TABLE rfid_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  student_id      UUID REFERENCES students(id),
  rfid_tag_uid    TEXT NOT NULL,
  device_id       TEXT NOT NULL,
  event_type      TEXT NOT NULL,        -- 'BOARD' | 'DEBOARD' | 'GATE_IN' | 'GATE_OUT'
  event_timestamp TIMESTAMPTZ NOT NULL,
  received_at     TIMESTAMPTZ DEFAULT now(),
  location_lat    DECIMAL(10,8),
  location_lng    DECIMAL(11,8),
  route_id        UUID REFERENCES transport_routes(id),
  processed       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rfid_events_student ON rfid_events(student_id, event_timestamp);
CREATE INDEX idx_rfid_events_device ON rfid_events(device_id, event_timestamp);
```

---

#### `school_<slug>.fee_structures`

```sql
CREATE TABLE fee_structures (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              TEXT NOT NULL,
  class_id          UUID REFERENCES classes(id),
  category          TEXT,
  academic_year     TEXT NOT NULL,
  fee_heads         JSONB NOT NULL,  -- [{name, amount, due_date, is_monthly}, ...]
  late_fine_per_day DECIMAL(10,2) DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

---

#### `school_<slug>.fee_transactions` [DPDP]

```sql
CREATE TABLE fee_transactions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL,
  student_id         UUID NOT NULL REFERENCES students(id),
  fee_structure_id   UUID REFERENCES fee_structures(id),
  transaction_type   TEXT NOT NULL,   -- 'INVOICE' | 'PAYMENT' | 'REFUND' | 'FINE'
  fee_head           TEXT NOT NULL,
  amount             DECIMAL(12,2) NOT NULL,
  paid_amount        DECIMAL(12,2) DEFAULT 0,
  balance            DECIMAL(12,2) GENERATED ALWAYS AS (amount - paid_amount) STORED,
  due_date           DATE,
  payment_date       TIMESTAMPTZ,
  payment_mode       TEXT,            -- 'ONLINE' | 'CASH' | 'CHEQUE' | 'NACH'
  gateway_order_id   TEXT,
  gateway_payment_id TEXT UNIQUE,     -- Razorpay payment ID (idempotency key)
  receipt_number     TEXT UNIQUE,
  receipt_url        TEXT,
  collected_by       UUID REFERENCES users(id),
  status             TEXT NOT NULL DEFAULT 'PENDING',
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fee_tx_student ON fee_transactions(student_id, due_date);
CREATE INDEX idx_fee_tx_status ON fee_transactions(tenant_id, status);
```

---

#### `school_<slug>.exams`

```sql
CREATE TABLE exams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  name          TEXT NOT NULL,
  exam_type     TEXT NOT NULL,      -- 'UNIT_TEST' | 'MID_TERM' | 'ANNUAL' | 'PRACTICAL'
  academic_year TEXT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  class_ids     UUID[],
  status        TEXT NOT NULL DEFAULT 'SCHEDULED',
  total_marks   DECIMAL(6,2),
  pass_marks    DECIMAL(6,2),
  created_by    UUID REFERENCES users(id),
  approved_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

---

#### `school_<slug>.exam_results` [DPDP]

```sql
CREATE TABLE exam_results (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  exam_id        UUID NOT NULL REFERENCES exams(id),
  student_id     UUID NOT NULL REFERENCES students(id),
  subject_id     UUID NOT NULL REFERENCES subjects(id),
  marks_obtained DECIMAL(6,2),
  grade          TEXT,
  is_absent      BOOLEAN DEFAULT false,
  entered_by     UUID REFERENCES users(id),   -- maker
  approved_by    UUID REFERENCES users(id),   -- checker (HOD)
  entry_status   TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED'
  remarks        TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_id, student_id, subject_id)
);

CREATE INDEX idx_exam_results_exam ON exam_results(exam_id);
CREATE INDEX idx_exam_results_student ON exam_results(student_id);
```

---

#### `school_<slug>.transport_routes` & `transport_vehicles`

```sql
CREATE TABLE transport_routes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name      TEXT NOT NULL,
  type      TEXT NOT NULL,      -- 'MORNING_PICKUP' | 'AFTERNOON_DROP' | 'BOTH'
  stops     JSONB NOT NULL,     -- [{sequence, name, arrival_time, lat, lng}, ...]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE transport_vehicles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  route_id         UUID REFERENCES transport_routes(id),
  vehicle_number   TEXT NOT NULL,
  vehicle_type     TEXT,           -- 'BUS' | 'VAN' | 'AUTO'
  capacity         INTEGER,
  driver_id        UUID REFERENCES staff(id),
  gps_device_id    TEXT,
  insurance_expiry DATE,
  fitness_expiry   DATE,
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

---

#### `school_<slug>.consent_records` [DPDP]

> Central DPDP compliance table. Every collection of student PII, biometric, health, or location-tracking data must reference a `consent_record`.

```sql
CREATE TABLE consent_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  data_subject_id  UUID NOT NULL,              -- student_id (the minor)
  guardian_id      UUID NOT NULL REFERENCES parents(id),
  purpose          TEXT NOT NULL,              -- 'STUDENT_ENROLLMENT' | 'TRANSPORT_TRACKING' | 'THIRD_PARTY_LMS'
  data_categories  TEXT[] NOT NULL,            -- ['name','dob','photo','rfid_location']
  processor_name   TEXT,                       -- third-party name; NULL for school's own processing
  dpa_reference    TEXT,                       -- DPA doc reference for processors
  consent_given_at TIMESTAMPTZ NOT NULL,
  consent_method   TEXT NOT NULL,              -- 'OTP_VERIFIED_MOBILE' | 'SIGNED_FORM_UPLOAD'
  consent_version  TEXT NOT NULL,              -- version of the consent notice shown
  ip_address       TEXT,
  is_active        BOOLEAN DEFAULT true,
  withdrawn_at     TIMESTAMPTZ,
  withdrawal_reason TEXT,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_consent_subject ON consent_records(data_subject_id, purpose);
CREATE INDEX idx_consent_guardian ON consent_records(guardian_id);
```

---

#### `school_<slug>.audit_logs`

> Immutable log — INSERT-only. No UPDATE or DELETE permitted (enforced at application layer + DB user grants).

```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  actor_user_id UUID,
  actor_role    TEXT,
  action        TEXT NOT NULL,      -- 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'CONSENT_CAPTURE'
  resource_type TEXT NOT NULL,      -- 'student' | 'fee_transaction' | 'exam_result' | etc.
  resource_id   UUID,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  session_id    TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB DEFAULT '{}'
);

CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id, occurred_at);
CREATE INDEX idx_audit_occurred ON audit_logs(occurred_at);
```

---

## 5. Roles, RBAC & CRUD Hierarchy

### 5.1 Role Enumeration & Hierarchy

| Scope | Roles | Access Boundary |
|---|---|---|
| **Platform** | Super Admin | All tenants; platform configuration; billing |
| **School** | Tenant/School Admin, Principal | Full school; all modules |
| **Department** | HOD / Academic Head | Own department's classes, teachers, results |
| **Class** | Teacher, Class Teacher | Assigned class(es)/section(s) only |
| **Function** | Accountant, Front Office/Admissions, Transport Staff, Librarian | Module-specific access across the school |
| **External** | Parent | Own child(ren) only — read-heavy |
| **Self** | Student | Own data only — read-only (Grade 5+) |

```
Super Admin (platform)
    +-- Tenant Admin / School Admin
            +-- Principal
            |       +-- HOD / Academic Head (per department)
            |       |       +-- Teacher (class-scoped)
            |       |       +-- Class Teacher (section-scoped)
            |       +-- Accountant
            |       +-- Front Office / Admissions Staff
            |       +-- Transport Staff
            |       +-- Librarian
            +-- (Parent and Student: external to staff hierarchy)
```

### 5.2 CRUD-by-Role Matrix

> Legend: C=Create, R=Read, U=Update, D=Delete, -=No Access, *=scope-restricted

| Resource | Super Admin | School Admin | Principal | HOD | Class Teacher | Teacher | Accountant | Front Office | Transport | Librarian | Parent | Student |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Tenants** | CRUD | - | - | - | - | - | - | - | - | - | - | - |
| **Users** | CRUD | CRUD | R | R* | - | - | - | CRU | - | - | - | - |
| **Students** | R | CRUD | CRUD | R* | RU* | R* | R (name) | CRUD | R (name+RFID) | R (name) | R (own child) | R (own) |
| **Parents** | R | CRUD | R | R* | R* | R* | R (name) | CRUD | R (contact) | - | R (own) | - |
| **Staff** | R | CRUD | RU | R* | - | - | R (payroll view) | R | - | - | - | - |
| **Attendance** | R | R | R | R* | CRUD* | CRU* | - | - | CRU (transport) | - | R (own child) | R (own) |
| **Fee Structures** | R | CRUD | R | - | - | - | CRUD | - | - | - | - | - |
| **Fee Transactions** | R | R | R | - | - | - | CRUD | - | - | - | R (own child) | - |
| **Exams** | R | CRUD | CRUD | CRU* | R | R | - | - | - | - | - | - |
| **Exam Results** | R | R | R | RU* | - | CRU* (maker) | - | - | - | - | R (own child) | R (own) |
| **Homework** | R | R | R | R* | CRUD* | CRUD* | - | - | - | - | R (own child) | R (own) |
| **Transport Routes** | R | CRUD | R | - | - | - | - | - | CRUD | - | R (own child stop) | - |
| **RFID Events** | R | R | R | - | - | - | - | - | R | - | R (own child) | - |
| **Library** | R | R | R | - | - | - | - | - | - | CRUD | - | R (own) |
| **LMS Content** | R | R | R | RU* | CRUD* | CRUD* | - | - | - | - | - | R (own class) |
| **Consent Records** | R | R | R | - | - | - | - | CRU | - | - | R/U (own) | - |
| **Audit Logs** | R | R | R (own school) | - | - | - | R (fee audits) | - | - | - | - | - |

### 5.3 Cross-Role Visibility Rules

| Scenario | Rule |
|---|---|
| Teacher viewing students | Only students in sections where teacher is assigned (via `class_subject_teacher_map`) |
| Parent viewing student data | Only students linked via `student_guardian_map` with parent's `user_id` |
| HOD viewing teacher performance | Only teachers in their department |
| HOD viewing fee/payment data | **Not permitted** — restricted to Accountant and above |
| Accountant viewing academic results | **Not permitted** — sees student name for dues tracking only |
| Transport Staff | Only: student_id, name, rfid_card_uid, route_id, stop_name. No academic or financial data. |
| Librarian | Only: student_id, name, class, section. No academic, financial, or biometric data. |

**Enforcement:** All RBAC enforced at the NestJS service layer via `@Roles()` and `@Scope()` decorators. The `RolesGuard` extracts JWT, resolves roles + scope entities, and injects a `PermissionContext`. All DB queries are parameterized with scope entity IDs. No client-side RBAC.

### 5.4 User Creation & Identity Bootstrap

**Staff:** Admin creates staff record -> Cognito account provisioned -> welcome email with temp password -> staff sets password + enrolls TOTP MFA on first login.

**Parent:** Auto-triggered on admission confirmation. OTP sent to parent's mobile. Parent enters OTP to set PIN/password. Cognito account created with verified mobile as username.

**Student (Grade 5+):** Admin creates account. Credentials shared via parent's account. Student changes password on first login.

**Student (Nursery–Grade 4):** No student login. All data accessible only via parent account.

**Self-registration:** Parent enters school code (unique 6-digit alphanumeric, rotated annually) + registered mobile -> OTP verification -> linked to existing parent record.

**MFA Policy:**

| Role | Requirement | Method |
|---|---|---|
| Super Admin | Mandatory | TOTP (Google Authenticator / Authy) |
| Tenant Admin, Principal, HOD, Teacher, Accountant | Mandatory | TOTP |
| Front Office / Support Staff | Mandatory | TOTP |
| Parent | Optional (recommended) | OTP-to-mobile (default); TOTP optional |
| Student | Optional | OTP-to-mobile |

---

## 6. Complete Lifecycles with Real-World Scenarios

*Fictional school: **Greenwood Academy, Pune** (CBSE, English medium, Nursery–Grade 10, tenant: school_greenwood)*
*Fictional student: **Priya Sharma**, DOB: 15 March 2016, applying for Grade 3 (AY 2025-26)*
*Fictional parent: **Rajesh Sharma** (father), Mobile: 98765-43210*

### 6.1 Student Lifecycle

#### Phase 1: Inquiry

Rajesh fills an inquiry form on Greenwood's website (EduCore embedded widget). System creates:

```
admission_inquiries {
  id: uuid-001,
  student_name: "Priya Sharma",
  dob: "2016-03-15",
  class_applying: "Class 3",
  parent_mobile: "9876543210",
  status: INQUIRY,
  assigned_to: Meera Joshi (Front Office)
}
```

Rajesh receives WhatsApp: "Thank you for your inquiry at Greenwood Academy. Reference: INQ-2025-0342."

#### Phase 2: Admission Process

Priya's entrance test: 82/100. Seat offer sent to Rajesh. 72-hour countdown begins. Rajesh confirms and uploads documents. Admin verifies and clicks **Confirm Admission**. System:

1. Creates `students` record (GWA-2025-0089).
2. Creates `parents` record for Rajesh.
3. Creates `student_guardian_map` (Priya <-> Rajesh, FATHER).
4. **Captures DPDP consent via OTP-verified flow:**
   ```json
   {
     "data_subject_id": "priya-student-uuid",
     "guardian_id": "rajesh-parent-uuid",
     "purpose": "STUDENT_ENROLLMENT",
     "data_categories": ["name","dob","photo","aadhaar_parent","academic_records"],
     "consent_given_at": "2025-04-13T10:32:00+05:30",
     "consent_method": "OTP_VERIFIED_MOBILE",
     "consent_version": "2025-v1"
   }
   ```
5. Provisions Rajesh's parent app account.
6. Assigns Grade 3B; generates fee invoices.
7. Sends welcome WhatsApp.

#### Phase 3: Daily Attendance — RFID Bus Scenario

Priya's RFID card (UID: `E2801150201601234`) assigned in her profile.

**8 October 2025, 7:42 AM — Priya boards Bus Route 7:**

```
Edge Gateway sends:
  { device_id: "GWA-BUS-007", rfid_tag_uid: "E2801150201601234",
    event_type: "BOARD", event_timestamp: "2025-10-08T07:42:18+05:30",
    location_lat: 19.0596, location_lng: 72.8295 }

RabbitMQ rfid.events exchange (parallel consumers):

Attendance Worker:
  -> Resolves rfid_tag_uid -> Priya Sharma
  -> Creates rfid_events record
  -> Creates attendance_records: status=PRESENT, capture_method=RFID

Notification Worker:
  -> Looks up guardian: Rajesh Sharma, 9876543210
  -> WhatsApp via Gupshup:
     "Priya Sharma has BOARDED Bus Route 7 at 7:42 AM (Stop: Bandra Station).
      Expected school arrival: 8:15 AM."
  -> notification_log: {status: SENT} -> {status: DELIVERED at 7:42:31 AM}
```

**17 October — Priya absent:** QR window closes, Priya not marked. Sunita Rao (Class Teacher) marks ABSENT. System auto-sends WhatsApp to Rajesh at 8:20 AM.

**November — Attendance shortfall (71%):** Auto-defaulter report to Class Teacher + HOD. WhatsApp to Rajesh: "Priya's attendance is 71%, below the required 75%."

#### Phase 4: Academics & Examinations

Unit Test 2 (December 2025): Sunita enters Priya's Mathematics marks: 38/50 (DRAFT). HOD Kavita approves (APPROVED). Admin publishes (PUBLISHED). Report card PDF auto-generated, sent to Rajesh via app notification.

#### Phase 5: Year-End Promotion

Annual exam (April 2026). Promotion engine:
```
Overall: 76%   Pass threshold: 33% (CBSE Grade 3)
All subjects above minimum: YES
Decision: PROMOTED -> Grade 4 (AY 2026-27)
```
New `class_enrollments` created. Rajesh notified via WhatsApp + push.

#### Phase 6: Alumni Status

May 2035 — Priya completes Grade 10. Admin issues TC. `enrollment_status` -> ALUMNI, `exit_date: 2035-05-31`.

**DPDP retention:** Academic records retained 7 years (until 2042). Transport/RFID/GPS data purged within 90 days of exit. At 7-year mark: names, Aadhaar, contacts irreversibly anonymized.

---

### 6.2 Teacher Lifecycle

*Fictional teacher: **Sunita Rao**, Grade 3 Class Teacher + Mathematics teacher*

**Onboarding:** Admin creates `staff` record -> Cognito account provisioned -> welcome email -> Sunita sets password + enrolls TOTP MFA. Roles assigned: TEACHER (Mathematics: 3B, 3C) + CLASS_TEACHER (Grade 3B).

**Daily attendance (QR):** Opens Flutter app -> Attendance -> Grade 3B -> Start Session. 5-minute QR displayed. Students scan. QR closes. Sunita marks absent students.

**Homework:** "+ Homework" -> subject, section, instructions, PDF attachment, due date -> push notifications to Grade 3B parents + students.

**Gradebook:** Sunita enters class test marks (DRAFT) -> HOD Kavita approves.

**Parent messaging:** Rajesh messages Sunita about fractions. Sunita responds in-app. Conversation visible to: Sunita, Rajesh, HOD Kavita. NOT visible to other parents or teachers.

**Annual appraisal:** Self-appraisal -> HOD rating -> Principal final rating -> salary revision.

---

### 6.3 HOD/Academic Head Lifecycle

*Fictional HOD: **Kavita Nair**, Head of Primary Department (Grades 1–5)*

**Dashboard:** Attendance rates for all Grade 1–5 sections, curriculum completion %, pending marks approvals, teacher leave requests. No fee/payroll data visible.

**Curriculum approval:** Teachers submit lesson plans -> Kavita approves or requests revision.

**Escalation example:** Grade 2A attendance drops to 68%. Kavita drills down: Class Teacher marking manually, note "RFID reader at Gate 2 not working." Kavita raises a maintenance ticket, messages Principal.

**Audit log records:**
```
Kavita READ attendance_records (Grade 1-5 sections)
Kavita READ user profile (Grade 2A teacher)
Kavita CREATED maintenance_ticket
Kavita SENT in-app message to Principal
```
All timestamped, scoped to her department. No unrelated staff can access these records.

---

### 6.4 Accountant/Finance Lifecycle

*Fictional accountant: **Prakash Mehta***

**Year-start:** Creates fee structure "Annual Fee 2025-26 - Grade 3": Tuition Rs 60,000 (quarterly), Transport Rs 18,000, Annual Day Rs 2,000, late fine Rs 50/day. On activation: auto-generates invoices for all Grade 3 students.

**Online payment:** Rajesh pays Q2 (Rs 19,500) via UPI in parent app. Razorpay webhook fires. System: marks PAID, generates receipt (GWA-2025-RCT-00432), sends PDF via WhatsApp + email.

**Offline payment:** Parent pays cash at counter. Prakash records: Fees -> Offline Collection -> student -> amount + mode=CASH -> Collect. Receipt printed.

**Defaulter follow-up:** 47 students outstanding >30 days. Prakash sends bulk reminder -> WhatsApp + push to 47 parents. Exports defaulter list to Excel for Principal.

**Month-end payroll:** Fetch attendance -> calculate (basic + HRA + DA - PF 12% - ESI 0.75% - TDS - LOP) -> generate payslips -> Principal approves -> bank transfer file -> PF ECR + ESI files generated -> payslips emailed to staff.

---

### 6.5 Parent Lifecycle

**Account linking:** Rajesh downloads EduCore app, enters mobile, enters OTP, sets 6-digit PIN. Home screen: today's attendance, upcoming homework, fee reminders.

**Fee payment:** Fees -> Q3 Invoice Rs 19,500 -> Pay Now -> Razorpay (UPI/Google Pay) -> receipt appears immediately.

**PTM booking:** Communication -> PTM -> selects slot: "Sunita Rao, 15 Mar 2026, 4:30 PM." WhatsApp confirmation sent.

**Third-party consent:** School integrates "ReadingBuddy Pro." Rajesh prompted to review and consent via OTP. New `consent_records` entry:
```json
{
  "purpose": "THIRD_PARTY_LMS",
  "processor_name": "ReadingBuddy Pro",
  "dpa_reference": "DPA-READINGBUDDY-2025-001",
  "data_categories": ["name","class","reading_level","assignment_scores"]
}
```

**Consent withdrawal:** Rajesh withdraws from app (Settings -> Consent Management -> Withdraw). System: sets `is_active: false`, `withdrawn_at`, sends deletion request to ReadingBuddy Pro API, audit-logs withdrawal.

---

### 6.6 Admin/Super Admin Lifecycle

**Tenant provisioning:** New school "Lotus Public School, Nagpur" signs up. Super Admin clicks provision:
1. Terraform creates PostgreSQL schema `school_lotus`.
2. Flyway migrations run on new schema.
3. Cognito entries created for school admin.
4. Default roles initialized in `school_lotus.roles`.
5. Credentials emailed to principal.

Total time: < 3 minutes.

**Trust-level reporting:** Sunrise Educational Trust (owns Greenwood Pune + Lotus Nagpur). Trust Admin (QuickSight, row-level security): total 2,847 students, Greenwood attendance 89%/Lotus 84%, fee collection summaries. Sees aggregate data only — no individual student PII.

---

### 6.7 RBAC Boundary Collaboration Example

**Scenario:** Sunita flags a welfare concern for Priya (3 absences in one week).

**Sunita (Class Teacher):**
- Can READ Priya's attendance and homework (class-scoped).
- Creates welfare concern note; cannot see fee dues or other students' concerns.

**Auto-escalation:** System notifies HOD Kavita (attendance < 75%).

**Kavita (HOD):**
- Sees Priya's attendance + welfare note + academic summary (dept-scoped).
- Cannot see fee dues or data from other schools.

**Kavita escalates to Principal.** Principal sees: attendance + welfare note + academics + fee dues (Principal has cross-functional read for pastoral care). Directs Front Office to call Rajesh.

**Other staff:** See nothing about this situation.

**Audit log:**
```
1. Sunita READ student Priya           [CLASS_TEACHER scope]
2. Sunita CREATED welfare_concern      [CLASS_TEACHER scope]
3. System CREATED notification -> Kavita [auto-escalation]
4. Kavita READ student Priya           [HOD scope]
5. Kavita READ welfare_concern         [HOD scope]
6. Principal READ student Priya        [PRINCIPAL scope]
7. Principal READ fee_transactions     [PRINCIPAL cross-functional]
```

Every access recorded. No unrelated staff accessed Priya's data. DPDP purpose-limitation upheld.

---

## 7. DPDP Act 2023 & DPDP Rules 2025 Compliance

> **Legal Disclaimer:** This section describes EduCore's technical and procedural approach to the DPDP Act 2023 and DPDP Rules 2025. It does not constitute legal advice. Specific scenarios should be reviewed by a qualified Indian data protection lawyer.

### 7.1 Legal Basis & Fiduciary Structure

| Entity | DPDP Role | Responsibilities |
|---|---|---|
| **EduCore (Cascade Technologies)** | Data Processor (school data) + Data Fiduciary (platform billing/admin data) | Process student data per school's instructions; maintain security |
| **School / Educational Institution** | **Data Fiduciary** | Determines purposes and means of processing; responsible for consent, purpose limitation, grievance redressal |
| **Third-party EdTech tools** | **Data Processor** (engaged by the school) | Process data only per school instructions and DPA; cannot repurpose |
| **Students** | **Data Principal** (minor) | Rights exercised by parent/guardian under Section 9 |
| **Parents/Guardians** | Consent givers on behalf of the student | Give, manage, and withdraw consent; exercise Data Principal rights |

**DPA between EduCore and schools:** Specifies processing only on school instructions; security standards; 6-hour breach notification to school; data deletion within 30 days of contract end (with certificate); no unauthorized sub-processing.

**DPA between schools and third-party tools:** School executes DPA with each tool provider. EduCore provides a DPA template and checklist. EduCore's Integration API enforces technical controls but the legal DPA responsibility lies with the school.

### 7.2 Children's Data — Section 9 Obligations

The DPDP Act defines a **"child"** as any person below 18 years — broader than GDPR (16) or COPPA (13). All EduCore students (Nursery–Grade 10, ages ~3–16) are legally children. Processing requires **verifiable parental/guardian consent** before collection.

#### 7.2.1 Consent Capture Flow at Admission

```
Step 1: Parent provides mobile number at inquiry.

Step 2: At admission confirmation, a Consent Notice (version-controlled,
        plain-language) is presented covering:
          - What data is collected (name, DOB, photo, Aadhaar, health,
            attendance, academic records, transport location)
          - Purpose of each data category
          - Who processes it (school + EduCore)
          - Retention period per data category
          - How to withdraw consent or exercise rights
          - School Grievance Officer contact details

Step 3: Parent identity verified (Aadhaar last-4 confirmation
        or staff-verified mobile at admission desk).

Step 4: OTP sent to parent's registered mobile.

Step 5: Parent enters OTP -> consent_records row created:
          consent_method: 'OTP_VERIFIED_MOBILE'
          ip_address: (audit trail)
          consent_version: '2025-v1'
          is_active: true

Step 6: Parent receives WhatsApp summary of consent + withdrawal instructions.
```

> **Note on "verifiable" standard:** DPDP Rules 2025 include provisions for age-gating mechanisms (Digital Nagrik system). As of mid-2026, this operationalization is still underway. EduCore's OTP-verified mobile is an interim measure. The Privacy Officer tracks this and will upgrade when the officially notified mechanism is operationalized.

#### 7.2.2 Consent as a First-Class Entity

The `consent_records` table is **never a simple checkbox**. It:
- Is created via a dedicated consent-capture flow, not as a side effect of account creation.
- References the specific consent notice document version (stored immutably in S3).
- Is audit-logged on creation, update, and withdrawal.
- Links to every student data table containing PII, biometric, or sensitive data.
- Cannot be deleted by any application user — only marked `is_active: false` on withdrawal.

#### 7.2.3 Consent for Additional Processing

New purposes (e.g., third-party proctoring) require a new consent request:
1. Parent notified via WhatsApp/push/email with plain-language description.
2. A new `consent_records` entry is created for the specific purpose.
3. Original enrollment consent remains unchanged.

### 7.3 Prohibited Processing Constraints (Section 9(3))

Section 9(3) prohibits behavioral monitoring and targeted advertising directed at children. EduCore implements these as **architectural constraints**, not merely policies:

| Module | Constraint |
|---|---|
| **LMS** | No behavioral profiling. No engagement pattern tracking for advertising. Permitted: completion tracking for teacher instructional improvement only. |
| **Analytics / Redshift** | No behavioral scores, predicted learner types, or behavioral segments in schema. Student analytics = academic + attendance performance only. |
| **Communication** | No algorithmically personalized content recommendations. Broadcasts are role-scoped, never behaviorally targeted. |
| **RFID/GPS** | Location data used exclusively for transport safety. No heatmaps, movement pattern analysis, or profiling. |
| **Third-party integrations** | DPA explicitly prohibits third-party processors from using shared student data for advertising, profiling, or any purpose beyond stated instructional use. Violation triggers contract termination. |

These constraints are embedded in the schema (no profiling columns exist) + enforced by quarterly internal audits.

### 7.4 Purpose Limitation & Data Minimization

| Data Category | Module | Stated Purpose | Retention Period | Deletion Trigger |
|---|---|---|---|---|
| Student name, DOB, class | SIS, all | Student identification and enrollment | 7 years post-exit | Student exit + 7 years |
| Parent contact (mobile, email) | Communication, Fees | Parent communication, fee collection | Enrollment + 1 year | Student exit + 1 year |
| Aadhaar (parent, student) | Admissions | Identity verification only | Verification only; purged at exit + 1 year | Student exit + 1 year |
| Health/medical data | SIS | Emergency medical care | Enrollment + 1 year | Student exit + 1 year |
| RFID boarding/deboarding events | Transport | Student safety during transport | 30 days operational; 90 days cold | 90 days from event date |
| GPS vehicle location | Transport | Real-time ETA for parents | 24 hours hot storage; purged | 24 hours from event |
| Exam results, report cards | Exams | Academic assessment and progression | 7 years post-exit | Student exit + 7 years |
| Fee transaction records | Fees | Financial accounting, statutory compliance | 8 years | 8 years from transaction |
| Audit logs | All | Security, compliance, dispute resolution | 5 years | 5 years from log date |

### 7.5 Data Principal Rights

| Right | DPDP Provision | EduCore Implementation |
|---|---|---|
| **Right to Access** | Section 11 | Parent views all child data via app "My Data" screen. Downloadable export (JSON/PDF) within 72 hours. |
| **Right to Correction** | Section 12(a) | Parent requests correction via in-app form. School Admin reviews within 30 days. Audit-logged. |
| **Right to Erasure** | Section 12(b) | Parent requests erasure. Anonymization job triggered (`anonymized_at` set; names replaced with UUIDs, contacts cleared). Retained data explained with justification. |
| **Right to Grievance Redressal** | Section 13 | In-app Grievance form. Each school designates a Grievance Officer. Response within 48 hours; resolution within 30 days. |
| **Right to withdraw consent** | Section 7 | Immediate in-app withdrawal. Third-party processors notified via API. Audit-logged. |

**Right to an Open Future:** EduCore's retention/erasure schedule ensures former students cannot be re-identified from EduCore data years after leaving school. On retention expiry, data is irreversibly anonymized — not merely soft-deleted.

### 7.6 Breach Notification Workflow

> Child data breaches are **aggravated violations** under DPDP Act Schedule I (Item 6), with penalty exposure up to **Rs 200 crore** for child-data-specific violations on the Data Fiduciary. All EduCore engineers must know that all student data relates to children under the DPDP Act.

**Detection sources:** AWS GuardDuty, CloudTrail anomaly detection, application audit log analysis, RDS Performance Insights, AWS Security Hub.

**Response timeline:**

```
Hour 0:    Breach detected (automated alert or manual report)

Hour 0-1:  On-call engineer declares incident.
           If student data involved: HIGH
           If children's data (all our students): CRITICAL

Hour 0-2:  Containment:
           - Affected JWTs invalidated
           - WAF IP block on suspicious source
           - If DB breach suspected: read-only mode, PgBouncer pools paused

Hour 0-6:  EduCore notifies affected schools (Data Fiduciaries):
           - Written notification: nature, data categories, estimated
             affected students, containment steps, next steps
           (Required by EduCore's DPA with schools)

Hour 0-72: Schools notify Data Protection Board of India (DPBI)
           within 72 hours (per DPDP Rules)
           EduCore provides:
             - Pre-filled Breach Report Template with technical details
             - Dedicated liaison contact for school's compliance team

Post-72h:  Affected parents/guardians notified:
           - WhatsApp + email: what data accessed, what school is doing,
             what parents should do

Post-breach: Full incident report. Lessons-learned review.
             Regulatory correspondence managed by school's legal team
             (EduCore provides technical evidence/documentation).
```

### 7.7 Compliance Posture & Privacy Officer

#### "DPDP-Ready by Design"

EduCore's compliance posture is explicitly **"DPDP-ready by design"**:
- Architectural guardrails (consent flows, data minimization, audit logs, purpose limitation, breach workflow) are first-class platform features.
- EduCore does **not** claim blanket DPDP compliance because:
  1. DPDP Rules 2025 are not yet fully operationalized as of mid-2026 (Fourth Schedule exemptions, Digital Nagrik age-gating pending notification).
  2. Compliance is determined by the Data Protection Board of India — not self-assessment.
  3. Each school bears independent compliance obligations that EduCore enables but cannot fulfill on the school's behalf.

#### Privacy Officer Responsibilities

| Responsibility | Cadence |
|---|---|
| Track DPDP Rules operationalization (MeitY/DPBI notifications) | Weekly |
| Review and update this document's compliance section | Quarterly |
| Privacy Impact Assessments for new features | Per-feature (pre-launch) |
| Manage DPA template; ensure all school clients have executed it | Per new tenant |
| Coordinate breach response as EduCore liaison to affected schools | Per incident |
| Engineering team DPDP training | Bi-annually |
| Handle Data Principal requests escalated from schools | As received |

**Privacy Officer Contact:** `privacy@educore.app`

Published in: EduCore Privacy Policy (linked from all web and app surfaces), each tenant's Grievance Officer configuration.

---

## 8. Additional Features

### 8.1 RFID/NFC Bus & Campus Tracking

- Edge gateway buffers 24 hours of events offline (resilient to campus internet outages).
- RabbitMQ fan-out exchange: one RFID event triggers parallel processing (attendance update + parent notification) without one blocking the other.
- WhatsApp delivery confirmed within 30 seconds of boarding event (P95 latency target).
- Campus GATE_IN/GATE_OUT events update a real-time "students on campus" dashboard visible to Admin and Security — useful for emergency headcount.

### 8.2 Attendance Capture Options

| Method | Hardware Required | User Action | DPDP Notes |
|---|---|---|---|
| **RFID** | UHF RFID card + edge gateway reader | Student taps card | GPS location retained max 90 days; RFID UID in student profile with consent |
| **QR Code** | Teacher's smartphone (camera) | Teacher displays QR; students scan | Session-specific, ephemeral QR; no hardware dependency |
| **Manual Override** | None | Teacher marks with mandatory justification note | Justification audit-logged; high volume triggers HOD alert |

### 8.3 Mobile Apps

| App | Platform | Users | Key Features |
|---|---|---|---|
| **EduCore Parent App** | Flutter (Android + iOS) | Parents | Attendance alerts, bus tracking, fee payment (Razorpay), homework, results, PTM booking, messaging, consent management |
| **EduCore Teacher App** | Flutter (Android + iOS) | Teachers, Class Teachers, HODs | Attendance marking (QR), homework, gradebook, timetable, parent messaging, leave requests |
| **EduCore Student App** | Flutter (Android + iOS) | Students (Grade 5–10) | Timetable, homework, results, library, LMS content, QR attendance scan |
| **EduCore Admin Web** | Next.js (web) | Admin, Principal, Accountant, Front Office | All modules; full configuration; reports and analytics |

All apps use the same NestJS API backend. Features gated by role permissions (RBAC enforced at API level, not app level). Push notifications via FCM (Android) + APNs (iOS) using the `firebase_messaging` Flutter package.

### 8.4 Role-Scoped Dashboards & Exportable Reports

**Export formats:** CSV, Excel (XLSX via exceljs), PDF (Puppeteer for report cards; QuickSight native for analytics).

**Export controls (DPDP-aligned):**
- All bulk exports audit-logged: user, role, timestamp, filter criteria, row count.
- Exports containing student PII require purpose confirmation (logged).
- Exports watermarked with exporter's name and timestamp (accountability).
- Rate-limited: max 5 bulk exports per user per hour.

### 8.5 Multi-Channel Notification System

**Delivery reliability strategy:**
1. Primary: WhatsApp Business API (highest open rate in India).
2. Fallback (60-second timeout): Push notification (FCM/APNs).
3. Secondary fallback: SMS (AWS SNS) for critical alerts.
4. Always-on: In-app notification board (written regardless of external delivery status).

**Opt-out management:** Parents can opt out of non-critical notification types (e.g., homework reminders). Safety-critical notifications (child absent, campus emergency) are not opt-outable. Preferences stored in `notification_preferences` table.

---

## 9. Glossary

| Term | Definition |
|---|---|
| **CBSE** | Central Board of Secondary Education — India's primary national school board |
| **CMK** | Customer Managed Key — an AWS KMS key managed by EduCore |
| **Consent Record** | A first-class DB entity capturing OTP-verified parental consent to process a child's data for a specific purpose |
| **Data Fiduciary** | DPDP Act: entity that determines the purpose and means of processing personal data. Schools are Data Fiduciaries for student data. |
| **Data Principal** | DPDP Act: individual whose data is processed. Students are Data Principals; parents/guardians exercise their rights on their behalf. |
| **Data Processor** | DPDP Act: entity that processes data on behalf of a Data Fiduciary. EduCore is a Data Processor for school data; third-party EdTech tools are Data Processors engaged by the school. |
| **DPA** | Data Processing Agreement — contract between a Data Fiduciary and a Data Processor specifying terms of data processing |
| **DPDP Act** | Digital Personal Data Protection Act, 2023 — India's primary personal data protection law |
| **DPDP Rules** | Digital Personal Data Protection Rules, 2025 — subsidiary legislation under the DPDP Act |
| **DPBI** | Data Protection Board of India — regulatory authority under the DPDP Act |
| **EPFO** | Employees' Provident Fund Organisation — manages PF contributions |
| **ESI** | Employees' State Insurance — statutory health insurance for employees below a wage threshold |
| **ETA** | Estimated Time of Arrival — used in the transport module for parent notifications |
| **FCM** | Firebase Cloud Messaging — Google's push notification service for Android |
| **HPA** | Horizontal Pod Autoscaler — Kubernetes mechanism to scale pod replicas based on metrics |
| **ICSE** | Indian Certificate of Secondary Education — school board run by CISCE |
| **JWT** | JSON Web Token — used for stateless authentication between EduCore frontend and API |
| **KMS** | Key Management Service — AWS service for managing cryptographic keys |
| **LMS** | Learning Management System — module for delivering online educational content |
| **MFA** | Multi-Factor Authentication — requires two or more verification factors for login |
| **NACH** | National Automated Clearing House — India's system for recurring bank mandates (UPI Autopay) |
| **OTP** | One-Time Password — used for parent/student authentication and consent verification |
| **PAN** | Permanent Account Number — Indian tax identification number |
| **PF** | Provident Fund — mandatory retirement savings contribution under EPF Act |
| **PII** | Personally Identifiable Information — data that can identify an individual |
| **RBAC** | Role-Based Access Control — permissions assigned to roles, enforced at the API layer |
| **RDS** | Relational Database Service — AWS managed database service |
| **RFID** | Radio-Frequency Identification — contactless card reading technology used for attendance and transport |
| **RPO** | Recovery Point Objective — maximum acceptable data loss measured in time |
| **RTO** | Recovery Time Objective — maximum acceptable downtime after a disaster event |
| **SIS** | Student Information System — master module for student profiles, enrollment, and documents |
| **SPICE** | Super-fast Parallel In-memory Calculation Engine — AWS QuickSight's in-memory data cache |
| **TDS** | Tax Deducted at Source — income tax withheld from salary payments |
| **TOTP** | Time-based One-Time Password — algorithm used in authenticator apps for MFA |
| **UHF RFID** | Ultra High Frequency RFID — 865–867 MHz band approved by India's TRAI |
| **WAF** | Web Application Firewall — filters malicious HTTP traffic at the edge |

---

*End of EduCore Master Context Documentation v1.0.0*

*Maintained by: EduCore Engineering & Product Team*
*Privacy Officer contact: privacy@educore.app*
*Next scheduled review: October 2026*
