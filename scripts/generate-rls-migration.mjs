import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const invFile = path.join(ROOT, "docs", "engineering", "RLS_TENANT_TABLE_INVENTORY.json");
const inv = JSON.parse(fs.readFileSync(invFile, "utf8"));
const gaps = inv.filter((i) => i.needsRemediation);

console.log(`Remediating tables count: ${gaps.length}`);
const tableNames = gaps.map((g) => g.tableName);

const sql = `-- Migration 0059: Complete Fail-Closed Row-Level Security on Remaining Tenant Tables (SEC-RLS-002)
-- Enforces fail-closed multi-tenancy and FORCE RLS across all ${tableNames.length} tenant-owned domain tables.
-- Tested against disposable local/CI database only.

DO $$ 
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
${tableNames.map((t) => "    '" + t + "'").join(",\n")}
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_select_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_insert_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_update_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_delete_policy ON %I;', tbl);

    -- SELECT: Strict tenant match OR global read for PLATFORM_ADMIN
    EXECUTE format('
      CREATE POLICY tenant_select_policy ON %I
        FOR SELECT
        USING (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
          OR nullif(current_setting(''app.current_role'', true), '''') = ''PLATFORM_ADMIN''
        );
    ', tbl);

    -- INSERT: Strict tenant match required (no PLATFORM_ADMIN write bypass)
    EXECUTE format('
      CREATE POLICY tenant_insert_policy ON %I
        FOR INSERT
        WITH CHECK (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        );
    ', tbl);

    -- UPDATE: Strict tenant match required
    EXECUTE format('
      CREATE POLICY tenant_update_policy ON %I
        FOR UPDATE
        USING (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        )
        WITH CHECK (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        );
    ', tbl);

    -- DELETE: Strict tenant match required
    EXECUTE format('
      CREATE POLICY tenant_delete_policy ON %I
        FOR DELETE
        USING (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        );
    ', tbl);

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;
--> statement-breakpoint
`;

const migrationPath = path.join(ROOT, "database", "src", "migrations", "0059_complete_fail_closed_rls.sql");
fs.writeFileSync(migrationPath, sql);
console.log(`✅ Wrote ${migrationPath}`);

// Update journal.json
const journalPath = path.join(ROOT, "database", "src", "migrations", "meta", "_journal.json");
const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
const existing0059 = journal.entries.find((e) => e.idx === 59);

if (!existing0059) {
  journal.entries.push({
    idx: 59,
    version: "7",
    when: Date.now(),
    tag: "0059_complete_fail_closed_rls",
    breakpoints: true,
  });
  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2) + "\n");
  console.log(`✅ Registered migration 0059 in _journal.json (Total entries: ${journal.entries.length})`);
}
