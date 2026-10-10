CREATE INDEX IF NOT EXISTS "students_school_first_name_search_hash_idx" ON "students" ("school_id", "first_name_search_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_school_last_name_search_hash_idx" ON "students" ("school_id", "last_name_search_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_school_admission_number_idx" ON "students" ("school_id", "admission_number");
