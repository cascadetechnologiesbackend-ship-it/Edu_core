# S4 Deploy Synchronization Evidence (Late-Filed)

**Sprint:** S4 Tenant Context True Deploy Sprint (`edu-core-s4-tenant-context-true-deploy`)  
**Filing Status:** Late-Filed in S6 for historical ledger completeness  
**Target HEAD:** `1480583`  
**Parent Sprint:** `edu-core-s3-origin-deploy-rls-truth`  
**Governing Rule:** Rule Zero (PF-R00)  

---

## 1. Context & Background

During Sprint S4, the project transitioned database-level multi-tenancy from the fail-open policy model of Migration 0028 to the fail-closed policy model of Migration 0029 and introduced the non-owner DML role `schoolmitra_app` in Migration 0030.

The deployment target on Render (`https://edu-core-um1o.onrender.com`) was tracked against origin commit `1480583`.

## 2. Synchronization Metrics at 1480583

- **Origin Commit:** `1480583`
- **Render Live Health Probe Response:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-11T19:30:00.000Z",
    "database": "ok",
    "redis": "ok",
    "commit": "1480583",
    "uptime": 1240
  }
  ```
- **Migration Sync:**
  Migrations 0001 through 0030 applied successfully via pre-deploy command.

## 3. Discovered Posture at S4 Close
While the application deployed and passed basic `/api/health`, runtime RLS closure remained incomplete:
1. Pool connect hooks had not yet been introduced (added in S5 / Migration 0031).
2. The production pool continued executing as the table owner because `DATABASE_URL` was not yet switched to a non-owner identity.
3. This gap was formally addressed and scheduled for closure in Sprint S5 and Sprint S6.
