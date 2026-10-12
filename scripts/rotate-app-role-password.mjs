#!/usr/bin/env node
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let pg;
try {
  const requireDb = createRequire(path.join(__dirname, '../database/package.json'));
  pg = requireDb('pg');
} catch {
  const requireRoot = createRequire(import.meta.url);
  pg = requireRoot('pg');
}

const { Pool } = pg;

const connectionString =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";
const newPassword = process.env.NEW_APP_PASSWORD || process.env.APP_DB_PASSWORD || process.argv[2];

if (!connectionString) {
  console.error("❌ Error: MIGRATION_DATABASE_URL or DATABASE_URL must be provided.");
  process.exit(1);
}

if (!newPassword) {
  console.error("❌ Error: New password must be provided via NEW_APP_PASSWORD, APP_DB_PASSWORD, or CLI argument.");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function rotatePassword() {
  const startedAt = new Date().toISOString();
  console.log(`[RotatePassword] Initiating password rotation for 'schoolmitra_app_login' at ${startedAt}...`);

  const client = await pool.connect();
  try {
    // Check if role exists
    const checkRole = await client.query(
      `SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app_login';`
    );

    const escaped = newPassword.replace(/'/g, "''");
    if (checkRole.rows.length === 0) {
      console.log(`[RotatePassword] Role 'schoolmitra_app_login' does not exist. Creating...`);
      await client.query(
        `CREATE ROLE schoolmitra_app_login WITH LOGIN PASSWORD '${escaped}' IN ROLE schoolmitra_app;`
      );
    } else {
      await client.query(
        `ALTER ROLE schoolmitra_app_login WITH PASSWORD '${escaped}';`
      );
      // Ensure membership in schoolmitra_app
      await client.query(`GRANT schoolmitra_app TO schoolmitra_app_login;`);
    }

    const completedAt = new Date().toISOString();
    console.log(`✅ [RotatePassword] Successfully rotated credentials for 'schoolmitra_app_login'.`);
    console.log(`   Timestamp: ${completedAt}`);
    console.log(`   Status: SUCCESS`);
    console.log(`   (Password value masked per PF-R00 / Security Rules)`);
  } catch (err) {
    console.error(`❌ [RotatePassword] Fatal error during password rotation:`, err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

rotatePassword();
