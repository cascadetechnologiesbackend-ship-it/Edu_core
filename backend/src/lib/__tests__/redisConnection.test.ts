import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getBullMQRedisConnection, getRedisUrl, getRedisClient } from "../redisConnection";

describe("Redis Connection Factory (Stage S2-E)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("extracts REDIS_URL when present", () => {
    process.env.REDIS_URL = "redis://user:pass@production-redis.internal:6379";
    expect(getRedisUrl()).toBe("redis://user:pass@production-redis.internal:6379");
  });

  it("configures BullMQ connection with maxRetriesPerRequest: null for Redis URL", () => {
    process.env.REDIS_URL = "rediss://default:secret@upstash.io:6379";
    const conn = getBullMQRedisConnection();
    expect(conn.url).toBe("rediss://default:secret@upstash.io:6379");
    expect(conn.maxRetriesPerRequest).toBeNull();
  });

  it("configures BullMQ connection with host/port and maxRetriesPerRequest: null", () => {
    delete process.env.REDIS_URL;
    delete process.env.educore_REDIS_URL;
    process.env.REDIS_HOST = "redis.internal";
    process.env.REDIS_PORT = "6380";
    process.env.REDIS_PASSWORD = "my-secret-pass";

    const conn = getBullMQRedisConnection();
    expect(conn.host).toBe("redis.internal");
    expect(conn.port).toBe(6380);
    expect(conn.password).toBe("my-secret-pass");
    expect(conn.maxRetriesPerRequest).toBeNull();
  });

  it("throws FATAL in production if REDIS_URL and host/port are missing", () => {
    delete process.env.REDIS_URL;
    delete process.env.educore_REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    (process.env as any).NODE_ENV = "production";

    expect(() => getBullMQRedisConnection()).toThrow(/FATAL: REDIS_URL or REDIS_HOST\/PORT is required/);
  });

  it("returns development localhost fallback when not in production", () => {
    delete process.env.REDIS_URL;
    delete process.env.educore_REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    (process.env as any).NODE_ENV = "test";

    const conn = getBullMQRedisConnection();
    expect(conn.host).toBe("127.0.0.1");
    expect(conn.port).toBe(6379);
    expect(conn.maxRetriesPerRequest).toBeNull();
  });
});
