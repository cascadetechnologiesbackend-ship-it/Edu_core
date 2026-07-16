import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"] ?? "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp",
});

const db = drizzle(pool);

async function main() {
  console.log("Migration started");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migration completed");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
