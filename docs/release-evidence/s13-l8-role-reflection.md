# S13 Layer 8 Evidence: Role Reflection, Admissions Funnel State Machine UI, Parent Portal Welcome, and Admin Dashboard Today Telemetry

**Sprint:** S13 Student Lifecycle Convergence & Durable Event Backbone  
**Layer:** Layer 8  
**Timestamp:** 2026-10-16T12:05:00+05:30  
**Status:** Certified & Verified  

---

## 1. Executive Summary

Layer 8 delivers the role reflection and UX closure layer for Sprint S13 across all primary stakeholders:
1. **Admissions Funnel UI**: Client-side enforcement of legal status transitions from `@schoolmitra/validators` (`LEGAL_ADMISSION_TRANSITIONS`). Illegal transitions (e.g. `REJECTED -> ENROLLED`, same-status, arbitrary strings) are disabled client-side with visual cues (`(Not Allowed)`), terminal states (`ENROLLED`, `REJECTED`, `WITHDRAWN`) render designated status badges, and server-side validation rejects any bypassed requests with typed forensics.
2. **Parent Portal Closure**: On parent login, the portal resolves active welcome notices (`audienceType: "PARENTS"`, targeted via `audienceFilter` or student ID) and renders an Enrolled Child Card displaying the child's decrypted name, admission number, assigned class & section, active enrollment badge, and auto-assigned fee invoices in one consolidated view.
3. **Admin and Principal Today Surfaces**: The Admin Dashboard integrates Query 2 consolidated rollups with the S10 telemetry `usage_events` table (`eventType: "STUDENT_ENROLLED"` created today). When new students are admitted, a prominent "New Admissions Enrolled Today" card and pending task item surface with direct deep-links to `/students`, reflecting the new students without stale cache.

---

## 2. Implementation Details

### 2.1 Admissions Funnel State Machine UI (`frontend/src/app/(admin)/admissions/[id]/StatusUpdater.tsx`)
- Imports canonical state machine rules:
  ```ts
  import {
    ADMISSION_STATUSES,
    LEGAL_ADMISSION_TRANSITIONS,
    AdmissionStatus,
    isAdmissionStatus,
  } from "@schoolmitra/validators";
  ```
- Evaluates `legalTransitions` dynamically based on `currentStatus`.
- Terminal states (`ENROLLED`, `REJECTED`, `WITHDRAWN`) render dedicated badges and lock status modification.
- Non-terminal states disable any transition option not present in `legalTransitions`:
  ```tsx
  {ADMISSION_STATUSES.filter((s) => s !== currentStatus).map((s) => {
    const allowed = legalTransitions.includes(s);
    return (
      <option key={s} value={s} disabled={!allowed}>
        {s.replace("_", " ")} {!allowed ? "(Not Allowed)" : ""}
      </option>
    );
  })}
  ```

### 2.2 Parent Portal Enrolled Child Card & Welcome Notice (`frontend/src/app/(parent)/portal/page.tsx`)
- Resolves linked students, assigned classes, sections, and targeted welcome notices (`notices` table).
- Renders:
  - **Welcome Notice Banner**: Informs the parent that enrollment is confirmed and portal features are accessible.
  - **Enrolled Child Cards**: Shows decrypted student full name, admission number, Class and Section, `✓ Enrolled` badge, and total assigned dues.

### 2.3 Admin & Principal Today Surfaces (`frontend/src/app/(admin)/dashboard/page.tsx`)
- Augments Query 2 rollup (preserving the 5-query budget in `Promise.all`):
  ```sql
  (SELECT count(*) FROM usage_events WHERE school_id = ${schoolId} AND event_type = 'STUDENT_ENROLLED' AND created_at >= ${startOfDay} AND created_at <= ${endOfDay})::int as new_admissions_today
  ```
- Emits `newAdmissionsToday` into `pendingTasksList` and renders the dedicated "New Admissions Enrolled Today" card with deep-link to `/students`.

---

## 3. Verification & Static Analysis

### 3.1 Monorepo Typecheck
```bash
$ pnpm type-check
 Tasks:    6 successful, 6 total
 Cached:   5 cached, 6 total
 Time:     12.948s
```

### 3.2 Static Lifecycle Hygiene Guard
```bash
$ node scripts/audit-lifecycle-hygiene.mjs
Running S13 Lifecycle Hygiene Static Analysis...
✅ S13 Lifecycle Hygiene Guard PASSED: student creation is strictly engine-scoped, zero ghost references, zero dead in-memory event publisher references, zero hardcoded 127.0.0.1 audit/consent IPs.
```
