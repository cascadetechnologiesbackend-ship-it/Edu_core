# 02 — System Architecture
## SchoolMitra ERP

---

## Architecture Classification

**Multi-tenant SaaS Monolith** deployed as a single Next.js 14 application on Render.com.

- All roles (Super Admin, School Admin, Teacher, Parent, Student, etc.) are served from one Next.js process.
- Tenant isolation is enforced via `schoolId` scoping at the application layer (not at the database layer via PostgreSQL RLS).
- Business logic is co-located in the `backend` package but imported directly by the frontend (no separate API service).

---

## Request Flow

```
Internet
  ↓
Render.com Load Balancer (TLS termination)
  ↓
Next.js 14 Application Server (single process)
  ├── Middleware (middleware.ts)
  │     ├── NextAuth authorized() callback
  │     ├── Session validation (JWT)
  │     ├── mustChangePassword redirect
  │     └── Public route bypass (/, /onboard, /api/webhooks, /api/health)
  ↓
Route Handler
  ├── App Router Pages (React Server Components + Server Actions)
  │     ├── requireAuth(allowedRoles) → validates JWT session
  │     ├── requireSchool(ctx) → validates tenant context
  │     └── Business Logic (imports from @schoolmitra/backend)
  └── API Routes
        ├── /api/trpc/[trpc] → tRPC handler
        │     ├── timingMiddleware
        │     ├── rateLimitMiddleware (Redis sliding window)
        │     ├── isAuthed (auth check)
        │     └── withRole(roles) (RBAC)
        ├── /api/auth/[...nextauth] → NextAuth handler
        ├── /api/webhooks/* → Webhook handlers (auth bypassed — signature check required)
        └── /api/health → Health check
  ↓
Business Logic Layer (@schoolmitra/backend)
  ├── gradeEngine.ts (pure functions)
  ├── payrollEngine.ts (pure functions)
  ├── feeAssignmentEngine.ts (DB writes — no transaction wrapping)
  ├── leaveEngine.ts
  ├── auditLogger.ts
  ├── encryption.ts (AES-256-CBC)
  ├── serverAuth.ts (requireAuth, requireSchool)
  └── s3.ts, email.ts, sms.ts
  ↓
Data Layer (@schoolmitra/database)
  ├── Drizzle ORM queries
  └── PostgreSQL (Render.com managed DB)
  
Parallel Paths:
  BullMQ Worker (reportCard.ts)     → Redis Queue → PDF generation → S3 upload
  BullMQ Worker (retention.ts)      → Redis Queue → DPDP retention enforcement → DB deletes
  CRON endpoints (/api/cron/*)      → withCronAuth (CRON_SECRET) → scheduled tasks
  Razorpay Webhooks (/api/webhooks) → Signature verification (UNKNOWN) → fee_payments update
```

---

## Module Map

```
@schoolmitra/frontend
├── Depends on: @schoolmitra/backend, @schoolmitra/database, @schoolmitra/validators, @schoolmitra/dpdp
└── Consumes DB directly (Drizzle) in Server Components

@schoolmitra/backend
├── Depends on: @schoolmitra/database, @schoolmitra/validators, @schoolmitra/dpdp
└── Pure business engines + tRPC routers + auth utilities

@schoolmitra/database
├── Depends on: @schoolmitra/dpdp (consent purpose types)
└── Exports: db connection pool, all schema tables, migration runner

@schoolmitra/validators
├── No internal dependencies
└── Exports: Zod schemas for API inputs

@schoolmitra/dpdp
├── No internal dependencies
└── Exports: ConsentPurposeId enum, consent purpose definitions

@schoolmitra/domain-events
└── Exports: Event type definitions (usage extent UNKNOWN)

@schoolmitra/i18n
└── Exports: Internationalization utilities (usage extent UNKNOWN)
```

---

## Authentication Flow

```
1. User → POST /api/auth/callback/credentials (email + password)
2. NextAuth CredentialsProvider.authorize()
   a. Check Redis/memory account lockout
   b. Query super_admin_users first (email match)
      → If found + active: bcrypt.compare → clearLockout → mint refresh session cookie → return SUPER_ADMIN user
   c. Query users table (email match)
      → If not found / inactive / no password: recordFailedAttempt → return null
      → bcrypt.compare → if invalid: recordFailedAttempt → return null
      → clearLockout → fetch userRoles → sort by ROLE_HIERARCHY → mint refresh session cookie
      → return { id, email, schoolId, role (highest), mustChangePassword }
3. NextAuth.jwt callback → token.id, token.schoolId, token.role, token.mustChangePassword
4. NextAuth.session callback → session.user (id, schoolId, role, mustChangePassword)
5. JWT stored as httpOnly cookie (8-hour maxAge, 1-hour updateAge)
6. Middleware checks authorized() → redirect logic for mustChangePassword
7. Server Actions call requireAuth(allowedRoles) → reads cached session
```

**TOTP/2FA status:** Schema exists (`totpSecret`, `totpEnabled` on users and superAdminUsers) but the `authorize()` function does not enforce TOTP verification. **UNKNOWN whether TOTP is enforced in a separate UI flow.**

---

## Tenant Isolation Model

```
Tenant = School (identified by schools.id UUID)

Isolation Points:
1. JWT token carries schoolId (set at login, immutable for session lifetime)
2. requireAuth() returns AuthContext { userId, schoolId, role }
3. requireSchool(ctx) validates schoolId is set and school is active
4. All DB queries must include WHERE schoolId = ctx.schoolId
5. SUPER_ADMIN: schoolId = null by default
   → Impersonation: cookie sm_impersonation (HMAC-signed) provides schoolId
   → requireAuth() resolves impersonation schoolId if cookie present

Isolation Gaps (INFERRED):
- No PostgreSQL Row Level Security — isolation depends entirely on application-layer WHERE clauses
- Server Actions that query DB without using requireSchool() could leak cross-tenant data
- In-memory schoolCache is per-process — multi-instance deployments have no shared invalidation
- Background workers must be verified to scope all queries to specific schoolIds
```

---

## Data Flow

```
Student PII Entry:
  UI Form → Zod validation (client) → Server Action →
  requireAuth() → encryptData(field) → Drizzle INSERT →
  PostgreSQL (encrypted columns) → logAuditEvent(WRITE)

Student PII Read:
  Server Component → requireAuth() → Drizzle SELECT (WHERE schoolId) →
  decryptData(field) → Render to RSC → HTML response

File Upload:
  UI → getUploadUrl tRPC (⚠️ public procedure) → S3 presigned URL →
  Browser → PUT to S3 → UI saves S3 key → Server Action stores key in DB

Fee Payment (Online):
  Parent → Razorpay checkout → Razorpay → POST /api/webhooks/razorpay →
  Signature verification (UNKNOWN) → updateFeeInvoice → logAuditEvent

Report Card Generation:
  Admin → Server Action → BullMQ enqueue job →
  reportCard worker → fetch student data → gradeEngine.calculateGrade() →
  @react-pdf/renderer → PDF buffer → S3 upload → job status update
```

---

## Key Architectural Decisions

| Decision | Rationale | Risk |
|----------|----------|------|
| Next.js Server Actions for most features (not tRPC) | Colocation with UI, RSC streaming | Auth/rate-limiting middleware does NOT auto-apply to Server Actions |
| JWT sessions (not database sessions) | Stateless, scalable | Revocation requires token expiry wait (8 hours) |
| Application-layer tenant isolation (not RLS) | Simpler development | Any query missing schoolId can leak cross-tenant data |
| AES-256-CBC field-level encryption | DPDP compliance for PII fields | Key rotation requires re-encrypting every row |
| In-memory fallback for Redis | Resilience when Redis is down | Rate limiting and lockout become per-process |
| Single Next.js process on Render | Simplicity | No horizontal scaling, cold starts, shared worker + web process |
| Copy-on-provision template system | School provisioning flexibility | Template changes don't propagate to existing schools |
