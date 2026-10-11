# Stage S2-E: Storage & Redis Configuration Integrity Evidence

**Sprint:** S2 Security & Release Integrity Hardening Sprint (`edu-core-security-release-integrity-hardening-s2`)  
**Stage:** S2-E Storage & Redis Consolidation  
**Date:** 2026-10-11  
**Author:** Cascade AI  
**Governing Rule:** Rule Zero PF-R00 (empirical before/after measurement, zero unverified assertions)

---

## 1. Executive Summary

This document certifies the consolidation and hardening of storage and Redis connection lifecycles across SchoolMitra ERP.

Prior to Stage S2-E:
1. Two disparate S3 storage implementations existed (`storage.ts` using `AWS_*` and `s3.ts` using `S3_*` with insecure default fallbacks to `http://localhost:9000` and `minioadmin`).
2. BullMQ workers (`financeAutomation.ts`, `retention.ts`, `reportCard.ts`) each implemented ad-hoc Redis connections falling back to unauthenticated `127.0.0.1` and lacking BullMQ's mandatory `maxRetriesPerRequest: null`.
3. `render.yaml` ran `db:migrate` and `db:seed-coa` during `buildCommand` inside the image build container, and the finance worker service lacked AWS/S3 storage environment variable bindings.

In Stage S2-E:
1. **Canonical S3 Storage Engine (`backend/src/lib/storage.ts`):** Standardized on `AWS_*` environment variables, implemented production fail-fast check against localhost/minioadmin credentials, strict 10MB file limit, and MIME type whitelisting (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`).
2. **Backwards-Compatible S3 Re-export (`backend/src/lib/s3.ts`):** Re-exports all unified methods from `storage.ts` without breaking legacy call sites.
3. **Centralized Redis Connection Factory (`backend/src/lib/redisConnection.ts`):** Unifies Redis URL parsing (`REDIS_URL || educore_REDIS_URL`), sets `maxRetriesPerRequest: null` for BullMQ, rejects unconfigured localhost fallback in production, and provides `getBullMQRedisConnection()` and `getRedisClient()`.
4. **Worker Migration:** Migrated `financeAutomation.ts`, `retention.ts`, `reportCard.ts`, and `rateLimiter.ts` to use the unified factory.
5. **Deployment Infrastructure Hardening (`render.yaml`):** Isolated database migrations strictly to `preDeployCommand`, added `AWS_*` environment variables to `educore-finance-worker`, and codified `SMS_PROVIDER=mock` fail-fast validation in `backend/src/lib/sms.ts`.

---

## 2. Storage Hardening Verification

### S3 Production Fail-Fast Guard
```typescript
if (process.env.NODE_ENV === "production") {
  if (rawEndpoint.includes("localhost") || rawEndpoint.includes("127.0.0.1") || rawEndpoint.includes(":9000")) {
    throw new Error("FATAL: Production storage configured with insecure localhost/MinIO endpoint: " + rawEndpoint);
  }
  if (accessKeyId === "minioadmin" || secretAccessKey === "minioadmin") {
    throw new Error("FATAL: Production storage configured with insecure default minioadmin credentials.");
  }
}
```

### Storage Unit Tests (`backend/src/lib/__tests__/storage.test.ts`)
```
pnpm --filter @schoolmitra/backend test -- src/lib/__tests__/storage.test.ts
```
**Results:** 9/9 passed.
- Path traversal rejection on presigned upload, download, and buffer upload.
- Tenant scoping prefix enforcement (`schools/${schoolId}/` or `${schoolId}/`).
- 10MB payload size limit enforcement.

---

## 3. Centralized Redis Connection Verification

### Implementation (`backend/src/lib/redisConnection.ts`)
- Configures `maxRetriesPerRequest: null` across all BullMQ queues and workers.
- Throws fatal configuration error in production if `REDIS_URL` or `REDIS_HOST/PORT` is missing.

### Unit Tests (`backend/src/lib/__tests__/redisConnection.test.ts`)
```
pnpm --filter @schoolmitra/backend test -- src/lib/__tests__/redisConnection.test.ts
```
**Results:** 5/5 passed.

---

## 4. Full Suite Test Verification

```
pnpm run test
```
- `@schoolmitra/backend`: 24 test files passed (166 tests).
- `@schoolmitra/frontend`: 19 test files passed (137 tests).
- Total tests passed: **303 tests, 0 failures**.

```
pnpm run type-check
```
- All 6 packages passed cleanly without errors.

---

## 5. Sign-off

Stage S2-E Storage & Redis Configuration Integrity is complete, verified, and ready for commit.
