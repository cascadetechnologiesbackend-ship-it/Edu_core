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

// S5-T1: Enforce non-owner role on all application database connections
// DDL migrations and seed scripts continue to run with table-owner identity.
const skipSetRole =
  process.env["DB_SKIP_SET_ROLE"] === "true" ||
  process.env["npm_lifecycle_event"]?.includes("seed") ||
  process.env["npm_lifecycle_event"]?.includes("migrate") ||
  process.env["npm_lifecycle_event"]?.includes("reset");

if (!skipSetRole) {
  pool.on("connect", (client) => {
    client
      .query("SET ROLE schoolmitra_app;")
      .then(async () => {
        if (
          process.env["DEBUG_DB_ROLES"] === "true" ||
          process.env["NODE_ENV"] === "development"
        ) {
          try {
            const res = await client.query(
              "SELECT current_user, current_setting('role', true) AS active_role;",
            );
            console.log(
              `[DB Pool] Connection established as ${res.rows[0]?.current_user} (role: ${res.rows[0]?.active_role})`,
            );
          } catch {}
        }
      })
      .catch((err) => {
        console.error(
          "[FATAL] Failed to set role schoolmitra_app on application connection:",
          err?.message || err,
        );
        if (process.env["NODE_ENV"] === "production") {
          // Hard fail-closed in production (S6-T0)
          client.emit("error", new Error(`Production DB connection failed to assume schoolmitra_app: ${err?.message || err}`));
          process.exit(1);
        }
      });
  });
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

// Canonical multi-tenant & RLS context wrappers (S6-T3 consolidation)
export * from "./tenant";

// ─── Re-export schema and query logger for convenience ───────────────────────

export * from "./schema";
export * from "./queryLogger";
