# Role Tour Card Matrix (Spec: role_tour_flashcards v1.0.0)

This matrix establishes the single source of truth for all 11 role tour decks. Every route (`ctaHref`) has been audited against physical page files under `frontend/src/app` and verified against `frontend/src/lib/routeGuards.ts` (`ROLE_MODULE_ACCESS_MATRIX` and `canRoleAccessRoute`).

---

## 1. School Administrator (`SCHOOL_ADMIN`)
Host Surfaces: `/(admin)/dashboard`, `/(admin)/admin/day-one`
Total Modules: 14

| Module ID | Module Title | Primary Route (`ctaHref`) | Real Sub-Modules (`id`, `title`, `ctaHref`) |
|---|---|---|---|
| `admin-day-one` | Day One Cockpit | `/admin/day-one` | • `readiness-check`: 8 Readiness Checks (`/admin/day-one`) |
| `admin-admissions` | Admissions & Intake | `/admissions` | • `new-app`: New Admission Form (`/admissions/new`)<br/>• `linkage`: Sibling & Family Linkage (`/students/linkage`) |
| `admin-students` | Student Information | `/students` | • `student-dir`: Complete Cohort Directory (`/students`)<br/>• `access-queue`: Student Access Credentials (`/students/access`) |
| `admin-academics` | Academics & Timetable | `/academics` | • `classes`: Classes & Sections (`/academics`)<br/>• `subjects`: Subject Catalog (`/academics/subjects`)<br/>• `bell`: Bell Schedule (`/academics/setup/bell-schedule`)<br/>• `calendar`: Academic Calendar (`/academics/setup/calendar`) |
| `admin-attendance` | Attendance Control | `/attendance` | • `mark-att`: Section-wise Attendance (`/attendance`) |
| `admin-fees` | Finance & Fee Collection | `/school/fees-dashboard` | • `collect`: Fee Counter (`/school/collect-fees`)<br/>• `dues`: Dues Register (`/school/due-fees`)<br/>• `daybook`: Transaction Day Book (`/school/transactions`)<br/>• `pricing`: Class Pricing Matrix (`/school/fee-structures`)<br/>• `audit`: Fee Audit Log (`/school/fee-audit`)<br/>• `online`: Online Gateway Reconciliation (`/school/online-payments`) |
| `admin-accounting` | Accounts & Vouchers | `/school/accounting/dashboard` | • `acct-reports`: Financial Statements (`/school/accounting/reports`)<br/>• `brs`: Bank Reconciliation (`/school/accounts/bank-reconciliation`)<br/>• `expenses`: Voucher Expenses (`/school/accounts/expenses`) |
| `admin-exams` | Examinations & Results | `/exams` | • `manage-exams`: Exam Series Schedule (`/exams/manage`)<br/>• `marks`: Marks Entry Matrix (`/exams/marks`)<br/>• `reports`: CBSE/State Report Cards (`/exams/report-cards`)<br/>• `admit`: Printable Admit Cards (`/exams/admit-cards`) |
| `admin-hr` | HR & Faculty Directory | `/hr` | • `staff`: Faculty Profiles & KYC (`/hr`)<br/>• `payroll`: EPFO/ESIC Payroll & ECR (`/hr/payroll`) |
| `admin-transport` | Transport & Fleet | `/transport` | • `fleet`: Routes, Stops & Vehicles (`/transport`) |
| `admin-library` | Library Catalog | `/library` | • `catalog`: Book Inventory & Circulation (`/library`) |
| `admin-communication` | Broadcast & Notices | `/communication/delivery` | • `delivery`: Multi-channel Dispatch (`/communication/delivery`) |
| `admin-dpdp` | DPDP Privacy Vault | `/dpdp` | • `consent`: Parent Consent & Data Governance (`/dpdp`) |
| `admin-settings` | School Configuration | `/settings` | • `profile`: School Profile & Affiliation (`/settings/school-setup`)<br/>• `grading`: Statutory Grading Blueprints (`/settings/grading`)<br/>• `roles`: Staff Role Permissions (`/settings/roles`) |

---

## 2. Teacher (`TEACHER`)
Host Surface: `/(teacher)/teacher/dashboard`
Total Modules: 6

| Module ID | Module Title | Primary Route (`ctaHref`) | Real Sub-Modules (`id`, `title`, `ctaHref`) |
|---|---|---|---|
| `teacher-dashboard` | Teacher Command Hub | `/teacher/dashboard` | • `home`: Today's Schedule & Quick Actions (`/teacher/dashboard`) |
| `teacher-attendance` | Classroom Attendance | `/teacher/attendance` | • `roll-call`: 4-minute Section Roll Call (`/teacher/attendance`) |
| `teacher-grading` | Examination Gradebook | `/teacher/grading` | • `marks-entry`: Subject Mark Sheet & Co-scholastics (`/teacher/grading`) |
| `teacher-classes` | My Assigned Classes | `/teacher/classes` | • `roster`: Student Roster & Academic Progress (`/teacher/classes`) |
| `teacher-homework` | Homework & Assignments | `/teacher/homework` | • `tasks`: Post Homework & Check Submissions (`/teacher/homework`) |
| `teacher-syllabus` | Syllabus Progress | `/teacher/syllabus` | • `tracker`: Term Curriculum Chapter Coverage (`/teacher/syllabus`) |

---

## 3. Parent / Guardian (`PARENT`)
Host Surfaces: `/(parent)/parent/dashboard`, `/(parent)/portal`
Total Modules: 5

| Module ID | Module Title | Primary Route (`ctaHref`) | Real Sub-Modules (`id`, `title`, `ctaHref`) |
|---|---|---|---|
| `parent-overview` | Ward Dashboard | `/parent/dashboard` | • `day-summary`: Today's Classes, Attendance & Alerts (`/parent/dashboard`) |
| `parent-attendance` | Attendance Calendar | `/parent/attendance` | • `monthly-view`: Present/Absent Log & Leave Status (`/parent/attendance`) |
| `parent-fees` | Fee Dues & Payments | `/parent/fees` | • `pay-dues`: Instant UPI Pay & Tax Invoices (`/parent/fees`) |
| `parent-bus` | School Bus Tracker | `/parent/bus` | • `live-route`: Route Stops & Vehicle Updates (`/parent/bus`) |
| `parent-portal` | Report Cards & Admit Cards | `/portal` | • `cards`: Statutory Term Report Cards (`/portal/report-cards`)<br/>• `admit`: Exam Admit Cards (`/portal/admit-cards`)<br/>• `rights`: DPDP Consent & Privacy Choices (`/portal/rights`) |

---

## 4. Student (`STUDENT`)
Host Surface: `/(student)/student/dashboard`
Total Modules: 5

| Module ID | Module Title | Primary Route (`ctaHref`) | Real Sub-Modules (`id`, `title`, `ctaHref`) |
|---|---|---|---|
| `student-hub` | Student Home Feed | `/student/dashboard` | • `feed`: Today's Timetable & Priority Alerts (`/student/dashboard`) |
| `student-homework` | Homework Center | `/student/homework` | • `tasks`: Pending Assignments & Submissions (`/student/homework`) |
| `student-timetable` | Class Timetable | `/student/timetable` | • `grid`: Weekly Master Schedule & Periods (`/student/timetable`) |
| `student-marks` | Marks & Evaluation | `/student/marks` | • `results`: Assessment Marks & Performance Trends (`/student/marks`) |
| `student-attendance` | My Attendance | `/student/attendance` | • `ratio`: Term Attendance & Working Days (`/student/attendance`) |

---

## 5. Principal (`PRINCIPAL`)
Host Surface: `/(principal)/principal/dashboard`
Total Modules: 6

| Module ID | Module Title | Primary Route (`ctaHref`) | Real Sub-Modules (`id`, `title`, `ctaHref`) |
|---|---|---|---|
| `principal-oversight` | Academic Oversight | `/principal/dashboard` | • `summary`: School Performance & Daily Health (`/principal/dashboard`) |
| `principal-academics` | Curriculum & Classes | `/academics` | • `cohorts`: Grade Levels & Subject Offerings (`/academics`) |
| `principal-attendance` | Attendance Insights | `/attendance` | • `trends`: School-wide Trends & Chronic Absentees (`/attendance`) |
| `principal-exams` | Examination Results | `/exams` | • `approval`: Moderation & Board Result Publishing (`/exams`) |
| `principal-staff` | Teacher Appraisals | `/hr` | • `allocations`: Staff Workload & Subject Specialization (`/hr`) |
| `principal-finance` | Finance Oversight | `/school/due-fees` | • `dues`: Outstanding Term Dues (`/school/due-fees`)<br/>• `concessions`: Concession Approvals (`/school/accounting/reports/concessions`) |

---

## 6. Accountant (`ACCOUNTANT`)
Host Surface: `/(accountant)/school/fees-dashboard`
Total Modules: 5

| Module ID | Module Title | Primary Route (`ctaHref`) | Real Sub-Modules (`id`, `title`, `ctaHref`) |
|---|---|---|---|
| `accountant-hub` | Finance Hub | `/school/fees-dashboard` | • `overview`: Daily Collections vs Outstanding Targets (`/school/fees-dashboard`) |
| `accountant-collect` | Counter Fee Collection | `/school/collect-fees` | • `receipts`: Fast Student Lookup, Cash/UPI/Cheque (`/school/collect-fees`) |
| `accountant-dues` | Dues Work List | `/school/due-fees` | • `aging`: Section-wise Arrears & Defaulters (`/school/due-fees`) |
| `accountant-daybook` | Day Book & Cashbook | `/school/transactions` | • `ledger`: Sequenced Transaction Audit Trail (`/school/transactions`) |
| `accountant-reconcile` | Bank Reconciliation (BRS) | `/school/accounts/bank-reconciliation` | • `brs`: Statement Match & Unreconciled Clearance (`/school/accounts/bank-reconciliation`)<br/>• `pricing`: Class Fee Pricing Matrix (`/school/fee-structures`) |

---

## 7. HR & Payroll Manager (`HR_MANAGER`)
Host Surface: `/(hr-manager)/hr/dashboard`
Total Modules: 4

| Module ID | Module Title | Primary Route (`ctaHref`) | Real Sub-Modules (`id`, `title`, `ctaHref`) |
|---|---|---|---|
| `hr-dashboard` | Workforce Command | `/hr/dashboard` | • `metrics`: Faculty Strength, Vacancies & Metrics (`/hr/dashboard`) |
| `hr-directory` | Staff Directory & KYC | `/hr` | • `roster`: Faculty Profiles & Qualifications (`/hr`) |
| `hr-attendance` | Biometric & Leaves | `/attendance` | • `punch`: Daily Biometric Logs & Leave Approvals (`/attendance`) |
| `hr-payroll` | Payroll & Statutory ECR | `/hr/payroll` | • `salary`: Basic, HRA, EPFO & ESIC Remittance (`/hr/payroll`) |

---

## 8. Librarian (`LIBRARIAN`)
Host Surface: `/(librarian)/librarian/dashboard`
Total Modules: 2

| Module ID | Module Title | Primary Route (`ctaHref`) | Real Sub-Modules (`id`, `title`, `ctaHref`) |
|---|---|---|---|
| `librarian-dashboard` | Library Operations | `/librarian/dashboard` | • `stats`: Active Circulations & Due Fines (`/librarian/dashboard`) |
| `librarian-catalog` | Book Circulation | `/library` | • `accession`: Book Inventory, Issues & Returns (`/library`) |

---

## 9. Transport Manager (`TRANSPORT_MANAGER`)
Host Surface: `/(transport-manager)/transport/dashboard`
Total Modules: 2

| Module ID | Module Title | Primary Route (`ctaHref`) | Real Sub-Modules (`id`, `title`, `ctaHref`) |
|---|---|---|---|
| `transport-dashboard` | Fleet Operations | `/transport/dashboard` | • `trips`: Live Trips, Fuel & Route Compliance (`/transport/dashboard`) |
| `transport-routes` | Bus Routes & Stops | `/transport` | • `allocations`: Route Stops, Drivers & Pass Holders (`/transport`) |

---

## 10. Bus Driver (`DRIVER`)
Host Surface: `/(driver)/driver/dashboard`
Total Modules: 2

| Module ID | Module Title | Primary Route (`ctaHref`) | Real Sub-Modules (`id`, `title`, `ctaHref`) |
|---|---|---|---|
| `driver-route` | Route & Navigation | `/driver/dashboard` | • `trip`: Active Stop-by-Stop Run & Students (`/driver/dashboard`) |
| `driver-profile` | Driver Profile | `/driver/profile` | • `license`: Driving License & Assigned Vehicle (`/driver/profile`) |

---

## 11. Platform Super Admin (`SUPER_ADMIN`)
Host Surface: `/(super-admin)/super-admin/dashboard`
Total Modules: 5

| Module ID | Module Title | Primary Route (`ctaHref`) | Real Sub-Modules (`id`, `title`, `ctaHref`) |
|---|---|---|---|
| `sa-dashboard` | Platform Overview | `/super-admin/dashboard` | • `health`: Multi-tenant Health & Real-time Metrics (`/super-admin/dashboard`) |
| `sa-schools` | School Tenant Directory | `/super-admin/schools` | • `tenants`: School Instances & Status Toggles (`/super-admin/schools`)<br/>• `provision`: Unified 8-step Provisioning Wizard (`/super-admin/schools/provision`) |
| `sa-audit` | Platform Audit Trail | `/super-admin/audit` | • `logs`: Immutable Append-Only Audit Log (`/super-admin/audit`) |
| `sa-dpdp` | DPDP Governance | `/super-admin/dpdp` | • `vault`: Cross-tenant DPDP Compliance Records (`/super-admin/dpdp`) |
| `sa-blueprints` | Blueprint Profiles | `/super-admin/templates` | • `standards`: CBSE, ICSE & State Board Templates (`/super-admin/templates`) |
