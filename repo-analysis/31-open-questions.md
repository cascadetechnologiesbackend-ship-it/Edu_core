# 31 — Open Questions
## SchoolMitra ERP

Items requiring investigation or clarification before production deployment.

---

## Q-001 — TOTP Enforcement Status

**Question:** Is TOTP verification enforced anywhere in the authentication flow for users with `totpEnabled = true`?

**Context:** The `users` and `superAdminUsers` tables have `totpSecret` and `totpEnabled` columns. The `otplib` dependency is installed. However, the `authorize()` callback in `backend/src/lib/auth/index.ts` does not check `totpEnabled` and does not perform TOTP verification.

**Files to Check:**
- Any additional `/api/auth/*` routes not in the reviewed tree
- Frontend login page components for a second-factor input step
- Any middleware intercepting post-password sessions

**Severity if Absent:** P1 for SUPER_ADMIN (no MFA on platform-wide account), P2 for school users

---

## Q-002 — Razorpay Webhook Signature Verification

**Question:** Does the `/api/webhooks/razorpay` handler verify the `x-razorpay-signature` header using HMAC-SHA256 with RAZORPAY_SECRET?

**Context:** `/api/webhooks/*` bypasses the NextAuth middleware. If webhook signature verification is absent, fake payment confirmations can be injected.

**Files to Check:** `frontend/src/app/api/webhooks/` (directory not found in file tree scan — may use different path)

**Severity if Absent:** P1 — financial data integrity

---

## Q-003 — Server Action Coverage for requireAuth()

**Question:** How many Server Action files are there and do all of them call `requireAuth()` before accessing the database?

**Context:** Only 2 Server Action files were found in `frontend/src/app/actions/` (changePassword, onboard). However, the `features/` directory contains at minimum 5 feature folders (academics, admissions, attendance, fees, hr) each likely containing Server Action files. tRPC middleware does NOT apply to Server Actions.

**Investigation Method:**
```powershell
Select-String -Path "v:\Cascade\Edu_core\Edu_core\frontend\src\**\*.ts" -Pattern '"use server"' -Recurse
```

**Severity:** P1 per unguarded action

---

## Q-004 — Database Backup Configuration

**Question:** Is PostgreSQL backup configured on Render.com? What is the backup frequency, retention period, and has a restore been tested?

**Context:** No backup configuration found in the repository. Render.com managed PostgreSQL offers automated backups, but the configuration is outside the repository.

**Action Required:** Verify in Render.com dashboard; document RPO/RTO; test restore.

**Severity if Absent:** P1 — data loss risk

---

## Q-005 — Redis Configuration in Production

**Question:** Is Redis provisioned and configured on Render.com for production? What is the Redis instance size and connection limit?

**Context:** Redis is required for: account lockout, rate limiting, BullMQ job queues (reportCard, retention workers). The `rateLimiter.ts` has an in-memory fallback but lockout state becomes per-process without Redis.

**Impact if Absent:** Rate limiting is per-process only; BullMQ workers cannot function; lockout bypassed in multi-instance scenarios.

---

## Q-006 — CRON_SECRET Configuration

**Question:** Is CRON_SECRET configured in production? What cron endpoints exist?

**Context:** `apiAuth.ts` implements `withCronAuth()` which uses `CRON_SECRET`. In development it falls back to `"dev-cron-secret-fallback"`. Cron jobs scheduled for fee reminders (reminderSentD7/D15/D30 flags on fee_invoices), data retention, etc. will fail silently if CRON_SECRET is not set and the fallback is used.

**Files to Check:** `frontend/src/app/api/cron/` (not found in tree scan — may not exist)

---

## Q-007 — BullMQ Worker Tenant Scoping

**Question:** Do `reportCard.ts` and `retention.ts` workers scope all database queries to a specific `schoolId`?

**Context:** Workers process jobs from BullMQ queues. If job payloads do not include `schoolId` or workers run unbounded queries, cross-tenant data exposure is possible.

**Files to Check:**
- `backend/src/workers/reportCard.ts`
- `backend/src/workers/retention.ts`

---

## Q-008 — S3 File Path Structure

**Question:** Do S3 object keys include a `schoolId` prefix to prevent cross-tenant file access?

**Context:** The `getUploadUrl` endpoint generates paths like `admissions/{uuid}-{filename}` without a school scope. Student document keys and payslip keys may or may not include school scope.

**Risk:** A user who learns another tenant's S3 key could generate a presigned URL to access that file if there is no school-scoped prefix and no IAM policy restriction.

---

## Q-009 — Communication, Transport, Library, Hostel Schema

**Question:** What do the `communication.ts`, `transport.ts`, `library.ts`, `hostel.ts`, `inventory.ts` schema files contain? Are the corresponding frontend features implemented?

**Context:** These schema files were not reviewed. The corresponding frontend routes (`/library`, `/transport`, `/admin/library`, etc.) appear in role config navigation but the actual page implementations were not verified.

---

## Q-010 — E2E Test Pass Status

**Question:** Do all Playwright E2E tests currently pass against a test database? Are the skipped/commented-out assertions in `security.spec.ts` intentionally disabled?

**Context:** `security.spec.ts` has a commented assertion: `// expect(hitLimit).toBe(true); // Uncomment when CI Redis is fully stable`. This suggests Redis instability in test environments. If CI/CD is added, test environment Redis configuration must be resolved.

---

## Q-011 — Email Provider Configuration

**Question:** Which SMTP provider is configured for production email delivery? Are transactional emails (password reset, admission confirmation, fee reminders) tested end-to-end?

**Context:** Nodemailer is installed. The `email.ts` lib file was not reviewed. SMTP credentials are not visible in `render.yaml`.

---

## Q-012 — Domain / Subdomain Routing

**Question:** How does the multi-tenant subdomain routing work? Is it subdomain-based (`saraswati.schoolmitra.in`) or path-based (`schoolmitra.in/school/saraswati`)?

**Context:** The `schools.slug` column and multitenancy E2E test (`saraswati.localhost:3002`) suggest subdomain routing. However, Next.js on Render.com requires wildcard subdomain DNS configuration. This infrastructure setup is not documented.

---

## Q-013 — Subscription / Access Control

**Question:** Is the `subscriptionTier` and `subscriptionExpiresAt` on the `schools` table enforced anywhere? Are expired subscriptions blocked from accessing the application?

**Context:** The schema has `subscriptionTier text` and `subscriptionExpiresAt timestamp`. No enforcement logic was found in the reviewed code paths.
