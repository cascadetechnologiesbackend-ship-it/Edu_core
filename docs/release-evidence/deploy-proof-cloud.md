# Cloud Deploy Proof & Runtime Truth (Task P2-T0)
**Task ID:** P2-T0 (closes OPEN-6)  
**Governing Specification:** `edu-core-production-readiness-verification-p2` v7.0.2  
**Timestamp:** 2026-10-09T23:25:00+05:30  
**Status:** **BLOCKED** (Documented honestly per spec instructions; all subsequent P2 tasks labeled `LOCAL_LOG`)

---

## 1. Executive Summary & Defect Finding (OPEN-6)

### Background:
In Phase P1, `docs/release-evidence/deploy-proof.md` proved compilation under `NODE_ENV=production` and booted the production server on `localhost:3000`. However, OPEN-6 recorded:
> *"deploy-proof.md contains a localhost:3000 production-server proof, not a Render/Vercel CLOUD_BUILD_LOG + LIVE_URL. The cloud deploy is still claimed, not proven. P2-T0 closes it or the phase gate fails."*

### Investigation & Probe:
We executed active network probes from the public internet against the claimed cloud URL:
`https://schoolmitra.onrender.com`

#### Probe A: Health Check (`/api/health`)
```bash
curl.exe -I -s --connect-timeout 10 https://schoolmitra.onrender.com/api/health
```
**HTTP Response Headers:**
```http
HTTP/1.1 200 OK
Date: Fri, 09 Oct 2026 17:44:17 GMT
Content-Type: application/json; charset=utf-8
Connection: keep-alive
access-control-allow-credentials: true
etag: W/"71-cDrGjXuc/p1pvyXD6pS894iR/GQ"
rndr-id: bfc723eb-36ed-4928
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a47f30f19b421996-MAA
alt-svc: h3=":443"; ma=86400
```

**JSON Response Body:**
```json
{
  "status": "ok",
  "mongodb_connected": true,
  "database_driver": "MongoDB (Mongoose)",
  "time": "2026-10-09T17:44:26.110Z"
}
```

#### Probe B: Login Route (`/login`)
```bash
curl.exe -I -s --connect-timeout 10 https://schoolmitra.onrender.com/login
```
**HTTP Response Headers:**
```http
HTTP/1.1 200 OK
Date: Fri, 09 Oct 2026 17:52:52 GMT
Content-Type: text/html; charset=UTF-8
Connection: keep-alive
access-control-allow-credentials: true
Cache-Control: public, max-age=0
etag: W/"1af-1a00083c9c0"
last-modified: Fri, 14 Aug 2026 13:43:52 GMT
rndr-id: 123adb49-e23e-4fd0
Server: cloudflare
vary: Origin
vary: Accept-Encoding
x-powered-by: Express
x-render-origin-server: Render
cf-cache-status: DYNAMIC
CF-RAY: a47f3dd8ba9b6115-MAA
alt-svc: h3=":443"; ma=86400
```

---

## 2. Root Cause Analysis & Truth Assessment

1. **Host Identity Mismatch:**
   - The remote Render service (`rndr-id: bfc723eb-36ed-4928`) is returning `x-powered-by: Express` and `"database_driver": "MongoDB (Mongoose)"`.
   - The `Edu_core` repository is a Next.js 14 App Router project backed by PostgreSQL and Drizzle ORM.
   - The `last-modified` header (`Fri, 14 Aug 2026 13:43:52 GMT`) confirms that the Render service is running a prior legacy application that has not been synced with the current repository.

2. **Trigger Pipeline Availability:**
   - The GitHub Actions workflow (`.github/workflows/deploy.yml`) is configured to deploy via a webhook secret:
     ```bash
     curl -s -f -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
     ```
   - In this development and verification terminal session, `RENDER_DEPLOY_HOOK_URL` and Vercel CLI credentials are not configured in the local environment, preventing a direct trigger from this CLI.

---

## 3. Task Verdict & Specification Compliance

In accordance with Rule Zero and the explicit instruction in `P2-T0`:
> *"If the platform is genuinely unreachable during this phase, mark P2-T0 BLOCKED in the verdict with the exact error, and run every other task against localhost with LOCAL_LOG labeling. Do not mark it VERIFIED."*

- **P2-T0 Status:** **BLOCKED**
- **Action Taken:** OPEN-6 is recorded as BLOCKED pending credential provisioning for the Render webhook.
- **Protocol Enforced:** All subsequent integration tasks (P2-T1 through P2-T6) are executed against the production-mode server on localhost with explicit `LOCAL_LOG` labeling.
