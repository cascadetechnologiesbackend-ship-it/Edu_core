# SchoolMitra Journey Map & D0 Baseline Audit

> **Governing Charter**: [docs/product-destination-charter.json](file:///v:/Cascade/2026/Edu_core/docs/product-destination-charter.json)  
> **Status**: Baseline audit completed in Phase D0. All 10 journeys evaluated against running codebase.

---

## Journey Audit Summary Matrix

| ID | Journey Name | Primary Persona(s) | Baseline Status | Existing Code Surfaces | Critical Gaps & Missing Finished State |
|---|---|---|---|---|---|
| **J1** | **Fee Day** | `office_admin`, `accountant` | **PARTIAL** | `/(admin)/fees`<br/>`/(admin)/school/collect-fees`<br/>`/(admin)/school/due-fees`<br/>`/(admin)/school/accounts/bank-reconciliation` | Fragmented across 4 sub-routes. Missing a unified daily closing surface showing *"Today's collection Rs X, reconciled Rs Y, N defaulters queued for reminder — day closed."* |
| **J2** | **Month-End Close** | `accountant` | **PARTIAL** | `/(accountant)/accountant/dashboard`<br/>`/(admin)/school/accounting/*`<br/>`/(admin)/school/accounts/journal-vouchers` | Reports and vouchers exist. Missing a 1-click month-close workflow verifying double-entry invariants, period freezing, and trustee report pack export. |
| **J3** | **The 40-Minute Period** | `teacher` | **PARTIAL** | `/(teacher)/teacher/dashboard`<br/>`/(teacher)/teacher/attendance`<br/>`/(teacher)/teacher/homework` | Separate page hops required. Missing a single podium surface to confirm attendance and post homework in <4 minutes before the bell rings. |
| **J4** | **The Weekly Review** | `principal` | **PARTIAL** | `/(principal)/principal/dashboard`<br/>`backend/src/lib/roleConsoleEngine.ts` | Displays attendance counts and pending locks, but lacks fee realization % and syllabus pace against calendar. Missing 1-level drill and 1-click nudge action. |
| **J5** | **The Parent Loop** | `parent` | **PARTIAL** | `/(parent)/portal`<br/>`/(parent)/parent/fees`<br/>`frontend/src/components/parent/CheckoutButton.tsx` | Functional payment checkout. Missing telemetry instrumenting the 90-second payment target and explicit confirmation screen *"Payment of Rs X confirmed, receipt #Y saved"*. |
| **J6** | **The Homework Cycle** | `student` | **PARTIAL** | `/(student)/student/homework`<br/>`/(teacher)/teacher/grading`<br/>`backend/src/lib/studentEventEngine` | Rich submission & feedback UI built. Missing closed-loop automated walkthrough linking student submission to teacher grading and student feedback assertion. |
| **J7** | **Admission Season** | `office_admin` | **PARTIAL** | `/(admin)/admissions`<br/>`/(admin)/admissions/[id]`<br/>`backend/src/lib/studentLifecycleEngine.ts` | Atomic enrollment engine exists. Missing inquiry capture intake queue, automatic fee structure attachment, roll number allocation, and stuck-applicant queue. |
| **J8** | **Exam Season** | `office_admin`, `teacher` | **PARTIAL** | `/(admin)/exams/*`<br/>`/(teacher)/teacher/grading`<br/>`frontend/src/lib/telemetryRegistry.ts` | Complete database schema and sub-routes. Missing a seasonal overview surface with progress bar and final *"Term [X] results published to N students"* state. |
| **J9** | **Academic Year Rollover** | `office_admin` | **MISSING** | `/(admin)/students/[id]/class-history`<br/>`/(admin)/school/fees-carry-forward` | Only single-student manual promotion exists. Zero school-wide batch rollover interface to promote 900 students, assign sections, carry fee structures, and lock the previous year read-only. |
| **J10** | **School Onboarding** | `super_admin`, `office_admin` | **PARTIAL** | `/onboard`<br/>`/(admin)/school/import-center` | 8-step wizard creates tenant and profile. Drops admin into empty state without piping into staff/student bulk import, timetable upload, and parent claims. |

---

## Detailed Journey Breakdown

### J1: Fee Day
- **Trigger**: Morning fee collection begins or fee due date arrives.
- **Persona**: Office Admin (`office_admin`) & Accountant (`accountant`).
- **Target Experience**:
  1. Open single Fee Day surface showing today's collection target and demand register.
  2. Record counter cash/cheque/POS collections with instant thermal/PDF receipt.
  3. Reconcile online payments (gateway settlement webhooks) against counter cash drawer.
  4. View instant defaulters queue with 1-click SMS/push reminder.
- **Finished State**: Screen reading: *"Today's collection Rs X, reconciled Rs Y, N defaulters queued for reminder — day closed."*
- **Audit Findings**:
  - `/(admin)/school/collect-fees` handles counter fee collection.
  - `/(admin)/school/accounts/bank-reconciliation` handles bank clearing.
  - `/(admin)/school/due-fees` displays arrears.
  - *Gap*: The workflows are uncoordinated across disparate URLs; no single "Fee Day" cockpit exists where the office clerk closes the cash drawer at 3:00 PM.

---

### J2: Month-End Close
- **Trigger**: Last working day of the calendar month.
- **Persona**: Accountant (`accountant`).
- **Target Experience**:
  1. View month-to-date fees, expenses, journal vouchers, and payroll obligations.
  2. Run automated sanity check on double-entry accounting invariants (Assets = Liabilities + Equity, debits match credits).
  3. Close and lock the calendar month against backdated voucher entries.
  4. Generate and download Trustee Report Pack (Balance Sheet, Income & Expenditure, Trial Balance, Collection Efficiency).
- **Finished State**: Screen reading: *"Month of [Month] closed. Invariants: green. Report pack generated."*
- **Audit Findings**:
  - Financial reports exist in `/(admin)/school/accounting/reports/*`.
  - Journal vouchers can be manually posted in `/(admin)/school/accounts/journal-vouchers`.
  - *Gap*: No formal "Close Month" action or period freeze lock exists; reports are computed on the fly with no immutable monthly snapshot for trustees.

---

### J3: The 40-Minute Period
- **Trigger**: Bell rings for Period N.
- **Persona**: Classroom Teacher (`teacher`).
- **Target Experience**:
  1. Teacher arrives at classroom podium with mobile device or tablet.
  2. Opens Period Surface: active class and section are pre-selected based on live timetable.
  3. Marks or confirms attendance in < 4 minutes (default present, tap absentees).
  4. Posts homework with title, brief, and optional photo attachment in 3 taps.
  5. Glances at next period allocation.
- **Finished State**: *"Attendance saved for [Class-Sec]: N/N present. Homework posted to N students. Next: Period X [Room Y]."*
- **Audit Findings**:
  - `/(teacher)/teacher/attendance` allows section attendance submission.
  - `/(teacher)/teacher/homework` allows homework posting.
  - *Gap*: Requires switching between two distinct top-level navigation areas; lacks a single "Active Period" podium interface designed for rapid in-class completion before the bell.

---

### J4: The Weekly Review
- **Trigger**: Monday morning 8:00 AM.
- **Persona**: Principal (`principal`).
- **Target Experience**:
  1. Principal opens dashboard on phone or laptop.
  2. Single card displays three truthful operational figures:
     - **Money**: % fee collected month-to-date vs expected demand.
     - **Attendance**: School-wide student & teacher attendance % this week.
     - **Syllabus Pace**: % of curriculum covered vs academic calendar schedule.
  3. One-level drill down to inspect the single outlier section or teacher.
  4. One immediate action (e.g., send reminder nudge or schedule meeting).
- **Finished State**: *"School status: ON TRACK (or N FLAGS). Action taken: [Nudge sent to Class 9-B]."*
- **Audit Findings**:
  - `/(principal)/principal/dashboard` exists and queries `getPrincipalConsoleMetrics`.
  - *Gap*: Does not calculate syllabus progress against academic calendar; does not aggregate fee realization against expected budget; lacks 1-click nudge action buttons.

---

### J5: The Parent Loop
- **Trigger**: Push notification (fee due, child marked absent, or homework posted) or 90-second tea break.
- **Persona**: Parent (`parent`).
- **Target Experience**:
  1. Parent opens app or taps notification.
  2. If fee is due: one-tap checkout via UPI/card in under 90 seconds, followed by instant receipt download.
  3. If absence alert: confirms child status or submits one-tap leave note.
  4. If homework: views tonight's subjects, assignments, and teacher remarks.
- **Finished State**: *"Payment of Rs X confirmed, receipt #Y saved"* or *"Attendance marked Present. 2 homework items due tomorrow."*
- **Audit Findings**:
  - `/(parent)/portal` renders fee cards, Razorpay integration, and receipts.
  - `/(parent)/parent/attendance` shows attendance history.
  - *Gap*: The 90-second payment timer is uninstrumented; breadcrumbs between `/portal` and `/parent/*` create navigational fragmentation.

---

### J6: The Homework Cycle
- **Trigger**: 9:00 PM evening study time.
- **Persona**: Student (`student`).
- **Target Experience**:
  1. Student opens student companion app.
  2. Views homework due tomorrow sorted by subject.
  3. Uploads or writes submission in 3 taps before deadline.
  4. Teacher grades submission in grading console and adds remarks.
  5. Student views verified score and feedback.
- **Finished State**: *"Submitted: Mathematics - Quadratic Equations at 20:45"* and subsequently *"Graded: 18/20 - 'Excellent step-by-step working'."*
- **Audit Findings**:
  - `/(student)/student/homework` built with offline queue and PII scanning during S1–S7.
  - `/(teacher)/teacher/grading` allows teacher evaluation.
  - *Gap*: Needs an end-to-end automated walkthrough validating the full student-submit to teacher-grade loop with finished state assertions.

---

### J7: Admission Season
- **Trigger**: Admission intake opens or walk-in inquiry arrives at front desk.
- **Persona**: Office Admin (`office_admin`).
- **Target Experience**:
  1. Quick intake: capture applicant details (name, DOB, parent contact, class sought).
  2. Move applicant through visual funnel: Inquiry -> Application -> Document Verification -> Offer -> Fee Paid -> Enrolled.
  3. Atomically assign class, section, monotonic admission number, and default fee structure.
  4. Issue parent claim credentials.
- **Finished State**: *"Admission completed: [Name], Class [X], Roll #[Y], Parent claim sent."*
- **Audit Findings**:
  - `/(admin)/admissions` and `/(admin)/admissions/[id]` display application status.
  - `StudentLifecycleEngine.enrollApplicant` provides atomic database provisioning.
  - *Gap*: Lacks a quick-inquiry intake modal, automatic fee structure attachment, roll number allocation, and stuck-applicant queue.

---

### J8: Exam Season
- **Trigger**: Term examinations approaching.
- **Persona**: Office Admin (`office_admin`) & Teacher (`teacher`).
- **Target Experience**:
  1. Create exam term and publish datesheet.
  2. Generate and distribute hall tickets / admit cards in bulk.
  3. Open teacher marks entry window; monitor submission progress.
  4. Lock marks against unauthorized tampering.
  5. Generate immutable result snapshots and publish report cards.
- **Finished State**: *"Term [X] results published to N students. Report cards ready."*
- **Audit Findings**:
  - Sub-routes exist: `/exams/schedule`, `/exams/marks`, `/exams/admit-cards`, `/exams/report-cards`.
  - Cryptographic result snapshots and holds supported in database schema.
  - *Gap*: Lacks a single unified "Exam Season" cockpit guiding the administrator sequentially through datesheet -> admit cards -> marks locking -> publication.

---

### J9: Academic Year Rollover
- **Trigger**: Academic year concludes (March/April).
- **Persona**: Office Admin (`office_admin`).
- **Target Experience**:
  1. Set up new academic year (dates, term schedules).
  2. Batch promote students (e.g., Class 9-A -> 10-A, with retention exceptions).
  3. Carry forward pending fee arrears into new year opening balances.
  4. Roll over fee structures and assign to promoted cohorts.
  5. Reset class timetables and archive old academic year as read-only.
- **Finished State**: *"Academic year [YYYY-YY] rolled over: N students promoted, N sections formed, year archived."*
- **Audit Findings**:
  - `/(admin)/school/fees-carry-forward` handles fee balance carry forward.
  - Per-student promotion exists in `students/[id]/class-history/actions.ts`.
  - *Gap*: Completely missing a school-wide batch rollover interface. Cannot promote 900 students or archive the previous academic year.

---

### J10: School Onboarding
- **Trigger**: New school contract signed.
- **Persona**: Super Admin (`super_admin`) & Office Admin (`office_admin`).
- **Target Experience**:
  1. Provision school tenant and administrator account.
  2. Define academic year, classes, sections, and subjects.
  3. Bulk import staff and students via standard Excel templates.
  4. Assign fee structures and upload master timetable.
  5. Generate parent and student claim credentials.
- **Finished State**: *"School [Name] ready for Day One: N students, M staff, K sections configured."*
- **Audit Findings**:
  - `/onboard` provides an 8-step wizard for school profile, classes, and admin credentials.
  - `/(admin)/school/import-center` exists for CSV imports.
  - *Gap*: Wizard ends without linking to bulk imports, timetable upload, and claim distribution; admin is deposited into an empty dashboard.

