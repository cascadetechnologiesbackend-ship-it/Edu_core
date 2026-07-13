import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// ─── Connection Pool ──────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
  min: Number(process.env["DATABASE_POOL_MIN"] ?? 2),
  max: Number(process.env["DATABASE_POOL_MAX"] ?? 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ─── Drizzle Client ───────────────────────────────────────────────────────────

export const db = drizzle(pool, {
  schema,
  logger: process.env["NODE_ENV"] === "development",
});

export type Db = typeof db;

// ─── Re-export schema for convenience ────────────────────────────────────────

export * from "./schema";
