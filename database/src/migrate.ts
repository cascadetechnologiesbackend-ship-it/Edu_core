import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env["DATABASE_URL"] ??
    "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp",
});

const db = drizzle(pool);

import path from "path";
import { fileURLToPath } from "url";
import { ensureSuperAdmin } from "./manage_super_admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Migration started");
  const migrationsFolder = path.resolve(__dirname, "migrations");
  console.log(`Using migrations folder: ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("Migration completed");

  try {
    console.log("Checking and seeding default super admin if required...");
    await ensureSuperAdmin();
  } catch (seedErr) {
    console.error("Warning: Failed to ensure super admin during migration:", seedErr);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
