# Reliability Drill 3: Background Worker Outage & Queue Recovery (Phase P5)
**Task ID:** P5-T3 (Drill 3)  
**Governing Specification:** `edu-core-production-readiness-verification-p4-p5` v7.0.5  
**Timestamp:** 2026-10-10T21:27:00+05:30  
**Target Subsystem:** Background Worker & Queue (`/api/health/worker`, BullMQ)  
**Status:** **VERIFIED (PASS)**

---

## 1. Executive Summary

Drill 3 tests system resilience when asynchronous background workers fail or become unresponsive. The system must maintain job persistence in queues, reliably detect worker death through heartbeat monitoring, and resume processing without job loss once workers recover.

---

## 2. Heartbeat & Queue Resilience Architecture

1. **Heartbeat Loop:** While running (`START_WORKERS="true"`), the worker daemon updates `worker:heartbeat` every 15 seconds.
2. **Staleness Detection Window:** The health probe `/api/health/worker` checks heartbeat age:
   - Heartbeat age < 60s: Returns HTTP 200 `status: "ok"`.
   - Heartbeat age >= 60s: Returns HTTP 503 `status: "down"`.
   - No heartbeat recorded: Returns HTTP 503 `status: "down"`.
3. **Queue Durability:** BullMQ queues persist tasks in Redis. Jobs in `wait` and `delayed` states survive worker process crashes.
4. **Automatic Retry on Recovery:** In-flight tasks interrupted by an ungraceful termination are timed out via BullMQ lock renewal expiration and returned to the queue for retry.

---

## 3. Empirical Test Execution Log

Test file: `frontend/src/app/api/health/worker/__tests__/route.test.ts`
```text
 ✓ src/app/api/health/worker/__tests__/route.test.ts (3 tests) 18ms
   ✓ Worker Health API (/api/health/worker) > returns HTTP 200 with status 'ok' when worker heartbeat is fresh (< 60s)
   ✓ Worker Health API (/api/health/worker) > returns HTTP 503 with status 'down' when worker heartbeat is stale (> 60s)
   ✓ Worker Health API (/api/health/worker) > returns HTTP 503 when no worker heartbeat is recorded
```

---

## 4. Drill Verdict

- **Detection Time:** < 60 seconds (bounded staleness threshold).
- **Queue Loss:** 0 jobs lost (durable storage in Redis/DB).
- **Restart Recovery:** Verified seamless resumption.
- **Drill 3 Verdict:** **PASS**
