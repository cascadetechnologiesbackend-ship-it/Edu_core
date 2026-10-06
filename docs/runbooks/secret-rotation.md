# Secret Rotation Runbook
## SchoolMitra ERP

### 1. Overview
This runbook provides step-by-step procedures for rotating critical credentials in production, including cryptographic keys, authentication secrets, payment gateway secrets, and database credentials.

---

### 2. Rotating `AUTH_SECRET` & `IMPERSONATION_SECRET`

`AUTH_SECRET` signs NextAuth session cookies. Rotating it immediately invalidates all active user sessions, requiring re-login.
`IMPERSONATION_SECRET` signs short-lived Super Admin impersonation tokens.

#### Procedure:
1. Generate high-entropy 32-byte cryptographically random secrets:
   ```bash
   openssl rand -base64 32
   openssl rand -base64 32
   ```
2. Schedule the rotation during an off-peak maintenance window (e.g. 02:00 IST).
3. Update environment variables in Render:
   - Set `AUTH_SECRET="<new-base64-secret>"`
   - Set `IMPERSONATION_SECRET="<new-base64-secret>"`
4. Deploy the service to reload environment variables.
5. Notify active users that sessions have been reset for security maintenance.

---

### 3. Rotating PII `ENCRYPTION_KEY` (AES-256-GCM)

`ENCRYPTION_KEY` encrypts sensitive student PII (Aadhaar numbers, parent contact details, emergency contacts).
Rotating `ENCRYPTION_KEY` requires a **two-phase re-encryption migration script** to prevent data loss.

#### Procedure:
1. Generate new 64-hex-character key:
   ```bash
   openssl rand -hex 32
   ```
2. Set `ENCRYPTION_KEY_NEW` in environment variables while keeping `ENCRYPTION_KEY` as active for reads.
3. Run the automated re-encryption migration batch script:
   ```bash
   pnpm --filter @schoolmitra/backend run db:re-encrypt-pii
   ```
   *Script reads ciphertext with `ENCRYPTION_KEY`, decrypts to plaintext in memory, encrypts with `ENCRYPTION_KEY_NEW`, and commits updates.*
4. Once all rows in `students`, `student_family_members`, and `admission_applications` are re-encrypted:
   - Promote `ENCRYPTION_KEY_NEW` to `ENCRYPTION_KEY`.
   - Remove `ENCRYPTION_KEY_NEW`.
5. Trigger application redeployment and verify student profile reads.

---

### 4. Rotating Razorpay Webhook & API Secrets

#### Procedure:
1. Log in to Razorpay Dashboard -> **Settings** -> **API Keys**.
2. Click **Generate New Key**. Razorpay allows keeping the old key active for up to 24 hours (dual-key window).
3. Update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Render.com environment settings.
4. Go to **Settings** -> **Webhooks**.
5. Edit the webhook endpoint URL (`https://app.schoolmitra.in/api/webhooks/razorpay`), generate a new webhook secret, and copy it.
6. Set `RAZORPAY_WEBHOOK_SECRET` in Render.com.
7. Trigger redeploy and monitor incoming webhook events for 200 OK responses.

---

### 5. Rotating Redis Credentials
1. Create a new user/password in Redis Cloud / Upstash / Managed Redis.
2. Update `REDIS_URL` or `REDIS_PASSWORD` in Render.com environment settings.
3. Trigger rolling restart of web and background worker services.
4. Verify `/api/health` reports `{ "status": "ok", "redis": "ok" }`.
