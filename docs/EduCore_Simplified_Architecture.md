# EduCore — Simplified Architecture Reference

**Version:** 2.0.0 (De-scoped)
**Date:** July 2026
**Status:** Active — supersedes complex variant for prototype and SMB deployment
**Companion:** See `EduCore_Master_Context.md` for full-feature reference architecture
**Build Plan:** See `EduCore_Build_Plan.md` for sequential implementation phases

---

## Table of Contents

1. [Design Philosophy — Why We De-scoped](#1-design-philosophy--why-we-de-scoped)
2. [What Was Removed & Why](#2-what-was-removed--why)
3. [Simplified Infrastructure](#3-simplified-infrastructure)
4. [Tech Stack](#4-tech-stack)
5. [Multi-Tenancy — Schema-per-Tenant (Retained)](#5-multi-tenancy--schema-per-tenant-retained)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Core Modules (Core 6)](#7-core-modules-core-6)
   - 7.1 [Admissions / CRM](#71-admissions--crm)
   - 7.2 [Student Information System (SIS)](#72-student-information-system-sis)
   - 7.3 [Attendance](#73-attendance)
   - 7.4 [Examinations & Results](#74-examinations--results)
   - 7.5 [Fees & Finance](#75-fees--finance)
   - 7.6 [Communication](#76-communication)
8. [Simplified Database Schemas](#8-simplified-database-schemas)
   - 8.1 [Schema Design Principles](#81-schema-design-principles)
   - 8.2 [Table Definitions](#82-table-definitions)
9. [Data Flow Optimization](#9-data-flow-optimization)
   - 9.1 [Eliminated Query Patterns](#91-eliminated-query-patterns)
   - 9.2 [Denormalization Strategy](#92-denormalization-strategy)
   - 9.3 [API Call Consolidation](#93-api-call-consolidation)
10. [RBAC — Simplified Role Matrix](#10-rbac--simplified-role-matrix)
11. [Reporting & Exports](#11-reporting--exports)
12. [DPDP Compliance (Retained Obligations)](#12-dpdp-compliance-retained-obligations)
13. [UI/UX Principles](#13-uiux-principles)

---

## 1. Design Philosophy — Why We De-scoped

The EduCore Master Context Document (v1.0.0) describes a full-featured School ERP SaaS platform with real-time RFID hardware integration, a multi-service Kubernetes cluster, a separate analytics data warehouse (Redshift + QuickSight), asynchronous message queuing (RabbitMQ), and a dual-app mobile strategy (Next.js web + Flutter iOS/Android).

That architecture is **correct for scale** but **wrong for a production prototype** and for the SMB school segment (200–1500 students) that represents the majority of the initial customer base.

This document describes the **de-scoped, production-ready simplified architecture** built on three organizing constraints:

### 1.1 The Three Constraints

| Constraint | What It Means |
|---|---|
| **Operational Simplicity** | Every component must be understandable, deployable, and debuggable by a 3-person engineering team without specialized DevOps expertise. |
| **Minimalist UI/UX** | Every screen has one job. No dashboards with 12 widgets. No wizard flows with 8 steps. A teacher marks attendance in two taps. |
| **Minimal Database Traffic** | Every user action maps to at most 1–2 SQL statements. No chatty N+1 query chains. No cross-module joins on read paths. Denormalize to serve common reads from one table. |

### 1.2 The De-scoping Decision Tree

```
Feature / Component         Kept?   Reason
------------------------------------------------------
Schema-per-tenant           YES     Isolation + DPDP boundary
Core 6 modules              YES     Cannot run a school without them
consent_records + audit_log YES     Legal obligation, non-negotiable
Email/password JWT auth     YES     Simple, self-contained
Responsive Next.js web app  YES     One codebase, works on mobile browser
RDS PostgreSQL              YES     The single source of truth
S3 for documents            YES     Cheap, reliable, no ops overhead

RabbitMQ / async workers    NO      Replaced by synchronous request/response
Redshift + QuickSight ETL   NO      Replaced by predefined SQL reports on Postgres
Amazon EKS (Kubernetes)     NO      Replaced by ECS Fargate or single EC2
Amazon Cognito              NO      Replaced by self-contained NestJS JWT
Flutter mobile apps         NO      Browser-responsive web covers mobile use
RFID hardware pipeline      NO      Hardware dependency removed entirely
Live GPS tracking           NO      Operational complexity; remove with Transport module
QR code attendance          NO      Rotating sessions add complexity; simple checkbox replaces
Maker-checker workflow      NO      CRUD override by Admin is sufficient
WhatsApp Business API       NO      In-app notification feed replaces external channels
SMS / push notifications    NO      In-app only in v1
Amazon ElastiCache (Redis)  NO      Removed with RabbitMQ and session caching
Amazon CloudFront CDN       NO      Direct ALB/Fargate serving for prototype
HRM & Payroll module        NO      Out of Core 6; Phase 2 candidate
Transportation module       NO      Out of Core 6; Phase 2 candidate
Library module              NO      Out of Core 6; Phase 2 candidate
LMS module                  NO      Out of Core 6; Phase 2 candidate
```

---

## 2. What Was Removed & Why

### 2.1 RFID Hardware Pipeline

**Removed.** The original pipeline (RFID reader → edge gateway → RabbitMQ → attendance worker → notification worker) introduced:
- Hardware procurement, commissioning, and failure modes outside the software team's control.
- An async message broker (RabbitMQ) with consumer groups, dead-letter queues, and retry logic.
- Per-device API key management in AWS Secrets Manager.
- GPS location data requiring a separate DPDP-specified retention/deletion schedule.

**Replacement:** Attendance is a checkbox list marked by the teacher. Operationally equivalent outcome (the student is marked Present/Absent); technically a single `POST /attendance/bulk` endpoint.

### 2.2 QR Code Attendance Sessions

**Removed.** The original QR flow required:
- A session token with a 5-minute expiry timer.
- Server-side validation of: QR signature, student section membership, time window.
- Student device with a camera and the student app installed.

This is 4+ moving parts for what should be a 2-tap action by the teacher.

**Replacement:** Same checkbox list. No tokens. No timers. No student-side interaction.

### 2.3 Maker-Checker Marks Entry

**Removed.** The original exam workflow had: Teacher (maker) enters marks → HOD (checker) approves → marks finalized. This required:
- A status-machine on `exam_results` (`DRAFT` → `SUBMITTED` → `APPROVED` → `PUBLISHED`).
- HOD inbox / review screen.
- Notification to HOD when marks are submitted.

This is 3 extra API round-trips and an entire workflow screen for a feature that a Principal can replace with a simple edit privilege.

**Replacement:** Teacher enters marks directly. Admin/Principal can edit any result. Status field collapses to `ENTERED` | `PUBLISHED`.

### 2.4 Redshift + QuickSight + Nightly ETL

**Removed.** A separate OLAP data warehouse (Redshift), a BI visualization tool (QuickSight), and a nightly ETL pipeline to populate it — for a school with 500–1500 students where the entire dataset fits comfortably in PostgreSQL.

**Replacement:** Predefined SQL queries against the primary Postgres DB (or its read replica when one is added). Reports are rendered server-side and exported as CSV or PDF. Zero additional infrastructure.

### 2.5 RabbitMQ + Async Worker Services

**Removed.** The message queue was the backbone of the original notification pipeline. Removing WhatsApp/SMS/push notifications also removes the need for the queue. All remaining operations (report generation, PDF creation) are fast enough to handle synchronously in a request/response cycle.

**Replacement:** Synchronous API responses. Report PDFs generated on-demand by a Puppeteer micro-service call (or a simple PDF library like `pdfkit`) within the API response cycle.

### 2.6 Amazon Cognito

**Removed.** Cognito adds: a separate AWS service to manage, a separate user pool concept, Cognito-specific SDK calls in the NestJS auth module, and a dependency on AWS for every login. For a production prototype, the cost and complexity are not justified.

**Replacement:** `bcrypt`-hashed passwords stored in the `users` table, JWT access tokens (15-min expiry) + refresh tokens (7-day expiry, HttpOnly cookie), all managed within the NestJS `AuthModule`. Password reset via email (AWS SES or any SMTP provider).

### 2.7 Flutter Mobile Apps

**Removed from v1.** A Flutter app requires: separate iOS and Android builds, App Store / Play Store publication (with Apple/Google review cycles), separate release pipelines, and device testing. None of this is appropriate for a production prototype.

**Replacement:** The Next.js web app is built mobile-first responsive. It works on any smartphone browser. Teachers mark attendance from their phone's browser. Parents check fee dues from their phone's browser. This is identical functionality with zero app deployment overhead.

### 2.8 ElastiCache (Redis)

**Removed.** Redis was used for: tenant context caching (replaced by in-process NestJS cache), session storage (replaced by HttpOnly cookie refresh tokens), RabbitMQ consumer coordination (queue removed), and rate limiting (handled at the ALB level). No Redis needed.

---

## 3. Simplified Infrastructure

### 3.1 Target Infrastructure Stack

```
AWS ap-south-1 (Mumbai) — India-only data residency maintained
+------------------------------------------------------------------+
|  Route 53 (DNS)                                                  |
|                                                                  |
|  Application Load Balancer (ALB)                                 |
|    - SSL termination (ACM certificate)                           |
|    - Path-based routing: /api/* -> NestJS, /* -> Next.js         |
|    - Rate limiting via WAF basic rules                           |
|                                                                  |
|  ECS Fargate (or single EC2 t3.medium for pilot)                 |
|    - NestJS API service (Docker container)                       |
|    - Next.js SSR service (Docker container)                      |
|    (Both on same task definition for prototype;                  |
|     separate services when scale demands it)                     |
|                                                                  |
|  Amazon RDS PostgreSQL 16                                        |
|    - Single-AZ (dev/pilot) | Multi-AZ (production)              |
|    - db.t3.medium (pilot) | db.r6g.large (production)           |
|    - Automated backups: 30-day retention                         |
|    - Encryption at rest: AES-256 (AWS managed key)              |
|                                                                  |
|  Amazon S3                                                       |
|    - educore-documents-{env}: student/staff documents            |
|    - educore-static-{env}: Next.js build assets                  |
|    - SSE-S3 encryption; presigned URLs (15-min) for documents    |
|                                                                  |
|  AWS SES (email only)                                            |
|    - Password reset emails                                       |
|    - Fee receipt PDFs (optional)                                 |
+------------------------------------------------------------------+
```

### 3.2 What Is NOT in the Infrastructure

| Removed Component | Monthly Cost Saved (est.) | Replaced By |
|---|---|---|
| EKS cluster (3 nodes) | ~$300–500/month | ECS Fargate (pay per task-second) |
| ElastiCache Redis (cache.t3.small) | ~$30/month | Removed (no caching layer needed) |
| RabbitMQ (EC2 t3.small) | ~$15/month | Removed (sync API only) |
| Redshift (dc2.large) | ~$180/month | Postgres read queries |
| QuickSight (Enterprise, 5 users) | ~$50/month | Server-rendered reports |
| Cognito (per MAU pricing) | Variable | Built-in JWT auth |
| **Estimated monthly savings** | **~$575–775/month** | — |

### 3.3 Deployment

- **Containerization:** Docker. One `Dockerfile` for NestJS API, one for Next.js.
- **CI/CD:** GitHub Actions → builds Docker images → pushes to ECR → updates ECS Fargate task definition.
- **Environment management:** `.env` files per environment (dev, staging, prod). Secrets stored in AWS Parameter Store (Standard tier — free).
- **Database migrations:** Flyway, run as an ECS one-off task before each deployment.

### 3.4 DR / Backup (Simplified)

| Metric | Target |
|---|---|
| **RPO** | 24 hours (RDS daily automated snapshots) |
| **RTO** | 2–4 hours (restore from snapshot + ECS task restart) |
| **Backup retention** | 30 days (RDS), 90 days (S3 documents) |
| **Data residency** | ap-south-1 only |

> **Note:** The simplified RPO/RTO (24h/2-4h) is appropriate for a production prototype and early SMB customers. Multi-AZ with 15-min RPO is added in Phase 2 production hardening.

---

## 4. Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| **Backend API** | Node.js 20 LTS + NestJS 10 (TypeScript) | Retained from original decision; decorator-driven RBAC guards |
| **Web Frontend** | Next.js 14 (App Router, TypeScript) | Responsive design covers mobile browser use; no separate mobile app |
| **Database** | PostgreSQL 16 (AWS RDS) | Schema-per-tenant isolation; ACID; sufficient for all analytics at this scale |
| **ORM** | TypeORM | Standard CRUD; raw SQL for the handful of reporting queries |
| **Authentication** | NestJS `AuthModule` + `bcrypt` + JWT | Self-contained; no external auth dependency |
| **File Storage** | AWS S3 + presigned URLs | Documents, ID card PDFs, report card PDFs |
| **PDF generation** | `pdfkit` (Node.js) or Puppeteer (headless Chrome) | On-demand, synchronous; no queue needed |
| **Email** | AWS SES (or Nodemailer + SMTP for dev) | Password reset only in v1 |
| **Containerization** | Docker + AWS ECR | Standard; ECS Fargate pulls from ECR |
| **Orchestration** | AWS ECS Fargate | No Kubernetes expertise required; serverless containers |
| **CI/CD** | GitHub Actions | Standard; free for small teams |
| **Infrastructure as Code** | Terraform | Reproducible; manages RDS, ECS, ALB, S3, SES |

**What is NOT in the tech stack:**
- RabbitMQ — removed
- Redis / ElastiCache — removed
- Redshift + QuickSight — removed
- Amazon Cognito — removed
- Flutter / React Native — removed for v1
- Amazon EKS — removed

---

## 5. Multi-Tenancy — Schema-per-Tenant (Retained)

The schema-per-tenant isolation model from the Master Context is **retained unchanged** because:
1. It provides the strongest DPDP boundary without DB-per-tenant cost.
2. It allows per-schema backup/restore for individual school data portability.
3. It is no more complex to implement than shared-schema RLS, and significantly more auditable.

The implementation is identical to the Master Context (Section 2.1): `SET search_path TO school_<slug>` injected by `TenantConnectionMiddleware` into every NestJS request.

**Simplified provisioning:** Tenant provisioning is a single NestJS Admin CLI command:
```bash
npm run tenant:create -- --slug=greenwood --name="Greenwood Academy"
```
This runs: `CREATE SCHEMA school_greenwood;` + Flyway migrations on the new schema + seed default roles. No Terraform change required per tenant.

---

## 6. Authentication & Authorization

### 6.1 Auth Flow

```
POST /auth/login { email, password }
  -> NestJS AuthService
  -> bcrypt.compare(password, users.password_hash)
  -> IF match: generate JWT access_token (15 min) + refresh_token (7 days)
  -> access_token returned in response body
  -> refresh_token set as HttpOnly cookie (SameSite=Strict)

POST /auth/refresh
  -> reads refresh_token cookie
  -> validates against refresh_tokens table (stored, rotated on use)
  -> issues new access_token + new refresh_token

POST /auth/logout
  -> deletes refresh_token record from refresh_tokens table
  -> clears HttpOnly cookie
```

### 6.2 Users Table (simplified)

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,     -- bcrypt, cost factor 12
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL,     -- 'ADMIN' | 'PRINCIPAL' | 'HOD' | 'TEACHER' | 'ACCOUNTANT' | 'FRONT_OFFICE' | 'PARENT' | 'STUDENT'
  scope_data    JSONB DEFAULT '{}', -- {section_ids: [...], class_ids: [...]} for class-scoped roles
  status        TEXT NOT NULL DEFAULT 'ACTIVE',
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);
```

> **Design decision:** Role is a single `TEXT` column rather than a normalized roles/permissions table. This is intentional for the simplified architecture — 8 roles are hardcoded in the NestJS `RolesGuard`. The normalized permission table from the Master Context is a Phase 2 upgrade when custom role configuration is needed.

### 6.3 RBAC Guard

NestJS `RolesGuard` reads the JWT payload `role` + `scope_data` claim and checks them against a hardcoded permissions map in `permissions.config.ts`. No DB query on every request — the role and scope are in the JWT itself.

```typescript
// permissions.config.ts (abbreviated)
export const PERMISSIONS: Record<string, Record<string, string[]>> = {
  'students': {
    'CREATE': ['ADMIN', 'FRONT_OFFICE'],
    'READ':   ['ADMIN', 'PRINCIPAL', 'HOD', 'TEACHER', 'FRONT_OFFICE', 'PARENT', 'ACCOUNTANT'],
    'UPDATE': ['ADMIN', 'FRONT_OFFICE'],
    'DELETE': ['ADMIN'],
  },
  'attendance': {
    'CREATE': ['TEACHER', 'ADMIN'],
    'READ':   ['TEACHER', 'HOD', 'PRINCIPAL', 'ADMIN', 'PARENT'],
    'UPDATE': ['TEACHER', 'ADMIN'],
  },
  // ...
};
```

Scope filtering (teacher sees only their sections; parent sees only their child) is enforced at the service layer by intersecting the JWT's `scope_data.section_ids` or `scope_data.student_ids` with the query parameters.

---

## 7. Core Modules (Core 6)

### 7.1 Admissions / CRM

**What was removed:** Lead nurturing pipeline, entrance test scheduling, seat allocation engine, document upload portal with token-based links, 72-hour countdown timer.

**What remains:** A simple inquiry form and a manual admission workflow.

**Simplified user flow:**
1. Front Office staff opens Admissions → New Inquiry. Enters: student name, DOB, class applying for, parent name, parent mobile, parent email.
2. `admission_inquiries` record created (status: `INQUIRY`).
3. Staff follows up manually (phone/in-person). When ready to admit, staff clicks **Convert to Admission**.
4. System creates `students`, `parents`, and `student_guardian_map` records.
5. Staff uploads documents (birth certificate, photo) from the student profile page → S3 presigned upload URL.
6. Staff assigns class/section. Fee structure auto-assigned from the class configuration.
7. Parent account created manually: staff enters parent email → system sends a password-set email (AWS SES).

**API surface (Admissions):**
```
POST   /admissions/inquiries           Create inquiry
GET    /admissions/inquiries           List all inquiries (with filters: status, date)
PATCH  /admissions/inquiries/:id       Update status / add notes
POST   /admissions/inquiries/:id/convert  Convert to student (creates student + parent + guardian_map records)
```

**DB traffic:** 2 queries on convert (INSERT student, INSERT parent + student_guardian_map). Document upload goes directly to S3 — zero DB traffic for files.

---

### 7.2 Student Information System (SIS)

**What was removed:** RFID card UID, biometric data fields, complex alumni conversion workflow, automatic ID card generation on photo upload.

**What remains:** A clean student profile and document vault.

**Simplified user flow:**
1. Admin/Front Office opens Students → finds student.
2. Views/edits: name, DOB, class/section, parent info, blood group, emergency contact.
3. Uploads documents to the document vault (photo, birth cert, TC) via S3 presigned URL.
4. Downloads ID card PDF (generated on-demand by the API when requested, not auto-triggered).
5. On exit: staff sets `enrollment_status` to `ALUMNI` or `TRANSFERRED`, enters exit date.

**API surface (SIS):**
```
GET    /students                        List students (filters: class_id, section_id, status)
POST   /students                        Create student
GET    /students/:id                    Student detail (student row only — no joins)
PATCH  /students/:id                    Update student fields
GET    /students/:id/documents          List document vault items (S3 metadata only)
POST   /students/:id/documents          Get presigned upload URL
GET    /students/:id/id-card            Generate and return ID card PDF (on-demand)
```

**DB traffic on student list:** `SELECT id, first_name, last_name, class_name, section_name, enrollment_status FROM students WHERE tenant_id = $1 AND ...` — a single flat query. `class_name` and `section_name` are denormalized columns on `students` (updated on class assignment), eliminating the JOIN.

---

### 7.3 Attendance

**What was removed:** RFID pipeline, edge gateway integration, QR code session tokens, RabbitMQ event bus, notification workers, WhatsApp/push notifications, `rfid_events` table.

**What remains:** A checkbox list saved in one API call.

**Simplified user flow:**
1. Teacher opens Attendance → selects their class/section (pre-selected based on their `scope_data`).
2. System returns the student list for that section: `GET /attendance?section_id=X&date=2025-10-08`.
   - If attendance already marked for this date, returns existing records (teacher can edit).
   - If not yet marked, returns the student list with all statuses defaulting to `PRESENT`.
3. Teacher reviews the list. Taps toggles to switch any student to `ABSENT` or `LATE`.
4. Teacher taps **Save**. One `POST /attendance/bulk` call sends the entire section's attendance as a JSON array.
5. System writes all records in a single transaction. Done.

**Parent view:** Parent opens their child's page → sees the attendance calendar for the month (a simple month-view grid with P/A/L markers). No real-time push — they check the app when they want to.

**Absence notification:** Not automated. Teacher can optionally open Communication → New Notice and send a circular to "Parents of Class 3B" if needed.

**API surface (Attendance):**
```
GET    /attendance?section_id=X&date=Y  Fetch attendance list for a section/date
POST   /attendance/bulk                 Save entire section's attendance in one transaction
GET    /attendance/student/:id?month=Y  Student's monthly attendance summary (one query)
GET    /attendance/report?class_id=X    Defaulter report (>X% absent) — predefined SQL query
```

**DB traffic on bulk save:**
```sql
-- Single upsert for all students in a section (e.g., 40 students):
INSERT INTO attendance_records
  (tenant_id, student_id, student_name, section_id, class_name, section_name, date, status, marked_by_id, marked_by_name)
VALUES
  ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10),
  ... (40 rows)
ON CONFLICT (student_id, date)
DO UPDATE SET status = EXCLUDED.status, marked_by_id = EXCLUDED.marked_by_id;
```

One statement. 40-student section = 40 row upsert = 1 round-trip to the DB.

---

### 7.4 Examinations & Results

**What was removed:** Maker-checker workflow (DRAFT → SUBMITTED → APPROVED → PUBLISHED state machine), HOD approval inbox, seating plan generator, Puppeteer auto-generation of report cards on marks finalization, Redshift sync.

**What remains:** Exam scheduling, a marks-entry grid (direct CRUD), manual report card PDF download, and a simple promotion flag.

**Simplified user flow:**

*Exam setup (Admin/HOD):*
1. Admin opens Exams → New Exam. Enters: name, type (Unit Test, Mid-Term, Annual), date, applicable classes, total marks, pass marks.
2. Exam created. Applicable sections automatically populated from class configuration.

*Marks entry (Teacher):*
1. Teacher opens Exams → selects an exam → selects their subject.
2. System returns a marks-entry grid: one row per student, one column for marks obtained.
3. Teacher fills marks. Taps Save. One `POST /exam-results/bulk` call saves all marks for that subject/section.
4. Admin can edit any individual mark at any time.

*Results publication (Admin):*
1. When all marks are entered, Admin clicks **Publish Results**. Exam status → `PUBLISHED`.
2. Parents can now see results in their child's page.

*Report card (on-demand):*
1. Admin or Parent clicks **Download Report Card** on a student's page.
2. API fetches all published exam results for the student for the academic year → generates PDF using `pdfkit` → returns as a file download.
3. No pre-generation, no S3 storage of report cards (generated fresh on every download request).

*Promotion:*
1. At year-end, Admin runs the Promotion screen: reviews each student's total percentage.
2. Admin manually sets each student's next-year class/section (the "promotion engine" is a simple edit of the `class_id` + `section_id` columns + a new `class_enrollments` record for the new academic year).
3. No automated rule engine. Simple CRUD.

**API surface (Exams):**
```
POST   /exams                           Create exam
GET    /exams?class_id=X                List exams for a class
GET    /exams/:id/results?section_id=X  Marks-entry grid (student list + existing marks)
POST   /exam-results/bulk               Save marks for a subject/section
PATCH  /exams/:id/publish               Publish results (status -> PUBLISHED)
GET    /students/:id/report-card        Generate and return report card PDF (on-demand)
```

**DB traffic on marks-entry bulk save:** Single `INSERT ... ON CONFLICT DO UPDATE` for all students in a section. Identical pattern to attendance bulk save.

---

### 7.5 Fees & Finance

**What was removed:** NACH mandate / Razorpay Subscriptions (recurring auto-debit), Razorpay webhook handler, async receipt generation, WhatsApp receipt delivery, due-date auto-reminder notifications.

**What remains:** Fee structure definition, manual invoice generation, online and offline payment recording, and on-demand receipt PDF.

**Simplified user flow:**

*Fee structure (Accountant):*
1. Accountant opens Fees → Fee Structures → New. Enters: name, class (or "All Classes"), academic year, fee heads as a list (Tuition Fee: ₹15,000; Transport Fee: ₹4,500; etc.), due date per head, late fine per day.
2. Fee structure saved.

*Invoice generation (Accountant):*
1. Accountant opens Fees → Generate Invoices → selects academic year + class → clicks Generate.
2. API runs a single INSERT for every student in the selected class: one `fee_transactions` row per fee head per student.
3. Parents can see their outstanding invoices immediately.

*Payment collection (Accountant):*
- **Online:** Parent opens Fees on their child's page. They see the invoice list. Clicks **Pay Online** → Razorpay checkout opens (Razorpay standard integration — no subscriptions, no NACH). On payment, Razorpay redirects back to the app with payment ID. Accountant or the system verifies via Razorpay Orders API call and marks the invoice PAID.
- **Offline:** Accountant opens student fees page, selects invoice, clicks **Record Offline Payment**, enters amount + payment mode (Cash/Cheque/DD) → invoice marked PAID.

*Receipt:*
On marking PAID, the API generates a PDF receipt on-demand using `pdfkit` and returns a download link. No async queue. No WhatsApp delivery. Receipt stored in S3 (optional) and available for download from the student fees page.

**API surface (Fees):**
```
POST   /fee-structures                  Create fee structure
GET    /fee-structures?academic_year=X  List fee structures
POST   /fee-structures/:id/generate-invoices  Generate invoices for a class
GET    /students/:id/fees               Student's invoice list (all fee_transactions for student)
POST   /fee-transactions/:id/pay-online  Record Razorpay payment (verify + mark PAID)
POST   /fee-transactions/:id/pay-offline Record offline payment (mark PAID)
GET    /fee-transactions/:id/receipt    Generate and return receipt PDF
GET    /fees/report?class_id=X          Outstanding dues report for a class
```

**DB traffic on student fees page:** `SELECT * FROM fee_transactions WHERE student_id = $1 ORDER BY due_date` — one query, no joins. `student_name` and `class_name` are denormalized on `fee_transactions`, not joined from `students`.

---

### 7.6 Communication

**What was removed:** WhatsApp Business API, SMS gateway, push notification service (FCM/APNs), RabbitMQ delivery pipeline, delivery/read receipt tracking, PTM slot booking system.

**What remains:** An in-app notice board (circulars) and simple direct messaging between parents and teachers.

**In-app notification feed:**
- Every user has a notification feed (a list of `notifications` rows for their `user_id`).
- When a teacher or admin sends a circular, the API INSERTs one `notifications` row per target recipient.
- The frontend polls `/notifications?since=<timestamp>` on page load and on a 60-second interval (no WebSockets, no push).
- Unread count shown in the nav bar.

**Circulars:**
1. Admin/Teacher opens Communication → New Circular.
2. Enters: title, body (rich text), target audience (everyone | specific class | specific section | specific role).
3. Clicks Send. API resolves the target user list and INSERTs `notifications` rows in a single bulk INSERT.

**Direct messaging (parent ↔ teacher):**
1. Parent opens their child's page → Messages tab → selects a teacher.
2. Sends a message. API INSERTs a `messages` row.
3. Teacher sees an unread badge on their Messages page.
4. Teacher replies. Parent sees a new `notifications` row on next poll.

**API surface (Communication):**
```
POST   /circulars                       Create and send a circular (bulk INSERT notifications)
GET    /circulars                       List circulars (for current user's role/class scope)
GET    /notifications?since=X           Unread notification feed for current user
PATCH  /notifications/mark-read         Mark all as read (UPDATE WHERE user_id = $1)
POST   /messages                        Send a direct message
GET    /messages?with_user_id=X         Conversation thread between two users
```

**DB traffic on notification feed:** `SELECT * FROM notifications WHERE user_id = $1 AND created_at > $2 ORDER BY created_at DESC LIMIT 50` — one indexed query. Polling every 60 seconds is negligible traffic for a 500-student school.

---

## 8. Simplified Database Schemas

### 8.1 Schema Design Principles

The three rules that every table in the simplified architecture follows:

**Rule 1 — Denormalize for reads.** The most-queried paths (student list, attendance list, fee list) must return complete display information from a single table scan with no JOINs. This means storing `student_name`, `class_name`, `section_name` redundantly on `attendance_records` and `fee_transactions`.

**Rule 2 — Normalize only on write.** Foreign key relationships are maintained for data integrity on writes. The application ensures denormalized fields are updated when the source record changes (e.g., if a student is moved to a different section, the `section_name` on their future attendance records is updated by the section-assignment endpoint).

**Rule 3 — No `NULL`-heavy optional columns.** If a field only applies to certain rows (e.g., `payment_mode` only applies to PAYMENT rows in `fee_transactions`), use `JSONB metadata` rather than nullable typed columns. This avoids wide sparse tables.

### 8.2 Table Definitions

> **Convention:** All tables: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id UUID NOT NULL`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`.

---

#### `public.tenants`

```sql
CREATE TABLE public.tenants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  schema_name  TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'ACTIVE',
  contact_email TEXT NOT NULL,
  config       JSONB DEFAULT '{}',   -- {academic_year: '2025-26', pass_percentage: 33, ...}
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
```

---

#### `school_<slug>.users`

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL,
  -- Role scope: stores {section_ids, class_ids, student_ids} for scoped roles
  scope_data    JSONB DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'ACTIVE',
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant_role ON users(tenant_id, role);
```

---

#### `school_<slug>.refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,   -- SHA-256 hash of the token
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

---

#### `school_<slug>.classes`

```sql
CREATE TABLE classes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  name          TEXT NOT NULL,      -- 'Nursery' | 'LKG' | 'Class 1' .. 'Class 10'
  numeric_level INTEGER NOT NULL,   -- for ordering: 0=Nursery, 1=LKG, 2=UKG, 3..12=Grade1..10
  academic_year TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name, academic_year)
);
```

---

#### `school_<slug>.sections`

```sql
CREATE TABLE sections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  class_id         UUID NOT NULL REFERENCES classes(id),
  class_name       TEXT NOT NULL,   -- denormalized for display
  name             TEXT NOT NULL,   -- 'A' | 'B' | 'C'
  class_teacher_id UUID REFERENCES users(id),
  class_teacher_name TEXT,          -- denormalized for display
  capacity         INTEGER DEFAULT 40,
  academic_year    TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, name)
);
```

---

#### `school_<slug>.subjects`

```sql
CREATE TABLE subjects (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name      TEXT NOT NULL,
  code      TEXT,
  board     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

#### `school_<slug>.section_subjects` (replaces class_subject_teacher_map)

```sql
CREATE TABLE section_subjects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  section_id   UUID NOT NULL REFERENCES sections(id),
  subject_id   UUID NOT NULL REFERENCES subjects(id),
  subject_name TEXT NOT NULL,      -- denormalized
  teacher_id   UUID NOT NULL REFERENCES users(id),
  teacher_name TEXT NOT NULL,      -- denormalized
  academic_year TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(section_id, subject_id, academic_year)
);
```

---

#### `school_<slug>.students` [DPDP]

```sql
CREATE TABLE students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  user_id           UUID REFERENCES users(id),     -- NULL for Nursery-Grade4
  admission_number  TEXT NOT NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  full_name         TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  date_of_birth     DATE NOT NULL,
  gender            TEXT,
  blood_group       TEXT,
  category          TEXT,
  -- Current class assignment (denormalized for fast list queries)
  class_id          UUID REFERENCES classes(id),
  class_name        TEXT,                           -- denormalized
  section_id        UUID REFERENCES sections(id),
  section_name      TEXT,                           -- denormalized
  academic_year     TEXT,
  -- Contact & personal
  emergency_contact JSONB,                          -- {name, relation, phone}
  medical_notes     TEXT,                           -- field-level encrypted (AES-256-GCM) [DPDP]
  photo_url         TEXT,                           -- S3 key
  -- Status
  enrollment_status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'ALUMNI' | 'TRANSFERRED'
  admission_date    DATE NOT NULL,
  exit_date         DATE,
  -- DPDP
  consent_record_id UUID REFERENCES consent_records(id),
  anonymized_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, admission_number)
);

CREATE INDEX idx_students_class_section ON students(class_id, section_id);
CREATE INDEX idx_students_status ON students(tenant_id, enrollment_status);
```

---

#### `school_<slug>.parents` [DPDP]

```sql
CREATE TABLE parents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id),
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  relation    TEXT NOT NULL,   -- 'FATHER' | 'MOTHER' | 'GUARDIAN'
  phone       TEXT NOT NULL,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

---

#### `school_<slug>.student_guardian_map`

```sql
CREATE TABLE student_guardian_map (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id   UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  -- Denormalized for parent's child-list query (no join back to students)
  student_name TEXT NOT NULL,
  class_name   TEXT NOT NULL,
  section_name TEXT NOT NULL,
  relation    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, parent_id)
);
```

---

#### `school_<slug>.admission_inquiries`

```sql
CREATE TABLE admission_inquiries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  student_name   TEXT NOT NULL,
  date_of_birth  DATE,
  class_applying TEXT NOT NULL,
  parent_name    TEXT NOT NULL,
  parent_phone   TEXT NOT NULL,
  parent_email   TEXT,
  status         TEXT NOT NULL DEFAULT 'INQUIRY',  -- 'INQUIRY' | 'IN_PROGRESS' | 'CONVERTED' | 'REJECTED'
  notes          TEXT,
  assigned_to_id UUID REFERENCES users(id),
  converted_to_student_id UUID REFERENCES students(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inquiries_status ON admission_inquiries(tenant_id, status);
```

---

#### `school_<slug>.attendance_records` [DPDP]

```sql
CREATE TABLE attendance_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  -- Denormalized: all display info in one row, no joins needed on read
  student_id     UUID NOT NULL REFERENCES students(id),
  student_name   TEXT NOT NULL,
  section_id     UUID NOT NULL REFERENCES sections(id),
  class_name     TEXT NOT NULL,
  section_name   TEXT NOT NULL,
  date           DATE NOT NULL,
  status         TEXT NOT NULL,     -- 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE'
  marked_by_id   UUID REFERENCES users(id),
  marked_by_name TEXT,              -- denormalized
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, date)          -- one record per student per day
);

CREATE INDEX idx_attendance_section_date ON attendance_records(section_id, date);
CREATE INDEX idx_attendance_student     ON attendance_records(student_id, date DESC);
```

---

#### `school_<slug>.exams`

```sql
CREATE TABLE exams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  name          TEXT NOT NULL,
  exam_type     TEXT NOT NULL,      -- 'UNIT_TEST' | 'MID_TERM' | 'ANNUAL'
  academic_year TEXT NOT NULL,
  exam_date     DATE,
  class_ids     UUID[],             -- which classes this exam applies to
  total_marks   DECIMAL(6,2) NOT NULL,
  pass_marks    DECIMAL(6,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ACTIVE',  -- 'ACTIVE' | 'PUBLISHED'
  created_by_id UUID REFERENCES users(id),
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
  exam_name      TEXT NOT NULL,       -- denormalized
  -- Student info denormalized for report generation without joins
  student_id     UUID NOT NULL REFERENCES students(id),
  student_name   TEXT NOT NULL,
  class_name     TEXT NOT NULL,
  section_name   TEXT NOT NULL,
  subject_id     UUID NOT NULL REFERENCES subjects(id),
  subject_name   TEXT NOT NULL,       -- denormalized
  marks_obtained DECIMAL(6,2),
  is_absent      BOOLEAN DEFAULT false,
  grade          TEXT,                -- computed on save: A+/A/B/C/D/F
  is_pass        BOOLEAN,             -- computed on save
  entered_by_id  UUID REFERENCES users(id),
  entered_by_name TEXT,               -- denormalized
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_id, student_id, subject_id)
);

CREATE INDEX idx_exam_results_student ON exam_results(student_id, exam_id);
CREATE INDEX idx_exam_results_exam    ON exam_results(exam_id, section_name);
```

---

#### `school_<slug>.fee_structures`

```sql
CREATE TABLE fee_structures (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              TEXT NOT NULL,
  class_id          UUID REFERENCES classes(id),  -- NULL = applies to all
  class_name        TEXT,             -- denormalized
  academic_year     TEXT NOT NULL,
  fee_heads         JSONB NOT NULL,   -- [{name, amount, due_date}, ...]
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
  -- Student info denormalized: single-table fee ledger per student
  student_id         UUID NOT NULL REFERENCES students(id),
  student_name       TEXT NOT NULL,
  class_name         TEXT NOT NULL,
  section_name       TEXT NOT NULL,
  fee_structure_id   UUID REFERENCES fee_structures(id),
  transaction_type   TEXT NOT NULL,   -- 'INVOICE' | 'PAYMENT' | 'FINE'
  fee_head           TEXT NOT NULL,
  academic_year      TEXT NOT NULL,
  amount             DECIMAL(12,2) NOT NULL,
  paid_amount        DECIMAL(12,2) DEFAULT 0,
  due_date           DATE,
  payment_date       TIMESTAMPTZ,
  payment_mode       TEXT,            -- 'ONLINE' | 'CASH' | 'CHEQUE' | 'DD'
  gateway_payment_id TEXT UNIQUE,     -- Razorpay payment ID (for online payments)
  receipt_url        TEXT,            -- S3 key for receipt PDF (optional)
  collected_by_id    UUID REFERENCES users(id),
  collected_by_name  TEXT,            -- denormalized
  status             TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'PAID' | 'WAIVED'
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fee_tx_student      ON fee_transactions(student_id, due_date);
CREATE INDEX idx_fee_tx_status       ON fee_transactions(tenant_id, status, due_date);
CREATE INDEX idx_fee_tx_class        ON fee_transactions(tenant_id, class_name, academic_year);
```

---

#### `school_<slug>.notifications`

```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,          -- 'CIRCULAR' | 'MESSAGE' | 'RESULT_PUBLISHED' | 'FEE_REMINDER'
  title       TEXT NOT NULL,
  body        TEXT,
  source_id   UUID,                   -- circular_id or message_id this relates to
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
```

---

#### `school_<slug>.circulars`

```sql
CREATE TABLE circulars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  target_type     TEXT NOT NULL,    -- 'ALL' | 'CLASS' | 'SECTION' | 'ROLE'
  target_id       UUID,             -- class_id or section_id if targeted
  target_role     TEXT,             -- role name if targeting a role
  sent_by_id      UUID REFERENCES users(id),
  sent_by_name    TEXT,             -- denormalized
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

#### `school_<slug>.messages`

```sql
CREATE TABLE messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  from_user_id UUID NOT NULL REFERENCES users(id),
  from_name    TEXT NOT NULL,     -- denormalized
  to_user_id   UUID NOT NULL REFERENCES users(id),
  to_name      TEXT NOT NULL,     -- denormalized
  -- Thread key: consistent ordering of two user UUIDs to identify a conversation
  thread_key   TEXT NOT NULL,     -- LEAST(from_user_id, to_user_id) || '_' || GREATEST(...)
  body         TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_thread ON messages(thread_key, created_at DESC);
CREATE INDEX idx_messages_to     ON messages(to_user_id, is_read, created_at DESC);
```

---

#### `school_<slug>.consent_records` [DPDP — RETAINED]

```sql
CREATE TABLE consent_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  data_subject_id  UUID NOT NULL,              -- student_id
  guardian_id      UUID NOT NULL REFERENCES parents(id),
  guardian_name    TEXT NOT NULL,              -- denormalized
  purpose          TEXT NOT NULL,              -- 'STUDENT_ENROLLMENT' | 'THIRD_PARTY_TOOL'
  data_categories  TEXT[] NOT NULL,
  processor_name   TEXT,                       -- for third-party tools; NULL for school
  consent_given_at TIMESTAMPTZ NOT NULL,
  consent_method   TEXT NOT NULL DEFAULT 'STAFF_VERIFIED_AT_ADMISSION',
  consent_version  TEXT NOT NULL DEFAULT '2025-v1',
  is_active        BOOLEAN DEFAULT true,
  withdrawn_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_consent_subject ON consent_records(data_subject_id);
```

---

#### `school_<slug>.audit_logs` [DPDP — RETAINED, INSERT-ONLY]

```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  actor_id      UUID,
  actor_name    TEXT,
  actor_role    TEXT,
  action        TEXT NOT NULL,        -- 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'LOGIN'
  resource_type TEXT NOT NULL,
  resource_id   UUID,
  summary       TEXT,                 -- human-readable one-line summary of the change
  old_values    JSONB,
  new_values    JSONB,
  ip_address    TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_occurred ON audit_logs(occurred_at DESC);
```

---

## 9. Data Flow Optimization

### 9.1 Eliminated Query Patterns

The following query patterns from the original architecture are explicitly **not present** in the simplified design:

| Original Pattern | Problem | Eliminated By |
|---|---|---|
| `students JOIN classes JOIN sections` on every student list query | 3-table join on every page load | Denormalized `class_name`, `section_name` columns on `students` |
| `exam_results JOIN students JOIN subjects JOIN staff` for report card | 4-table join per student per exam | Denormalized display fields on `exam_results` |
| `fee_transactions JOIN students JOIN classes` for class-level dues report | Join on every report | Denormalized `class_name`, `section_name` on `fee_transactions` |
| N+1: fetch section → foreach student → fetch attendance | One query per student | Replaced by `WHERE section_id = X AND date = Y` — one query returns all |
| RabbitMQ consumer → DB write per RFID event | One DB write per hardware tap | RFID removed entirely |
| Nightly ETL from Postgres → Redshift | Background job, separate infra | Postgres read queries replace Redshift |
| Cognito token introspection on every request | HTTP call to Cognito per JWT | JWT verified locally (stateless, no network call) |

### 9.2 Denormalization Strategy

**What is denormalized and where:**

| Denormalized Field | Stored On | Updated When |
|---|---|---|
| `student_name` | `attendance_records`, `fee_transactions`, `exam_results`, `student_guardian_map` | Student name changed (rare; admin operation) |
| `class_name`, `section_name` | `students`, `attendance_records`, `fee_transactions`, `exam_results` | Student assigned to a new section |
| `subject_name` | `exam_results`, `section_subjects` | Subject name changed (very rare) |
| `teacher_name` | `section_subjects` | Teacher name changed |
| `marked_by_name` | `attendance_records` | Never (historical audit field) |
| `entered_by_name` | `exam_results` | Never (historical audit field) |
| `class_teacher_name` | `sections` | Teacher assignment changed |
| `sent_by_name` | `circulars` | Never (historical) |

**Update propagation rule:** When a denormalized source changes (e.g., a student moves from Class 3B to Class 4A), the section-assignment endpoint runs:
```sql
-- One UPDATE to keep future records consistent:
UPDATE students SET class_id = $new_class_id, class_name = $new_class_name,
                    section_id = $new_section_id, section_name = $new_section_name
WHERE id = $student_id;
-- Historical records (attendance, fees) are NOT updated — they reflect the state at time of recording.
```

This means historical attendance and fee records correctly reflect the class the student was in at the time they were recorded — which is the right behavior for audit purposes.

### 9.3 API Call Consolidation

**Before (original):** A teacher opening the attendance screen required:
1. `GET /sections/:id` — fetch section details
2. `GET /sections/:id/students` — fetch student list (JOINs students + class_enrollments)
3. `GET /attendance?section_id=X&date=Y` — fetch existing attendance records
4. Three separate API calls, two JOINs, all before the teacher sees the screen

**After (simplified):**
1. `GET /attendance?section_id=X&date=Y` — returns the student list with existing attendance status (or defaults to PRESENT if no record). One endpoint, one query.

The response shape:
```json
{
  "date": "2025-10-08",
  "section": { "id": "uuid", "class_name": "Class 3", "section_name": "B" },
  "records": [
    { "student_id": "uuid", "student_name": "Priya Sharma", "status": "PRESENT", "attendance_record_id": "uuid" },
    { "student_id": "uuid", "student_name": "Arjun Mehta", "status": null }
  ]
}
```

The SQL behind this (one query):
```sql
SELECT
  s.id AS student_id,
  s.full_name AS student_name,
  a.id AS attendance_record_id,
  COALESCE(a.status, 'PRESENT') AS status
FROM students s
LEFT JOIN attendance_records a
  ON a.student_id = s.id AND a.date = $date
WHERE s.section_id = $section_id
  AND s.enrollment_status = 'ACTIVE'
ORDER BY s.full_name;
```

This LEFT JOIN is the one acceptable join in a read path — it fetches exactly the data the screen needs in one round-trip, with no further queries.

---

## 10. RBAC — Simplified Role Matrix

> Roles are hardcoded in `permissions.config.ts`. No roles/permissions tables needed.

| Resource | ADMIN | PRINCIPAL | HOD | TEACHER | ACCOUNTANT | FRONT_OFFICE | PARENT | STUDENT |
|---|---|---|---|---|---|---|---|---|
| **Students** | CRUD | CRU | R* | R* | R (name+fees) | CRUD | R (own child) | R (own) |
| **Attendance** | CRUD | R | R* | CRUD* | - | - | R (own child) | R (own) |
| **Exams** | CRUD | CRU | CRU* | R | - | - | - | - |
| **Exam Results** | CRUD | CRU | CRU* | CRUD* | - | - | R (own child) | R (own) |
| **Fee Structures** | CRUD | R | - | - | CRUD | - | - | - |
| **Fee Transactions** | CRUD | R | - | - | CRUD | - | R (own child) | - |
| **Circulars** | CRUD | CRUD | CRU* | CRU* | - | CRU | R | R |
| **Messages** | R (all) | R (all) | R* | R (own threads) | - | - | R (own) | - |
| **Notifications** | R (all) | R (own) | R (own) | R (own) | R (own) | R (own) | R (own) | R (own) |
| **Audit Logs** | R | R | - | - | R (fee) | - | - | - |
| **Consent Records** | CRUD | R | - | - | - | CRU | R (own) | - |
| **Users** | CRUD | R | R* | - | - | CRU | - | - |

> *\* = scope-restricted to own classes/sections/department*

**Scope enforcement:** The JWT payload contains `scope_data`:
```json
{
  "role": "TEACHER",
  "scope_data": {
    "section_ids": ["uuid-3b", "uuid-3c"],
    "class_ids": ["uuid-class3"]
  }
}
```

All service methods for TEACHER-role requests AND queries with `WHERE section_id = ANY($scope_data.section_ids)`. This happens in the NestJS service layer, not the DB (no RLS policies needed).

---

## 11. Reporting & Exports

All reports are predefined SQL queries executed against the primary Postgres DB (or a read replica when traffic warrants it). No separate analytics infrastructure.

| Report | Query Summary | Output | Audience |
|---|---|---|---|
| **Class Attendance Summary** | `GROUP BY student_id, status` for a class/month | Table: student name, present days, absent days, % | Teacher, HOD, Principal |
| **Attendance Defaulter List** | Students with present% < threshold | Table: student name, class, %, parent phone | Class Teacher, HOD |
| **Exam Results by Section** | All `exam_results` for an exam + section | Marks grid table | Teacher, HOD |
| **Student Report Card** | All `exam_results` for a student across all exams in a year | PDF (pdfkit) | Parent, Admin |
| **Fee Collection Summary** | `SUM(paid_amount)` by fee_head, payment_mode, date range | Table + totals | Accountant, Principal |
| **Outstanding Dues** | `fee_transactions WHERE status = 'PENDING'` by class | Table: student, due amount, overdue days | Accountant |
| **Class-wise Fee Collection** | `GROUP BY class_name` | Summary table | Principal |

**Export implementation:** Each report endpoint accepts a `?format=csv` or `?format=pdf` query parameter. CSV is streamed from the SQL result. PDF is rendered using `pdfkit` (for simple tabular reports) or Puppeteer (for report cards with school branding).

**No scheduled reports in v1.** Scheduled delivery (weekly email of reports) is a Phase 2 feature.

---

## 12. DPDP Compliance (Retained Obligations)

Despite the significant de-scoping, the following DPDP obligations are **non-negotiable** and are retained in the simplified architecture:

### 12.1 Consent Records

The `consent_records` table is retained exactly. At admission, the Front Office staff:
1. Shows the parent the Consent Notice (a printed or on-screen document, version `2025-v1`).
2. Enters the parent's verbal/signed consent into the system (consent method: `STAFF_VERIFIED_AT_ADMISSION`).
3. A `consent_records` row is created and linked to the student record.

> **Note:** The simplified consent flow uses `STAFF_VERIFIED_AT_ADMISSION` as the `consent_method` rather than `OTP_VERIFIED_MOBILE`. This is a pragmatic interim approach for in-person admissions. The OTP flow from the Master Context is a Phase 2 upgrade when the parent app has a self-serve onboarding experience.

### 12.2 Audit Logs

The `audit_logs` table is retained with INSERT-only semantics. A NestJS `AuditInterceptor` wraps all mutating endpoints and writes one audit row per operation. The `summary` field is a human-readable one-liner (e.g., `"Teacher Sunita Rao marked attendance for Class 3B on 2025-10-08"`).

### 12.3 Data Retention & Anonymization

The retention schedule from Section 7.4 of the Master Context is retained:
- Student academic records: 7 years post-exit.
- Transport/GPS data: not collected (module removed).
- Fee records: 8 years.
- Audit logs: 5 years.

An anonymization script (`npm run dpdp:anonymize -- --student_id=X`) clears PII fields and sets `anonymized_at`. This is a manual admin CLI operation in v1; automated scheduling is Phase 2.

### 12.4 Data Principal Rights

| Right | Simplified Implementation |
|---|---|
| Access | Admin can export a student's full data as JSON/CSV on request |
| Correction | Admin edits fields directly (standard CRUD) |
| Erasure | Admin runs the anonymization CLI script |
| Grievance | School's Grievance Officer contact displayed in app footer; no in-app form needed for v1 |

---

## 13. UI/UX Principles

### 13.1 One Screen, One Job

Every screen in the simplified EduCore does exactly one thing:

| Screen | One Job |
|---|---|
| Attendance Screen | Mark today's attendance for my section |
| Student Profile | View and edit one student's information |
| Fee Ledger | See what a student owes and record a payment |
| Marks Entry | Enter marks for my subject in one exam |
| Circular | Write and send an announcement |
| My Notifications | See what's new since I last logged in |

### 13.2 Mobile-Responsive Web

- All screens built with a mobile-first CSS grid (320px base).
- Teacher's most-used flow (attendance checkbox list) must work comfortably with thumb-only interaction on a 5-inch screen.
- No horizontal scrolling. No modals with 6 fields. No multi-step wizards.
- Tables on mobile collapse to card layouts.

### 13.3 Minimal Navigation

Navigation structure (maximum 2 levels deep):
```
Top Nav: [EduCore Logo] [Module Tabs] [Notifications Bell] [User Menu]

Module Tabs:
  - Students
  - Attendance
  - Exams
  - Fees
  - Communication

Each tab opens a list view. Click a row to open a detail view. That's it.
```

### 13.4 Optimistic UI

For the attendance checkbox list, status changes are applied in the UI immediately on tap. The bulk-save API call fires in the background. If it fails, the UI reverts and shows an error banner. This makes the attendance marking experience feel instant even on slow mobile connections.

---

*End of EduCore Simplified Architecture v2.0.0*

*Companion document: [EduCore_Master_Context.md](./EduCore_Master_Context.md) — full-feature reference*
*Build plan: [EduCore_Build_Plan.md](./EduCore_Build_Plan.md) — sequential implementation phases*
