import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import type { PoolConfig } from "pg";
import { parseEnv } from "@neon/env";
import neonConfig from "../../neon";

export const DEFAULT_LOCAL_DATABASE_URL =
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

let envLoaded = false;

/**
 * Loads `.env.local` and `.env` from cwd or monorepo root for CLI/migration
 * scripts without ever overwriting variables already provided in `process.env`.
 * `.env.local` is loaded first so pulled Neon values override `.env` defaults
 * while preserving all existing `.env` configuration.
 */
export function loadLocalEnvFiles(): void {
  if (envLoaded) return;
  envLoaded = true;

  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "..", ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
  ];

  const seen = new Set<string>();
  for (const envPath of candidates) {
    if (seen.has(envPath)) continue;
    seen.add(envPath);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }
}

/**
 * Returns the pooled application connection string (`DATABASE_URL`), validated
 * through `@neon/env`'s `parseEnv` against `neon.ts` when set in `process.env`.
 */
export function getAppDatabaseUrl(): string {
  if (process.env["DATABASE_URL"] && process.env["DATABASE_URL"].trim() !== "") {
    const { postgres } = parseEnv(neonConfig, ["DATABASE_URL"]);
    return postgres.databaseUrl;
  }
  return DEFAULT_LOCAL_DATABASE_URL;
}

/**
 * Returns the direct (non-pooled) Postgres connection string for schema
 * migrations and DDL tools, following the `neon-postgres` skill rule:
 *   1. `MIGRATION_DATABASE_URL` (explicit migration override, e.g. Render)
 *   2. `DATABASE_URL_UNPOOLED` (Neon direct endpoint, validated via `parseEnv`)
 *   3. `DATABASE_URL` (fallback)
 *   4. Local development default
 */
export function getMigrationDatabaseUrl(): string {
  return getMigrationDatabaseDetails().url;
}

export interface MigrationDatabaseDetails {
  url: string;
  source: "MIGRATION_DATABASE_URL" | "DATABASE_URL_UNPOOLED" | "DATABASE_URL" | "DEFAULT_LOCAL_DATABASE_URL";
  sanitized: string;
  username?: string | undefined;
  host?: string | undefined;
  database?: string | undefined;
}

export function getMigrationDatabaseDetails(): MigrationDatabaseDetails {
  let source: MigrationDatabaseDetails["source"] = "DEFAULT_LOCAL_DATABASE_URL";
  let url = DEFAULT_LOCAL_DATABASE_URL;

  if (
    process.env["MIGRATION_DATABASE_URL"] &&
    process.env["MIGRATION_DATABASE_URL"].trim() !== ""
  ) {
    source = "MIGRATION_DATABASE_URL";
    url = process.env["MIGRATION_DATABASE_URL"];
  } else if (
    process.env["DATABASE_URL_UNPOOLED"] &&
    process.env["DATABASE_URL_UNPOOLED"].trim() !== ""
  ) {
    source = "DATABASE_URL_UNPOOLED";
    const { postgres } = parseEnv(neonConfig, ["DATABASE_URL_UNPOOLED"]);
    url = postgres.databaseUrlUnpooled;
  } else if (
    process.env["DATABASE_URL"] &&
    process.env["DATABASE_URL"].trim() !== ""
  ) {
    source = "DATABASE_URL";
    const { postgres } = parseEnv(neonConfig, ["DATABASE_URL"]);
    url = postgres.databaseUrl;
  }

  let sanitized = url;
  let username: string | undefined;
  let host: string | undefined;
  let database: string | undefined;

  try {
    const parsed = new URL(url);
    username = parsed.username || undefined;
    host = parsed.host || undefined;
    database = parsed.pathname ? parsed.pathname.replace(/^\//, "") : undefined;
    if (parsed.password) {
      parsed.password = "******";
    }
    sanitized = parsed.toString();
  } catch {
    sanitized = url.replace(/:([^@/]+)@/, ":******@");
  }

  return { url, source, sanitized, username, host, database };
}

export function isNeonDatabaseUrl(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString);
    return parsed.hostname.toLowerCase().endsWith(".neon.tech");
  } catch {
    return connectionString.toLowerCase().includes(".neon.tech");
  }
}

/**
 * Builds `pg.PoolConfig` tailored cleanly for both local Postgres and Neon
 * serverless Lakebase Postgres (preserving `node-postgres` / Drizzle ORM).
 */
export function createPoolConfig(
  connectionString: string,
  options?: { isMigration?: boolean },
): PoolConfig {
  const isMigration = options?.isMigration ?? false;
  const isNeon = isNeonDatabaseUrl(connectionString);
  const isServerless = Boolean(process.env["VERCEL"]);

  if (isMigration) {
    return {
      connectionString,
      connectionTimeoutMillis: isNeon ? 30000 : 10000,
    };
  }

  return {
    connectionString,
    min: isServerless ? 0 : Number(process.env["DATABASE_POOL_MIN"] ?? 4),
    max: isServerless
      ? Number(process.env["DATABASE_POOL_MAX"] ?? 5)
      : Number(process.env["DATABASE_POOL_MAX"] ?? 25),
    idleTimeoutMillis: isServerless ? 5000 : 30000,
    connectionTimeoutMillis: isNeon || isServerless ? 15000 : 5000,
    statement_timeout: 2000,
  };
}

