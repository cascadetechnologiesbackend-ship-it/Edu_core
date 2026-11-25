# SchoolMitra ERP — Row-Level Security (RLS) Completeness & Gap Analysis
**Directive**: `EDUCORE_MASTER_ENGINEERING_EXCELLENCE` v1.0.0  
**Phase**: Phase 02 (Requirement B: RLS Completeness)  
**Date**: November 25, 2026  
**Auditor**: Principal Database Architect  
**Inventory Reference**: [docs/engineering/RLS_TENANT_TABLE_INVENTORY.json](file:///v:/Cascade/2026/Edu_core/docs/engineering/RLS_TENANT_TABLE_INVENTORY.json)

---

## 1. Executive Summary

A comprehensive automated audit of all 171 table entities defined across the 19 database schema files (`database/src/schema/*.ts`) against all 58 existing PostgreSQL migrations (`database/src/migrations/*.sql`) reveals:

- **Total Discovered Tables**: 171
- **Tenant-Owned Tables (contain direct `school_id`)**: 151
- **Platform-Global Tables (no `school_id`, e.g. `schools`, `worker_heartbeats`)**: 20
- **Tenant Tables with Full RLS & FORCE RLS (Migration 0041/0042)**: 15
- **Tenant Tables with Partial RLS (Missing `FORCE ROW LEVEL SECURITY`)**: 8
- **Tenant Tables Completely Missing RLS & FORCE RLS**: 136

---

## 2. Policy Structure & Defense-in-Depth Architecture

### The Four Law Standard for Fail-Closed Multi-Tenancy (SEC-RLS-001):
1. **Unset, NULL, or Empty Setting Denial**:
   `nullif(current_setting('app.current_school_id', true), '')` evaluates to `NULL` if not set, denying ordinary tenant access fail-closed.
2. **SELECT Policy**:
   ```sql
   (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
   OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
   ```
3. **INSERT / UPDATE / DELETE Policies**:
   ```sql
   WITH CHECK ((school_id)::text = nullif(current_setting('app.current_school_id', true), ''))
   ```
   *Note: Platform administrators cannot execute cross-tenant writes without explicitly scoping via `withTenant(schoolId)`.*
4. **Owner Enforcement (`FORCE ROW LEVEL SECURITY`)**:
   In PostgreSQL, standard `ENABLE ROW LEVEL SECURITY` does NOT apply policies to the table owner. `ALTER TABLE ... FORCE ROW LEVEL SECURITY` is mandatory to ensure application database users running under the table owner identity are strictly constrained.
5. **Role Privilege Truth (Corrected ADR-003)**:
   In PostgreSQL, roles with `SUPERUSER` attributes or `BYPASSRLS` privileges unconditionally bypass Row-Level Security regardless of `FORCE ROW LEVEL SECURITY`. Therefore, production application connection pools MUST connect as a dedicated non-superuser, non-BYPASSRLS role (e.g., `schoolmitra_app_login`), while DDL schema migrations run under the table owner identity.

---

## 3. Gap Analysis: The 136 Unprotected Tenant Tables

The following 136 tables hold tenant-owned data with a direct `school_id` foreign key but have no RLS policies active in migrations 0001 through 0058:

### Academics & Curriculum (16 tables):
- `sections`, `subjects`, `class_subjects`, `student_subject_enrollments`, `academic_terms`, `academic_calendar_events`, `bell_schedule`, `timetable_periods`, `timetable_substitutions`, `syllabus_units`, `syllabus_chapters`, `syllabus_topics`, `lesson_plans`, `assignments`, `assignment_submissions`, `assessments`.

### Accounts & Financial Ledger (6 tables):
- `chart_of_accounts`, `bank_accounts`, `income_heads`, `expense_heads`, `income_vouchers`, `expense_vouchers`.

### Admissions & Intake (4 tables):
- `admission_applications`, `admission_documents`, `admission_workflow_steps`, `waitlist`.

### Attendance Control (3 tables):
- `staff_attendance`, `attendance_notifications`, `student_leave_requests`.

### Communication & Messaging (6 tables):
- `notices`, `sms_logs`, `email_logs`, `push_subscriptions`, `message_templates`, `chat_channels`.

### DPDP Privacy & Compliance (11 tables):
- `data_retention_policies`, `dpdp_audit_events`, `pii_access_logs`, `data_flow_mappings`, `consent_purposes`, `sar_requests`, `privacy_notices`, `dpdp_consents`, `dpdp_rights_requests`, `dpdp_retention_policies`, `dpdp_purge_logs`.

### Drivers & Fleet (3 tables):
- `driver_profiles`, `driver_vehicles`, `driver_licenses`.

### Examinations & Grading (12 tables):
- `exams`, `exam_schedules`, `exam_marks`, `grade_scales`, `report_cards`, `exam_rooms`, `exam_invigilators`, `marks_entry_locks`, `exam_fee_dues`, `hall_tickets`, `admit_cards`, `exam_grade_conversions`.

### Fee Structures & Advances (8 tables):
- `fee_categories`, `fee_structures`, `fee_discounts`, `fee_challans`, `fee_receipt_templates`, `student_fee_advances`, `student_fee_advance_allocations`, `late_fee_rules`.

### Hostels & Boarding (3 tables):
- `hostel_blocks`, `hostel_rooms`, `hostel_allocations`.

### HR & Staff Payroll (12 tables):
- `departments`, `designations`, `staff`, `leave_types`, `leave_requests`, `salary_components`, `payroll_runs`, `payslips`, `salary_templates`, `staff_documents`, `staff_loans`, `leave_balances`.

### Inventory & Assets (5 tables):
- `assets`, `asset_assignments`, `inventory_items`, `purchase_orders`, `stock_movements`.

### Library Management (5 tables):
- `books`, `book_copies`, `library_members`, `book_issues`, `book_fines`.

### Student Demographics & Family (5 tables):
- `student_family_members`, `student_medical_records`, `student_class_history`, `student_documents`, `alumni`.

### Transport Fleet & Routes (4 tables):
- `vehicles`, `routes`, `route_stops`, `student_bus_passes`.

---

## 4. Remediation Migration: `0059_complete_fail_closed_rls.sql`

A comprehensive, non-breaking idempotent migration script is prepared:
- Applies `DROP POLICY IF EXISTS ...` for clean replayability.
- Creates `tenant_select_policy` with `PLATFORM_ADMIN` read bypass.
- Creates `tenant_insert_policy`, `tenant_update_policy`, `tenant_delete_policy` strictly enforcing `school_id = current_setting('app.current_school_id', true)::uuid`.
- Executes `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `ALTER TABLE ... FORCE ROW LEVEL SECURITY` across all 136 tables.
- **Safety Boundary**: This migration is registered in `database/src/migrations/meta/_journal.json` for validation in local test environments and will NOT be applied to production without separate explicit approval.
