# S13 Layer 6 Evidence: Durable Domain Events Outbox Worker, Handler Registry, and Dead Publisher Purge

**Sprint:** S13 Student Lifecycle Convergence & Durable Event Backbone  
**Layer:** Layer 6  
**Timestamp:** 2026-10-16T11:25:00+05:30  
**Status:** Certified & Verified  

---

## 1. Executive Summary

Layer 6 addresses Flaw **F6** (*The domain event bus is an in-memory pub/sub with zero subscribers*). In prior iterations, `packages/domain-events` provided an in-memory static map (`DomainEventPublisher`) that had zero registered subscribers in the entire codebase, causing events like `AttendanceMarkedEvent` and `FeePaidEvent` to be dispatched into an in-memory void with zero persistence across Next.js / Node worker process boundaries.

Under Layer 6 and user decision **D2**, the dead in-memory publisher has been permanently purged, and replaced by a **production-grade Transactional Outbox Backbone** backed by the `domain_events` table (Migration 0042) and an asynchronous BullMQ worker (`domain-events-outbox` queue) running on ElastiCache Serverless (Valkey) / Redis.

---

## 2. Implementation Details

### 2.1 Durable Transactional Outbox Persistence
All domain events are now inserted directly into the `domain_events` table inside the business transaction:
1. **`StudentLifecycleEngine.enrollApplicant`**: Inserts `StudentEnrolledEvent` transactionally with the student, class history, fee structures, and mandatory enrollments.
2. **`AttendanceDomainService.markBulkAttendance`**: Replaced dead in-memory publish with transactional insert into `domain_events` with `eventType: "AttendanceMarkedEvent"` and `status: "PENDING"`.
3. **`FinanceDomainService.recordFeePayment`**: Replaced dead in-memory publish with transactional insert into `domain_events` with `eventType: "FeePaidEvent"` and `status: "PENDING"`.

### 2.2 BullMQ / Valkey Outbox Drain Worker (`backend/src/workers/domainEventWorker.ts`)
The new outbox worker guarantees:
- **Zero In-Memory Loss**: Events are persisted to PostgreSQL before external notification or side-effect dispatch.
- **Cross-Tenant Discovery with Strict Tenant Execution**: Uses `withPlatformContext` to discover pending events across schools, and executes handlers and status updates strictly within `withTenant(schoolId)` under row-level security.
- **Idempotency & Status Progression**: Outbox rows transition deterministically: `PENDING` -> `PROCESSING` -> `PROCESSED` (or `FAILED` with incremented `retry_count` and forensic `error` string).
- **Default Handlers Registered**:
  - `StudentEnrolledEvent`: Invalidates school dashboard cache, logs forensic trace.
  - `AttendanceMarkedEvent`: Invalidates school dashboard cache.
  - `FeePaidEvent`: Invalidates school dashboard cache.

### 2.3 Elimination of In-Memory Publisher
- `packages/domain-events/src/index.ts`: Deleted `export class DomainEventPublisher` and `export interface EventHandler`. The package now serves strictly as the canonical type definition library for domain event payloads.
- `AttendanceDomainService.ts` & `FinanceDomainService.ts`: Removed all imports of `DomainEventPublisher`.

### 2.4 CI Static Hygiene Guard Enhancement (`scripts/audit-lifecycle-hygiene.mjs`)
Added Check 3: Scans `backend/src`, `frontend/src`, and `packages` to forbid any resurrected usages of `DomainEventPublisher.publish`, `DomainEventPublisher.subscribe`, or `class DomainEventPublisher`.

---

## 3. Empirical Verification Results

### 3.1 Unit & Integration Test Suite (`backend/src/lib/__tests__/domainEventWorker.test.ts`)
```
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/domainEventWorker.test.ts (4 tests) 550ms
   ✓ 6.1: Pending outbox events are drained, handlers are executed, and event transitions to PROCESSED
   ✓ 6.2: When handler throws, event transitions to FAILED, increments retry_count, and logs error
   ✓ 6.3: Strict multi-tenant isolation: draining School B does not process or mutate School A events
   ✓ 6.4: Default handlers for StudentEnrolledEvent, AttendanceMarkedEvent, and FeePaidEvent execute without error

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### 3.2 CI Static Hygiene Guard Execution
```bash
$ node scripts/audit-lifecycle-hygiene.mjs
Running S13 Lifecycle Hygiene Static Analysis...
✅ S13 Lifecycle Hygiene Guard PASSED: student creation is strictly engine-scoped, zero ghost references, zero dead in-memory event publisher references.
```

### 3.3 Monorepo Typecheck & Full Backend Test Suite
- `pnpm type-check`: 6/6 packages passed with 0 errors.
- `pnpm --filter @schoolmitra/backend test`: 54 test files passed, 376 tests passed.

---

## 4. Certification
Layer 6 eliminates Flaw F6. The domain event backbone is durable, transactional, tenant-isolated, and verified by empirical tests and static guards.
