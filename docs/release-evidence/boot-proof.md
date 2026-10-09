# SchoolMitra ERP — Boot Proof & Heartbeat Evidence (Phase P1)
**Task ID:** P1-T5  
**Governing Specification:** `edu-core-production-readiness-verification-p1` v7.0.1  
**Timestamp:** 2026-10-09T22:18:00+05:30  
**Evidence Artifact:** `CI_LOG` + `DB_PROOF`

---

## 1. Executive Summary & Defect Remediation

### Defect Identified & Remediated:
- **Middleware Redirection on Health Probes**:
  - **Previous State**: In `backend/src/lib/auth/auth.config.ts`, the authorized callback checked `pathname === "/api/health"`. As a result, sub-endpoints such as `/api/health/worker` were treated as unauthenticated protected routes and returned `HTTP 307` redirecting to `/login?callbackUrl=...`.
  - **Remediation**: Updated rule in `backend/src/lib/auth/auth.config.ts` to `pathname.startsWith("/api/health")`, allowing internal infrastructure probes, monitoring agents, and Render/Kubernetes liveness checks to query all health subroutes without session credentials.

---

## 2. Health Endpoint Verification (`/api/health`)

### A. Cold Initial Call (Verifying Redis Honesty Rule)
When Redis connection is in initial connect or offline state, the endpoint honestly reports degraded status rather than faking an `ok` response:
```bash
curl.exe -s -w "\nHTTP %{http_code} in %{time_total}s\n" http://localhost:3002/api/health
```
**HTTP Status:** 200  
**Payload Body:**
```json
{
  "status": "degraded",
  "database": "ok",
  "redis": "degraded",
  "version": "0.1.0",
  "uptime": 0,
  "timestamp": "2026-10-09T16:44:53.132Z",
  "durationMs": 72,
  "redisNote": "Stream isn't writeable and enableOfflineQueue options is false"
}
```
**Evaluation:** Complies strictly with the **Honesty Rule**: transparent fallback to in-process LRU cache while accurately reporting `"redis": "degraded"`.

### B. Warm Call (Meeting Latency Budget)
```bash
curl.exe -s -w "\nHTTP %{http_code} in %{time_total}s\n" http://localhost:3002/api/health
```
**HTTP Status:** 200  
**Response Time:** 0.080s total round-trip (Internal execution: **3ms**)  
**Payload Body:**
```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "version": "0.1.0",
  "uptime": 21,
  "timestamp": "2026-10-09T16:45:14.501Z",
  "durationMs": 3
}
```
**Evaluation:** Internal DB ping and Redis ping execute in **3ms**, well under the 50ms budget limit.

---

## 3. Worker Heartbeat & Stale Detection (`/api/health/worker`)

### A. Initial State (Pre-boot)
Before the worker process initialized:
```bash
curl.exe -s -w "\nHTTP %{http_code} in %{time_total}s\n" http://localhost:3002/api/health/worker
```
**HTTP Status:** 200  
**Payload Body:**
```json
{
  "status": "waiting",
  "worker": "educore-finance-worker",
  "heartbeatStatus": "not_started",
  "ageSeconds": 0,
  "lastSeenAt": null,
  "durationMs": 4,
  "timestamp": "2026-10-09T16:46:17.630Z"
}
```

### B. Heartbeat Persistence Drill (`DB_PROOF`)
Execution of worker startup sequence:
```text
=== WORKER HEARTBEAT DRILL ===
Initial worker_heartbeats row count: 0
Heartbeat recorded in 42.36ms: {
  workerName: 'educore-finance-worker',
  lastSeenAt: 2026-10-09T16:47:33.255Z,
  status: 'alive'
}

Database Row Verification:
┌─────────┬──────────────────────────┬──────────────────────────┬──────────┬──────────────────────────┐
│ id      │ worker_name              │ last_seen_at             │ status   │ created_at               │
├─────────┼──────────────────────────┼──────────────────────────┼──────────┼──────────────────────────┤
│ 1       │ 'educore-finance-worker' │ 2026-10-09T16:47:33.255Z │ 'alive'  │ 2026-10-09T16:47:33.255Z │
└─────────┴──────────────────────────┴──────────────────────────┴──────────┴──────────────────────────┘

Wall-clock time to first heartbeat: 42.36ms (Budget: <90,000ms [PASS])
```

### C. Stale Heartbeat Detection Test
To verify the watchdog stale threshold (120 seconds):
1. Simulated historical timestamp (`now - 150 seconds`):
   ```text
   Stale heartbeat status test (>120s): {
     status: 'stale',
     isAlive: false,
     lastSeenAt: 2026-10-09T16:45:03.310Z,
     ageSeconds: 150,
     workerName: 'educore-finance-worker'
   }
   ```
   *Verified: System correctly detects staleness and flags `isAlive: false`.*

2. Heartbeat restored to current timestamp:
   ```text
   Restored live heartbeat status: {
     status: 'alive',
     isAlive: true,
     lastSeenAt: 2026-10-09T16:47:33.323Z,
     ageSeconds: 0,
     workerName: 'educore-finance-worker'
   }
   ```

### D. Live Worker Health Query (`/api/health/worker`)
```bash
curl.exe -s -w "\nHTTP %{http_code} in %{time_total}s\n" http://localhost:3002/api/health/worker
```
**HTTP Status:** 200  
**Response Time:** 0.094s total round-trip (Internal execution: **7ms**)  
**Payload Body:**
```json
{
  "status": "ok",
  "worker": "educore-finance-worker",
  "heartbeatStatus": "alive",
  "ageSeconds": 41,
  "lastSeenAt": "2026-10-09T16:47:33.323Z",
  "durationMs": 7,
  "timestamp": "2026-10-09T16:48:14.392Z"
}
```

**Conclusion:** Both `/api/health` and `/api/health/worker` operate with sub-10ms warm database verification, accurately report dependency status, and execute real-time heartbeat monitoring.
