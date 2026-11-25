# Data Import / Export Operations Runbook

## Purpose
Operational procedures for monitoring, troubleshooting, and recovering `import-export-jobs` in production.

## Queue & Worker Health
- **Queue Name**: `import-export-jobs` (BullMQ on Valkey/Redis)
- **Worker File**: `backend/src/workers/importExportWorker.ts`
- **Concurrency**: 2 jobs per worker instance

## Common Failure Modes
1. **Redis/Valkey Unavailable**:
   - Symptom: `[ImportExportQueue] Redis is not configured in this environment. Job skipped.`
   - Resolution: Verify `REDIS_URL` or `VALKEY_HOST` environment variables and network connectivity.
2. **Job Stuck in `PROCESSING`**:
   - Symptom: Worker crashed mid-job.
   - Resolution: Inspect worker logs for `jobId`, verify `import_export_jobs` table status, and re-enqueue if idempotent.
3. **S3 Presigned URL Expired**:
   - Symptom: 403 AccessDenied on download.
   - Resolution: Re-generate presigned URL via `getSignedDownloadUrl(key, 3600)` for the existing `schools/{schoolId}/exports/{jobId}.{format}` object.
