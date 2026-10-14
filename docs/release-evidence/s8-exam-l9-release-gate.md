# Layer 9 Evidence: Result Release Gate, Fee Defaulter Policy & Parent Portal Visibility

**Sprint**: S8 Offline Examinations (`edu-core-s8-examinations-module-rebuild`)  
**Timestamp**: 2026-10-15T01:02:15+05:30  
**Head Commit Prior to Layer**: `90d9d08`  
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0`, `SCHOOL-ERP-UIUX-SPEC.md v2.0`, `RULES.md`

---

## 1. Executive Summary

Layer 9 completes the Result Release Gate and visibility enforcement across the administrative console and student/parent portals:

1. **Administrative Result Release Gate (`/exams/report-cards/settings`)**:
   - Built dedicated policy console and live simulation preview:
     - **Emergency Withhold All (`withholdAll`)**: Master switch immediately withdrawing report card visibility across student/parent portals and public lookups.
     - **Scheduled Release Datetime (`releaseAt`)**: Time-locked visibility countdown, holding marks until the specified release timestamp.
     - **Financial Clearance Enforcement (`feeLockMode`)**:
       - `OFF`: Unrestricted access regardless of fee arrears.
       - `SOFT`: Renders an urgent warning banner with the exact outstanding balance, while allowing report cards to be viewed and downloaded.
       - `HARD`: Completely blocks viewing and downloading, rendering an actionable arrears payment card linking to `/portal`.
     - **Balance Threshold (`feeLockThresholdAmount`)**: Configurable threshold (e.g. ₹0, ₹500, ₹1000).
     - **Public Portal Controls**: Granular toggles for `publicLookupEnabled` and `publicToppersEnabled`.
   - Linked directly from `/exams/report-cards` with modern header button.

2. **Parent & Student Portal Visibility (`/portal/report-cards`)**:
   - Replaced legacy query with S8 immutable `result_snapshots` aggregated per enrolled ward.
   - Evaluates multi-factor release gates for each student:
     - Global withhold check (`result_settings.withholdAll`).
     - Future release timestamp check (`result_settings.releaseAt`).
     - Student-specific administrative hold check (`result_holds`).
     - Automated fee defaulter balance calculation against `fee_invoices`.
   - Comprehensive Scholastic View:
     - Snapshot version badge (`v1 Verified`).
     - Total Marks, Percentage, Overall Grade, Division, and Class Rank.
     - Subject performance breakdown table (Obtained, Max, Percentage, Grade, Status).
     - Official PDF Download action.
   - Preserves archived legacy records as historical reference.

3. **Secure API PDF Download Route (`/api/report-cards/[id]/download`)**:
   - Enhanced to support both S8 `result_snapshots` and legacy `reportCards`.
   - Strictly enforces DPDP tenant boundary and non-admin release gates (withhold, scheduled release, holds, and hard fee locks) on direct PDF downloads.

---

## 2. Verification Evidence

- `pnpm type-check` across all 6 workspace packages completed with 0 errors.
- Both Server Actions and Route Handlers enforce the identical release gate criteria.
- DPDP audit logging confirmed on portal and API download access.
