import { describe, it, expect, afterEach } from "vitest";
import {
  DEFAULT_LOCAL_DATABASE_URL,
  createPoolConfig,
  getAppDatabaseUrl,
  getMigrationDatabaseUrl,
  getMigrationDatabaseDetails,
  isNeonDatabaseUrl,
} from "../../../../database/src/neonEnv";

describe("Neon Connection & Pool Config (neon + neon-postgres skills)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of [
      "DATABASE_URL",
      "DATABASE_URL_UNPOOLED",
      "MIGRATION_DATABASE_URL",
      "VERCEL",
      "DATABASE_POOL_MIN",
      "DATABASE_POOL_MAX",
    ]) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("falls back to DEFAULT_LOCAL_DATABASE_URL when no DATABASE_URL is configured", () => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_UNPOOLED;
    delete process.env.MIGRATION_DATABASE_URL;

    expect(getAppDatabaseUrl()).toBe(DEFAULT_LOCAL_DATABASE_URL);
    expect(getMigrationDatabaseUrl()).toBe(DEFAULT_LOCAL_DATABASE_URL);
  });

  it("reads and validates pooled DATABASE_URL through @neon/env parseEnv", () => {
    const pooled =
      "postgresql://app:secret@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
    process.env.DATABASE_URL = pooled;

    expect(getAppDatabaseUrl()).toBe(pooled);
  });

  it("selects unpooled direct DATABASE_URL_UNPOOLED over pooled DATABASE_URL for migrations", () => {
    const pooled =
      "postgresql://app:secret@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
    const direct =
      "postgresql://app:secret@ep-example.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

    process.env.DATABASE_URL = pooled;
    process.env.DATABASE_URL_UNPOOLED = direct;
    delete process.env.MIGRATION_DATABASE_URL;

    expect(getAppDatabaseUrl()).toBe(pooled);
    expect(getMigrationDatabaseUrl()).toBe(direct);
  });

  it("honors explicit MIGRATION_DATABASE_URL override over DATABASE_URL_UNPOOLED", () => {
    const explicit = "postgresql://migrator:secret@custom.example.com/db";
    process.env.DATABASE_URL =
      "postgresql://app:secret@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb";
    process.env.DATABASE_URL_UNPOOLED =
      "postgresql://app:secret@ep-example.ap-southeast-1.aws.neon.tech/neondb";
    process.env.MIGRATION_DATABASE_URL = explicit;

    expect(getMigrationDatabaseUrl()).toBe(explicit);

    const details = getMigrationDatabaseDetails();
    expect(details.source).toBe("MIGRATION_DATABASE_URL");
    expect(details.username).toBe("migrator");
    expect(details.host).toBe("custom.example.com");
    expect(details.sanitized).toContain("migrator:******@custom.example.com");
  });

  it("identifies Neon endpoints accurately", () => {
    expect(
      isNeonDatabaseUrl(
        "postgresql://user:pass@ep-foo-bar.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
      ),
    ).toBe(true);
    expect(isNeonDatabaseUrl(DEFAULT_LOCAL_DATABASE_URL)).toBe(false);
  });

  it("applies cold-start timeouts and serverless pool sizing for Neon while preserving local defaults", () => {
    delete process.env.VERCEL;
    delete process.env.DATABASE_POOL_MIN;
    delete process.env.DATABASE_POOL_MAX;

    const localCfg = createPoolConfig(DEFAULT_LOCAL_DATABASE_URL);
    expect(localCfg.min).toBe(4);
    expect(localCfg.max).toBe(25);
    expect(localCfg.connectionTimeoutMillis).toBe(5000);
    expect(localCfg.statement_timeout).toBe(2000);

    const neonUrl =
      "postgresql://app:secret@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
    const neonCfg = createPoolConfig(neonUrl);
    expect(neonCfg.connectionTimeoutMillis).toBe(15000);
    expect(neonCfg.statement_timeout).toBe(2000);

    const migrationCfg = createPoolConfig(neonUrl, { isMigration: true });
    expect(migrationCfg.connectionTimeoutMillis).toBe(30000);
    expect(migrationCfg.statement_timeout).toBeUndefined();

    process.env.VERCEL = "1";
    const serverlessCfg = createPoolConfig(neonUrl);
    expect(serverlessCfg.min).toBe(0);
    expect(serverlessCfg.max).toBe(5);
    expect(serverlessCfg.idleTimeoutMillis).toBe(5000);
  });
});

