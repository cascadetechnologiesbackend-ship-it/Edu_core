# 04 — Domain Model
## SchoolMitra ERP

---

## Core Entities

### School (schools)

The root aggregate. Every tenant-scoped entity carries `school_id`.

**State Machine:**
```
ACTIVE → SUSPENDED → ACTIVE (by super admin)
ACTIVE → ARCHIVED
SUSPENDED → ARCHIVED
```

**Key Fields:** id, name, board (CBSE/ICSE/STATE_BOARD/IGCSE/IB), udise_code, slug, status, subscription_tier, subscription_expires_at, feature_flags, provisioning_manifest

**Invariants:**
- UDISE code must be unique globally
- Slug must be unique (for subdomain routing)
- school_type must match provisioned template profile

---

### User (users)

Authentication identity for all school staff and portal users. Linked to the school.

**Key Fields:** id, school_id, email, password_hash, totp_secret, totp_enabled, is_active, must_change_password, failed_login_attempts, locked_until, role (via user_roles JOIN)

**Invariants:**
- (school_id, email) must be unique (multi-tenant email uniqueness)
- A user has exactly one active role per session (highest role by hierarchy)
- `super_admin_users` is a separate table with no school_id

---

### Student (students)

The core student entity linking academic enrollment and PII.

**Lifecycle:**
```
Application (admission_applications)
  ↓ ENROLLED action
ACTIVE student record
  ↓ academic year promotion
student_class_history record
  ↓ graduation or transfer
alumni record OR leavingDate set
```

**Key Fields:** id, school_id, academic_year_id, admission_number, first_name_encrypted, current_class_id, current_section_id, opt_in_transport, opt_in_hostel, is_active, legal_hold

**Invariants:**
- (school_id, admission_number) must be unique
- Aadhaar last 4 only — full number MUST NOT be stored
- Medical records restricted to School Admin + designated staff

---

### Admission Application (admission_applications)

**State Machine:**
```
APPLIED
  ↓
SCREENING
  ↓
ENTRANCE_TEST
  ↓
INTERVIEW
  ↓
OFFER_LETTER ──→ WITHDRAWN
  ↓
ENROLLED ──→ creates student record
  ↓
(or) REJECTED / WAITLISTED
```

**Key Invariants:**
- Consent must be recorded before data entry (DPDP Act)
- Sibling FK must reference an active student in same school
- Application number unique per school per year

---

### Fee Invoice (fee_invoices)

The financial obligation record for a student.

**State Machine:**
```
PENDING → PARTIAL → PAID
PENDING → OVERDUE (when dueDate passes)
PENDING/PARTIAL/OVERDUE → WAIVED
PENDING → CANCELLED
```

**Lifecycle:**
```
Fee structure activated for class
  ↓ autoAssignFeeStructuresToStudent()
PENDING invoice created (gross - discount + tax = net)
  ↓ payment recorded
paidAmount increases, balanceAmount decreases
  ↓ balanceAmount = 0
status → PAID
```

**Invariants:**
- netAmount = grossAmount - discountAmount + taxAmount
- paidAmount must not exceed netAmount
- balanceAmount = netAmount - paidAmount
- Transport/hostel invoices only for opted-in students

---

### Fee Payment (fee_payments)

Immutable financial transaction record.

**Key Fields:** id, receipt_number, school_id, student_id, fee_invoice_id, amount_paid, payment_method, transaction_reference, payment_date, collected_by_id

**Invariants:**
- (school_id, receipt_number) must be unique
- amount_paid must be positive
- A payment cannot exceed invoice balance amount (should be enforced in engine)

---

### Staff (staff)

HR record for all school employees.

**Lifecycle:**
```
ACTIVE (joiningDate set)
  ↓ leave request
LEAVE_PENDING → HOD_APPROVED → HR_APPROVED (leave taken)
  ↓ resignation/termination
relievingDate set, isActive = false, separationType set
```

**Key Fields:** id, school_id, employee_code, department_id, designation_id, contract_type, first_name_encrypted, pan_encrypted, bank_account_encrypted, is_active, legal_hold

---

### Payroll Run (payroll_runs)

**State Machine:**
```
DRAFT → PROCESSED → APPROVED → PAID
```

**Invariants:**
- (school_id, month) must be unique — one run per school per month
- PAID run must not be modified
- Payslips are generated on PROCESSED transition

---

### Leave Request (leave_requests)

**State Machine:**
```
PENDING → HOD_APPROVED → HR_APPROVED (approved)
PENDING → REJECTED (by HOD or HR)
PENDING/HOD_APPROVED → CANCELLED (by staff)
```

---

### Consent Record (consent_records)

DPDP Act compliance. Append-only.

**Lifecycle:**
```
Parent fills consent form at admission
  ↓ granted = true
Consent record created (no updatedAt)
  ↓ parent withdraws consent
NEW consent record created with granted = false, withdrawnAt set
  ↓ processingHaltedAt set by system
Data processing for that purpose stops
```

**Invariants:**
- Each event creates a NEW record (not an update)
- Most recent record for (student_id, purpose_id) determines current consent state
- OTP verification must be completed for consent to be valid

---

### Rights Request (rights_requests)

DPDP Act Sections 11-14.

**State Machine:**
```
SUBMITTED → ACKNOWLEDGED → IN_PROGRESS → COMPLETED
                                         → REJECTED
                         → ESCALATED_TO_DPO
```

**Invariants:**
- dueAt = createdAt + 30 days (30-day SLA)
- For ERASURE requests: data deletion must be confirmed in responseDetails
- For ACCESS requests: dataExportS3Key must be set and expires 48 hours after readyAt

---

### Academic Term / Calendar Event

**Key Relationships:**
```
Academic Year
  → Academic Terms (Term 1, Term 2, etc.)
    → Calendar Events (Holidays, Exams, Events)
    → Syllabus Units
      → Syllabus Chapters
        → Syllabus Topics
          ← Lesson Plans
  → Classes
    → Sections
      → Class Subjects
        → Timetable Periods
        → Assignments
        → Assessments
```

---

## Entity Relationship Summary

```
schools
  ├── academic_years
  │     ├── classes
  │     │     ├── sections
  │     │     │     ├── student_attendance
  │     │     │     ├── timetable_periods
  │     │     │     └── assignments
  │     │     └── class_subjects
  │     │           ├── syllabus_units → chapters → topics
  │     │           ├── lesson_plans
  │     │           └── assessments
  │     ├── students
  │     │     ├── student_family_members
  │     │     ├── student_medical_records
  │     │     ├── student_class_history
  │     │     ├── student_documents
  │     │     ├── fee_invoices → fee_payments → fee_refunds
  │     │     └── consent_records
  │     └── academic_terms → calendar_events
  ├── users → user_roles → roles → role_permissions → permissions
  ├── staff
  │     ├── salary_components → payroll_runs → payslips
  │     ├── leave_requests → leave_balances
  │     └── staff_documents
  ├── fee_heads → fee_structures
  ├── departments → designations
  └── DPDP tables (consent_purposes, rights_requests, data_breach_log, ...)
```
