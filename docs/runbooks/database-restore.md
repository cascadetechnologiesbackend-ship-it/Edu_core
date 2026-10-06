# Database Restore & Disaster Recovery Runbook
## SchoolMitra ERP

### 1. Overview & Service Level Objectives
- **RPO (Recovery Point Objective)**: 24 Hours. Maximum acceptable data loss window. Daily automated database snapshots.
- **RTO (Recovery Time Objective)**: 4 Hours. Target duration from disaster declaration to restored service.
- **Encryption**: Backups are encrypted at rest using AES-256 via Cloud provider KMS.

---

### 2. Pre-Restore Checklist
1. Identify the point-in-time snapshot or dump file to restore from.
2. Put the application in maintenance mode (redirect external traffic to `/maintenance`).
3. Verify available disk space on target database instance (minimum 2.5x snapshot size).
4. Isolate the target instance network security groups.

---

### 3. Step-by-Step Restoration Procedure

#### Step A: Verify Backup File Integrity
```bash
# Verify checksum of encrypted dump
sha256sum backup-schoolmitra-*.sql.gz.enc
```

#### Step B: Decrypt Snapshot
```bash
# Using KMS / key management system
openssl enc -d -aes-256-cbc -in backup-schoolmitra.sql.gz.enc -out backup-schoolmitra.sql.gz -pass env:DB_BACKUP_KEY
gunzip backup-schoolmitra.sql.gz
```

#### Step C: Restore Database Schema & Data
```bash
# Restore directly using pg_restore / psql
PGPASSWORD=$DATABASE_PASSWORD pg_restore -h $DATABASE_HOST -p 5432 -U $DATABASE_USER -d schoolmitra_erp --clean --if-exists backup-schoolmitra.sql
```

#### Step D: Run Schema & Migration Verification
```bash
# Validate that the restored database is fully synchronized with current migrations
pnpm --filter @schoolmitra/database run db:check-migrations
pnpm --filter @schoolmitra/database run db:migrate
```

---

### 4. Post-Restore Verification
1. Execute `/api/health` and verify `database: "ok"`.
2. Inspect `audit_logs` and `users` tables to verify record counts.
3. Test a sample student search and report card query.
4. Disable maintenance mode and notify the incident response team.
