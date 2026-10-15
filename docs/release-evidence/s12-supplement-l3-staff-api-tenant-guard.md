# Sprint S12.1 Layer 3: Staff Exam Results API Tenant Guard Evidence

- **Specification**: `edu-core-s12-supplemental-security-and-release-closure` (v12.1.0)
- **Defect Closed**: `SEC-API-003` (P0: Staff exam-results API checked `exam.schoolId !== userSchoolId` only when `userSchoolId` was truthy, allowing missing tenant context to bypass tenant comparison)
- **Target File**: `frontend/src/app/api/staff/exam-results/[examId]/route.ts`
- **Audited & Hardened Files**:
  - `frontend/src/app/api/report-cards/generate-bulk/route.ts`
  - `frontend/src/app/api/report-cards/[id]/download/route.tsx`
  - `frontend/src/app/api/certificates/[id]/download/route.tsx`
  - `frontend/src/app/api/razorpay/order/route.ts`
  - `frontend/src/app/api/razorpay/verify/route.ts`
- **Date**: 2026-10-15
- **Status**: CLOSED & VERIFIED (PASS)

---

## 1. Vulnerability Analysis & Remediation

### 1.1 Root Cause
In `frontend/src/app/api/staff/exam-results/[examId]/route.ts`, the check was:
```ts
if (!exam || (!isSuperAdmin && userSchoolId && exam.schoolId !== userSchoolId))
```
If a session lacked `schoolId` (e.g. malformed JWT or un-scoped context) while presenting an authorized role like `TEACHER` or `SCHOOL_ADMIN`, `userSchoolId && ...` evaluated to `false`. The endpoint loaded the exam globally without tenant scoping, permitting cross-tenant access.

### 1.2 Additive Fail-Closed Remediation
1. **Mandatory Tenant Context**:
   ```ts
   if (!isSuperAdmin && (!userSchoolId || typeof userSchoolId !== "string")) {
     return NextResponse.json(
       { error: "Forbidden: tenant school scope required for staff examination access" },
       { status: 403 },
     );
   }
   ```
2. **Simultaneous Database Scoping**:
   The exam query is scoped directly by `schoolId` at query time:
   ```ts
   const examConditions = [eq(exams.id, params.examId)];
   if (!isSuperAdmin) {
     examConditions.push(eq(exams.schoolId, userSchoolId));
   }
   const exam = await db.query.exams.findFirst({
     where: and(...examConditions),
   });
   ```
3. **Zero Cross-Tenant Disclosure & Audit**:
   Missing or foreign exams return a uniform HTTP 404 (`{ error: "Exam not found" }`). When a cross-tenant probe occurs, an immutable entry is logged to `audit_logs` (`purposeId: "cross_tenant_violation"`).
4. **Referenced Entity Consistency**:
   Marks, students, and subjects are queried with explicit `effectiveSchoolId = exam.schoolId` filters, guaranteeing no foreign-tenant student or subject data can be returned.
5. **Systemic Audit Across APIs**:
   Identical permissive conditionals (`!isSuperAdmin && userSchoolId && ...`) were found and corrected in `generate-bulk/route.ts`, report card download route, certificate download route, and Razorpay payment order/verify routes.

---

## 2. Empirical Test Results

### Test Suite: `frontend/src/app/api/staff/exam-results/[examId]/__tests__/route.test.ts`
- **Tests**: 6 passed, 0 failed
- **Execution Date**: 2026-10-15

| Test Case | Description | HTTP Status | Verdict |
| :--- | :--- | :---: | :---: |
| 3.1 | Unauthenticated request returns 401 Unauthorized | 401 | **PASS** |
| 3.2 | Unauthorized role (e.g. STUDENT) returns 403 Forbidden | 403 | **PASS** |
| 3.3 | Authenticated non-SUPER_ADMIN with missing schoolId is denied | 403 | **PASS** |
| 3.4 | School A admin querying School B exam returns uniform 404 (zero disclosure) | 404 | **PASS** |
| 3.5 | School A admin querying School A exam returns exam results & marks | 200 | **PASS** |
| 3.6 | SUPER_ADMIN queries across schools via explicit administrative path | 200 | **PASS** |

### Test Suite: `backend/src/lib/__tests__/examDataIsolation.test.ts`
- **Tests**: 12 passed, 0 failed
- **Execution Date**: 2026-10-15
- Surface 2 confirms zero cross-tenant row leakage across Postgres query patterns.

---

## 3. Verification Checksum
- `pnpm --filter @schoolmitra/frontend test -- exam-results` -> PASS (6/6 tests)
- `pnpm --filter @schoolmitra/backend test -- examDataIsolation` -> PASS (12/12 tests)
- Baseline Flaw Status: `SEC-API-003` -> **CLOSED**
