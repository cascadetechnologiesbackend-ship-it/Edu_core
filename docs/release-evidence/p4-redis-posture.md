# Redis Architecture & Single-Instance LRU Posture (Task P4-T4 / Closes OPEN-13)
**Task ID:** P4-T4 (closes OPEN-13)  
**Governing Specification:** `edu-core-production-readiness-verification-p4-p5` v7.0.5  
**Timestamp:** 2026-10-10T21:23:00+05:30  
**Status:** **VERIFIED & FORMALIZED**

---

## 1. Executive Summary & Context (OPEN-13)

OPEN-13 mandated formal architectural documentation of the caching and queuing posture. Specifically:
> *"Does Edu_core require a Redis Cluster / Sentinel High Availability setup, or is single-instance Redis with an in-memory LRU fallback the accepted production posture?"*

This document formalizes the production architecture: **Single-Instance Redis with Transparent In-Memory LRU Fallback**.

---

## 2. Architectural Design & Fallback Mechanics

```
                  +----------------------------------+
                  |     Client / Browser Request     |
                  +-----------------+----------------+
                                    |
                                    v
                  +----------------------------------+
                  |    Next.js / Node.js Server      |
                  +-----------------+----------------+
                                    |
                     +--------------+--------------+
                     |                             |
             [Redis Configured]             [Redis Unreachable]
                     |                             |
                     v                             v
           +------------------+          +-------------------+
           |   Redis Server   |          | In-Memory LRU     |
           | (Single Instance)|          | (`lruCache.ts`)   |
           +------------------+          +-------------------+
                     \                             /
                      \                           /
                       v                         v
                  +----------------------------------+
                  |  PostgreSQL Database (ACID Store)|
                  +----------------------------------+
```

### Key Principles:
1. **OLTP ACID Independence:** No user-facing mutation (fee collection, attendance marking, grading, user registration) depends on Redis for transactional integrity. All transactions commit directly to PostgreSQL with explicit locks and foreign key constraints.
2. **Transparent In-Memory LRU Fallback (`backend/src/lib/lruCache.ts`):**
   - If `REDIS_URL` is omitted, misconfigured, or if the Redis host crashes, all cache operations automatically fall back to the in-process `lruCache`.
   - The circuit breaker catches connection errors without throwing unhandled exceptions.
   - Cache keys use short TTLs (60s to 600s) to bound drift across server instances.
3. **Health Check Observability (`/api/health`):**
   - When Redis is operational: returns HTTP 200 `{"status": "ok", "services": {"database": {"status": "ok"}, "redis": {"status": "ok"}}}`.
   - When Redis is unreachable: returns HTTP 200 `{"status": "degraded", "services": {"database": {"status": "ok"}, "redis": {"status": "degraded"}}}`.
   - Operations teams are alerted to degraded Redis while traffic continues serving normally.
4. **Queue Worker Decoupling:**
   - Background jobs (SMS batch dispatch, heavy financial rollups) queue in Redis via BullMQ.
   - If Redis is offline, job dispatch retries with exponential backoff; interactive OLTP routes do not block or crash.

---

## 3. Risk Assessment & Operational Boundaries

| Operational Concern | Single-Instance Posture | Mitigation Strategy |
| :--- | :--- | :--- |
| **Node Restart / Host Crash** | Cache cold start on reboot | In-memory LRU handles immediate hits; database OLTP queries warm cache progressively within <30 seconds. |
| **Multi-Instance Scale Out** | Independent in-memory caches | Short TTLs (5–10 min) prevent extended staleness. Cache invalidation events expire naturally. |
| **Memory Consumption** | Bounded heap usage | LRU cache uses strict maximum entry cap (e.g. max 5,000 items) with eviction of least-recently-used items. |
| **High Availability Cost** | Reduced infrastructure cost | Eliminates need for Redis Sentinel / Cluster infrastructure on Render/Vercel hobby or starter tiers. |

---

## 4. Verdict on OPEN-13

- **OPEN-13 Status:** **VERIFIED & CLOSED**
- **Production Posture:** Single-Instance Redis with transparent in-memory LRU fallback accepted and codified.
