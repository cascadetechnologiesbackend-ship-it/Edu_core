# Sprint S13 — Layer 0: Baseline Verification & Flaw Confirmation

**Sprint ID**: `edu-core-s13-student-lifecycle-convergence-event-backbone`  
**Execution Date**: 2026-10-16  
**Baseline HEAD**: `2287e4d4d0d32cebb20d9f1497cb73f04673b9bb` (`v11.1.0`)  
**Parent Release**: Sprint S12 verdict certified (`0c220659`), security closure sprint (`56661134`), release `v11.1.0`.

---

## 1. Environment & Migration Journal Verification

- **Git HEAD**: `2287e4d4d0d32cebb20d9f1497cb73f04673b9bb` (Verified up-to-date with `origin/main`).
- **Migration Journal**: Verified entries `idx: 40, tag: 0040_exam_integrity_closure` and `idx: 41, tag: 0041_fail_closed_rls` present in `database/src/migrations/meta/_journal.json`.
- **Next Migration Number**: Certified as **`0042`**.
- **Monorepo Baseline Test Suite**:
  - Backend: 47/47 suites passed (349/349 tests, 100% green).
  - Frontend: 22/22 suites passed (155/155 tests, 100% green).
  - Turbo tasks: 4/4 passed cleanly.

---

## 2. Student Creation Entry-Point Junction Matrix

Every student-creation path across the codebase was mapped across all 12 institutional and DPDP lifecycle junctions:

| Junction | Authoritative (`admissions/[id]/actions.ts`) | Ghost Service (`AdmissionsDomainService.ts`) | Directory (`students/actions.ts`) | Direct Import / Scripts |
|---|---|---|---|---|
| **Tenant Scope Enforcement** | Enforced via `requireSchool(ctx)` session | **MISSING**: Application fetched by `id` without `schoolId` filter | Directory search-only (no student creation) | N/A |
| **Person Master Provisioning** | Yes (AES-256 encrypted, HMAC search hash) | Partial (duplicates full name to first & last name) | N/A | `seed.ts` only |
| **Student Profile Creation** | Yes (random `ADM-YYYY-RAND4` number) | Partial (random `ADM-timestamp` number) | N/A | `seed.ts` only |
| **Class History Provisioning** | Yes (`ENROLLED` status) | Yes (`ENROLLED` status) | N/A | `seed.ts` only |
| **Family Members Provisioning** | Yes (Father, Mother, Guardian AES-256) | Incomplete (Father, Mother only) | N/A | `seed.ts` only |
| **Parent User Account & Role** | Yes (provisions `users` + `PARENT` role) | **MISSING**: No parent user created | N/A | `seed.ts` only |
| **Document Migration / Copy** | Yes (copies `admission_documents` to `student_documents`) | **MISSING**: Zero documents copied | N/A | N/A |
| **DPDP Consent Recording** | Flawed (`parentUserId` = admin ID, `127.0.0.1`) | Flawed (`parentUserId` = zero UUID or admin ID) | N/A | N/A |
| **Concessions (RTE / Sibling / Staff)** | Yes (auto-assigns fee concessions) | **MISSING**: No concessions evaluated | N/A | N/A |
| **Fee Structure & Invoices** | Yes (`autoAssignFeeStructuresToStudent`) | **MISSING**: No fees or invoices assigned | N/A | N/A |
| **Subject Enrollments (`student_subject_enrollments`)** | **MISSING**: 0 rows created | **MISSING**: 0 rows created | N/A | N/A |
| **Post-Commit Notification** | Flawed: Synchronous SMS in tx with plaintext password | **MISSING**: Publishes to subscriberless event bus | N/A | N/A |
| **Audit Log Attribution** | Flawed: Hardcodes `127.0.0.1` | **MISSING**: Zero audit logs written | N/A | N/A |

### Audit Findings
1. `frontend/src/app/(admin)/students/actions.ts` provides only `searchStudentsAction`. There is no direct student creation in the students directory.
2. The only two student-creation code paths in the application are `admissions/[id]/actions.ts` and `AdmissionsDomainService.ts`.
3. The ghost `AdmissionsDomainService.ts` is not imported or referenced by any caller in the repository, yet poses an extreme security hazard (tenant-blind, unverified). Per User Decision D1, it will be deleted in Layer 2.

---

## 3. Database Enrollment Coverage Report (Before S13)

Queried live PostgreSQL instance (port 5444):
```sql
SELECT 
  s.school_id,
  sc.name as school_name,
  COUNT(s.id) as total_active_students,
  COUNT(s.id) FILTER (WHERE sse.active_count IS NULL OR sse.active_count = 0) as students_with_zero_enrollments
FROM students s
JOIN schools sc ON sc.id = s.school_id
LEFT JOIN (
  SELECT student_id, COUNT(*) as active_count
  FROM student_subject_enrollments
  WHERE enrollment_status = 'ACTIVE'
  GROUP BY student_id
) sse ON sse.student_id = s.id
WHERE s.is_active = true AND s.deleted_at IS NULL
GROUP BY s.school_id, sc.name;
```

### Empirical Results:
- **`Saraswati Public School`** (`ca7173a3-f4ae-42ce-bc49-788765111d2a`):
  - Total Active Students: **390**
  - Students with Zero Active Subject Enrollments: **390** (100% un-enrolled, invisible to exams after S12!)
- **Duplicate Admission Numbers Check**: **0** duplicate admission numbers found across all schools.
- **Duplicate Application Numbers Check**: **0** duplicate application numbers found across all schools.

---

## 4. Empirical Flaw Confirmation Tests

Committed test suite `backend/src/lib/__tests__/s13FailingCapture.test.ts` executes and confirms:
1. **F2 (Collision Flaw)**: Simulating 500 admissions with `Math.floor(1000 + Math.random() * 9000)` produces multiple collisions.
2. **F3 (Subject Enrollment Flaw)**: A newly created student in pre-S13 code yields `0` rows in `student_subject_enrollments` and `getStudentSubjectEnrollments` returns `[]`.
3. **F4 (Consent Attribution Flaw)**: Pre-S13 consent creation attributes admin ID as consenter, claims `method: 'web_form'`, and records loopback IP `127.0.0.1`.

```
 PASS  src/lib/__tests__/s13FailingCapture.test.ts
  S13 Layer 0 Failing-Capture Tests (Empirical Confirmation of F2, F3, F4)
    ✓ F2: Random 4-digit number generation has severe collision probability across standard annual admissions
    ✓ F3: A student created under pre-S13 enrollment logic has ZERO student_subject_enrollments and is missing from marks entry matrix
    ✓ F4: Pre-S13 consent creation falsifies consent method as web_form and hardcodes 127.0.0.1
```

Layer 0 tasks are complete and verified. Layer 1 (Migration 0042 & Atomic Number Sequences) can proceed.
