# DATA IMPORT/EXPORT INVENTORY
**SchoolMitra ERP — Complete Module Coverage**  
Branch: `feature/data-import-export-glass-navigation`  
Version: 1.0.0 | Generated: 2026-11-25

---

## Legend
- **Import**: ✅ Supported | ❌ Not supported (protected or no business case) | ⚠️ Controlled (domain-specific workflow)
- **Export**: CSV | XLSX | PDF | ❌ None
- **Status**: 🔵 Planned | 🟡 In Progress | 🟢 Complete | ⚫ N/A

---

## Module Inventory

| # | Module | Submodule | Route | Entity | Import | Export Formats | Authorized Roles | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | **Super Admin / Platform** | School Listing | `/platform/schools` | schools | ❌ | CSV, XLSX | SUPER_ADMIN | 🔵 |
| 2 | **Super Admin / Platform** | School Details | `/platform/schools/[id]` | schools | ❌ | ❌ | SUPER_ADMIN | ⚫ |
| 3 | **School Management** | Settings | `/settings` | schools | ❌ | ❌ | SCHOOL_ADMIN | ⚫ |
| 4 | **Admissions** | New Admission | `/admissions/new` | admissions, persons | ✅ CSV/XLSX | XLSX, PDF, CSV | SCHOOL_ADMIN, PRINCIPAL | 🔵 |
| 5 | **Admissions** | Admission List | `/admissions` | admissions | ❌ | XLSX, PDF, CSV | SCHOOL_ADMIN, PRINCIPAL | 🔵 |
| 6 | **Students** | Student Directory | `/students` | students, persons | ✅ CSV/XLSX (STUDENTS) | XLSX, PDF, CSV | SCHOOL_ADMIN, PRINCIPAL | 🟢 |
| 7 | **Students** | Student Profile | `/students/[id]` | students | ❌ | PDF (profile) | SCHOOL_ADMIN, PRINCIPAL, TEACHER | 🔵 |
| 8 | **Students** | Student 360 | `/students/[id]/360` | students, attendance, marks | ❌ | PDF | SCHOOL_ADMIN, PRINCIPAL, TEACHER | 🔵 |
| 9 | **Parents / Guardians** | Parent Directory | `/students` (parent tab) | persons, students | ✅ via Students | CSV | SCHOOL_ADMIN | 🔵 |
| 10 | **Academics** | Academic Year Setup | `/academics/setup` | academic_years | ❌ | ❌ | SCHOOL_ADMIN | ⚫ |
| 11 | **Classes & Sections** | Class List | `/academics/classes` | classes, sections | ✅ CSV (CLASSES) | CSV, XLSX | SCHOOL_ADMIN | 🟢 |
| 12 | **Subjects & Curriculum** | Subject List | `/academics/subjects` | subjects | ✅ CSV (SUBJECTS) | CSV, XLSX | SCHOOL_ADMIN | 🟢 |
| 13 | **Subject Mapping** | Class-Subject Mapping | `/academics/mapping` | class_subjects | ❌ | CSV | SCHOOL_ADMIN | 🔵 |
| 14 | **Timetable** | Timetable Config | `/academics` (timetable tab) | timetable_slots | ✅ CSV (TIMETABLE) | PDF, XLSX | SCHOOL_ADMIN, PRINCIPAL | 🔵 |
| 15 | **Attendance** | Daily Attendance | `/attendance` | attendance_records | ❌ Protected | PDF (register), XLSX, CSV | SCHOOL_ADMIN, PRINCIPAL, TEACHER | 🔵 |
| 16 | **Attendance** | Attendance Reports | `/academics/reports` | attendance_records | ❌ | PDF (register), XLSX, CSV | SCHOOL_ADMIN, PRINCIPAL, TEACHER | 🔵 |
| 17 | **Exams** | Exam List | `/exams` | exams | ❌ | XLSX | SCHOOL_ADMIN, PRINCIPAL | 🔵 |
| 18 | **Exams** | Exam Schedule | `/exams/schedule` | exam_schedules | ❌ | PDF (schedule), XLSX | SCHOOL_ADMIN, PRINCIPAL, TEACHER | 🔵 |
| 19 | **Marks & Results** | Mark Entry | `/exams/marks` | exam_marks | ✅ XLSX (controlled) | PDF, XLSX, CSV | SCHOOL_ADMIN, PRINCIPAL, TEACHER | 🔵 |
| 20 | **Marks & Results** | Results | `/exams/results` | exam_results | ❌ | PDF (results), XLSX, CSV | SCHOOL_ADMIN, PRINCIPAL | 🔵 |
| 21 | **Report Cards** | Generate Report Cards | `/exams/report-cards` | report_cards | ❌ | PDF (existing domain flow) | SCHOOL_ADMIN, PRINCIPAL | ⚫ |
| 22 | **Admit Cards** | Admit Cards Batch | `/exams/admit-cards` | admit_cards | ❌ | PDF batch (extend existing) | SCHOOL_ADMIN, PRINCIPAL | 🔵 |
| 23 | **Certificates** | Certificates | `/api/certificates` | certificates | ❌ | PDF (existing flow) | SCHOOL_ADMIN, PRINCIPAL | ⚫ |
| 24 | **Fees** | Fee Structures | `/fees/structures`, `/school/fee-structures` | fee_structures | ✅ CSV (FEE_HEADS) | CSV, XLSX | SCHOOL_ADMIN, ACCOUNTANT | 🟢 |
| 25 | **Fees** | Fee Types | `/school/fee-types` | fee_types | ✅ CSV (FEE_HEADS) | CSV | SCHOOL_ADMIN, ACCOUNTANT | 🔵 |
| 26 | **Fees** | Fee Groups | `/school/fee-groups` | fee_groups | ❌ | CSV | SCHOOL_ADMIN, ACCOUNTANT | 🔵 |
| 27 | **Fees** | Assign Fees | `/school/assign-fees` | student_fee_assignments | ❌ | XLSX | SCHOOL_ADMIN, ACCOUNTANT | 🔵 |
| 28 | **Fees** | Collect Fees | `/school/collect-fees`, `/fees/collect` | fee_payments | ❌ Transaction-protected | PDF receipt, XLSX | SCHOOL_ADMIN, ACCOUNTANT | 🔵 |
| 29 | **Fees** | Fee Challans | `/school/fee-challans` | fee_challans | ❌ | PDF batch | SCHOOL_ADMIN, ACCOUNTANT | 🔵 |
| 30 | **Fees** | Due Fees | `/school/due-fees` | fee_invoices | ❌ | XLSX, PDF, CSV | SCHOOL_ADMIN, ACCOUNTANT | 🔵 |
| 31 | **Fees** | Fee Reports | `/fees/reports` | fee_reports | ❌ | PDF, XLSX, CSV | SCHOOL_ADMIN, ACCOUNTANT | 🔵 |
| 32 | **Fees** | Concessions | `/fees/concessions` | fee_concessions | ❌ | CSV, XLSX | SCHOOL_ADMIN, ACCOUNTANT | 🔵 |
| 33 | **Fees** | Fee Audit | `/school/fee-audit` | audit_logs | ❌ | CSV | SCHOOL_ADMIN | 🔵 |
| 34 | **Fees** | Carry Forward | `/school/fees-carry-forward` | fee_carry_forwards | ❌ | XLSX | SCHOOL_ADMIN, ACCOUNTANT | 🔵 |
| 35 | **Finance / Accounts** | Accounts Hub | `/school/accounts`, `/school/accounting` | accounts | ❌ | XLSX, CSV | SCHOOL_ADMIN, ACCOUNTANT | 🔵 |
| 36 | **Finance** | Import Center (existing) | `/school/import-center` | multiple | ✅ (upgraded) | CSV, XLSX | SCHOOL_ADMIN | 🟡 |
| 37 | **HR** | Staff Directory | `/hr/staff` | staff, persons | ✅ CSV/XLSX (STAFF) | XLSX, PDF, CSV | SCHOOL_ADMIN, HR | 🟢 |
| 38 | **HR** | Leave Management | `/hr` (leave tab) | leave_requests | ❌ | XLSX, CSV | SCHOOL_ADMIN, HR | 🔵 |
| 39 | **Payroll** | Payroll Processing | `/hr/payroll` | payroll_runs | ❌ Ledger-protected | PDF, XLSX | SCHOOL_ADMIN, ACCOUNTANT, HR | 🔵 |
| 40 | **Payroll** | ECR Export | `/api/payroll/ecr` | payroll_ecr | ❌ | CSV (ECR format) | SCHOOL_ADMIN, ACCOUNTANT | 🔵 |
| 41 | **Salary Templates** | Salary Templates | `/hr` | salary_templates | ✅ CSV (SALARY_TEMPLATES) | CSV | SCHOOL_ADMIN, HR | 🟢 |
| 42 | **Library** | Library Inventory | `/library` | library_books | ✅ CSV/XLSX (LIBRARY_INVENTORY) | XLSX, PDF, CSV | SCHOOL_ADMIN | 🔵 |
| 43 | **Library** | Issue Log | `/library` (issues tab) | book_issues | ❌ | XLSX, CSV | SCHOOL_ADMIN | 🔵 |
| 44 | **Transport** | Routes & Vehicles | `/transport` | transport_routes, vehicles | ✅ CSV (TRANSPORT_ROUTES) | XLSX, PDF, CSV | SCHOOL_ADMIN | 🔵 |
| 45 | **Transport** | Transport Dashboard | `/transport/dashboard` | transport_assignments | ❌ | XLSX | SCHOOL_ADMIN | 🔵 |
| 46 | **Communication** | Notices | `/communication/notices` | notices | ❌ | ❌ | SCHOOL_ADMIN, PRINCIPAL | ⚫ |
| 47 | **Communication** | Notifications | `/communication/delivery` | notification_logs | ❌ | CSV (delivery report) | SCHOOL_ADMIN, PRINCIPAL | 🔵 |
| 48 | **DPDP / Data Rights** | Consent Records | `/dpdp` | consent_records | ❌ | PDF (data portability) | SCHOOL_ADMIN, DPDP_OFFICER | 🔵 |
| 49 | **DPDP / Data Rights** | Data Breach Log | `/dpdp` | data_breach_log | ❌ | PDF, CSV | SCHOOL_ADMIN | 🔵 |
| 50 | **Parent Portal** | Child Reports | `/parent/*` | student, marks, attendance | ❌ | PDF (child's reports, receipts) | PARENT (own child only) | 🔵 |
| 51 | **Student Portal** | Own Marks/Timetable | `/student/*` | student, marks, timetable | ❌ | PDF (own data only) | STUDENT (own only) | 🔵 |
| 52 | **Teacher Portal** | Class Attendance | `/teacher/attendance` | attendance_records | ❌ | PDF/XLSX (own classes) | TEACHER (own classes) | 🔵 |
| 53 | **Teacher Portal** | Gradebook | `/teacher/grading` | exam_marks | ✅ XLSX (controlled mark entry) | PDF, XLSX | TEACHER (own classes) | 🔵 |

---

## Explicitly Excluded (No Import/Export)

| Screen | Reason |
|---|---|
| Dashboard (all roles) | Aggregated metrics, not raw data |
| Settings / School Profile | Configuration, not data export |
| Notifications list | Delivery-only, no bulk export needed |
| Auth pages (login, onboard) | N/A |
| Demo mode | Sandbox, not real data |
| GPS live tracking | Real-time stream, not tabular |
| Day-One wizard | Onboarding flow, not data management |
| Profile pages | Single-record view |

---

## Protected Data — Never Exported

Regardless of role or export type, these fields are always excluded:

- `password_hash`, `otp_secret`, `auth_tokens`
- `encrypted_*` columns (raw ciphertext)
- `jit_activation_nonces`, `jit_access_audit_logs`
- `tenant_secrets`
- Razorpay/payment gateway tokens
- System-internal UUIDs (exposed only as references, not bulk-exported)
- RLS policy definitions

---

## Status Summary

| Status | Count |
|---|---|
| 🟢 Complete (pre-existing or first implemented) | 7 |
| 🟡 In Progress | 1 |
| 🔵 Planned (this implementation) | 38 |
| ⚫ Intentionally N/A | 7 |
| **Total modules covered** | **53** |
