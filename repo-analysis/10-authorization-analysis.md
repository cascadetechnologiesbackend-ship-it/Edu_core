# 10 — Authorization Analysis
## SchoolMitra ERP

---

## Authorization Architecture

SchoolMitra uses a Role-Based Access Control (RBAC) model with 11 roles and two enforcement layers:

1. **tRPC Middleware** — `withRole(allowedRoles)` enforced in tRPC procedure builders
2. **Server Action Guards** — `requireAuth(allowedRoles)` called explicitly in each Server Action

**Critical Gap:** The tRPC middleware chain applies automatically to tRPC procedures. Server Actions require explicit `requireAuth()` calls — omission is silent and creates unprotected endpoints.

---

## Role Hierarchy

```
SUPER_ADMIN (100)     — Platform-wide access, all school tenants
SCHOOL_ADMIN (90)     — Full school control
PRINCIPAL (80)        — Academic oversight, teacher management
HR_MANAGER (70)       — Staff, payroll, leave
ACCOUNTANT (60)       — Fees, financial reports
TEACHER (50)          — Attendance, grading, assignments
LIBRARIAN (40)        — Book catalog, issues, fines
TRANSPORT_MANAGER (30)— Bus routes, allocations
DRIVER (20)           — Route view, GPS broadcast
PARENT (10)           — Child data, fee portal, bus tracker
STUDENT (0)           — Own data only
```

---

## tRPC Authorization Matrix

| Procedure Builder | Allowed Roles | Rate Limiting |
|-------------------|--------------|---------------|
| `publicProcedure` | ALL (anonymous) | YES |
| `protectedProcedure` | Any authenticated user | YES |
| `adminProcedure` | SUPER_ADMIN, SCHOOL_ADMIN | YES |
| `principalProcedure` | SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL | YES |
| `hrProcedure` | SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, HR_MANAGER | YES |
| `accountantProcedure` | SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, ACCOUNTANT | YES |
| `librarianProcedure` | SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, LIBRARIAN | YES |
| `transportManagerProcedure` | SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TRANSPORT_MANAGER | YES |
| `teacherProcedure` | SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER | YES |
| `parentProcedure` | PARENT only | YES |

**Note:** STUDENT and DRIVER have no dedicated procedure builders — their access routes are UNKNOWN.

---

## Registered tRPC Routers (Verified)

| Router | Procedure | Auth Level | Gap |
|--------|-----------|------------|-----|
| admissions.getUploadUrl | publicProcedure | NONE | ⚠️ P1 — SEC-004 |
| admissions.submitApplication | publicProcedure | NONE | ⚠️ P1 — SEC-005 |
| students.getStudentProfile | (UNKNOWN) | (UNKNOWN) | Verify |
| attendance.* | (UNKNOWN) | (UNKNOWN) | Verify |

**Only 3 tRPC routers are registered in root.ts.** The remaining 10+ feature domains are implemented as Server Actions.

---

## Server Action Authorization Coverage

Server Actions are in `frontend/src/app/actions/` and scattered throughout feature directories.

| Server Action File | requireAuth() Called | Verified |
|--------------------|---------------------|---------|
| `actions/changePassword.ts` | UNKNOWN | NOT REVIEWED |
| `actions/onboard.ts` | UNKNOWN | NOT REVIEWED |
| `features/academics/*` | UNKNOWN | NOT REVIEWED |
| `features/admissions/*` | UNKNOWN | NOT REVIEWED |
| `features/attendance/*` | UNKNOWN | NOT REVIEWED |
| `features/fees/*` | UNKNOWN | NOT REVIEWED |
| `features/hr/*` | UNKNOWN | NOT REVIEWED |

**The authorization coverage of Server Actions is the largest unverified security surface in the system.**

---

## SUPER_ADMIN Bypass Finding

```
Location: backend/src/lib/serverAuth.ts — requireAuth()

Code:
  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(effectiveRole) &&
    role !== "SUPER_ADMIN"    // ← bypass condition
  ) {
    throw new Error(`FORBIDDEN: requires roles [...]`);
  }

Effect: A user with role=SUPER_ADMIN always passes requireAuth() regardless of
        the allowedRoles constraint. This includes when impersonating a school —
        the effective role becomes "SCHOOL_ADMIN" but the original role is still
        checked for the bypass.
```

---

## Tenant Scoping in Authorization

| Component | Tenant Scoped | Mechanism | Risk |
|-----------|--------------|-----------|------|
| requireAuth() | YES | Returns ctx.schoolId from JWT | Relies on JWT not being forged |
| requireSchool() | YES | Queries DB for school by ctx.schoolId | 60s in-memory cache |
| tRPC context | YES | session.user.schoolId | |
| DB queries | DEPENDS | Application must add WHERE schoolId = ctx.schoolId | No RLS enforcement |
| Server Actions | DEPENDS | Must call requireSchool() explicitly | Omission is silent |
| Background Workers | UNKNOWN | Not reviewed | |
| File Storage (S3) | UNKNOWN | Path prefix? | Not verified |

---

## Authorization Strength Assessment

| Dimension | Status | Finding |
|-----------|--------|---------|
| Role definition | STRONG | Well-defined 11-role hierarchy |
| tRPC middleware | STRONG | Procedure-level enforcement |
| tRPC rate limiting | STRONG | Sliding window per user/IP |
| Server Action coverage | UNKNOWN | Not audited |
| Database-level isolation | ABSENT | No PostgreSQL RLS |
| SUPER_ADMIN scope | WEAK | Bypasses all role checks (SEC-006) |
| IDOR protection | PARTIAL | schoolId in WHERE clauses assumed |
| Horizontal access | UNKNOWN | Student/parent ownership checks not verified |
| Role revocation lag | MEDIUM | Up to 1 hour via JWT |

---

## Recommended Authorization Improvements

1. Audit every Server Action for `requireAuth()` and `requireSchool()` coverage.
2. Remove or scope SUPER_ADMIN bypass — when impersonating, apply role checks to effectiveRole.
3. Consider adding PostgreSQL Row Level Security as a defense-in-depth layer.
4. Implement `protectedProcedure` with tenant scoping for all tRPC procedures that access school data.
5. Add automated lint rule that flags Server Action files missing requireAuth().
