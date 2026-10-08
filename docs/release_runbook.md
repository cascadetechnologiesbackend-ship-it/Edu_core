# Production Release & Operational Runbook (Phase B1 AZ-08)
## SchoolMitra ERP — Finance & Core Platform

**Audience**: Release Engineers, DevOps / Platform Engineers, SREs, Super Administrators  
**Scope**: Production Deployments, Zero-Downtime Releases, Automated DB Backups, Telemetry, and Disaster Recovery  
**Target Architecture**: Render Monorepo Web + Worker + PostgreSQL + Redis + AWS S3

---

## 1. Zero-Downtime Deployment Sequence (Render & Cloud Services)

To prevent schema-application race conditions, transaction lockups, or worker task conflicts, releases must strictly execute in the following sequential phases:

```
[Phase 1: Pre-Release Audit] ──▶ [Phase 2: DB Migrations (0014-0021)] ──▶ [Phase 3: Worker Deploy]
                                                                                   │
[Phase 5: Post-Deploy Verification] ◀── [Phase 4: Web/API Monorepo Deploy] ◀──────┘
```

### Phase 1: Pre-Release Audit & Backup Snapshot
1. Verify CI status: All Vitest unit test suites (backend & frontend) and Turbo `type-check` pass 100%.
2. Trigger an immediate on-demand database backup before deploying any migrations:
   ```bash
   pg_dump "$DATABASE_URL" \
     --format=custom \
     --compress=9 \
     --file="pre_deploy_$(date +%Y%m%d_%H%M%S).dump"
   ```
3. Run the Go-Live Data Readiness Audit:
   ```bash
   pnpm --filter @schoolmitra/backend run audit:readiness
   ```

### Phase 2: Database Schema Migrations (0014 through 0021)
1. Run Drizzle migrations via one-off task or deploy hook:
   ```bash
   pnpm --filter @schoolmitra/database run db:migrate
   ```
2. Verify all migration entries (0014 through 0021) exist in `__drizzle_migrations`:
   - `0014_accounting_chart_of_accounts.sql`
   - `0015_account_ledger_transactions.sql`
   - `0016_contra_vouchers.sql`
   - `0017_income_expense_vouchers.sql`
   - `0018_fiscal_lock.sql`
   - `0019_bank_reconciliation.sql`
   - `0020_student_fee_advances.sql`
   - `0021_worker_heartbeats.sql`

### Phase 3: Background Worker Deployment (`educore-finance-worker`)
1. Deploy Render background worker service:
   - **Service Name**: `educore-finance-worker`
   - **Start Command**: `pnpm --filter @schoolmitra/backend run worker:finance`
   - **Environment Variables**:
     - `START_WORKERS="true"`
     - `DATABASE_URL` (Direct connection string)
     - `REDIS_URL`
     - `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
2. Verify heartbeat starts updating within 30 seconds:
   ```bash
   curl -s "https://api.schoolmitra.in/api/health/worker" | jq
   # Expected output:
   # { "status": "ok", "worker": "financeAutomation", "healthy": true, "secondsSinceLastHeartbeat": 12 }
   ```

### Phase 4: Web & API Deployment
1. Deploy Web service (`educore-web`) with rolling update (zero downtime).
2. Render routes traffic to new containers only after `/api/health` returns HTTP 200.

### Phase 5: Post-Deployment Verification
1. Liveness check: `GET /api/health` returns `status: "ok"` or `"degraded"`, HTTP 200.
2. Worker check: `GET /api/health/worker` returns `healthy: true` (< 90s heartbeat).
3. Smoke test parent portal and counter POS collection flows.

---

## 2. Automated Database Backup Schedules & Disaster Recovery SOP

### 2.1 Backup Policy & SLA
- **RPO (Recovery Point Objective)**: <= 1 hour (Continuous WAL archiving) / Daily full dump.
- **RTO (Recovery Time Objective)**: <= 30 minutes for snapshot restore, <= 2 hours for point-in-time recovery.
- **Retention**: Daily backups retained for 30 days; Weekly backups retained for 12 weeks; Monthly backups retained for 7 years.
- **Storage**: AWS S3 Glacier / Cloud Object Storage with Object Lock (WORM compliant).

### 2.2 Backup Verification SOP (Quarterly Drill)
Perform this restore drill on a staging or isolated scratch instance every quarter:

```bash
# 1. Fetch latest encrypted backup from S3
aws s3 cp s3://educore-backups/prod/schoolmitra_daily_latest.dump.gpg ./

# 2. Decrypt dump
gpg --decrypt --batch --passphrase "$BACKUP_DECRYPTION_KEY" \
  schoolmitra_daily_latest.dump.gpg > schoolmitra_drill.dump

# 3. Create drill test database
dropdb --if-exists schoolmitra_drill
createdb schoolmitra_drill

# 4. Restore using pg_restore
pg_restore -d schoolmitra_drill --clean --no-owner --no-privileges schoolmitra_drill.dump

# 5. Execute schema & integrity assertions
psql -d schoolmitra_drill -c "SELECT count(*) FROM students;"
psql -d schoolmitra_drill -c "SELECT count(*) FROM fee_invoices;"
psql -d schoolmitra_drill -c "SELECT count(*) FROM account_ledger_transactions;"
psql -d schoolmitra_drill -c "SELECT sum(debit_amount) = sum(credit_amount) AS is_balanced FROM account_ledger_transactions;"
```

---

## 3. Telemetry & Error Alerting on Money-Action Failures

Financial operations carry strict double-entry and legal compliance invariants. The following alerting thresholds must be configured in Sentry, CloudWatch, or Datadog:

### 3.1 P1 Critical Alerts (Immediate On-Call Page)
| Metric / Alert Rule | Threshold | Channel | Action |
| :--- | :--- | :--- | :--- |
| **Double-Entry Imbalance** | `sum(debit) != sum(credit)` detected on any voucher or reconciliation | PagerDuty / Telegram Ops | Immediately freeze posting and review transaction trace |
| **Advance Invariant Violation** | `SecurityViolation: Sum of allocations exceeds advance amount` | PagerDuty / Ops | Critical engine bug: investigate concurrent collection race |
| **Worker Heartbeat Stale** | `worker_heartbeats.last_heartbeat > 180s` | Ops Alert | Restart `educore-finance-worker` container |
| **Razorpay Webhook 5xx** | > 3 failures in 5 minutes | Ops Alert | Inspect gateway secret, DB connectivity, and S3 status |
| **Database Connectivity Down** | `/api/health` returns HTTP 503 | PagerDuty | Failover to standby database replica |

### 3.2 P2 Warning Alerts (Investigate Within 2 Hours)
- **DLT SMS Delivery Rate < 95%**: Triggered if Indian DLT gateway returns unconfigured or delivery failed continuously.
- **S3 Receipt Archival Fallback**: Triggered when `fee_payments.receiptS3Key` is null and client falls back to runtime PDF generator.
- **Unsettled Gateway Logs > 10**: Auto-matcher has unmatched online payment logs pending accountant review.

---

## 4. Health Monitoring Endpoints

### 4.1 Global System Health (`GET /api/health`)
- **Checks**:
  - PostgreSQL pool connectivity (`SELECT 1`).
  - Redis cache availability (Ping test).
- **Responses**:
  - `HTTP 200`: `{"status": "ok", "database": "ok", "redis": "ok"}`
  - `HTTP 200`: `{"status": "degraded", "database": "ok", "redis": "down"}` (Non-critical degraded)
  - `HTTP 503`: `{"status": "error", "error": "Database connection failed"}`

### 4.2 Automation Worker Health (`GET /api/health/worker`)
- **Checks**:
  - Queries `worker_heartbeats` table for `worker_name = 'financeAutomation'`.
  - Calculates `secondsSinceLastHeartbeat = now - lastHeartbeatAt`.
  - Returns `healthy: true` if delta < 90 seconds.
- **Responses**:
  - `HTTP 200`: `{"status": "ok", "worker": "financeAutomation", "healthy": true, "secondsSinceLastHeartbeat": 15}`
  - `HTTP 503`: `{"status": "error", "worker": "financeAutomation", "healthy": false, "secondsSinceLastHeartbeat": 240}`

---

## 5. Rollback Runbook (Safe Undo Procedure)

If a critical issue occurs post-deployment:

1. **Web / Application Layer Rollback**:
   - Revert Render deploy to previous stable commit hash using git:
     ```bash
     git revert <commit-hash>
     git push origin main
     ```
   - Render automatically rolls back the web and worker instances.

2. **Database Migration Rollback Protocol**:
   - If a migration fails halfway, roll back only the specific failed migration using down migrations or restoring the pre-deploy snapshot.
   - Never run destructive down migrations without a full verified snapshot.

3. **Post-Rollback Triage**:
   - Verify `/api/health` and `/api/health/worker` return HTTP 200.
   - Notify accounting and administration teams of resolution.
