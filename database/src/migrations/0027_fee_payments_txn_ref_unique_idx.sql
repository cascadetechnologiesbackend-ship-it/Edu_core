CREATE UNIQUE INDEX IF NOT EXISTS "fee_payments_txn_ref_unique_idx" 
ON "fee_payments" ("school_id", "transaction_reference") 
WHERE "transaction_reference" IS NOT NULL;
