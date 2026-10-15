# S12 Layer 4 Evidence: Real Web-Push Dispatcher & IST Quiet Hours Pipeline

**Spec**: `edu-core-s12-exam-wiring-integrity-flaw-closure@12.0.0`
**Layer**: 4 — Notification Dispatch Pipeline Closure (Flaws F6, F11, F14)
**Commit Date**: 2026-10-15
**Governing Rulebook**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0` + `RULES.md` (Rule Zero PF-R00)

---

## 1. Executive Summary

In baseline HEAD `98f16d6`, exam communication had four major flaws:
1. **Unwired Web Push Delivery (F6)**: Notification endpoints stored in `user_push_subscriptions` were never dispatched over the network; logs were written as DELIVERED without attempting Web Push delivery.
2. **Local Machine Quiet Hours Distortion (F11)**: `isQuietHours` relied on `date.getHours()`, evaluating against the server's local system time (UTC in containerized/cloud environments) rather than Indian Standard Time (`Asia/Kolkata`), misclassifying day notifications as quiet hours and allowing night notifications to fire.
3. **Broad School Fan-out Without Class Scope**: Notification fan-out queried all students in the entire school instead of restricting to classes configured in `exam_class_scopes`.
4. **N+1 Log Writes**: Push and SMS logs were inserted one-by-one in sequential loops rather than batch multi-row inserts.

Layer 4 closes these flaws:
- Implemented real Web Push dispatch in `backend/src/lib/webPushDispatcher.ts` with VAPID negotiation, subscription lookups, and graceful mock/dev fallback.
- Timezone-safe IST quiet hours (`21:00` - `07:00` IST via `Intl.DateTimeFormat` with `timeZone: "Asia/Kolkata"`).
- Class scope resolution: notifications targeting an exam restrict recipient discovery to students in `exam_class_scopes`, including secondary guardians from `student_family_members`.
- Batched multi-row inserts in chunks of 100 into `push_notification_logs` and `sms_logs`.
- BullMQ `notificationQueueWorker.ts` for draining `QUEUED_QUIET_HOURS` logs and queued SMS messages adhering to the 500 SMS/day school cap.
- Strict multi-tenant RLS compliance via `withTenant(schoolId, ...)`.

---

## 2. Changes Implemented

### 2.1 Web Push Dispatcher (`backend/src/lib/webPushDispatcher.ts`)
- Implements `dispatchWebPush(schoolId, userIds, payload, txDb)`:
  - Queries active endpoints in `user_push_subscriptions` under `schoolId`.
  - Supports VAPID credentials (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
  - Gracefully handles local and test mock endpoints, logging delivery status without throwing.
  - Returns structured `DispatchPushResult[]` per recipient.

### 2.2 Hardened Lifecycle Notifications (`backend/src/lib/examNotifications.ts`)
- **IST Quiet Hours**:
  ```typescript
  export function isQuietHours(date: Date = new Date(), timeZone: string = "Asia/Kolkata"): boolean {
    const localHour = parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(date),
      10,
    );
    return localHour >= 21 || localHour < 7;
  }
  ```
- **Scoped Recipient Resolution**:
  - Checks `examClassScopes` for `(schoolId, examId)`.
  - Scopes student queries to candidate classes.
  - Resolves both `primaryParentUserId` and secondary guardians in `studentFamilyMembers`.
- **Batch Multi-Row Logging**:
  - `batchInsertPushLogs` and `batchInsertSmsLogs` in chunks of 100 rows.
- **Fail-Closed RLS Transaction Context**:
  - Operations execute inside `withTenant(schoolId, async (scopedDb) => ...)` to ensure all queries operate under explicit tenant session context.

### 2.3 Scheduled Notification Flush Worker (`backend/src/workers/notificationQueueWorker.ts`)
- Provides BullMQ worker on queue `exam-notifications`:
  - `flushQuietHoursNotifications(schoolId?)`: Drains notifications held in `QUEUED_QUIET_HOURS` once IST local time exits quiet hours.
  - `drainQueuedSms(schoolId?)`: Drains queued SMS messages while enforcing the 500 SMS/day per-school limit.

---

## 3. Verification & Test Evidence

### 3.1 Type-Check
```bash
pnpm --filter @schoolmitra/backend type-check
```
**Result**: Clean zero-error build (`tsc --noEmit` exited 0).

### 3.2 Vitest Verification (`examNotifications.test.ts`)
```bash
pnpm --filter @schoolmitra/backend test -- examNotifications
```
**Output**:
```
 ✓ src/lib/__tests__/examNotifications.test.ts (9 tests) 414ms
   ✓ 3.1: notifyResultReleased creates in-app notice, push notification log, and contains ZERO marks or PII
   ✓ 3.2: notifyResultReleased triggers SMS fallback only when smsNotificationsEnabled=true and parent has no push sub
   ✓ 3.3: notifyAdmitCardsReleased creates in-app notice and web push notification for parents
   ✓ 3.4: notifyDatesheetPublished creates in-app notice with audienceType='ALL' and push logs
   ✓ 3.5: notifyBulkJobCompleted dispatches push notification directly to triggering admin user
   ✓ 3.6: Cross-tenant isolation probe: School A notification never queries or sends to School B parent
   ✓ 3.7: Failure-without-rollback rule: invalid schoolId does not crash or throw unhandled exceptions
   ✓ 3.8: IST Quiet Hours accuracy: enforces 21:00 - 07:00 IST window regardless of system timezone
   ✓ 3.9: Scopes fan-out strictly to classes in examClassScopes when configured

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Duration  2.50s
```

### 3.3 Rule Zero Integrity Metrics
- **Zero Marks / PII Leakage in Payloads**: Verified (`body` contains no raw scores or grade marks) — **PASS**
- **IST Timezone Fidelity**: Explicit `Asia/Kolkata` evaluation verified across day/night boundaries — **PASS**
- **RLS Multi-Tenant Isolation**: Cross-tenant probes show 0 leaked push/SMS logs — **PASS**
- **Class Scope Containment**: Un-scoped fan-out eliminated when `examClassScopes` are present — **PASS**
