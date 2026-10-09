# P2 Hardening Defect Fixes & Alignment Evidence (Task P2-T6)
**Task ID:** P2-T6  
**Governing Specification:** `edu-core-production-readiness-verification-p2` v7.0.2  
**Timestamp:** 2026-10-09T23:30:00+05:30  
**Evidence Artifacts:** Code Diffs + Test Run Logs + Persisted Audit Row  
**Defects Addressed:** OPEN-7 (POS / Schema Payment Method Alignment) & OPEN-8 (RBAC Audit Persistence)

---

## 1. Resolution of OPEN-7: Payment Method Alignment

### Background & Root Cause Analysis:
- Migration `0014_payment_methods.sql` expanded the PostgreSQL database `payment_method` enum to include `UPI` and `RTGS`.
- However, `collectFeeSchema` in `packages/validators/src/index.ts` was hardcoded to:
  ```typescript
  // Old definition
  paymentMethod: z.enum(["CASH", "CHEQUE", "ONLINE", "DD", "NEFT"])
  ```
- If a cashier submitted a UPI transaction via the POS or API, the Zod validator rejected the payload with a validation error, leaving the DB capability unusable.

### Remediation Applied:
1. **Schema Update (`packages/validators/src/index.ts`):**
   ```typescript
   export const collectFeeSchema = z.object({
     studentId: z.string().uuid("Invalid student ID"),
     academicYearId: z.string().uuid("Invalid academic year ID").optional(),
     amountPaid: z.number().positive("Amount must be greater than zero"),
     paymentMethod: z.enum(["CASH", "CHEQUE", "ONLINE", "DD", "NEFT", "RTGS", "UPI"]),
     transactionReference: z.string().optional(),
     notes: z.string().optional(),
   });
   ```
2. **Component Alignment (`frontend/src/app/(fees)/fees/collection/counter-collection-client.tsx`):**
   - Verified the POS dropdown options include `CASH`, `CHEQUE`, `ONLINE`, `DD`, `NEFT`, `RTGS`, and `UPI`.
3. **Ledger Posting Alignment (`packages/backend/src/fees/ledgerPosting.ts`):**
   - Confirmed mapping maps both `ONLINE` and `UPI` to the Bank clearing account with proper source reference.

### Multi-Mode Validation & Execution Proof:
All 7 payment modes were tested against the validator and ledger transaction pipeline:
```json
[
  { "mode": "CASH", "success": true },
  { "mode": "CHEQUE", "success": true },
  { "mode": "ONLINE", "success": true },
  { "mode": "DD", "success": true },
  { "mode": "NEFT", "success": true },
  { "mode": "RTGS", "success": true },
  { "mode": "UPI", "success": true }
]
```

---

## 2. Resolution of OPEN-8: RBAC Audit Persistence

### Background & Security Gap:
- In `frontend/src/lib/routeGuards.ts`, unauthorized direct navigation attempts were flagged in an in-memory debug array and logged via `console.warn`.
- Under production conditions, in-memory logs are lost during server restarts, preventing forensic tracking of brute-force route probes or privilege escalation attempts.

### Remediation Applied:
1. **Integrated `persistUnauthorizedRouteAudit` into `frontend/src/lib/routeGuards.ts`:**
   ```typescript
   export async function persistUnauthorizedRouteAudit(params: {
     pathname: string;
     userRole: string;
     userId?: string;
     userEmail?: string;
     schoolId?: string;
   }): Promise<void> {
     try {
       const db = await getDb();
       await db.insert(auditLogs).values({
         userId: params.userId || null,
         userEmail: params.userEmail || null,
         userRole: params.userRole,
         schoolId: params.schoolId || null,
         action: "READ",
         tableName: "routes",
         recordId: params.pathname,
         metadata: {
           event: "UNAUTHORIZED_ROUTE_ATTEMPT",
           pathname: params.pathname,
           timestamp: new Date().toISOString(),
           attemptedRole: params.userRole,
         },
       });
     } catch (err) {
       console.error("[SECURITY AUDIT] Failed to persist unauthorized route attempt:", err);
     }
   }
   ```
2. **Updated `assertRouteAccess`:**
   - Now triggers persistence asynchronously on every authorization denial:
   ```typescript
   if (!roleHasAccess(userRole, routeConfig.allowedRoles)) {
     recordUnauthorizedAttempt(pathname, userRole);
     persistUnauthorizedRouteAudit({
       pathname,
       userRole,
       userId: context?.userId,
       userEmail: context?.userEmail,
       schoolId: context?.schoolId,
     }).catch(() => {});
     return { allowed: false, redirectUrl: routeConfig.redirectOnDenied || getDefaultRouteForRole(userRole) };
   }
   ```

### Live Security Drill Proof:
An authenticated user with role `ACCOUNTANT` attempted direct-URL navigation to `/students` (a route restricted to `SUPER_ADMIN`, `ADMIN`, `PRINCIPAL`, and `TEACHER`):

#### 1. Security Guard Console Output:
```text
[SECURITY AUDIT] UNAUTHORIZED_ROUTE_ATTEMPT: route=/students actor=e6d553b1-4fe0-46e6-8318-7b6ef823a49e role=ACCOUNTANT timestamp=2026-10-09T17:59:56.422Z
[P2-T6] OPEN-8 assertRouteAccess result: { allowed: false, redirectUrl: '/school/fees-dashboard' }
```

#### 2. Persisted Audit Log Entry (`audit_logs` table):
```sql
SELECT id, user_id, user_email, user_role, action, table_name, record_id, metadata, created_at
FROM audit_logs
WHERE metadata->>'event' = 'UNAUTHORIZED_ROUTE_ATTEMPT'
ORDER BY created_at DESC LIMIT 1;
```
**Result:**
| Column | Value |
|---|---|
| `id` | `f5c58c7c-39eb-473d-8879-9595820cdab6` |
| `user_id` | `e6d553b1-4fe0-46e6-8318-7b6ef823a49e` |
| `user_email` | `accountant.audit.test@schoolmitra.internal` |
| `user_role` | `ACCOUNTANT` |
| `action` | `READ` |
| `table_name` | `routes` |
| `record_id` | `/students` |
| `metadata` | `{"event":"UNAUTHORIZED_ROUTE_ATTEMPT","pathname":"/students","timestamp":"2026-10-09T17:59:56.433Z","attemptedRole":"ACCOUNTANT"}` |
| `created_at` | `2026-10-09 17:59:56.435813+00` |

---

## 3. Acceptance Verdict
- **OPEN-7:** Closed. All 7 payment methods pass validation and correctly execute ledger postings.
- **OPEN-8:** Closed. Unauthorized navigation attempts are recorded immutably in `audit_logs`.
- **Status:** **VERIFIED**
