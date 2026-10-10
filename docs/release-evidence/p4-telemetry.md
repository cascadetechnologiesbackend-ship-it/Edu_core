# Telemetry Ingestion & API Hardening Proof (Phase P4)
**Task ID:** P4-T2  
**Governing Specification:** `edu-core-production-readiness-verification-p4-p5` v7.0.5  
**Timestamp:** 2026-10-10T21:21:00+05:30  
**Target Route:** `/api/telemetry/vitals`  
**Status:** **VERIFIED**

---

## 1. Executive Summary & Defect Prevention

To enable real-user performance monitoring across client browsers (including pre-login pages such as `/login` and `/manifest.json`), `/api/telemetry` was whitelisted in `backend/src/lib/auth/auth.config.ts`.
Because un-authenticating an endpoint exposes it to potential abuse (denial of service, table bloat, or spam writes), strict multi-layer defense controls were mandated and implemented:
1. **Per-IP Rate Limiting:** Enforced via `checkRateLimit("rate:telemetry:${ip}", 30, 60000)` (maximum 30 batch submissions per minute per IP). Returns HTTP 429 when breached.
2. **Batch Cap Constraint:** Strictly enforced via Zod schema (`metrics: z.array(...).min(1).max(20)`). Oversized batches (>20 entries) are rejected with HTTP 400.
3. **Strict Payload Validation:** Every entry must conform to defined metric names (`TTFB`, `FCP`, `LCP`, `CLS`, `FID`, `INP`), valid values, and UUID tenant scope.
4. **Zero PII Guarantee (PF-R111):** Recursive key scanner verifies that no payload contains user identification fields (`name`, `email`, `phone`, `aadhar`, `studentId`, `admissionNumber`, etc.).

---

## 2. Implementation Proof

### A. Route Handler (`frontend/src/app/api/telemetry/vitals/route.ts`)
```typescript
// IP Rate limiting
const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
const rateLimit = await checkRateLimit(`rate:telemetry:${clientIp}`, 30, 60000);
if (!rateLimit.allowed) {
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
}

// Batch parsing & size cap (max 20)
const body = await request.json();
const parsed = batchSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
}

// Zero-PII check (PF-R111)
if (hasPii(body)) {
  return NextResponse.json({ error: "Payload contains prohibited PII" }, { status: 400 });
}
```

---

## 3. Automated Test Verification (`route.test.ts`)

Test file: `frontend/src/app/api/telemetry/vitals/__tests__/route.test.ts`
All 8 test cases pass:

```text
 ✓ src/app/api/telemetry/vitals/__tests__/route.test.ts (8 tests) 42ms
   ✓ Telemetry Vitals API (/api/telemetry/vitals) > accepts a valid batch of web vitals metrics (HTTP 200)
   ✓ Telemetry Vitals API (/api/telemetry/vitals) > rejects oversized batches (> 20 metrics) with HTTP 400
   ✓ Telemetry Vitals API (/api/telemetry/vitals) > rejects empty batches (< 1 metric) with HTTP 400
   ✓ Telemetry Vitals API (/api/telemetry/vitals) > rejects invalid metric names with HTTP 400
   ✓ Telemetry Vitals API (/api/telemetry/vitals) > enforces per-IP rate limiting returning HTTP 429
   ✓ Telemetry Vitals API (/api/telemetry/vitals) > strictly rejects any payload containing PII (PF-R111)
   ✓ Telemetry Vitals API (/api/telemetry/vitals) > accepts payload without schoolId (super-admin / anonymous session)
   ✓ Telemetry Vitals API (/api/telemetry/vitals) > accepts payload with valid schoolId
```

---

## 4. Verification Verdict

- **Batch Size Cap:** Enforced (max 20).
- **Per-IP Rate Limiting:** Enforced (HTTP 429 on spam).
- **PII Leakage Prevention:** Verified zero PII accepted (PF-R111).
- **Verdict:** **VERIFIED**
