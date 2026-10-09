import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql, eq } from "drizzle-orm";
import * as schema from "./schema";
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
    min: Number(process.env["DATABASE_POOL_MIN"] ?? 4),
    max: Number(process.env["DATABASE_POOL_MAX"] ?? 25),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 2000, // 2s statement timeout for OLTP (PF-R100). Analytical reports and background workers override up to 30s.
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForDb.pool = pool;
}

import { BudgetQueryLogger } from "./queryLogger";

// ─── Drizzle Client ───────────────────────────────────────────────────────────

export const budgetQueryLogger = new BudgetQueryLogger();

export const db = drizzle(pool, {
  schema,
  logger: budgetQueryLogger,
});

export type Db = typeof db;

// ─── Multi-Tenancy & Query Timeout Helpers ────────────────────────────────────

/**
 * Runs queries inside a dedicated analytical session with extended statement_timeout (up to 30s).
 * Normative PF-R100: Normal OLTP statements budget 2s; report queries on replica budget 30s.
 */
export async function withReportSession<T>(
  cb: (tx: Db) => Promise<T>,
  timeoutMs = 30000,
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL statement_timeout = '${timeoutMs}ms'`));
    return await cb(tx as any);
  });
}

/**
 * Runs queries inside a transaction scoped to the tenant context.
 * Kept for backward compatibility with schema-isolated plugins.
 */
export async function withTenant<T>(
  tenantSlug: string,
  cb: (tx: Db) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await cb(tx as any);
  });
}

/**
 * Tenant provisioning handler.
 * Under the shared schema architecture, newly created schools immediately inherit
 * the shared schema tables partitioned by `school_id`.
 */
export async function provisionTenant(tenantSlug: string): Promise<void> {
  // Shared-schema architecture: no dynamic DDL required.
  // Tables are pre-provisioned and scoped by schoolId.
  return Promise.resolve();
}

/**
 * Gets the tenant slug from the specified schoolId.
 * Used to scope DB queries to the tenant schema.
 */
export async function getTenantDb(schoolId?: string) {
  if (!schoolId) throw new Error("No tenant context");

  const school = await db.query.schools.findFirst({
    where: eq(schema.schools.id, schoolId),
    columns: { udiseCode: true, id: true },
  });
  if (!school) throw new Error("School not found");

  const tenantSlug = school.udiseCode.replace(/[^a-zA-Z0-9]/g, "_");
  return { tenantDb: db, tenantSlug, schoolId: school.id };
}

// ─── Re-export schema and query logger for convenience ───────────────────────

export * from "./schema";
export * from "./queryLogger";
