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

export function getPoolConfig(
  rawConnectionString?: string,
  options?: { isMigration?: boolean }
) {
  const connectionString =
    rawConnectionString ??
    process.env["DATABASE_URL"] ??
    "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

  const isVercel = !!process.env["VERCEL"];
  const isRender = !!process.env["RENDER"];
  const sslDisabled = process.env["DATABASE_SSL"] === "false";

  let isSslRequired = false;
  let cleanConnectionString = connectionString;

  try {
    const urlStr = connectionString
      .replace(/^postgresql:\/\//i, "http://")
      .replace(/^postgres:\/\//i, "http://");
    const parsed = new URL(urlStr);
    const sslMode = parsed.searchParams.get("sslmode");
    const sslParam = parsed.searchParams.get("ssl");

    const hostname = parsed.hostname.toLowerCase();
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.includes("schoolmitra_dev");

    // Render internal connections: within Render private network, hosts are dpg-xxx (without .render.com) or end in .internal
    const isRenderInternal =
      hostname.endsWith(".internal") ||
      (hostname.startsWith("dpg-") && !hostname.includes(".render.com")) ||
      (isRender && !hostname.includes(".render.com") && !hostname.includes("neon.tech") && !hostname.includes("supabase.co") && !hostname.includes("amazonaws.com"));

    if (sslDisabled || isLocal || isRenderInternal) {
      isSslRequired = false;
    } else if (process.env["DATABASE_SSL"] === "true") {
      isSslRequired = true;
    } else if (sslMode === "disable" || sslParam === "false") {
      isSslRequired = false;
    } else if (
      isVercel ||
      hostname.includes("neon.tech") ||
      hostname.includes("supabase.co") ||
      hostname.includes("rds.amazonaws.com") ||
      hostname.includes(".render.com") ||
      hostname.includes("cockroachlabs.cloud") ||
      sslMode === "require" ||
      sslMode === "verify-ca" ||
      sslMode === "verify-full" ||
      sslParam === "true"
    ) {
      isSslRequired = true;
    } else if (process.env["NODE_ENV"] === "production" && !isRender) {
      isSslRequired = true;
    }

    // Strip sslmode and ssl query params so pg-connection-string does not override our ssl config or trigger deprecation warnings
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("ssl");
    parsed.searchParams.delete("uselibpqcompat");

    const originalScheme = connectionString.startsWith("postgresql:") ? "postgresql:" : "postgres:";
    cleanConnectionString = originalScheme + parsed.toString().slice("http:".length).replace(/\?$/, "");
  } catch {
    const lower = connectionString.toLowerCase();
    if (
      sslDisabled ||
      lower.includes("127.0.0.1") ||
      lower.includes("localhost") ||
      lower.includes(".internal") ||
      (lower.includes("dpg-") && !lower.includes(".render.com")) ||
      (isRender && !lower.includes(".render.com") && !lower.includes("neon.tech"))
    ) {
      isSslRequired = false;
    } else if (
      process.env["DATABASE_SSL"] === "true" ||
      isVercel ||
      lower.includes("neon.tech") ||
      lower.includes("supabase.co") ||
      lower.includes("rds.amazonaws.com") ||
      lower.includes(".render.com")
    ) {
      isSslRequired = true;
    }

    cleanConnectionString = connectionString
      .replace(/[?&]sslmode=[^&]+/gi, "")
      .replace(/[?&]ssl=[^&]+/gi, "")
      .replace(/[?&]uselibpqcompat=[^&]+/gi, "")
      .replace(/\?$/, "");
  }

  const isMigration =
    options?.isMigration || process.env["npm_lifecycle_event"]?.includes("migrate");

  return {
    connectionString: cleanConnectionString,
    min: isVercel ? 0 : Number(process.env["DATABASE_POOL_MIN"] ?? 4),
    max: isVercel ? 5 : Number(process.env["DATABASE_POOL_MAX"] ?? 25),
    idleTimeoutMillis: isVercel ? 5000 : 30000,
    connectionTimeoutMillis: 15000,
    statement_timeout: isMigration ? 0 : 10000,
    ssl: isSslRequired ? { rejectUnauthorized: false } : false,
  };
}

const pool = globalForDb.pool ?? new Pool(getPoolConfig());

if (process.env["NODE_ENV"] !== "production") {
  globalForDb.pool = pool;
}

// S5-T1: Enforce non-owner role on all application database connections
// DDL migrations and seed scripts continue to run with table-owner identity.
const skipSetRole =
  process.env["DB_SKIP_SET_ROLE"] === "true" ||
  (!!process.env["VERCEL"] && process.env["DB_SET_ROLE"] !== "true") ||
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
        if (process.env["NODE_ENV"] === "production" && !process.env["VERCEL"]) {
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

// ─── Re-export schema, query logger, and migration NER ───────────────────────

export * from "./schema";
export * from "./queryLogger";
export * from "./migrations";

