# 08 Application Security & Authentication Hardening Audit

**Directive ID:** `EDUCORE_MASTER_PRODUCTION_READINESS_CERTIFICATION`  
**Subsystems:** NextAuth v5, Rate Limiter, Account Lockout, Impersonation Engine, Session Verification  
**Verdict:** **PASS**  

---

## 1. Security Architecture & Threat Mitigation

1. **Fail-Closed Session Checks (`backend/src/lib/serverAuth.ts`):**
   - `getCachedSession()` performs live account active verification (`users.isActive`) and role presence checks. If database queries encounter an unhandled exception or connection drop, the function fails closed and immediately returns `null`.
2. **Demo Role Launch UX & Session Recovery (`login-form.tsx`):**
   - Fixed the `SessionExpired` race condition where `signIn("credentials", { redirect: false })` succeeded (`result.ok === true`) but an unverified target dashboard redirect populated `error: "SessionExpired"`.
   - Added direct navigation on `result.ok === true`.
3. **Sentinel Role Authorization (`SYSTEM_AUTH`):**
   - During credentials authentication, user lookup by email must happen before tenant context is known.
   - `withAuthContext()` sets session role `SYSTEM_AUTH`, explicitly permitted by RLS on `users`, `roles`, and `user_roles`.
4. **Brute Force & Account Lockout Defense:**
   - Edge rate limiter on `/api/auth/callback/credentials`.
   - Account lockout after 5 consecutive failed attempts (15-minute cooloff).
   - Audit logging of `FAILED_LOGIN` events to `audit_logs`.
