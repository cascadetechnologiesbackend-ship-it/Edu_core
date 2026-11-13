# Contextual Guided Tour: Role & Page Anchor Matrix (CT-L0)

> **Governing Specification**: [docs/contextual-tour-spec.json](file:///v:/Cascade/2026/Edu_core/docs/contextual-tour-spec.json)  
> **Status**: Ratified Pre-Flight Matrix for Contextual Coach-Mark Tours across all 11 roles.  
> **Rule BR-CT-2 & Law 2**: Every popup step anchors to a real DOM element marked `data-tour="{anchor-id}"`. Ghost anchors are prohibited and enforced by automated CI tests.

---

## 1. Overview & Paradigm Shift

The tour paradigm transitions from a static, centralized flashcard deck to **in-situ contextual popups**:
- **Contextual Trigger**: When a user enters a module page, a spotlight popup anchors directly to the page's primary buttons, filter controls, or data tables.
- **Game-Style Progression**: Each role has an ordered module progression trail (e.g. *Day One -> Admissions -> Students -> Academics -> Attendance -> Fees*). Completing or skipping a module's steps advances the role's progress trail.
- **Centralized Deck Demotion**: The existing deck component is retained as an **Overview Map & Re-entry Point**, accessible exclusively via the `TutorialLauncherButton`. It no longer auto-opens.
- **Zero New Dependencies**: The coach-mark engine is hand-crafted with standard SVG overlays, `getBoundingClientRect` coordinate clamping, and mobile bottom-sheet fallback.

---

## 2. Master Matrix by Role

### Role 1: School Administrator (`SCHOOL_ADMIN`)
- **Starting High-Frequency Surface**: `/admin/day-one` (Day One Cockpit)
- **Module Trail Sequence** (14 Modules):
  1. `admin-day-one` (`/admin/day-one`)
  2. `admin-admissions` (`/admissions`)
  3. `admin-students` (`/students`)
  4. `admin-academics` (`/academics`)
  5. `admin-attendance` (`/attendance`)
  6. `admin-fees` (`/school/fees-dashboard`)
  7. `admin-accounting` (`/school/accounting/dashboard`)
  8. `admin-exams` (`/exams/dashboard`)
  9. `admin-hr` (`/hr`)
  10. `admin-transport` (`/transport`)
  11. `admin-library` (`/library`)
  12. `admin-communication` (`/communication/delivery`)
  13. `admin-dpdp` (`/dpdp`)
  14. `admin-settings` (`/settings/school-setup`)

| Page Route | Step # | Anchor ID (`data-tour`) | Anchored Control | One-Line Explanatory Copy | Instrumentation Needed |
|---|---|---|---|---|---|
| `/admin/day-one` | 1 | `day-one-readiness-strip` | Readiness Progress Strip | Track your 8 essential Day One operational milestones before school opens. | Yes |
| `/admin/day-one` | 2 | `day-one-checks-grid` | 8 Database Readiness Checks | Live diagnostics verifying academic year, classes, fee heads, staff, and parent claims. | Yes |
| `/admin/day-one` | 3 | `day-one-metric-badge` | Onboarding Duration Badge | First-party readout measuring time from registration to Day One readiness. | Yes |
| `/admissions` | 1 | `admissions-new-btn` | + New Admission Button | Enrol a new student with statutory quota rules, Aadhaar encryption, and parent KYC. | Yes |
| `/admissions` | 2 | `admissions-rte-tracker` | RTE 25% Quota Tracker | Monitor mandatory Right to Education quotas and compliance status live. | Yes |
| `/admissions` | 3 | `admissions-table` | Applications Register | Review submitted applications, verify documents, and assign admission numbers. | Yes |
| `/students` | 1 | `students-search-input` | Search Name / Admission # | Instantly search any student across all classes by name or admission number. | Yes |
| `/students` | 2 | `students-class-filter` | Class & Section Filter | Scope directory view to a specific grade level or active section. | Yes |
| `/students` | 3 | `students-list-table` | Student Records Table | Comprehensive student roster with emergency contacts, blood group, and claim status. | Yes |
| `/academics` | 1 | `academics-new-class-btn` | + New Class Button | Configure new grade levels, sections, class teachers, and student capacities. | Yes |
| `/academics` | 2 | `academics-hub-tabs` | Academic Spokes Nav | Seamlessly switch between Classes, Timetable, Curriculum, and Staff Allocations. | Yes |
| `/academics` | 3 | `academics-class-grid` | Grade Levels Grid | Inspect active classrooms, sections, and assigned class teachers. | Yes |
| `/attendance` | 1 | `attendance-section-select` | Section & Date Selector | Pick target classroom and calendar date to mark or review roll call. | Yes |
| `/attendance` | 2 | `attendance-roster` | Attendance Roster Grid | Rapid roll call roster with Present, Absent, Late, and Leave toggle buttons. | Yes |
| `/attendance` | 3 | `attendance-submit-btn` | Submit Attendance Button | Save daily attendance in under 4 minutes with instant absentee alerts to parents. | Yes |
| `/school/fees-dashboard` | 1 | `fees-collect-btn` | Counter Collection Button | Open fee collection desk for counter cash, cheque, and POS payments. | Yes |
| `/school/fees-dashboard` | 2 | `fees-collection-kpi` | Realization KPI Card | Real-time demand vs collected fees telemetry and monthly recovery rate. | Yes |
| `/school/fees-dashboard` | 3 | `fees-defaulters-tab` | Overdue Arrears Link | Filter student ledger arrears and dispatch one-tap SMS fee reminders. | Yes |
| `/school/accounting/dashboard` | 1 | `accounting-kpi-row` | Financial Health Cards | Live double-entry ledger summaries: Assets, Liabilities, and Collections. | Yes |
| `/school/accounting/dashboard` | 2 | `accounting-actions-bar` | Vouchers & Day Book Bar | Post journal vouchers, review day books, and verify accounting invariants. | Yes |
| `/school/accounting/dashboard` | 3 | `accounting-recon-link` | Bank Reconciliation Button | Match bank deposits against daily counter cash collection batches. | Yes |
| `/exams/dashboard` | 1 | `exams-stage-stepper` | 6-Stage Lifecycle Nav | Track exam progression: Schedule, Admit Cards, Marks Entry, Lock, and Publishing. | Yes |
| `/exams/dashboard` | 2 | `exams-create-btn` | Schedule Examination Button | Create new term examination timetable with maximum and passing marks. | Yes |
| `/exams/dashboard` | 3 | `exams-admit-cards-link` | Hall Tickets Console Link | Generate official admit cards with fee-clearance access verification. | Yes |
| `/hr` | 1 | `hr-spokes-nav` | Operations Hub Spokes | Navigate Staff Directory, Allocations, Leave Approvals, and Payroll Runs. | Yes |
| `/hr` | 2 | `hr-staff-count-card` | Total Staff Metric | Total faculty and clerk count with departmental breakdown. | Yes |
| `/hr` | 3 | `hr-pending-leaves-card` | Pending Leaves Counter | Review pending teacher absence requests with one-tap approval actions. | Yes |
| `/transport` | 1 | `transport-tabs` | Fleet Spokes Nav | Switch between Vehicles, Bus Routes, Live Tracking, and Bus Passes. | Yes |
| `/transport` | 2 | `transport-live-map` | Fleet Telemetry Mini Map | Live GPS broadcast map displaying active bus coordinates and speeds. | Yes |
| `/transport` | 3 | `transport-add-vehicle-btn` | Register Vehicle Button | Add transport fleet vehicles, licence details, and seating capacity. | Yes |
| `/library` | 1 | `library-search-input` | Book Catalog Search | Search library inventory by ISBN, title, category, or author. | Yes |
| `/library` | 2 | `library-issue-btn` | Issue Book Button | Circulate book copies to students and teachers with automatic due date calculation. | Yes |
| `/library` | 3 | `library-overdue-table` | Overdue Fines Table | Track overdue book returns and collect fine payments into the fee ledger. | Yes |
| `/communication/delivery` | 1 | `comm-broadcast-summary` | Delivery KPI Summary | Inspect SMS, push notification, and email delivery rates and bounce telemetry. | Yes |
| `/communication/delivery` | 2 | `comm-status-table` | Notification Audit Logs | Trace per-student and parent notification dispatch status with timestamp logs. | Yes |
| `/dpdp` | 1 | `dpdp-kpi-row` | Privacy Governance Cards | Statutory Aadhaar encryption rate and DPDP parent consent verification status. | Yes |
| `/dpdp` | 2 | `dpdp-incident-table` | Access Audit Logs | Immutable security logs tracking all personal data access and exports. | Yes |
| `/settings/school-setup` | 1 | `settings-board-info` | School Identity & Board Card | Verify school affiliation board, registration codes, and academic calendar. | Yes |
| `/settings/school-setup` | 2 | `settings-save-btn` | Save Configuration Button | Update institutional profile, address, and official school branding. | Yes |

---

### Role 2: Teacher (`TEACHER`)
- **Starting High-Frequency Surface**: `/teacher/attendance`
- **Module Trail Sequence** (6 Modules):
  1. `teacher-attendance` (`/teacher/attendance`)
  2. `teacher-homework` (`/teacher/homework`)
  3. `teacher-grading` (`/teacher/grading`)
  4. `teacher-classes` (`/teacher/classes`)
  5. `teacher-home` (`/teacher/dashboard`)
  6. `teacher-leaves` (`/teacher/leaves`)

| Page Route | Step # | Anchor ID (`data-tour`) | Anchored Control | One-Line Explanatory Copy | Instrumentation Needed |
|---|---|---|---|---|---|
| `/teacher/attendance` | 1 | `teacher-attendance-header` | Section & Date Header | Confirm your active classroom period and attendance date. | Yes |
| `/teacher/attendance` | 2 | `teacher-attendance-roster` | Roll Call Matrix | Fast touch attendance list with present, absent, and late toggles. | Yes |
| `/teacher/attendance` | 3 | `teacher-attendance-save-btn` | Save Roll Call Button | Submit morning attendance in under 4 minutes with instant parent notices. | Yes |
| `/teacher/homework` | 1 | `teacher-homework-post-btn` | + Post Homework Button | Create homework tasks with subject tags, descriptions, and submission deadlines. | Yes |
| `/teacher/homework` | 2 | `teacher-homework-list` | Active Homework Cards | View posted assignments and track submission rates per section. | Yes |
| `/teacher/homework` | 3 | `teacher-homework-roster-btn` | Submission Roster Button | Review student uploaded homework solutions and mark completion status. | Yes |
| `/teacher/grading` | 1 | `teacher-grading-class-select` | Class & Exam Selector | Choose examination and subject to open student marks entry matrix. | Yes |
| `/teacher/grading` | 2 | `teacher-grading-score-table` | Marks Entry Grid | Enter theory and practical marks with automatic validation against max marks. | Yes |
| `/teacher/grading` | 3 | `teacher-grading-lock-btn` | Finalize & Lock Marks | Lock marks to prevent tampering and send for report card compilation. | Yes |
| `/teacher/classes` | 1 | `teacher-classes-list` | Assigned Classrooms | View all class sections where you are appointed as class or subject teacher. | Yes |
| `/teacher/classes` | 2 | `teacher-classes-students` | Student Roster Link | Access student roll numbers, attendance rates, and guardian phone numbers. | Yes |
| `/teacher/dashboard` | 1 | `teacher-today-periods` | Today's Teaching Schedule | See your daily timetable periods, classroom locations, and substitutions. | Yes |
| `/teacher/dashboard` | 2 | `teacher-quick-actions` | Rapid Period Actions | Quick buttons for roll call and homework right from your podium view. | Yes |
| `/teacher/leaves` | 1 | `teacher-leave-balance` | Leave Quota Card | View remaining casual, medical, and earned leave balances. | Yes |
| `/teacher/leaves` | 2 | `teacher-leave-apply-btn` | Apply for Leave Button | Submit absence requests with dates, reason, and substitute teacher preferences. | Yes |

---

### Role 3: School Principal (`PRINCIPAL`)
- **Starting High-Frequency Surface**: `/principal/dashboard`
- **Module Trail Sequence** (6 Modules):
  1. `principal-home` (`/principal/dashboard`)
  2. `principal-academics` (`/academics`)
  3. `principal-attendance` (`/attendance`)
  4. `principal-exams` (`/exams/dashboard`)
  5. `principal-finance` (`/school/fees-dashboard`)
  6. `principal-school-setup` (`/settings/school-setup`)

| Page Route | Step # | Anchor ID (`data-tour`) | Anchored Control | One-Line Explanatory Copy | Instrumentation Needed |
|---|---|---|---|---|---|
| `/principal/dashboard` | 1 | `principal-kpi-summary` | Executive Telemetry Cards | Truthful overview of student attendance, teacher coverage, and fee pace. | Yes |
| `/principal/dashboard` | 2 | `principal-approvals-queue` | Pending Approvals Queue | Review marks lock requests, teacher leaves, and statutory exceptions. | Yes |
| `/academics` | 1 | `principal-classes-overview` | Grade Structure Overview | Canonical class structure, student strength, and faculty allocations. | Yes |
| `/academics` | 2 | `principal-timetable-link` | Master Timetable Link | Audit school-wide period schedules and teacher workload distribution. | Yes |
| `/attendance` | 1 | `principal-attendance-metrics` | School Attendance Benchmark | Monitor school attendance against the 85% statutory board requirement. | Yes |
| `/exams/dashboard` | 1 | `principal-exams-lifecycle` | Examination Milestones | Track timetable publishing, question paper setup, and report card releases. | Yes |
| `/school/fees-dashboard` | 1 | `principal-fee-collection-trend` | Fee Realization Trend | Monitor fee demand recovery rate and approved scholarship concessions. | Yes |
| `/settings/school-setup` | 1 | `principal-affiliation-card` | Board Affiliation Profile | Institutional affiliation number, board matrix, and school metadata. | Yes |

---

### Role 4: Accountant (`ACCOUNTANT`)
- **Starting High-Frequency Surface**: `/school/collect-fees`
- **Module Trail Sequence** (5 Modules):
  1. `accountant-collect` (`/school/collect-fees`)
  2. `accountant-defaulters` (`/school/due-fees`)
  3. `accountant-home` (`/school/fees-dashboard`)
  4. `accountant-concessions` (`/school/accounting/reports/concessions`)
  5. `accountant-bank-recon` (`/school/accounts/bank-reconciliation`)

| Page Route | Step # | Anchor ID (`data-tour`) | Anchored Control | One-Line Explanatory Copy | Instrumentation Needed |
|---|---|---|---|---|---|
| `/school/collect-fees` | 1 | `accountant-student-search` | Student Lookup Input | Rapidly find student by admission number or name to pull pending dues. | Yes |
| `/school/collect-fees` | 2 | `accountant-payment-modes` | Mode Selector (Cash/UPI/POS) | Choose collection channel and enter cheque/reference transaction ID. | Yes |
| `/school/collect-fees` | 3 | `accountant-record-btn` | Record & Print Receipt Button | Post collection atomically and print GST/statutory thermal fee receipt. | Yes |
| `/school/due-fees` | 1 | `accountant-defaulter-filters` | Arrears Aging Filter | Filter overdue student balances by class, month, and amount threshold. | Yes |
| `/school/due-fees` | 2 | `accountant-reminder-btn` | 1-Click Reminder Trigger | Send automated SMS payment reminders with direct online payment link. | Yes |
| `/school/fees-dashboard` | 1 | `accountant-today-collection` | Daily Cash Drawer Card | Real-time counter cash reconciled against payment gateway bank deposits. | Yes |
| `/school/fees-dashboard` | 2 | `accountant-spokes-tabs` | Accounting Hub Spokes | Jump directly to Fee Heads, Structure Mapping, Refunds, and Audit Logs. | Yes |
| `/school/accounting/reports/concessions` | 1 | `accountant-concession-table` | Concession Register | Audit sibling discounts, merit scholarships, and RTE 25% waiver ledger. | Yes |
| `/school/accounts/bank-reconciliation` | 1 | `accountant-bank-selector` | School Bank Account Picker | Select active school bank account for statement clearance matching. | Yes |
| `/school/accounts/bank-reconciliation` | 2 | `accountant-recon-table` | Batch Reconciliation Table | Reconcile counter collection cash batches with official bank bank slips. | Yes |

---

### Role 5: HR Manager (`HR_MANAGER`)
- **Starting High-Frequency Surface**: `/hr?tab=overview`
- **Module Trail Sequence** (4 Modules):
  1. `hr-overview` (`/hr?tab=overview`)
  2. `hr-staff-directory` (`/hr?tab=directory`)
  3. `hr-leave-approvals` (`/hr?tab=leaves`)
  4. `hr-payroll-runs` (`/hr?tab=payroll`)

| Page Route | Step # | Anchor ID (`data-tour`) | Anchored Control | One-Line Explanatory Copy | Instrumentation Needed |
|---|---|---|---|---|---|
| `/hr` | 1 | `hr-stats-grid` | HR Operations KPI Grid | Active faculty headcount, department distribution, and staff attendance. | Yes |
| `/hr` | 2 | `hr-staff-table` | Staff Directory Table | Faculty database with qualifications, designations, and biometric codes. | Yes |
| `/hr` | 3 | `hr-leave-requests-list` | Leave Applications Queue | Review teacher leave applications with one-click approve/reject actions. | Yes |
| `/hr` | 4 | `hr-payroll-month-select` | Monthly Payroll Generator | Generate monthly salary slips, statutory PF/ESI deductions, and bank lists. | Yes |

---

### Role 6: Librarian (`LIBRARIAN`) - *Short Honest Tour*
- **Starting High-Frequency Surface**: `/librarian/dashboard`
- **Module Trail Sequence** (2 Modules):
  1. `librarian-home` (`/librarian/dashboard`)
  2. `librarian-catalog` (`/library`)

| Page Route | Step # | Anchor ID (`data-tour`) | Anchored Control | One-Line Explanatory Copy | Instrumentation Needed |
|---|---|---|---|---|---|
| `/librarian/dashboard` | 1 | `librarian-metrics-row` | Circulation Metrics Row | Live total book copies, active loans, and overdue fines summary. | Yes |
| `/librarian/dashboard` | 2 | `librarian-catalog-btn` | Open Catalog Button | Fast shortcut to access the master inventory catalog and issue desk. | Yes |
| `/library` | 1 | `librarian-catalog-search` | ISBN & Title Search Bar | Search books by title, ISBN, subject, or rack shelf location. | Yes |
| `/library` | 2 | `librarian-issue-btn` | Quick Issue / Return Desk | Check-out book copies to students and teachers with automatic due dates. | Yes |

---

### Role 7: Transport Manager (`TRANSPORT_MANAGER`) - *Short Honest Tour*
- **Starting High-Frequency Surface**: `/transport/dashboard`
- **Module Trail Sequence** (2 Modules):
  1. `transport-home` (`/transport/dashboard`)
  2. `transport-fleet` (`/transport`)

| Page Route | Step # | Anchor ID (`data-tour`) | Anchored Control | One-Line Explanatory Copy | Instrumentation Needed |
|---|---|---|---|---|---|
| `/transport/dashboard` | 1 | `transport-manager-kpi` | Fleet Health Cards | Active buses on route, GPS signal health, and student pass allocations. | Yes |
| `/transport/dashboard` | 2 | `transport-manager-fleet-btn` | Open Fleet Manager Button | Jump straight to fleet vehicle registrations and transit route setup. | Yes |
| `/transport` | 1 | `transport-routes-list` | Transit Routes Directory | View bus routes with ordered stop sequences and assigned drivers. | Yes |
| `/transport` | 2 | `transport-live-tracking` | Fleet Live Map View | Live tracking map showing real-time GPS pings from driver apps. | Yes |

---

### Role 8: Transit Driver (`DRIVER`) - *Short Honest Tour*
- **Starting High-Frequency Surface**: `/driver/dashboard`
- **Module Trail Sequence** (2 Modules):
  1. `driver-home` (`/driver/dashboard`)
  2. `driver-profile` (`/driver/profile`)

| Page Route | Step # | Anchor ID (`data-tour`) | Anchored Control | One-Line Explanatory Copy | Instrumentation Needed |
|---|---|---|---|---|---|
| `/driver/dashboard` | 1 | `driver-trip-toggle` | Trip In-Progress Toggle | Tap to start or end trip and broadcast live bus GPS coordinates to parents. | Yes |
| `/driver/dashboard` | 2 | `driver-live-map` | Mini Leaflet Map | High-contrast route map showing your live bus location and vehicle speed. | Yes |
| `/driver/dashboard` | 3 | `driver-stops-checklist` | Bus Stops Checklist | Clear bus stops sequentially as students embark or disembark. | Yes |
| `/driver/profile` | 1 | `driver-licence-card` | Licence & Vehicle Details | View your verified commercial driving licence and allocated transit bus. | Yes |

---

### Role 9: Parent (`PARENT`)
- **Starting High-Frequency Surface**: `/parent/dashboard`
- **Module Trail Sequence** (5 Modules):
  1. `parent-feed` (`/parent/dashboard`)
  2. `parent-fees` (`/portal` or `/parent/fees`)
  3. `parent-transit` (`/parent/bus`)
  4. `parent-attendance` (`/parent/attendance`)
  5. `parent-profile` (`/parent/profile`)

| Page Route | Step # | Anchor ID (`data-tour`) | Anchored Control | One-Line Explanatory Copy | Instrumentation Needed |
|---|---|---|---|---|---|
| `/parent/dashboard` | 1 | `parent-identity-header` | Child Ward Selector | Switch between children and view real-time monthly attendance rate. | Yes |
| `/parent/dashboard` | 2 | `parent-today-strip` | Today's Action Strip | Glances today's priorities: urgent fee dues, homework, and notices. | Yes |
| `/parent/dashboard` | 3 | `parent-feed-cards` | Chronological Feed Cards | Event cards with one-tap actions for fees, homework, and permissions. | Yes |
| `/portal` | 1 | `parent-due-invoice` | Fee Due Invoice Card | Outstanding fee invoice breakdown with tuition, transport, and term fees. | Yes |
| `/portal` | 2 | `parent-pay-btn` | Instant Pay Button | Pay securely in under 90 seconds via UPI, debit card, or NetBanking. | Yes |
| `/parent/bus` | 1 | `parent-bus-eta-card` | Bus Live Arrival ETA | Live countdown showing estimated arrival time at your child's pickup stop. | Yes |
| `/parent/bus` | 2 | `parent-bus-live-map` | Real-time GPS Map | Track your child's school bus location live on the route map. | Yes |
| `/parent/attendance` | 1 | `parent-attendance-calendar` | Monthly Attendance Calendar | Inspect daily present, absent, and holiday marks with monthly totals. | Yes |
| `/parent/profile` | 1 | `parent-ward-profile` | Student Profile & Vault | Official admission number, class teacher contact, and school records. | Yes |

---

### Role 10: Student (`STUDENT`)
- **Starting High-Frequency Surface**: `/student/dashboard`
- **Module Trail Sequence** (5 Modules):
  1. `student-feed` (`/student/dashboard`)
  2. `student-homework` (`/student/homework`)
  3. `student-timetable` (`/student/timetable`)
  4. `student-marks` (`/student/marks`)
  5. `student-fees` (`/student/fees`)

| Page Route | Step # | Anchor ID (`data-tour`) | Anchored Control | One-Line Explanatory Copy | Instrumentation Needed |
|---|---|---|---|---|---|
| `/student/dashboard` | 1 | `student-identity-bar` | Student Identity Header | Your class section, roll number, and 30-day attendance streak. | Yes |
| `/student/dashboard` | 2 | `student-feed-stream` | Daily Learning Stream | Today's homework assignments, classwork notes, and school notices. | Yes |
| `/student/homework` | 1 | `student-hw-pending-list` | Pending Assignments | Active homework list with subject tags and due dates. | Yes |
| `/student/homework` | 2 | `student-hw-submit-flow` | Submit Homework Button | Submit homework text or photo attachments directly to your teacher. | Yes |
| `/student/timetable` | 1 | `student-timetable-grid` | Weekly Timetable Matrix | Your complete weekly class timetable with periods, subjects, and rooms. | Yes |
| `/student/marks` | 1 | `student-marks-term-select` | Exam Term Selector | Review unit test and term examination scores, grades, and teacher remarks. | Yes |
| `/student/fees` | 1 | `student-fee-balance` | Fee Receipts & Status | Verify fee clearance status and download official paid fee receipts. | Yes |

---

### Role 11: Platform Operator (`SUPER_ADMIN`)
- **Starting High-Frequency Surface**: `/super-admin/dashboard`
- **Module Trail Sequence** (5 Modules):
  1. `super-admin-command` (`/super-admin/dashboard`)
  2. `super-admin-tenants` (`/super-admin/schools`)
  3. `super-admin-provisioning` (`/super-admin/schools/provision`)
  4. `super-admin-telemetry` (`/super-admin/dashboard`)
  5. `super-admin-dpdp` (`/dpdp`)

| Page Route | Step # | Anchor ID (`data-tour`) | Anchored Control | One-Line Explanatory Copy | Instrumentation Needed |
|---|---|---|---|---|---|
| `/super-admin/dashboard` | 1 | `super-admin-hero` | Operator Mode Hero | Platform command center with multi-tenant governance controls. | Yes |
| `/super-admin/dashboard` | 2 | `super-admin-kpi-grid` | Multi-Tenant Metrics Grid | Live platform aggregates: total schools, enrolled students, and staff. | Yes |
| `/super-admin/dashboard` | 3 | `super-admin-telemetry-panel` | Live AWS Telemetry Panel | Real-time ECS compute, RDS database connections, and S3 telemetry. | Yes |
| `/super-admin/schools` | 1 | `super-admin-provision-btn` | + Provision New School | Launch the unified 8-step school tenant provisioning wizard. | Yes |
| `/super-admin/schools` | 2 | `super-admin-schools-table` | School Tenants Directory | Master tenant directory with tenant status, domain, and support actions. | Yes |
| `/super-admin/schools/provision` | 1 | `super-admin-wizard-stepper` | 8-Step Provisioning Stepper | Guided statutory board, academic year, and administrator account creation. | Yes |
| `/super-admin/schools/provision` | 2 | `super-admin-wizard-content` | Step Form Configuration | Comprehensive step configuration with automatic curriculum matrix binding. | Yes |
| `/dpdp` | 1 | `super-admin-audit-log` | Platform Privacy Audit Logs | Multi-tenant audit logs ensuring DPDP 2023 compliance across all schools. | Yes |

---

## 3. Review Gate & Operator Approval Checkpoint

- **Role Coverage**: All 11 roles mapped (`SCHOOL_ADMIN`, `TEACHER`, `PRINCIPAL`, `ACCOUNTANT`, `HR_MANAGER`, `LIBRARIAN`, `TRANSPORT_MANAGER`, `DRIVER`, `PARENT`, `STUDENT`, `SUPER_ADMIN`).
- **Honest Scoping**: Thin roles (`DRIVER`, `LIBRARIAN`, `TRANSPORT_MANAGER`) are scoped honestly to 2 modules without padding or phantom controls.
- **Progress Trails**: Every role starts at its highest-frequency daily job (Admin at Day One Cockpit, Teacher at Roll Call, Accountant at Fee Counter, Parent at Feed, Driver at Route).
- **Binding Contract**: Every anchor ID defined in this table will be placed as `data-tour="{anchor-id}"` in the target page component and asserted by the automated CI anchor-truth test (`routeTruth.test.ts` / `anchorTruth.test.ts`).
