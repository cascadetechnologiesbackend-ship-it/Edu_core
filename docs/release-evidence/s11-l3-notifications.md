# S11 Layer 3 Evidence: Communication Engine Wiring

**Spec**: edu-core-s11-exam-cross-module-integration (v11.0.0)  
**Layer**: 3 — Communication Wiring  
**Date**: 2026-10-15  
**Git Branch**: `main`  

---

## 1. Overview & Data Flow
Prior to S11, publishing datesheets, releasing admit cards, publishing results, and running async bulk report card generation did not dispatch in-app notices, web push, or SMS fallback notifications.

Layer 3 connects all 4 examination lifecycle events to the notification subsystem via `backend/src/lib/examNotifications.ts`:
1. **Four Examination Lifecycle Events**:
   - `notifyResultReleased`: Dispatched when report cards are published in `publishResults`. Informs parents that results are ready.
   - `notifyAdmitCardsReleased`: Dispatched when admit cards are released in `saveAdmitCardSettings`. Informs parents that admit cards are available for download.
   - `notifyDatesheetPublished`: Dispatched when datesheets are published in `publishDatesheet`. Informs students and parents with schedule timings.
   - `notifyBulkJobCompleted`: Dispatched when asynchronous report card batch generation finishes in `bulkGenerationEngine.ts`. Directly notifies the School Admin / Principal who triggered the job.
2. **Quiet Hours Enforcement (UX-P11)**:
   - Configured between 21:00 and 07:00 (local/IST).
   - During quiet hours, web push notifications are queued (`status: 'QUEUED_QUIET_HOURS'`, `sentAt: null`) rather than waking families at night.
3. **SMS Fallback Guard**:
   - SMS notifications are only queued if `resultSettings.smsNotificationsEnabled = true` AND the recipient parent has no registered web push subscription, optimizing SMS costs and respecting user preferences.
4. **Zero-PII Privacy Rule (DPDP Compliance)**:
   - Notification titles and bodies strictly omit any student marks, percentages, or rank details (e.g. `"Examination results for Term 1 have been published. Tap to view."`).
5. **Non-Blocking Fail-Safe**:
   - Notification failures are caught and logged without rolling back the primary database transaction.

---

## 2. Test Execution Evidence

### Vitest Unit & Integration Suite (`src/lib/__tests__/examNotifications.test.ts`)
```
✓ src/lib/__tests__/examNotifications.test.ts (7 tests)
  ✓ 3.1: notifyResultReleased creates in-app notice and push notifications without marks/scores in payload
  ✓ 3.2: notifyResultReleased triggers SMS fallback only when smsNotificationsEnabled=true and parent has no push sub
  ✓ 3.3: notifyAdmitCardsReleased creates in-app notice and push notifications for exam
  ✓ 3.4: notifyDatesheetPublished creates in-app notice and parent push notifications
  ✓ 3.5: notifyBulkJobCompleted notifies the specific triggering admin user with counts
  ✓ 3.6: Quiet hours rule: notifications during 21:00-07:00 are marked QUEUED_QUIET_HOURS with sentAt null
  ✓ 3.7: Failure-without-rollback rule: invalid schoolId does not crash or throw unhandled exceptions
```

### RBAC Static AST Guard (`scripts/audit-exam-rbac.mjs`)
```
Auditing 8 examination server action files for requireExamPermission guards...
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/admitCardActions.ts -> saveAdmitCardSettings()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/resultActions.ts -> publishResults()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/resultActions.ts -> configureResultSettings()
  ✓ [GUARDED MUTATION]   frontend/src/app/(admin)/exams/actions/scheduleActions.ts -> publishDatesheet()
Auditing 18 examination routes for assertRouteAccess & session checks...
✅ ALL EXAMINATION RBAC GUARDS, ACTIONS & ROUTES VERIFIED (0 ERRORS)
```

### TypeScript Validation
```
pnpm --filter @schoolmitra/frontend exec tsc --noEmit: EXIT 0 (0 errors)
```

---

## 3. Cross-Tenant Isolation Verification
- All notification dispatches require `schoolId` and query strictly bounded by `where: eq(table.schoolId, schoolId)`.
- Push notifications, SMS logs, and in-app notices are recorded with `school_id` foreign keys ensuring tenant boundary integrity.
