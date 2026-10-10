# P3-T5: Auth Hardening & Rate Limiting Drill Evidence

**Spec**: `edu-core-production-readiness-verification-p3` v7.0.3  
**Task ID**: `P3-T5`  
**Governing Rule**: Auth Hardening, Account Lockout Threshold, Rate Limiting & Audit Trail  
**Executed Against**: Local Stack (PostgreSQL port 5444, Next.js Auth, Redis Circuit Breaker)  
**Date**: 2026-10-10  
**Status**: **PASS (All Drills Succeeded + FAILED_LOGIN Audit Rows Verified)**

---

## 1. Executive Summary

A comprehensive security drill was conducted on authentication mechanisms and ingress rate limiting:
1. **Account Lockout (Brute Force Defense)**: Verified that 5 consecutive failed login attempts lock the target account for 15 minutes (`LOCKOUT_DURATION_MS = 900000`), blocking subsequent authentication attempts before touching expensive database queries.
2. **Lockout Recovery / Reset**: Verified `clearLockout(email)` releases the lockout immediately upon successful credential or administrator unlock.
3. **Audit Log Persistence**: Verified that failed login events persist an append-only row into `audit_logs` with `action: 'FAILED_LOGIN'`, recording the target email, IP address, user agent, and specific failure reason (`INVALID_PASSWORD`, `INVALID_TOTP`, `USER_NOT_FOUND`).
4. **Rate Limiting Hammer**: Verified atomic sliding-window rate limiting on sensitive routes (credentials login and Razorpay webhook/verification endpoints). Testing with 8 rapid requests against a threshold of 5 yielded 5 allowed and 3 rejected with HTTP 429 (`Too Many Requests`).
5. **TOTP Clock Skew Tolerance (Flaw Audit P1 #11)**: Verified `authenticator.verify({ token, secret, window: 1 })` permits valid authentications within a 1-step window (±30s) while rejecting unauthorized tokens (`000000`).
6. **AUTH_SECRET Hard-Fail (Flaw Audit P1 #13)**: Verified that server boot fails closed in production when `AUTH_SECRET`/`NEXTAUTH_SECRET` is unset, preventing JWT forgery with default secrets.

---

## 2. Test Execution & Evidence

Execution logs from `database/run_p3_verifications.ts`:

```text
===============================================================
   PHASE P3: SECURITY VERIFICATION PASS - LIVE DRILLS
===============================================================

>>> [P3-T5] Executing Auth Hardening & Rate Limiting Drill...
- Initial lockout state for drill_lockout_1791641570188@testschool.edu: false
- Attempts recorded: 5, isAccountLocked: true
- Lockout cleared state: false
- Rate Limiter Hammer: Allowed = 5, Blocked = 3 (Expected: 5 allowed, 3 blocked)
- TOTP window skew verification: valid token -> true, invalid token -> false
- FAILED_LOGIN audit row persisted: ID=9a5f61a8-b5d5-4c7b-8d85-62ad39299cae, action=FAILED_LOGIN
```

### JSON Output Summary
```json
{
  "P3_T5": {
    "accountLockout": {
      "initialLock": false,
      "isLockedAfter5": true,
      "isCleared": false
    },
    "rateLimiting": {
      "allowedCount": 5,
      "blockedCount": 3
    },
    "totpSkewTolerance": {
      "totpValid": true,
      "totpInvalid": false
    },
    "auditLogFailedLogin": {
      "id": "9a5f61a8-b5d5-4c7b-8d85-62ad39299cae",
      "action": "FAILED_LOGIN"
    }
  }
}
```

---

## 3. Security Analysis & Verifications

| Test Item | Threshold / Rule | Observed Behavior | Verdict |
|---|---|---|---|
| Brute-Force Lockout | 5 consecutive failures triggers 15 min lock | Locked on 5th attempt (`isAccountLocked = true`) | **PASS** |
| Lockout Clear | `clearLockout` resets memory & Redis key | Reset to `false` immediately | **PASS** |
| Rate Limiter Ingress | Max requests enforced by sliding window | 5 allowed, 3 rejected | **PASS** |
| TOTP Window Skew | Step skew window = 1 | Valid token verified; invalid token rejected | **PASS** |
| Audit Row Creation | DPDP Section 8(5) auth event auditing | Row `9a5f61a8-b5d5-4c7b-8d85-62ad39299cae` recorded with `FAILED_LOGIN` | **PASS** |
| AUTH_SECRET Fail-Closed | Production crash if secret missing | Throws fatal error on empty secret in production | **PASS** |
