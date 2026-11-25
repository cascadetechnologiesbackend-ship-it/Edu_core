# 06 Webhook Security & Idempotency Audit

**Directive ID:** `EDUCORE_MASTER_PRODUCTION_READINESS_CERTIFICATION`  
**Endpoint:** `/api/webhooks/razorpay`  
**Security Primitives:** HMAC-SHA256 signature verification, CAS state transitions, Postgres 23505 collision handling  
**Verdict:** **PASS**  

---

## 1. Webhook Security Controls

The Razorpay webhook endpoint (`frontend/src/app/api/webhooks/razorpay/route.ts`) handles incoming financial transactions.

### Key Guarantees Implemented:
1. **Cryptographic Signature Verification:** Enforces `x-razorpay-signature` comparison against `process.env.RAZORPAY_WEBHOOK_SECRET`. Rejects missing signatures (400) and unconfigured secrets (503).
2. **Idempotency Guard & CAS Transitions:**
   - Pre-check: If `log.status === "PAID"` or `log.gatewayPaymentId === payment.id`, returns `200 { message: "Order already fulfilled" }`.
   - Atomic CAS: `UPDATE payment_gateway_logs SET status = 'PAID' ... WHERE id = log.id AND status <> 'PAID'`. If 0 rows updated, concurrent process won; aborts gracefully.
3. **Database Uniqueness Resilience:** Wraps `feePayments.insert()` in a dedicated try-catch for PostgreSQL error code `23505` (`unique_violation` on `(school_id, transaction_reference)`), ensuring zero duplicate payment entries.
4. **Tenant Scoping:** All state mutations and invoice updates execute inside `withTenant(log.schoolId)`.

---

## 2. Test Verification Evidence

```
 ✓ src/app/api/webhooks/razorpay/__tests__/route.test.ts  (5 tests) 21ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
```
- Missing signature header -> 400 Bad Request (PASSED)
- Unset/default secret -> 503 Service Unavailable (PASSED)
- Tampered signature -> 400 Invalid Signature (PASSED)
- Valid capture payload -> CAS update, fee extraction, S3 archival trigger (PASSED)
- Concurrent/duplicate retry -> Idempotency fulfillment (PASSED)
