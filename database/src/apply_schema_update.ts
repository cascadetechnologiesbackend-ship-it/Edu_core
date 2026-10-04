import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env["DATABASE_URL"] ??
    "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp",
});

async function main() {
  console.log("Applying schema updates...");
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TYPE role_name ADD VALUE IF NOT EXISTS 'DRIVER';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);
    console.log("✓ DRIVER added to role_name enum");

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log("✓ must_change_password added to users table");

    await client.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
        vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        name_encrypted TEXT NOT NULL,
        mobile_encrypted TEXT NOT NULL,
        licence_encrypted TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT drivers_user_unique UNIQUE (user_id)
      );

      CREATE INDEX IF NOT EXISTS drivers_school_idx ON drivers(school_id);
      CREATE INDEX IF NOT EXISTS drivers_vehicle_idx ON drivers(vehicle_id);
      CREATE INDEX IF NOT EXISTS drivers_user_idx ON drivers(user_id);

      ALTER TABLE vehicles ALTER COLUMN driver_name_encrypted DROP NOT NULL;
      ALTER TABLE vehicles ALTER COLUMN driver_licence_encrypted DROP NOT NULL;
      ALTER TABLE vehicles ALTER COLUMN driver_mobile_encrypted DROP NOT NULL;
    `);
    console.log("✓ drivers table created/verified and vehicles driver columns made optional");
  } finally {
    client.release();
    await pool.end();
  }
  console.log("Schema update completed successfully.");
}

main().catch((err) => {
  console.error("Schema update failed:", err);
  process.exit(1);
});
