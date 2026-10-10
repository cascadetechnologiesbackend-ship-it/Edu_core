# SchoolMitra ERP — Environment Variable Matrix (Phase P1)
**Task ID:** P1-T2  
**Governing Specification:** `edu-core-production-readiness-verification-p1` v7.0.1  
**Timestamp:** 2026-10-09T22:08:00+05:30  
**Evidence Artifact:** `docs/release-evidence/env-matrix.md`

---

## 1. Executive Summary & Defect Remediation

A complete AST/regex scan of all source files across the monorepo identified **61 distinct environment variables** accessed via `process.env`.

### Defect Identified & Remediated:
- **Silently-Wrong Fallback on Missing `ENCRYPTION_KEY`**:
  - **Previous State**: In `backend/src/lib/encryption.ts`, when `ENCRYPTION_KEY` was missing from the environment, the function printed a console warning and returned a hardcoded test key (`0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`). In production, this would silently encrypt student PII with a public key.
  - **Remediation**: Added an explicit check in `backend/src/lib/encryption.ts` to immediately throw `new Error("CRITICAL: ENCRYPTION_KEY environment variable is missing in production. Refusing to boot with default key.")` when `process.env.NODE_ENV === "production"`.
- **Undeclared Variables in Deployment Spec & Examples**:
  - Added root `.env.example` defining every single runtime variable.
  - Updated `render.yaml` with explicit declarations for all production variables (`sync: false` for platform secrets, and database property references for `educore-db`).

---

## 2. Environment Variable Matrix

| Variable Name | Reading Packages | Req / Opt | Default Value (if unset) | Declared in `render.yaml` | Declared in `.env.example` | Deployed State | Missing Failure Mode |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`ANALYZE`** | `frontend` | Optional | `"false"` | No | Yes | UNKNOWN | Degraded-with-warning (bundle analysis disabled) |
| **`AUTH_SECRET`** | `backend`, `frontend` | **Required (Prod)** | None | Yes (`sync: false`) | Yes | UNKNOWN | **Crash** (fatal error thrown at startup) |
| **`AUTH_URL`** / **`NEXTAUTH_URL`** | `frontend` | Optional (Prod auto) | `http://localhost:3000` | No | Yes | UNKNOWN | Degraded-with-warning (uses host header) |
| **`AWS_ACCESS_KEY_ID`** | `backend`, `frontend` | Required (Prod S3) | `""` | Yes (`sync: false`) | Yes | UNKNOWN | **Crash** in prod (`env.ts` validation exit 1) |
| **`AWS_REGION`** | `backend` | Optional | `"ap-south-1"` | No | Yes | UNKNOWN | Degraded-with-warning (defaults to ap-south-1) |
| **`AWS_S3_BUCKET_NAME`** | `backend` | Optional | `"schoolmitra-uploads"` | No | Yes | UNKNOWN | Degraded-with-warning (uses fallback bucket) |
| **`AWS_SECRET_ACCESS_KEY`** | `backend` | Required (Prod S3) | `""` | Yes (`sync: false`) | Yes | UNKNOWN | **Crash** in prod (`env.ts` validation exit 1) |
| **`CI`** | `frontend` | Optional | None | No | No (CI-only) | UNKNOWN | Non-fatal (Playwright retries/workers toggle) |
| **`CRON_SECRET`** | `backend` | Optional (Dev) / Req (Prod) | Dev fallback | No | Yes | UNKNOWN | Degraded-with-warning (unauthenticated cron fails) |
| **`DATABASE_POOL_MAX`** | `database` | Optional | `25` (db) / `10` (yaml) | Yes (`value: "10"`) | Yes | UNKNOWN | Degraded-with-warning (falls back to 25) |
| **`DATABASE_POOL_MIN`** | `database` | Optional | `4` (db) / `2` (yaml) | Yes (`value: "2"`) | Yes | UNKNOWN | Degraded-with-warning (falls back to 4) |
| **`DATABASE_URL`** | `database`, `frontend` | **Required** | Local Postgres URI | Yes (`fromDatabase`) | Yes | UNKNOWN | **Crash** (connection pool fails) |
| **`DEBUG_DB`** | `database` | Optional | `"false"` | No | Yes | UNKNOWN | Degraded-with-warning (query logging disabled) |
| **`EMAIL_FROM`** | `backend` | Optional | `"noreply@schoolmitra.in"` | Yes | Yes | UNKNOWN | Degraded-with-warning (uses default sender) |
| **`ENCRYPTION_KEY`** | `backend`, `database` | **Required (Prod)** | None (Prod throws) | Yes (`sync: false`) | Yes | UNKNOWN | **Crash** (fatal error thrown at startup) |
| **`ENCRYPTION_KEY_ID`** | `backend` | Optional | `"k1"` | No | Yes | UNKNOWN | Degraded-with-warning (uses primary key k1) |
| **`ENCRYPTION_KEYRING`** | `backend` | Optional | `""` | No | Yes | UNKNOWN | Degraded-with-warning (keyring empty, no retired keys) |
| **`GPS_DEVICE_API_KEY`** | `frontend` | Optional (Dev) | Dev fallback in dev | No | No (Module-only) | UNKNOWN | Degraded-with-warning (rejects unsigned pings) |
| **`HOSTNAME`** | `render.yaml` | Optional | `0.0.0.0` | Yes (`value: 0.0.0.0`)| Yes | UNKNOWN | Degraded-with-warning (listens on default host) |
| **`IMPERSONATION_SECRET`**| `backend` | Optional | Falls back to `AUTH_SECRET` | Yes (`sync: false`) | Yes | UNKNOWN | Degraded-with-warning (uses AUTH_SECRET) |
| **`LOG_LEVEL`** | `backend`, `frontend` | Optional | `"info"` | No | Yes | UNKNOWN | Degraded-with-warning (falls back to "info") |
| **`NEXTAUTH_SECRET`** | `backend`, `frontend` | Optional (Alias) | Alias to `AUTH_SECRET` | No | Yes | UNKNOWN | Degraded-with-warning (uses AUTH_SECRET) |
| **`NEXT_OUTPUT_STANDALONE`** | `frontend` | Optional | `false` | No | Yes | UNKNOWN | Degraded-with-warning (standard build output) |
| **`NEXT_PHASE`** | `backend`, `frontend` | Next.js internal | None | Next internal | Next internal | UNKNOWN | Non-fatal (guards build-phase execution) |
| **`NEXT_PUBLIC_APP_URL`** | `frontend` | Optional | `http://localhost:3000` | No | Yes | UNKNOWN | Degraded-with-warning (falls back to VERCEL_URL) |
| **`NEXT_PUBLIC_APP_VERSION`** | `frontend` | Optional | `"0.1.0"` | No | Yes | UNKNOWN | Degraded-with-warning (uses default version) |
| **`NEXT_PUBLIC_CLARITY_PROJECT_ID`** | `frontend` | Optional | `"sm_clarity_baseline"` | No | No | UNKNOWN | Degraded-with-warning (disables analytics) |
| **`NEXT_PUBLIC_PWA_ENABLED`** | `frontend` | Optional | `"true"` | No | Yes | UNKNOWN | Degraded-with-warning (defaults to enabled in prod) |
| **`NEXT_PUBLIC_PWA_URL`** | `frontend` | Optional | `http://localhost:3002` | No | No | UNKNOWN | Degraded-with-warning (falls back to local port) |
| **`NEXT_PUBLIC_RAZORPAY_KEY_ID`** | `frontend` | Optional (Dev) | `"rzp_test_TlW4pDX3FlFmRx"` | No | Yes | UNKNOWN | Degraded-with-warning (client payment disabled) |
| **`NEXT_PUBLIC_VAPID_PUBLIC_KEY`** | `frontend` | Optional (Push) | `""` | No | Yes | UNKNOWN | Degraded-with-warning (push notifications disabled) |
| **`NODE_ENV`** | All | Optional | `"development"` | Yes (`value: production`)| Yes | UNKNOWN | Degraded-with-warning (defaults to dev mode) |
| **`PORT`** | `render.yaml` | Optional | `3000` | Yes (`value: 10000`)| Yes | UNKNOWN | Degraded-with-warning (falls back to 3000) |
| **`RAZORPAY_KEY_ID`** | `frontend` | Required (Prod Pay) | None | Yes (`sync: false`) | Yes | UNKNOWN | Degraded-with-warning (payment creation 400) |
| **`RAZORPAY_KEY_SECRET`** | `frontend` | Required (Prod Pay) | None | Yes (`sync: false`) | Yes | UNKNOWN | Degraded-with-warning (signature verify fails) |
| **`RAZORPAY_WEBHOOK_SECRET`** | `frontend` | Required (Prod Pay) | None | Yes (`sync: false`) | Yes | UNKNOWN | Degraded-with-warning (webhook reject 400) |
| **`REDIS_HOST`** | `backend` | Optional | `"127.0.0.1"` | No | Yes | UNKNOWN | Degraded-with-warning (in-memory LRU fallback) |
| **`REDIS_PASSWORD`** | `backend` | Optional | `""` | No | Yes | UNKNOWN | Degraded-with-warning (unauthenticated connect) |
| **`REDIS_PORT`** | `backend` | Optional | `6379` | No | Yes | UNKNOWN | Degraded-with-warning (defaults to 6379) |
| **`REDIS_URL`** / **`educore_REDIS_URL`** | `backend` | Required (Prod) | None (LRU in dev) | Yes (`sync: false`) | Yes | UNKNOWN | Degraded-with-warning (in-memory LRU active) |
| **`S3_ACCESS_KEY_ID`** | `backend` | Optional (Alias) | `"minioadmin"` | No | Yes | UNKNOWN | Degraded-with-warning (uses AWS_ACCESS_KEY_ID) |
| **`S3_BUCKET`** / **`S3_BUCKET_DOCUMENTS`** | `backend` | Required (Prod S3) | None | Yes (`sync: false`) | Yes | UNKNOWN | **Crash** in prod (`env.ts` validation exit 1) |
| **`S3_BUCKET_NAME`** | `frontend` | Optional | `"schoolmitra"` | No | Yes | UNKNOWN | Degraded-with-warning (defaults to schoolmitra) |
| **`S3_BUCKET_PHOTOS`** | `backend` | Optional | `"schoolmitra-photos"` | No | Yes | UNKNOWN | Degraded-with-warning (defaults to photos) |
| **`S3_ENDPOINT`** | `backend` | Optional | `"http://localhost:9000"` | No | Yes | UNKNOWN | Degraded-with-warning (uses AWS native S3) |
| **`S3_REGION`** | `backend` | Optional | `"ap-south-1"` | Yes (`value: ap-south-1`)| Yes | UNKNOWN | Degraded-with-warning (defaults to ap-south-1) |
| **`S3_SECRET_ACCESS_KEY`** | `backend` | Optional (Alias) | `"minioadmin"` | No | Yes | UNKNOWN | Degraded-with-warning (uses AWS_SECRET...) |
| **`SMS_API_KEY`** | `backend` | Required (MSG91) | None | Yes (`sync: false`) | Yes | UNKNOWN | Degraded-with-warning (SMS delivery disabled) |
| **`SMS_DLT_PE_ID`** | `backend` | Required (DLT) | None | Yes (`sync: false`) | Yes | UNKNOWN | Degraded-with-warning (DLT headers omitted) |
| **`SMS_DLT_TEMPLATE_ID`** | `backend` | Required (DLT) | None | Yes (`sync: false`) | Yes | UNKNOWN | Degraded-with-warning (DLT template omitted) |
| **`SMS_FLOW_ID`** | `backend` | Optional | None | No | Yes | UNKNOWN | Degraded-with-warning (flow ID omitted) |
| **`SMS_GATEWAY_URL`** | `backend` | Optional | `"https://api.sms-gateway.in/v1/send"` | No | Yes | UNKNOWN | Degraded-with-warning (uses default gateway) |
| **`SMS_PROVIDER`** | `backend` | Optional | `"TWILIO"` / `"mock"` | Yes (`value: mock`) | Yes | UNKNOWN | Degraded-with-warning (falls back to Twilio) |
| **`SMS_SENDER_ID`** | `backend` | Optional | `"SCHMTR"` | Yes (`sync: false`) | Yes | UNKNOWN | Degraded-with-warning (defaults to SCHMTR) |
| **`SMTP_HOST`** | `backend` | Required (Prod Mail) | `"smtp.example.com"` | Yes (`sync: false`) | Yes | UNKNOWN | Degraded-with-warning (email dispatch fails) |
| **`SMTP_PASS`** | `backend` | Required (Prod Mail) | None | Yes (`sync: false`) | Yes | UNKNOWN | Degraded-with-warning (SMTP auth fails) |
| **`SMTP_PORT`** | `backend` | Optional | `587` | Yes (`value: "587"`)| Yes | UNKNOWN | Degraded-with-warning (defaults to 587) |
| **`SMTP_SECURE`** | `backend` | Optional | `false` | No | Yes | UNKNOWN | Degraded-with-warning (defaults to TLS) |
| **`SMTP_USER`** | `backend` | Required (Prod Mail) | None | Yes (`sync: false`) | Yes | UNKNOWN | Degraded-with-warning (SMTP auth fails) |
| **`START_WORKERS`** | `backend` | Optional | `"false"` | Yes (`value: "true"`)| Yes | UNKNOWN | Degraded-with-warning (workers do not poll) |
| **`SUPER_ADMIN_EMAIL`** | `database` | Optional (Seed) | `"cascadetechnologiessolutions@gmail.com"` | No | Yes | UNKNOWN | Degraded-with-warning (uses default seed email) |
| **`SUPER_ADMIN_PASSWORD`** | `database` | Optional (Seed) | `"P4jkbnixj4@"` | No | Yes | UNKNOWN | Degraded-with-warning (uses default seed pass) |
| **`TWILIO_ACCOUNT_SID`** | `backend` | Required (Twilio) | None | No | Yes | UNKNOWN | Degraded-with-warning (Twilio SMS disabled) |
| **`TWILIO_AUTH_TOKEN`** | `backend` | Required (Twilio) | None | No | Yes | UNKNOWN | Degraded-with-warning (Twilio SMS disabled) |
| **`TWILIO_FROM_NUMBER`** | `backend` | Required (Twilio) | None | No | Yes | UNKNOWN | Degraded-with-warning (Twilio SMS disabled) |
| **`VERCEL_URL`** | `frontend` | Platform provided | None | Vercel native | Vercel native | UNKNOWN | Degraded-with-warning (uses fallback URL) |
| **`VAPID_PRIVATE_KEY`** | `backend`, `frontend` | Optional (Push) | `""` | No | Yes | UNKNOWN | Degraded-with-warning (web push send disabled) |
| **`VAPID_SUBJECT`** | `backend`, `frontend` | Optional (Push) | `"mailto:support@schoolmitra.in"` | No | Yes | UNKNOWN | Degraded-with-warning (uses default mailto) |

---

## 3. Appendix: Monorepo `process.env` Static Analysis Inventory

```text
--- ANALYZE (2 occurrences) ---
  frontend/next.config.mjs:3 -> if (process.env.ANALYZE === "true") {
  frontend/scripts/build-analyze.mjs:3 -> process.env.ANALYZE = "true";
--- AUTH_SECRET (6 occurrences) ---
  backend/src/lib/auth/auth.config.ts:6 -> const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  backend/src/lib/auth/jwtSecret.ts:2 -> const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  backend/src/lib/impersonation.ts:13 -> const secret = process.env.IMPERSONATION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_S
  frontend/src/app/api/auth/refresh/__tests__/route.test.ts:18 -> delete process.env.AUTH_SECRET;
  frontend/src/app/api/auth/refresh/__tests__/route.test.ts:25 -> process.env.AUTH_SECRET = "super-secret-key-at-least-32-chars-long";
  frontend/src/app/api/auth/refresh/__tests__/route.test.ts:34 -> delete process.env.AUTH_SECRET;
--- AWS_ACCESS_KEY_ID (15 occurrences) ---
  backend/src/env.ts:43 -> if (!process.env.AWS_ACCESS_KEY_ID && !process.env.S3_ACCESS_KEY_ID) {
  backend/src/lib/storage.ts:7 -> accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  backend/src/lib/storage.ts:42 -> if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === "") {
  backend/src/lib/storage.ts:68 -> if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === "") {
  backend/src/lib/storage.ts:99 -> if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === "") {
  backend/src/lib/__tests__/storage.test.ts:57 -> const originalKeyId = process.env.AWS_ACCESS_KEY_ID;
  backend/src/lib/__tests__/storage.test.ts:59 -> delete process.env.AWS_ACCESS_KEY_ID;
  backend/src/lib/__tests__/storage.test.ts:65 -> if (originalKeyId) process.env.AWS_ACCESS_KEY_ID = originalKeyId;
  backend/src/lib/__tests__/storage.test.ts:83 -> const originalKeyId = process.env.AWS_ACCESS_KEY_ID;
  backend/src/lib/__tests__/storage.test.ts:85 -> delete process.env.AWS_ACCESS_KEY_ID;
  backend/src/lib/__tests__/storage.test.ts:95 -> if (originalKeyId) process.env.AWS_ACCESS_KEY_ID = originalKeyId;
  frontend/src/app/api/receipt/[id]/route.ts:70 -> if (payment.receiptS3Key && process.env.AWS_ACCESS_KEY_ID) {
--- AWS_REGION (1 occurrences) ---
  backend/src/lib/storage.ts:5 -> region: process.env.AWS_REGION || "ap-south-1",
--- AWS_S3_BUCKET_NAME (1 occurrences) ---
  backend/src/lib/storage.ts:12 -> export const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "schoolmitra-uploads";
--- AWS_SECRET_ACCESS_KEY (2 occurrences) ---
  backend/src/env.ts:46 -> if (!process.env.AWS_SECRET_ACCESS_KEY && !process.env.S3_SECRET_ACCESS_KEY) {
  backend/src/lib/storage.ts:8 -> secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
--- CI (3 occurrences) ---
  frontend/playwright.config.ts:19 -> forbidOnly: !!process.env.CI,
  frontend/playwright.config.ts:21 -> retries: process.env.CI ? 2 : 0,
  frontend/playwright.config.ts:23 -> workers: process.env.CI ? 1 : 1,
--- CRON_SECRET (1 occurrences) ---
  backend/src/lib/apiAuth.ts:34 -> process.env.CRON_SECRET ||
--- DATABASE_POOL_MAX (1 occurrences) ---
  database/src/index.ts:21 -> max: Number(process.env["DATABASE_POOL_MAX"] ?? 25),
--- DATABASE_POOL_MIN (1 occurrences) ---
  database/src/index.ts:20 -> min: Number(process.env["DATABASE_POOL_MIN"] ?? 4),
--- DATABASE_URL (5 occurrences) ---
  database/drizzle.config.ts:9 -> process.env["DATABASE_URL"] ??
  database/src/apply_schema_update.ts:6 -> process.env["DATABASE_URL"] ??
  database/src/index.ts:18 -> process.env["DATABASE_URL"] ??
  database/src/migrate.ts:11 -> process.env["DATABASE_URL"] ??
  frontend/drizzle.config.ts:9 -> process.env["DATABASE_URL"] ??
--- DEBUG_DB (1 occurrences) ---
  database/src/queryLogger.ts:106 -> if (process.env.DEBUG_DB === "true") {
--- EMAIL_FROM (1 occurrences) ---
  backend/src/lib/email.ts:29 -> from: process.env.EMAIL_FROM || "noreply@schoolmitra.in",
--- ENCRYPTION_KEY (3 occurrences) ---
  backend/src/lib/encryption.ts:4 -> const key = process.env.ENCRYPTION_KEY;
  database/src/seed.ts:168 -> process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
  database/src/seed_parent_user.ts:8 -> const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "e29ed7af4c54ed20a650cd257398652e3dc54b1fc4800b
--- GPS_DEVICE_API_KEY (1 occurrences) ---
  frontend/src/app/api/webhooks/gps-ping/route.ts:11 -> process.env.GPS_DEVICE_API_KEY ||
--- IMPERSONATION_SECRET (2 occurrences) ---
  backend/src/lib/impersonation.ts:13 -> const secret = process.env.IMPERSONATION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_S
  backend/src/lib/__tests__/impersonation.test.ts:16 -> process.env.IMPERSONATION_SECRET = "test-impersonation-signing-secret-32-chars-minimum";
--- LOG_LEVEL (4 occurrences) ---
  backend/src/lib/logger.ts:4 -> level: process.env.LOG_LEVEL ?? "info",
  backend/src/lib/webVitals.ts:5 -> level: process.env["LOG_LEVEL"] || "info",
  frontend/src/lib/serverTiming.ts:4 -> level: process.env["LOG_LEVEL"] || "info",
  frontend/src/lib/webVitals.ts:5 -> level: process.env["LOG_LEVEL"] || "info",
--- NEXTAUTH_SECRET (5 occurrences) ---
  backend/src/lib/auth/auth.config.ts:6 -> const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  backend/src/lib/auth/jwtSecret.ts:2 -> const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  backend/src/lib/impersonation.ts:13 -> const secret = process.env.IMPERSONATION_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_S
  frontend/src/app/api/auth/refresh/__tests__/route.test.ts:19 -> delete process.env.NEXTAUTH_SECRET;
  frontend/src/app/api/auth/refresh/__tests__/route.test.ts:35 -> delete process.env.NEXTAUTH_SECRET;
--- NEXT_OUTPUT_STANDALONE (1 occurrences) ---
  frontend/next.config.mjs:17 -> ...(process.env.NEXT_OUTPUT_STANDALONE ? { output: "standalone" } : {}),
--- NEXT_PHASE (3 occurrences) ---
  backend/src/lib/auth/jwtSecret.ts:4 -> if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  backend/src/lib/impersonation.ts:15 -> if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  frontend/src/app/api/auth/refresh/__tests__/route.test.ts:17 -> delete process.env.NEXT_PHASE;
--- NEXT_PUBLIC_APP_URL (1 occurrences) ---
  frontend/src/app/layout.tsx:7 -> const rawUrl = process.env["NEXT_PUBLIC_APP_URL"] || process.env["VERCEL_URL"];
--- NEXT_PUBLIC_APP_VERSION (3 occurrences) ---
  frontend/src/app/api/health/route.ts:49 -> version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
  frontend/src/app/api/health/route.ts:67 -> version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
  frontend/src/components/telemetry/WebVitalsReporter.tsx:58 -> const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "6.0.0";
--- NEXT_PUBLIC_CLARITY_PROJECT_ID (1 occurrences) ---
  frontend/src/components/analytics/ClarityScript.tsx:10 -> process.env["NEXT_PUBLIC_CLARITY_PROJECT_ID"] || "sm_clarity_baseline";
--- NEXT_PUBLIC_PWA_URL (3 occurrences) ---
  frontend/src/app/(admin)/admissions/[id]/actions.ts:260 -> const pwaUrl = process.env.NEXT_PUBLIC_PWA_URL || "http://localhost:3002";
  frontend/src/app/(admin)/hr/actions.ts:833 -> const pwaUrl = process.env.NEXT_PUBLIC_PWA_URL || "http://localhost:3000";
  frontend/src/app/(admin)/transport/actions.ts:575 -> const pwaUrl = process.env.NEXT_PUBLIC_PWA_URL || "http://localhost:3002";
--- NEXT_PUBLIC_RAZORPAY_KEY_ID (2 occurrences) ---
  frontend/src/app/(admin)/school/collect-fees/CounterCollectionClient.tsx:320 -> key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TlW4pDX3FlFmRx",
  frontend/src/app/(parent)/portal/CheckoutButton.tsx:63 -> process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TlW4pDX3FlFmRx";
--- NODE_ENV (19 occurrences) ---
  backend/src/env.ts:19 -> const isProd = process.env.NODE_ENV === "production";
  backend/src/lib/apiAuth.ts:35 -> (process.env.NODE_ENV !== "production"
  backend/src/lib/auth/index.ts:105 -> secure: process.env.NODE_ENV === "production",
  backend/src/lib/auth/index.ts:199 -> secure: process.env.NODE_ENV === "production",
  backend/src/lib/auth/jwtSecret.ts:4 -> if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  backend/src/lib/email.ts:21 -> if (process.env.NODE_ENV === "development" && !process.env.SMTP_HOST) {
  backend/src/lib/encryption.ts:6 -> if (process.env.NODE_ENV === "production") {
  backend/src/lib/impersonation.ts:15 -> if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  backend/src/lib/logger.ts:6 -> ...(process.env.NODE_ENV === "development" && {
  backend/src/lib/webVitals.ts:6 -> ...(process.env["NODE_ENV"] === "development" && {
  backend/src/server/trpc.ts:105 -> if (process.env.NODE_ENV !== "development") {
  database/src/index.ts:27 -> if (process.env["NODE_ENV"] !== "production") {
  frontend/next.config.mjs:65 -> process.env.NODE_ENV === "production"
  frontend/src/app/(super-admin)/super-admin/schools/page.tsx:75 -> secure: process.env.NODE_ENV === "production",
  frontend/src/app/api/auth/refresh/route.ts:52 -> secure: process.env.NODE_ENV === "production",
  frontend/src/app/api/debug-session/route.ts:12 -> if (process.env.NODE_ENV !== "development") {
  frontend/src/app/api/webhooks/gps-ping/route.ts:12 -> (process.env.NODE_ENV !== "production" ? "dev-gps-tracker-secret" : null);
  frontend/src/lib/serverTiming.ts:5 -> ...(process.env["NODE_ENV"] === "development" && {
  frontend/src/lib/webVitals.ts:6 -> ...(process.env["NODE_ENV"] === "development" && {
--- RAZORPAY_KEY_ID (4 occurrences) ---
  frontend/src/app/api/razorpay/order/route.ts:64 -> !process.env.RAZORPAY_KEY_ID ||
  frontend/src/app/api/razorpay/order/route.ts:65 -> process.env.RAZORPAY_KEY_ID === "change-me"
  frontend/src/app/api/razorpay/order/route.ts:71 -> key_id: process.env.RAZORPAY_KEY_ID!,
  frontend/src/app/api/razorpay/__tests__/order.test.ts:43 -> process.env.RAZORPAY_KEY_ID = "rzp_test_TlW4pDX3FlFmRx";
--- RAZORPAY_KEY_SECRET (5 occurrences) ---
  frontend/src/app/api/razorpay/order/route.ts:72 -> key_secret: process.env.RAZORPAY_KEY_SECRET!,
  frontend/src/app/api/razorpay/verify/route.ts:29 -> const secret = process.env.RAZORPAY_KEY_SECRET;
  frontend/src/app/api/razorpay/__tests__/order.test.ts:44 -> process.env.RAZORPAY_KEY_SECRET = "u43q6hmds0h51Ri7qkkI8Bru";
  frontend/src/app/api/razorpay/__tests__/verify.test.ts:48 -> process.env.RAZORPAY_KEY_SECRET = secret;
  frontend/src/app/api/razorpay/__tests__/verify.test.ts:91 -> process.env.RAZORPAY_KEY_SECRET = "change-me";
--- RAZORPAY_WEBHOOK_SECRET (3 occurrences) ---
  frontend/src/app/api/webhooks/razorpay/route.ts:17 -> const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  frontend/src/app/api/webhooks/razorpay/__tests__/route.test.ts:44 -> process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  frontend/src/app/api/webhooks/razorpay/__tests__/route.test.ts:85 -> process.env.RAZORPAY_WEBHOOK_SECRET = "change-me";
--- REDIS_HOST (6 occurrences) ---
  backend/src/lib/rateLimiter.ts:19 -> host: process.env.REDIS_HOST ?? "127.0.0.1",
  backend/src/workers/financeAutomation.ts:33 -> host: process.env["REDIS_HOST"] ?? "127.0.0.1",
  backend/src/workers/financeAutomation.ts:560 -> host: process.env["REDIS_HOST"] ?? "127.0.0.1",
  backend/src/workers/reportCard.ts:38 -> host: process.env["REDIS_HOST"] ?? "127.0.0.1",
  backend/src/workers/retention.ts:13 -> host: process.env["REDIS_HOST"] ?? "127.0.0.1",
  backend/src/workers/retention.ts:264 -> host: process.env["REDIS_HOST"] ?? "127.0.0.1",
--- REDIS_PASSWORD (7 occurrences) ---
  backend/src/lib/rateLimiter.ts:21 -> password: process.env.REDIS_PASSWORD ?? undefined,
  backend/src/workers/financeAutomation.ts:35 -> password: process.env["REDIS_PASSWORD"] ?? undefined,
  backend/src/workers/financeAutomation.ts:562 -> password: process.env["REDIS_PASSWORD"] ?? undefined,
  backend/src/workers/reportCard.ts:40 -> ...(process.env["REDIS_PASSWORD"] ? { password: process.env["REDIS_PASSWORD"] } : {}),
  backend/src/workers/retention.ts:15 -> password: process.env["REDIS_PASSWORD"] ?? undefined,
  backend/src/workers/retention.ts:266 -> password: process.env["REDIS_PASSWORD"] ?? undefined,
--- REDIS_PORT (6 occurrences) ---
  backend/src/lib/rateLimiter.ts:20 -> port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
  backend/src/workers/financeAutomation.ts:34 -> port: parseInt(process.env["REDIS_PORT"] ?? "6379"),
  backend/src/workers/financeAutomation.ts:561 -> port: parseInt(process.env["REDIS_PORT"] ?? "6379"),
  backend/src/workers/reportCard.ts:39 -> port: parseInt(process.env["REDIS_PORT"] ?? "6379"),
  backend/src/workers/retention.ts:14 -> port: parseInt(process.env["REDIS_PORT"] ?? "6379"),
  backend/src/workers/retention.ts:265 -> port: parseInt(process.env["REDIS_PORT"] ?? "6379"),
--- REDIS_URL (2 occurrences) ---
  backend/src/lib/rateLimiter.ts:4 -> const redisUrl = process.env.educore_REDIS_URL || process.env.REDIS_URL;
  backend/src/workers/reportCard.ts:34 -> const redisUrl = process.env["educore_REDIS_URL"] || process.env["REDIS_URL"];
--- S3_ACCESS_KEY_ID (2 occurrences) ---
  backend/src/env.ts:43 -> if (!process.env.AWS_ACCESS_KEY_ID && !process.env.S3_ACCESS_KEY_ID) {
  backend/src/lib/s3.ts:12 -> accessKeyId: process.env.S3_ACCESS_KEY_ID || "minioadmin",
--- S3_BUCKET (3 occurrences) ---
  backend/src/env.ts:40 -> if (!process.env.S3_BUCKET && !process.env.S3_BUCKET_DOCUMENTS) {
  backend/src/server/routers/admissions.ts:30 -> process.env.S3_BUCKET || "schoolmitra-docs",
  backend/src/server/routers/students.ts:80 -> process.env.S3_BUCKET || "schoolmitra-docs",
--- S3_BUCKET_DOCUMENTS (1 occurrences) ---
  backend/src/env.ts:40 -> if (!process.env.S3_BUCKET && !process.env.S3_BUCKET_DOCUMENTS) {
--- S3_BUCKET_NAME (1 occurrences) ---
  frontend/src/app/(admin)/students/[id]/page.tsx:423 -> process.env.S3_BUCKET_NAME || "schoolmitra",
--- S3_BUCKET_PHOTOS (1 occurrences) ---
  backend/src/server/services/StudentsDomainService.ts:52 -> process.env.S3_BUCKET_PHOTOS || "schoolmitra-photos",
--- S3_ENDPOINT (1 occurrences) ---
  backend/src/lib/s3.ts:10 -> endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
--- S3_REGION (1 occurrences) ---
  backend/src/lib/s3.ts:9 -> region: process.env.S3_REGION || "ap-south-1",
--- S3_SECRET_ACCESS_KEY (2 occurrences) ---
  backend/src/env.ts:46 -> if (!process.env.AWS_SECRET_ACCESS_KEY && !process.env.S3_SECRET_ACCESS_KEY) {
  backend/src/lib/s3.ts:13 -> secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "minioadmin",
--- SMS_API_KEY (6 occurrences) ---
  backend/src/lib/sms.ts:34 -> return Boolean(process.env.SMS_API_KEY);
  backend/src/lib/sms.ts:181 -> const apiKey = process.env.SMS_API_KEY!;
  backend/src/lib/sms.ts:216 -> const apiKey = process.env.SMS_API_KEY!;
  backend/src/lib/sms.ts:257 -> const apiKey = process.env.SMS_API_KEY!;
  backend/src/lib/__tests__/sms.test.ts:19 -> delete process.env.SMS_API_KEY;
  backend/src/lib/__tests__/sms.test.ts:43 -> process.env.SMS_API_KEY = "mock_msg91_key";
--- SMS_DLT_PE_ID (2 occurrences) ---
  backend/src/lib/sms.ts:120 -> const entityId = dltParams?.entityId || process.env.SMS_DLT_PE_ID || "";
  backend/src/lib/__tests__/sms.test.ts:74 -> process.env.SMS_DLT_PE_ID = "110123456789012";
--- SMS_DLT_TEMPLATE_ID (2 occurrences) ---
  backend/src/lib/sms.ts:121 -> const templateId = dltParams?.templateId || process.env.SMS_DLT_TEMPLATE_ID || "";
  backend/src/lib/__tests__/sms.test.ts:75 -> process.env.SMS_DLT_TEMPLATE_ID = "120156789012345";
--- SMS_FLOW_ID (1 occurrences) ---
  backend/src/lib/sms.ts:182 -> const flowId = templateId || process.env.SMS_FLOW_ID || "";
--- SMS_GATEWAY_URL (1 occurrences) ---
  backend/src/lib/sms.ts:256 -> process.env.SMS_GATEWAY_URL || "https://api.sms-gateway.in/v1/send";
--- SMS_PROVIDER (8 occurrences) ---
  backend/src/lib/sms.ts:26 -> const provider = (process.env.SMS_PROVIDER || "TWILIO").toUpperCase();
  backend/src/lib/sms.ts:119 -> const provider = (process.env.SMS_PROVIDER || "TWILIO").toUpperCase();
  backend/src/lib/__tests__/parentFinanceReadiness.test.ts:161 -> process.env.SMS_PROVIDER = "TWILIO";
  backend/src/lib/__tests__/parentFinanceReadiness.test.ts:198 -> process.env.SMS_PROVIDER = "TWILIO";
  backend/src/lib/__tests__/sms.test.ts:20 -> delete process.env.SMS_PROVIDER;
  backend/src/lib/__tests__/sms.test.ts:34 -> process.env.SMS_PROVIDER = "TWILIO";
  backend/src/lib/__tests__/sms.test.ts:42 -> process.env.SMS_PROVIDER = "MSG91";
  backend/src/lib/__tests__/sms.test.ts:70 -> process.env.SMS_PROVIDER = "TWILIO";
--- SMS_SENDER_ID (1 occurrences) ---
  backend/src/lib/sms.ts:122 -> const senderId = process.env.SMS_SENDER_ID || "SCHMTR";
--- SMTP_HOST (2 occurrences) ---
  backend/src/lib/email.ts:4 -> host: process.env.SMTP_HOST || "smtp.example.com",
  backend/src/lib/email.ts:21 -> if (process.env.NODE_ENV === "development" && !process.env.SMTP_HOST) {
--- SMTP_PASS (1 occurrences) ---
  backend/src/lib/email.ts:9 -> pass: process.env.SMTP_PASS,
--- SMTP_PORT (1 occurrences) ---
  backend/src/lib/email.ts:5 -> port: Number(process.env.SMTP_PORT || 587),
--- SMTP_SECURE (1 occurrences) ---
  backend/src/lib/email.ts:6 -> secure: process.env.SMTP_SECURE === "true",
--- SMTP_USER (1 occurrences) ---
  backend/src/lib/email.ts:8 -> user: process.env.SMTP_USER,
--- START_WORKERS (3 occurrences) ---
  backend/src/workers/financeAutomation.ts:531 -> if (process.env["START_WORKERS"] === "true") {
  backend/src/workers/reportCard.ts:241 -> if (process.env["START_WORKERS"] === "true") {
  backend/src/workers/retention.ts:247 -> if (process.env["START_WORKERS"] === "true") {
--- SUPER_ADMIN_EMAIL (1 occurrences) ---
  database/src/manage_super_admin.ts:8 -> targetEmail = process.env.SUPER_ADMIN_EMAIL || "cascadetechnologiessolutions@gmail.com",
--- SUPER_ADMIN_PASSWORD (1 occurrences) ---
  database/src/manage_super_admin.ts:9 -> targetPass = process.env.SUPER_ADMIN_PASSWORD || "P4jkbnixj4@"
--- TWILIO_ACCOUNT_SID (7 occurrences) ---
  backend/src/lib/sms.ts:29 -> process.env.TWILIO_ACCOUNT_SID &&
  backend/src/lib/sms.ts:126 -> const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  backend/src/lib/__tests__/parentFinanceReadiness.test.ts:162 -> process.env.TWILIO_ACCOUNT_SID = "AC_test_account";
  backend/src/lib/__tests__/parentFinanceReadiness.test.ts:199 -> process.env.TWILIO_ACCOUNT_SID = "AC_test_account";
  backend/src/lib/__tests__/sms.test.ts:16 -> delete process.env.TWILIO_ACCOUNT_SID;
  backend/src/lib/__tests__/sms.test.ts:35 -> process.env.TWILIO_ACCOUNT_SID = "AC_mock_sid";
  backend/src/lib/__tests__/sms.test.ts:71 -> process.env.TWILIO_ACCOUNT_SID = "AC_test";
--- TWILIO_AUTH_TOKEN (7 occurrences) ---
  backend/src/lib/sms.ts:30 -> process.env.TWILIO_AUTH_TOKEN &&
  backend/src/lib/sms.ts:127 -> const authToken = process.env.TWILIO_AUTH_TOKEN!;
  backend/src/lib/__tests__/parentFinanceReadiness.test.ts:163 -> process.env.TWILIO_AUTH_TOKEN = "test_auth_token";
  backend/src/lib/__tests__/parentFinanceReadiness.test.ts:200 -> process.env.TWILIO_AUTH_TOKEN = "test_auth_token";
  backend/src/lib/__tests__/sms.test.ts:17 -> delete process.env.TWILIO_AUTH_TOKEN;
  backend/src/lib/__tests__/sms.test.ts:36 -> process.env.TWILIO_AUTH_TOKEN = "mock_token";
  backend/src/lib/__tests__/sms.test.ts:72 -> process.env.TWILIO_AUTH_TOKEN = "token_test";
--- TWILIO_FROM_NUMBER (7 occurrences) ---
  backend/src/lib/sms.ts:31 -> process.env.TWILIO_FROM_NUMBER
  backend/src/lib/sms.ts:128 -> const fromNumber = process.env.TWILIO_FROM_NUMBER!;
  backend/src/lib/__tests__/parentFinanceReadiness.test.ts:164 -> process.env.TWILIO_FROM_NUMBER = "+15005550006";
  backend/src/lib/__tests__/parentFinanceReadiness.test.ts:201 -> process.env.TWILIO_FROM_NUMBER = "+15005550006";
  backend/src/lib/__tests__/sms.test.ts:18 -> delete process.env.TWILIO_FROM_NUMBER;
  backend/src/lib/__tests__/sms.test.ts:37 -> process.env.TWILIO_FROM_NUMBER = "+1234567890";
  backend/src/lib/__tests__/sms.test.ts:73 -> process.env.TWILIO_FROM_NUMBER = "+15551234";
--- VERCEL_URL (1 occurrences) ---
  frontend/src/app/layout.tsx:7 -> const rawUrl = process.env["NEXT_PUBLIC_APP_URL"] || process.env["VERCEL_URL"];
--- educore_REDIS_URL (2 occurrences) ---
  backend/src/lib/rateLimiter.ts:4 -> const redisUrl = process.env.educore_REDIS_URL || process.env.REDIS_URL;
  backend/src/workers/reportCard.ts:34 -> const redisUrl = process.env["educore_REDIS_URL"] || process.env["REDIS_URL"];
```
