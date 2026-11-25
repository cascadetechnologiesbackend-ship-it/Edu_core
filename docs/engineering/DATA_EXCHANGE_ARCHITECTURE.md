# Data Exchange Architecture

## Overview
SchoolMitra ERP uses an asynchronous, tenant-isolated pipeline for bulk data import and export across all school entities (Students, Staff, Fees, Attendance, Exams).

## Architecture Components
1. **API Layer**: Validates RBAC permissions and enqueues jobs onto the `import-export-jobs` BullMQ queue.
2. **Background Worker (`backend/src/workers/importExportWorker.ts`)**:
   - Guarded by `hasRedis` so local/CI environments without Redis degrade gracefully.
   - Executes all database reads and writes inside `withTenant(schoolId, ...)` to enforce PostgreSQL Row-Level Security (RLS).
   - Tracks job lifecycle (`PENDING` -> `PROCESSING` -> `COMPLETED` / `FAILED`) in `import_export_jobs`.
3. **Object Storage (S3 / MinIO)**:
   - Exported files are uploaded to school-scoped keys: `schools/{schoolId}/exports/{jobId}.{format}`.
   - Downloads are served via short-lived S3 presigned URLs (`getSignedDownloadUrl`).

## Security & DPDP Compliance
- All S3 keys are strictly prefixed with `schools/{schoolId}/`.
- Presigned URLs expire after 3600 seconds.
- Every import/export job is audit-logged with `userId` and `schoolId`.
