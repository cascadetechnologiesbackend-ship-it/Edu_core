-- ============================================================
-- Migration 0062: Import/Export Job Tracking Table (Additive Only)
-- Never modifies any existing table.
-- ============================================================

CREATE TABLE IF NOT EXISTS "import_export_jobs" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id"     UUID NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "created_by"    UUID NOT NULL REFERENCES "users"("id"),
  "job_type"      TEXT NOT NULL CHECK ("job_type" IN ('IMPORT', 'EXPORT')),
  "module"        TEXT NOT NULL,
  "dataset_key"   TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'QUEUED'
                    CHECK ("status" IN (
                      'QUEUED', 'PROCESSING', 'COMPLETED',
                      'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED', 'EXPIRED'
                    )),
  "format"        TEXT CHECK ("format" IN ('CSV', 'XLSX', 'PDF')),
  "record_count"  INTEGER,
  "error_count"   INTEGER,
  "file_key"      TEXT,
  "error_csv_key" TEXT,
  "metadata"      JSONB NOT NULL DEFAULT '{}',
  "expires_at"    TIMESTAMPTZ,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_iej_school_id"   ON "import_export_jobs" ("school_id");
CREATE INDEX IF NOT EXISTS "idx_iej_created_by"  ON "import_export_jobs" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_iej_status"      ON "import_export_jobs" ("status");
CREATE INDEX IF NOT EXISTS "idx_iej_expires_at"  ON "import_export_jobs" ("expires_at")
  WHERE "expires_at" IS NOT NULL;

-- ── Row-Level Security (matches pattern from 0059) ────────────────────────────
ALTER TABLE "import_export_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_export_jobs" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'import_export_jobs'
      AND policyname = 'iej_tenant_isolation'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY iej_tenant_isolation ON "import_export_jobs"
        USING (
          school_id = current_setting('app.current_school_id', true)::uuid
        )
    $policy$;
  END IF;
END $$;

-- ── Grants ────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON "import_export_jobs" TO schoolmitra_app';
  END IF;
END $$;
