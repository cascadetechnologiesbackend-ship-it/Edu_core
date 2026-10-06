# Production Deployment Runbook
## SchoolMitra ERP

### 1. Pre-Deployment Checklist
Prior to triggering any staging or production deployment:
- [ ] **Type-check**: Monorepo type-check passes completely (`turbo run type-check`).
- [ ] **Migration Check**: Pending Drizzle SQL migrations audited and non-destructive (`pnpm --filter @schoolmitra/database run db:check-migrations`).
- [ ] **Environment Validation**: Verify all required environment variables are configured on Render.com (`DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `IMPERSONATION_SECRET`, `ENCRYPTION_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `S3_BUCKET`).
- [ ] **Database Snapshot**: Create an automated or on-demand snapshot of the production PostgreSQL cluster.
- [ ] **Third-Party APIs**: Confirm Razorpay, AWS S3/MinIO, and SMTP services report normal operational status.

---

### 2. Standard Deployment Steps
SchoolMitra ERP is deployed on Render.com with Next.js standalone container builds.

#### Step 1: Trigger Deployment
- Merging to `main` branch automatically triggers CI/CD GitHub Actions.
- Manual deployment via Render dashboard: Select web service `schoolmitra-erp` -> **Manual Deploy** -> **Deploy latest commit**.

#### Step 2: Database Migration Execution
- In production, migrations are executed automatically during the pre-deploy lifecycle or run via container command:
  ```bash
  pnpm --filter @schoolmitra/database run db:migrate
  ```

#### Step 3: Health Check Verification
Immediately upon service startup, query the health check endpoint:
```bash
curl -f https://app.schoolmitra.in/api/health
```
**Expected Response**:
```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "version": "0.1.0",
  "uptime": 12.4,
  "durationMs": 45
}
```

---

### 3. Verification & Smoke Testing
Run the following post-deploy smoke checks:
1. **Public Routes**: Access `/` and `/login`. Verify 200 OK and SSL certificates.
2. **Super Admin Access**: Log in as `superadmin@schoolmitra.in` with password and TOTP code.
3. **Tenant Routing**: Visit tenant URL or start impersonation session.
4. **Telemetry**: Check Render logs for absence of critical startup errors or unhandled promise rejections.

---

### 4. Rollback Criteria & Procedure

#### Rollback Triggers
Initiate immediate rollback if any of the following occur within 15 minutes of deployment:
- `/api/health` returns HTTP 503 or `database: "error"`.
- Application error rate exceeds 1% of total HTTP requests.
- P95 latency spikes above 2,000ms.
- Authentication or payment webhook verification fails continuously.

#### Rollback Steps
1. **Render.com Rollback**:
   - Navigate to **Deploys** in the Render service.
   - Select the last known stable deployment and click **Rollback to this deploy**.
2. **Database Rollback** (if migration applied breaking change):
   - Consult [database-restore.md](file:///V:/Cascade/Edu_core/Edu_core/docs/runbooks/database-restore.md) to restore from the pre-deploy snapshot if data was corrupted, or apply compensating down-migration script.
3. **Cache Purge**:
   - Flush Redis cache to invalidate stale rendered payloads:
     ```bash
     redis-cli -u $REDIS_URL FLUSHDB
     ```
4. **Incident Notification**: Post update in `#incidents` Slack/Teams channel.
