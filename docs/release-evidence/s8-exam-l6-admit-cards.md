# Layer 6 Evidence: Admit Cards UI, Fee Defaulter Gate & Student/Parent Portal

**Sprint**: S8 Offline Examinations (`edu-core-s8-examinations-module-rebuild`)  
**Timestamp**: 2026-10-15T00:35:00+05:30  
**Head Commit Prior to Layer**: `d0fe48f`  
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0`, `SCHOOL-ERP-UIUX-SPEC.md v2.0`, `RULES.md`

---

## 1. Executive Summary

Layer 6 delivers Stage 3 (Hall Tickets, Admit Cards, Fee Defaulter Gates, and Student/Parent Portal Distribution) of the Offline Examination lifecycle:
1. **Administrative Operations Command (`/exams/admit-cards`)**:
   - Examination switcher and class filter dropdowns.
   - Global Hall Ticket settings panel:
     - Download window constraints (`availableFrom`, `availableUntil`).
     - Three-tier Fee Defaulter lock mode (`OFF`, `SOFT`, `HARD`).
     - Fee threshold limit (`feeLockThresholdAmount`).
     - Examination centre, reporting time, and candidate guidelines.
   - Comprehensive student roster with roll number, admission number, student name, current live outstanding balance from `feeInvoices`, and hold state.
   - Interactive Hold Management Modal: Instantly toggle or release individual student hall tickets with custom administrative reasons (`toggleAdmitCardHold`).
   - Role-Module Access Control: Guarded by `assertRouteAccess` and RBAC matrix allowing `ACCOUNTANT`, `SUPER_ADMIN`, `SCHOOL_ADMIN`, and `PRINCIPAL`.
2. **Student & Parent Portal Integration (`/portal/admit-cards`)**:
   - Seamless horizontal pill navigation tabs across Fees, Report Cards, Admit Cards, Consent, Documents, and Subject Rights.
   - Full support for multi-child parent accounts and direct student accounts with fail-closed access checks and DPDP audit logging.
   - Automated Three-Tier Gate Verification:
     - **Window Gate**: Prevents premature or post-deadline downloads with precise date messaging.
     - **Administrative Hold Gate**: Displays administrative withhold notification and reason.
     - **Fee Defaulter Gate**:
       - `OFF`: Unrestricted download.
       - `SOFT`: Amber dues warning banner displaying pending amount, permitting hall ticket generation.
       - `HARD`: Enforced gate blocking hall ticket access when balance exceeds threshold.
   - High-fidelity official Admit Card / Hall Ticket with:
     - School masthead, CBSE/State affiliation, and campus location.
     - Student profile and room assignment.
     - Examination timetable table with dates, times, durations, and room assignments.
     - Formal rules of examination.
     - Candidate, Invigilator, and Controller of Examinations signature blocks.
     - Clean `@media print` stylesheet for 1-click printing or PDF generation.

---

## 2. Verification Evidence

- `pnpm type-check` across all 6 packages passes with 0 errors.
- Portal navigation bar updated across `/portal/admit-cards` and `/portal/report-cards`.
