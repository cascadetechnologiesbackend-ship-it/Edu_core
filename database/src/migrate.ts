import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { ensureSuperAdmin } from "./manage_super_admin";

const pool = new Pool({
  connectionString:
    process.env["DATABASE_URL"] ??
    "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp",
});

const db = drizzle(pool);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sanitizeMigrationHistory(client: Pool) {
  try {
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      ) AS exists;
    `);

    if (!tableCheck.rows[0]?.exists) {
      return;
    }

    const { rows } = await client.query(
      `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id ASC;`
    );
    console.log(`[Migrate] Found ${rows.length} existing migration records in DB.`);

    // Normalize legacy timestamps that were renumbered in commit 95d99ea:
    // Migration 0006 was formerly 1791114978995 -> normalize to 1786958891444
    // Migration 0005 was formerly 1790800000000 -> normalize to 1786458891444
    // Migration 0004 was formerly 1790785323538 -> normalize to 1785958891444
    const fixResult = await client.query(`
      UPDATE drizzle.__drizzle_migrations 
      SET created_at = CASE 
        WHEN created_at = 1791114978995 THEN 1786958891444
        WHEN created_at = 1790800000000 THEN 1786458891444
        WHEN created_at = 1790785323538 THEN 1785958891444
        ELSE created_at
      END
      WHERE created_at IN (1791114978995, 1790800000000, 1790785323538);
    `);
    if ((fixResult.rowCount ?? 0) > 0) {
      console.log(`[Migrate] Normalized ${fixResult.rowCount} legacy migration timestamp(s).`);
    }

    // Check if account_ledger_transactions table exists in public schema
    const altCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'account_ledger_transactions'
      ) AS exists;
    `);
    const hasAlt = Boolean(altCheck.rows[0]?.exists);

    // If account_ledger_transactions does not exist, migration 0013 has not actually run
    // Delete any erroneous records with created_at >= 1790458891444 so Drizzle executes 0013+
    if (!hasAlt) {
      const delResult = await client.query(`
        DELETE FROM drizzle.__drizzle_migrations 
        WHERE created_at >= 1790458891444;
      `);
      if ((delResult.rowCount ?? 0) > 0) {
        console.log(`[Migrate] Pruned ${delResult.rowCount} unapplied migration record(s) so 0013+ can execute.`);
      }
    }
  } catch (err) {
    console.warn("[Migrate] Non-fatal notice during migration history check:", err);
  }
}

async function main() {
  console.log("Migration started");
  const migrationsFolder = path.resolve(__dirname, "migrations");
  console.log(`Using migrations folder: ${migrationsFolder}`);

  await sanitizeMigrationHistory(pool);

  await migrate(db, { migrationsFolder });
  console.log("Migration completed");

  try {
    console.log("Checking and seeding default super admin if required...");
    await ensureSuperAdmin();
  } catch (seedErr) {
    console.error("Warning: Failed to ensure super admin during migration:", seedErr);
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
