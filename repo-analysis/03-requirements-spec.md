# 03 — Requirements Specification (Reconstructed)
## SchoolMitra ERP

*These requirements are reconstructed from codebase evidence — no formal requirements document was found in the repository.*

---

## System Purpose

SchoolMitra ERP is a multi-tenant school management platform for Indian schools covering Nursery through Class 10. It digitizes every operational domain of a school: admissions, academics, fees, HR, attendance, examinations, compliance, and communication.

**Compliance constraint:** The system is designed to comply with the DPDP Act 2023 (India's Digital Personal Data Protection Act).

---

## User Roles and Capabilities

| Role | Primary Capabilities | Evidence |
|------|---------------------|---------|
| SUPER_ADMIN | Platform management, school provisioning, impersonation, global templates | superadmin.ts schema, roleConfig.ts |
| SCHOOL_ADMIN | Full school control — all modules | roleConfig.ts, admin routes |
| PRINCIPAL | Academic oversight, teacher management, exam approval | roleConfig.ts |
| HR_MANAGER | Staff directory, leave approvals, payroll, ECR export | hr.ts, roleConfig.ts |
| TEACHER | Attendance marking, gradebook, assignments, lesson plans | roleConfig.ts, academics routes |
| ACCOUNTANT | Fee collection, concessions, financial reports | fees.ts, roleConfig.ts |
| LIBRARIAN | Book catalog, issue/return, overdue fines | library routes |
| TRANSPORT_MANAGER | Bus routes, student allocations | transport.ts |
| PARENT | Child attendance view, fee portal, bus tracker | parent routes |
| STUDENT | Own timetable, grades, report cards | student routes |
| DRIVER | Route view, GPS broadcast | driver routes |

---

## Core Functional Modules

### M-001: Multi-Tenant Platform Management (Super Admin)

- **R-SA-01:** Super admin can provision new school tenants from global templates (Board × School Type matrix)
- **R-SA-02:** Templates are deep-cloned at provisioning — 8 entity types (academic years, classes, subjects, timetable, fee heads, salary grades, holidays, roles)
- **R-SA-03:** Template changes do not auto-propagate to existing schools
- **R-SA-04:** Super admin can impersonate a school admin for support (60-minute TTL, logged)
- **R-SA-05:** Super admin can suspend/archive schools
- **R-SA-06:** Platform-level audit log of all super-admin actions
- **R-SA-07:** Platform announcements to school admins

### M-002: Authentication & Authorization

- **R-AUTH-01:** Email + password credential authentication
- **R-AUTH-02:** Account lockout after 5 failed attempts (15-minute block)
- **R-AUTH-03:** Force password change on first login
- **R-AUTH-04:** 8-hour JWT sessions, 1-hour re-sign
- **R-AUTH-05:** 11 roles with hierarchical access control
- **R-AUTH-06:** TOTP/2FA support (schema implemented; enforcement UNKNOWN)

### M-003: Student Admissions

- **R-ADM-01:** Public online admission application (unauthenticated — parents apply without account)
- **R-ADM-02:** Multi-step workflow: Applied → Screening → Entrance Test → Interview → Offer Letter → Enrolled → Rejected
- **R-ADM-03:** Document upload (birth certificate, Aadhaar photo, TC, vaccination)
- **R-ADM-04:** Waitlist management with rank ordering
- **R-ADM-05:** RTE applicant flagging
- **R-ADM-06:** DPDP consent collection at application step 1
- **R-ADM-07:** Sibling discount eligibility tracking

### M-004: Student Information

- **R-STU-01:** Student profile with PII encryption (AES-256)
- **R-STU-02:** Family member linkage (father, mother, guardian)
- **R-STU-03:** Medical records (restricted access, all fields encrypted)
- **R-STU-04:** Class assignment with section and roll number
- **R-STU-05:** Class promotion history
- **R-STU-06:** Document storage (S3)
- **R-STU-07:** Aadhaar last 4 digits only — full number never stored

### M-005: Academic Management

- **R-ACA-01:** Class → Section → Subject hierarchy
- **R-ACA-02:** Timetable management with bell schedule
- **R-ACA-03:** Teacher assignment per subject per section (with date history)
- **R-ACA-04:** Substitute teacher tracking
- **R-ACA-05:** Syllabus structure (Units → Chapters → Topics)
- **R-ACA-06:** Lesson plans linked to syllabus topics
- **R-ACA-07:** Assignment creation and student submission tracking
- **R-ACA-08:** Academic calendar with holiday types

### M-006: Fee Management

- **R-FEE-01:** Fee head catalogue (Tuition, Transport, Library, Lab, Hostel, etc.)
- **R-FEE-02:** Fee structure matrix (Class × Fee Head × Term × Amount)
- **R-FEE-03:** Automatic invoice generation for enrolled students
- **R-FEE-04:** Transport and hostel opt-in fee conditionals
- **R-FEE-05:** Concession types (staff ward, sibling, RTE, merit scholarship)
- **R-FEE-06:** Online payment via Razorpay
- **R-FEE-07:** Cash/cheque/NEFT/DD payment recording
- **R-FEE-08:** Receipts (PDF, S3 stored)
- **R-FEE-09:** Late fee calculation (flat or percentage, after N days)
- **R-FEE-10:** Refund workflow with approval
- **R-FEE-11:** SMS reminders at D-7, D-15, D-30 overdue

### M-007: HR & Payroll

- **R-HR-01:** Staff directory (departments, designations, contract types)
- **R-HR-02:** Indian statutory payroll: PF (12% on 15k cap), ESI (0.75%/3.25% on 21k ceiling), PT (state-wise)
- **R-HR-03:** LWP (Loss of Work Pay) daily rate deduction
- **R-HR-04:** Staff loan tracking with EMI deduction
- **R-HR-05:** Leave request workflow: Staff → HOD approval → HR approval
- **R-HR-06:** Leave balance tracking with carry-forward
- **R-HR-07:** Monthly payroll runs (DRAFT → PROCESSED → APPROVED → PAID)
- **R-HR-08:** ECR (EPFO) file generation
- **R-HR-09:** Payslip PDF generation and storage
- **R-HR-10:** Staff document management (appointment letters, etc.)

### M-008: Attendance

- **R-ATT-01:** Daily student attendance per section
- **R-ATT-02:** Period-wise student attendance option
- **R-ATT-03:** Staff attendance (clock-in/clock-out, biometric flag)
- **R-ATT-04:** SMS notification to parents on student absence

### M-009: Examinations & Report Cards

- **R-EXA-01:** Exam type configuration (Unit Test, Half-Yearly, Annual, etc.)
- **R-EXA-02:** Mark entry per subject per student (draft → submitted → locked)
- **R-EXA-03:** Grade calculation engine (CBSE A1-E, configurable rules)
- **R-EXA-04:** Class-group-specific templates (Nursery-UKG, Class 1-5, 6-8, 9-10)
- **R-EXA-05:** Rank calculation (tied ranks for equal marks)
- **R-EXA-06:** Report card PDF generation (async via BullMQ worker)
- **R-EXA-07:** Topper certificate generation

### M-010: DPDP Act 2023 Compliance

- **R-DPD-01:** Consent collection before data entry (purposes: admission, health, alumni, etc.)
- **R-DPD-02:** Consent withdrawal with processing halt
- **R-DPD-03:** Rights requests: Access, Correction, Erasure, Grievance, Nomination (30-day SLA)
- **R-DPD-04:** Data breach log with 72-hour board notification deadline
- **R-DPD-05:** Vendor/processor register with DPA tracking
- **R-DPD-06:** Data retention policies with automated enforcement (BullMQ worker)
- **R-DPD-07:** Privacy notices (bilingual: EN + HI) with version history
- **R-DPD-08:** Immutable audit trail (append-only trigger on audit_logs)

### M-011: Library

- **R-LIB-01:** Book catalog management
- **R-LIB-02:** Book issue and return tracking
- **R-LIB-03:** Overdue fine calculation
- *(Implementation details: UNKNOWN — schema and routes not reviewed)*

### M-012: Transport

- **R-TRN-01:** Bus route and stop management
- **R-TRN-02:** Student transport allocation
- **R-TRN-03:** GPS broadcast by driver
- *(Implementation details: UNKNOWN)*

---

## Non-Functional Requirements

| NFR | Evidence | Status |
|-----|---------|--------|
| Security headers (HSTS, CSP, etc.) | next.config.mjs headers() | VERIFIED |
| PII encryption at rest | AES-256-CBC field-level | VERIFIED |
| Account lockout (brute force) | accountLockout.ts | VERIFIED |
| Rate limiting (sliding window) | rateLimiter.ts | VERIFIED |
| Multi-tenant data isolation | schoolId on all tables | PARTIAL |
| Audit logging | audit_logs table + trigger | VERIFIED |
| Structured logging | pino (dev only) | PARTIAL |
| DPDP Act 2023 compliance | dpdp.ts schema | PARTIAL |
| Scalability | Single process on Render starter | INSUFFICIENT |
| Recovery | No backup configuration | MISSING |
