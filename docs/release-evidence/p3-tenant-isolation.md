# P3-T2: Cross-Tenant Isolation Drill Evidence

**Spec**: `edu-core-production-readiness-verification-p3` v7.0.3  
**Task ID**: `P3-T2`  
**Governing Rule**: Strict Multi-Tenant Data Isolation & Fail-Closed Guard Architecture  
**Executed Against**: Local Stack (PostgreSQL on port 5444)  
**Tenants Under Test**:
- **Tenant A**: Sparkids (`fa22364d-da37-41b7-ba58-aa98da7a3e75`)
- **Tenant B**: Global college (`31f1949c-0ecd-474d-ac31-08fe4a48e98f`)  
**Date**: 2026-10-10  
**Status**: **PASS (All 5 Drills Succeeded + 2 API Vulnerability Patches Applied)**

---

## 1. Executive Summary

A multi-phase cross-tenant attack simulation was executed to verify complete isolation between School A and School B across:
1. **Repository/Database row scoping** (`where: eq(table.schoolId, schoolId)`).
2. **ID parameter tampering**: Accessing Tenant B resources with Tenant A session context.
3. **Dashboard cache namespace isolation**: Prefixing `t:{schoolId}:v1:dashboard_summary` with zero bleed on invalidation.
4. **Finance cache tag isolation**: Tag-based invalidation restricted strictly to caller school.
5. **API route endpoint enforcement**: Cross-tenant requests rejected with HTTP 403 Forbidden.

During the audit, two real cross-tenant security vulnerabilities were discovered and patched:
- `/api/certificates/[id]/download`: Previously allowed any staff member with role `SCHOOL_ADMIN`, `PRINCIPAL`, or `TEACHER` to download certificates across schools without validating that `cert.schoolId === session.user.schoolId`.
- `/api/report-cards/[id]/download`: Previously allowed any staff member to download report cards across schools without validating `reportCard.schoolId === session.user.schoolId`.

Both endpoints now strictly enforce `if (!isSuperAdmin && userSchoolId && record.schoolId !== userSchoolId) return 403 Forbidden`.

---

## 2. Test Setup & Target Data

- **Tenant A ID**: `fa22364d-da37-41b7-ba58-aa98da7a3e75` (Sparkids)
- **Tenant A Student**: ID `92b1cd3a-a863-413f-b752-d4e59afed16a`
- **Tenant B ID**: `31f1949c-0ecd-474d-ac31-08fe4a48e98f` (Global college)
- **Tenant B Student**: ID `078ddec0-76fb-4fd6-bb8f-d100a37551b2`

---

## 3. Drill Results

Execution log from `database/drill_p3_tenant_isolation.ts`:

```text
==================================================================
       P3-T2: Cross-Tenant Isolation Drill (Red-Team Audit)       
==================================================================
[TENANT A] Sparkids (fa22364d-da37-41b7-ba58-aa98da7a3e75)
[TENANT B] Global college (31f1949c-0ecd-474d-ac31-08fe4a48e98f)
Found Student A in School A: ID 92b1cd3a-a863-413f-b752-d4e59afed16a
Found Student B in School B: ID 078ddec0-76fb-4fd6-bb8f-d100a37551b2

[DRILL 1] Verifying Repository-Level Row Scoping...
  PASS: School A returned 1 students, 0 leaks.
  PASS: School B returned 1 students, 0 leaks.

[DRILL 2] Simulating Direct ID Parameter Tampering across Tenant Boundary...
  PASS: Student B query scoped to School A returned null (Fail-Closed).

[DRILL 3] Verifying Dashboard Cache Tenant Isolation...
  Key A: t:fa22364d-da37-41b7-ba58-aa98da7a3e75:v1:dashboard_summary
  Key B: t:31f1949c-0ecd-474d-ac31-08fe4a48e98f:v1:dashboard_summary
  PASS: Dashboard cache demonstrates strict tenant key prefixing and isolated invalidation.

[DRILL 4] Verifying Finance Cache Tag & Key Isolation...
  PASS: Finance cache tags isolate keys strictly to school namespace.

[DRILL 5] Validating API Route Cross-Tenant Guard Logic...
  PASS: API routes correctly enforce 403 Forbidden on cross-tenant attempts.

==================================================================
  ALL DRILLS PASSED: Zero cross-tenant data leakage detected.     
==================================================================
```

---

## 4. Vulnerabilities Remediated

### 1. `frontend/src/app/api/certificates/[id]/download/route.tsx`
- **Flaw**: Allowed any staff member with role `TEACHER` or `SCHOOL_ADMIN` to download student certificates belonging to another school.
- **Fix**: Added tenant check:
  ```ts
  if (!isSuperAdmin && userSchoolId && cert.schoolId !== userSchoolId) {
    return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
  }
  ```

### 2. `frontend/src/app/api/report-cards/[id]/download/route.tsx`
- **Flaw**: Allowed any staff member with role `TEACHER` or `SCHOOL_ADMIN` to download student report cards belonging to another school.
- **Fix**: Added tenant check:
  ```ts
  if (!isSuperAdmin && userSchoolId && reportCard.schoolId !== userSchoolId) {
    return NextResponse.json({ error: "Forbidden: cross-tenant access denied" }, { status: 403 });
  }
  ```

---

## 5. Sign-Off

- **Constraint**: Zero cross-tenant leakage across database, cache, and HTTP routes.
- **Auditor**: Antigravity Automated Verification Engine
- **Verdict**: **P3-T2 PASS**
