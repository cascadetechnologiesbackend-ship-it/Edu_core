# 09 — Authentication Analysis
## SchoolMitra ERP

---

## Authentication Technology

- **Library:** NextAuth v5 beta (`next-auth@^5.0.0-beta.16`)
- **Strategy:** JWT (stateless sessions, no database session table)
- **Session TTL:** 8 hours (`maxAge: 8 * 60 * 60`)
- **JWT Re-sign:** Every 1 hour (`updateAge: 60 * 60`)
- **Provider:** CredentialsProvider only (no OAuth/SSO)

---

## Login Flow

```
POST /api/auth/callback/credentials
  ↓
CredentialsProvider.authorize(credentials)
  │
  ├─ 1. Validate input (email + password present)
  │
  ├─ 2. Check account lockout (Redis: key=lockout:{email})
  │     Redis unavailable → in-memory Map fallback
  │     Threshold: 5 failed attempts
  │     Lockout duration: 15 minutes
  │
  ├─ 3. Check super_admin_users table (email match)
  │     Found + active + bcrypt match:
  │       → clearLockout
  │       → mint refresh session (sessions table via createRefreshSession)
  │       → set httpOnly cookie: schoolmitra_refresh (7-day, path=/api/auth/refresh)
  │       → return { id, email, name, schoolId: null, role: "SUPER_ADMIN" }
  │     Found + bcrypt fail:
  │       → recordFailedAttempt
  │       → return null (NextAuth returns 401)
  │
  ├─ 4. Check users table (email match)
  │     Not found / inactive / no password: recordFailedAttempt → return null
  │     Found + bcrypt fail: recordFailedAttempt → return null
  │     Found + bcrypt pass:
  │       → clearLockout
  │       → query userRoles + roles JOIN → sort by ROLE_HIERARCHY
  │       → mint refresh session + cookie
  │       → return { id, email, name, schoolId, role: highest_role, mustChangePassword }
  │
  └─ 5. jwt() callback → token populated with id, schoolId, role, mustChangePassword
         session() callback → session.user populated
```

---

## JWT Token Contents

| Field | Source | Notes |
|-------|--------|-------|
| `id` | user.id (UUID) | Immutable for session |
| `schoolId` | user.schoolId | null for SUPER_ADMIN |
| `role` | Highest user role | Single role per session |
| `mustChangePassword` | user.mustChangePassword | Checked on each jwt() refresh |
| `email` | Standard NextAuth | |

**Concern:** The role is embedded in the JWT at login time and only updated on `updateAge` (1 hour). If a role is changed in the database between JWT issuances, the session continues with the old role for up to 1 hour.

---

## Session Management

| Aspect | Implementation | Status |
|--------|---------------|--------|
| Session storage | JWT httpOnly cookie | VERIFIED |
| Cookie security | httpOnly, sameSite strict, secure (prod) | VERIFIED |
| Session revocation | Token expiry only (8 hours) | GAP — no immediate revocation |
| Refresh token | `sessions` table + `schoolmitra_refresh` cookie | PARTIAL |
| Session table | DB `sessions` table exists | PARTIAL — usage unclear |
| Logout | `signOut({ redirectTo: "/login" })` | VERIFIED |
| Force password change | JWT `mustChangePassword` flag + middleware redirect | VERIFIED |

**Gap:** JWT sessions cannot be revoked before expiry (standard JWT limitation). A compromised session remains valid for up to 8 hours unless AUTH_SECRET is rotated. Rotating AUTH_SECRET invalidates ALL active sessions simultaneously.

---

## TOTP / 2FA

| Aspect | Status | Evidence |
|--------|--------|---------|
| Schema support | VERIFIED | `users.totpSecret`, `users.totpEnabled` (core.ts) |
| `otplib` dependency | VERIFIED | `backend/package.json: "otplib": "^12.0.1"` |
| Enforcement in authorize() | NOT FOUND | The `authorize()` function does not check `totpEnabled` |
| TOTP verification UI | UNKNOWN | Not visible in reviewed routes |
| TOTP for SUPER_ADMIN | UNKNOWN | Same gap — schema present, enforce absent |

**Finding SEC-012:** TOTP is not enforced during login. The authorize() callback returns a valid user object without requiring TOTP verification even when `totpEnabled = true`.

---

## Account Lockout

```
Library: backend/src/lib/accountLockout.ts
Redis key: lockout:{email.toLowerCase()}
Threshold: 5 failed attempts
Duration: 15 minutes
Fallback: in-memory Map (Redis unavailable)
Reset: on successful login (clearLockout)

Timing: lockout check BEFORE database query (prevents timing oracle)
```

**Strength:** Redis-backed with in-memory fallback. In-memory fallback is per-process — on multi-instance deployments, lockout state is not shared across instances.

---

## Refresh Token Mechanism

```
createRefreshSession() mints a cryptographically random token:
  → hashes token → inserts into sessions table { userId, sessionToken (hashed), refreshToken, ipAddress, userAgent, expiresAt }
  → sets cookie: schoolmitra_refresh (httpOnly, sameSite:strict, path=/api/auth/refresh)

refreshToken.ts: PARTIALLY REVIEWED
  Implementation details: NOT FULLY VERIFIED
  The /api/auth/refresh route usage: UNKNOWN
```

---

## Super Admin Authentication

```
Separate user table: super_admin_users
  - No schoolId linkage (global platform access)
  - TOTP schema present (totpSecret, totpEnabled)
  - Account lockout applies (same Redis key space as regular users)

Impersonation:
  SUPER_ADMIN can impersonate school users via:
  1. Server Action creates impersonation session record (impersonation_sessions table)
  2. Mints HMAC-SHA256 signed token (payload: superAdminId, schoolId, role: "SCHOOL_ADMIN", exp)
  3. Sets cookie: sm_impersonation (httpOnly, signed)
  4. requireAuth() resolves impersonation cookie → returns schoolId + effectiveRole "SCHOOL_ADMIN"
  5. All impersonation sessions are logged to impersonation_sessions table

  Token TTL: 60 minutes (hard, in payload exp)
  Secret: AUTH_SECRET (⚠️ same as JWT secret — SEC-016)
  Token scope: SCHOOL_ADMIN only (cannot impersonate other roles)
```

---

## Password Security

| Aspect | Implementation | Status |
|--------|---------------|--------|
| Hashing | bcryptjs | VERIFIED |
| Reset flow | password_reset_tokens table (tokenHash, expiresAt, usedAt) | SCHEMA VERIFIED, flow UNKNOWN |
| Email verification | email_verification_tokens table | SCHEMA VERIFIED, flow UNKNOWN |
| mustChangePassword | DB flag + middleware redirect + JWT flag | VERIFIED |
| Password history | NOT FOUND | MISSING |
| Minimum complexity | NOT FOUND | UNKNOWN |

---

## Authorization Guard

```
All Server Actions must call:
  requireAuth(allowedRoles?: readonly Role[]) → AuthContext

Middleware (middleware.ts):
  → Protects all routes except: /, /onboard, /api/webhooks, /api/health, /api/auth, static assets
  → Does NOT enforce role-level access (only authentication)
  → Role routing is enforced in layouts/pages

tRPC:
  → publicProcedure: no auth
  → protectedProcedure: isAuthed middleware
  → adminProcedure/hrProcedure/etc.: isAuthed + withRole()
```

---

## Authentication Risks Summary

| Risk | Severity | Status |
|------|----------|--------|
| Hardcoded fallback secrets (SEC-001) | P0 | VERIFIED |
| TEST_AUTH_USER bypass (SEC-002) | P0 | VERIFIED |
| TOTP not enforced (SEC-012) | P2/P1 | UNKNOWN/INFERRED |
| 8-hour non-revocable JWT | P2 | ARCHITECTURAL |
| Role changes take up to 1 hour to propagate | P2 | ARCHITECTURAL |
| In-memory lockout not shared across instances | P2 | INFERRED |
| Refresh token flow not fully verified | P2 | PARTIAL |
| No password complexity enforcement confirmed | P3 | UNKNOWN |
