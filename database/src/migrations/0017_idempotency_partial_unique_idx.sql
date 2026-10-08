-- Migration: 0017_idempotency_partial_unique_idx.sql
-- Description: Enforce unique idempotency per cashier session within school

CREATE UNIQUE INDEX IF NOT EXISTS "fee_payments_idempotency_unique_idx"
ON "fee_payments" ("school_id", "collected_by_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint
