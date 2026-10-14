# Layer 8 Evidence: Report Card Setups, Immutable Result Snapshots & Revision Versioning

**Sprint**: S8 Offline Examinations (`edu-core-s8-examinations-module-rebuild`)  
**Timestamp**: 2026-10-15T00:54:30+05:30  
**Head Commit Prior to Layer**: `c0a205a`  
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0`, `SCHOOL-ERP-UIUX-SPEC.md v2.0`, `RULES.md`

---

## 1. Executive Summary

Layer 8 delivers Stage 5 (Result Snapshots, Framework Setups, Rank Calculation, and Revision Versioning) of the Offline Examination lifecycle:

1. **Framework Setup Builder (`/exams/report-cards/setups`)**:
   - Allows administrators and principals to configure report card frameworks (`report_card_setups`).
   - Supports multi-exam weightage distributions (e.g. Periodic Test 1 10%, Mid Term 40%, Annual 50%) summing to 100%.
   - Configures grading layouts (`CBSE_STANDARD`, `CBSE_PRIMARY`, `ICSE_STANDARD`, `STATE_BOARD_GENERAL`).
   - Setup list with active toggles and creation timestamp auditing.

2. **Snapshot Generation & Freeze Engine (`generateResultSnapshots`)**:
   - Multi-exam marks aggregation: Resolves marks entries across all exams configured in the setup's weightages.
   - Grade Calculation: Computes subject grades, grade points, percentages, and overall status (`PASSED`, `FAILED`, `COMPARTMENT`).
   - Rank Calculation: Pure deterministic tie-breaking ranking via `rankSnapshots` (scores descending, failed students ranked below passed students, ties share highest rank).
   - Snapshot Versioning: Creates new versions (`version = existing.version + 1`), sets previous snapshot `isCurrent = false` and pointers `supersededById = newSnapshot.id`.
   - Immutable Protection: Backed by PostgreSQL trigger `trg_enforce_result_snapshot_immutability` ensuring frozen payloads, timestamps, and audit trails cannot be altered.

3. **Report Card Operations Center (`/exams/report-cards`)**:
   - Class and setup selector controls.
   - Comprehensive student snapshot roster with version badges (`v1`, `v2`, etc.), total marks, percentages, CBSE grades, division, and rank.
   - Single-student & Batch Report Card Generation Modal: Previewing student scores, scholastic performance, and attendance.
   - Individual Result Holds: Place/remove student result holds with mandatory reason auditing (`result_holds`).
   - Topper Certificate Issuance: Issues verified topper certificates (`issueTopperCertificate`) with secure QR verification hashes and serial numbers.

4. **Backward-Compatible Redirect**:
   - Legacy route `/exams/results` redirects seamlessly to `/exams/report-cards` preserving query parameters.

---

## 2. Verification Evidence

- `pnpm type-check` across all workspace packages (`@schoolmitra/frontend`, `@schoolmitra/backend`, `@schoolmitra/database`, etc.) passed with 0 errors.
- `/exams/results` redirects to `/exams/report-cards`.
- `exactOptionalPropertyTypes: true` fully respected in both server actions and client components.
- Database immutability trigger `trg_enforce_result_snapshot_immutability` verified active on `result_snapshots`.
