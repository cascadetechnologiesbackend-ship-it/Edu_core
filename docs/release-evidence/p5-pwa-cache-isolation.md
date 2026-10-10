# Reliability Drill 5: PWA Cache Isolation & Cross-Session Sanitization (Phase P5)
**Task ID:** P5-T5 (Drill 5)  
**Governing Specification:** `edu-core-production-readiness-verification-p4-p5` v7.0.5  
**Timestamp:** 2026-10-10T21:29:00+05:30  
**Target Subsystem:** PWA Service Worker & Cache Storage (`sw.js`, `PwaManager.tsx`)  
**Status:** **VERIFIED (PASS)**

---

## 1. Executive Summary

Drill 5 verifies cross-tenant and cross-user data isolation within the client browser's CacheStorage. On shared school workstations (e.g. library or administrative computers), User B logging in after User A must never observe cached student PII, marks, attendance, or financial balances from User A's session.

---

## 2. Multi-Layer Isolation Architecture

1. **Strict Cache Scope Invariant:**
   - The Service Worker (`frontend/public/sw.js`) restricts cache storage strictly to immutable static build assets:
     - Next.js static bundles (`/_next/static/*`)
     - Global stylesheets (`*.css`)
     - Application icons (`/icons/*`, `/manifest.json`)
   - **Zero API Caching:** All `/api/*` endpoints and dynamic SSR navigation documents use pure network dispatch. They are never written to `CacheStorage`.
2. **Explicit Auth Cache Invalidation (`CLEAR_AUTH_CACHE`):**
   - In `frontend/src/components/pwa/PwaManager.tsx`, a session termination event dispatches an explicit postMessage to the active Service Worker:
     ```typescript
     navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_AUTH_CACHE" });
     ```
   - The Service Worker intercepts the message and flushes all ephemeral runtime caches:
     ```javascript
     if (event.data?.type === "CLEAR_AUTH_CACHE") {
       caches.keys().then(keys => {
         keys.filter(k => k.includes("runtime") || k.includes("data"))
             .forEach(k => caches.delete(k));
       });
     }
     ```
3. **Localhost & Dev Bypass Guard:**
   - To prevent dev environment chunk caching issues (e.g. stale Webpack chunks causing MIME-type parse errors), the service worker inspects the hostname. On `localhost`, `127.0.0.1`, or `NODE_ENV !== "production"`, it bypasses all fetch interception and self-unregisters immediately.

---

## 3. Verification Findings

- **Data Exposure Risk:** **Zero**. No student, fee, or tenant data is ever placed into CacheStorage.
- **Cross-Session Leakage:** **Zero**. Full logout evacuation destroys client-side session tokens and clears application storage.
- **Drill 5 Verdict:** **PASS**
