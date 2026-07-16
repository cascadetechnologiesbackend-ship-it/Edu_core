import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

// ─── Connection Pool ──────────────────────────────────────────────────────────

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString:
      process.env["DATABASE_URL"] ??
      "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp",
    min: Number(process.env["DATABASE_POOL_MIN"] ?? 2),
    max: Number(process.env["DATABASE_POOL_MAX"] ?? 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForDb.pool = pool;
}

// ─── Drizzle Client ───────────────────────────────────────────────────────────

export const db = drizzle(pool, {
  schema,
  logger: process.env["NODE_ENV"] === "development",
});

export type Db = typeof db;

// ─── Multi-Tenancy Helpers ────────────────────────────────────────────────────

/**
 * Runs queries inside a transaction scoped to the tenant's PostgreSQL schema.
 * Employs `SET LOCAL search_path` to guarantee absolute data isolation.
 */
export async function withTenant<T>(
  tenantSlug: string,
  cb: (tx: Db) => Promise<T>,
): Promise<T> {
  const schemaName = `tenant_${tenantSlug.replace(/[^a-zA-Z0-9_]/g, "")}`;
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`SET LOCAL search_path TO ${sql.raw(schemaName)}, public`,
    );
    return await cb(tx as any);
  });
}

/**
 * Automates creating a new PostgreSQL schema for a school tenant
 * and applies all base database migrations dynamically.
 */
export async function provisionTenant(tenantSlug: string): Promise<void> {
  const schemaName = `tenant_${tenantSlug.replace(/[^a-zA-Z0-9_]/g, "")}`;

  // 1. Create the tenant's individual database schema namespace
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.raw(schemaName)}`);

  // 2. Parse and execute the Drizzle schema SQL migrations under the new schema context
  const migrationsDir = path.join(process.cwd(), "src/db/migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  await db.transaction(async (tx) => {
    // Force migration DDL statements to create tables inside the tenant schema
    await tx.execute(
      sql`SET LOCAL search_path TO ${sql.raw(schemaName)}, public`,
    );

    for (const file of migrationFiles) {
      const fullPath = path.join(migrationsDir, file);
      const rawSql = fs.readFileSync(fullPath, "utf8");

      // Split the Drizzle migration file into individual statements
      const statements = rawSql
        .split("--> statement-breakpoint")
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0);

      for (const statement of statements) {
        await tx.execute(sql.raw(statement));
      }
    }
  });
}

// ─── Re-export schema for convenience ────────────────────────────────────────

export * from "./schema";
