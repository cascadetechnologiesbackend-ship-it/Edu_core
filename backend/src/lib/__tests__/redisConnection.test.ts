import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getBullMQRedisConnection,
  getBullMQValkeyConnection,
  getRedisUrl,
  getValkeyUrl,
  getRedisClient,
  getValkeyClient,
} from "../redisConnection";

describe("Valkey / Redis Connection Factory", () => {
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

  it("prioritizes VALKEY_URL over REDIS_URL", () => {
    process.env.VALKEY_URL = "redis://user:pass@valkey.internal:6379";
    process.env.REDIS_URL = "redis://user:pass@old-redis.internal:6379";
    expect(getValkeyUrl()).toBe("redis://user:pass@valkey.internal:6379");
    expect(getRedisUrl()).toBe("redis://user:pass@valkey.internal:6379");
  });

  it("normalizes valkey:// protocol to redis:// for ioredis compatibility", () => {
    process.env.VALKEY_URL = "valkey://default:secret@aws-elasticache-valkey.internal:6379";
    expect(getValkeyUrl()).toBe("redis://default:secret@aws-elasticache-valkey.internal:6379");
  });

  it("normalizes valkeys:// TLS protocol to rediss:// for ioredis compatibility", () => {
    process.env.VALKEY_URL = "valkeys://default:secret@aws-elasticache-valkey.internal:6379";
    expect(getValkeyUrl()).toBe("rediss://default:secret@aws-elasticache-valkey.internal:6379");
  });

  it("configures BullMQ connection with maxRetriesPerRequest: null for Valkey URL", () => {
    process.env.VALKEY_URL = "valkeys://default:secret@educore-valkey.c3e6ik6w4c0u.ap-south-1.cache.amazonaws.com:6379";
    const conn = getBullMQValkeyConnection();
    expect(conn.url).toBe("rediss://default:secret@educore-valkey.c3e6ik6w4c0u.ap-south-1.cache.amazonaws.com:6379");
    expect(conn.maxRetriesPerRequest).toBeNull();
  });

  it("configures BullMQ connection with VALKEY_HOST/PORT/PASSWORD", () => {
    delete process.env.VALKEY_URL;
    delete process.env.REDIS_URL;
    delete process.env.educore_VALKEY_URL;
    delete process.env.educore_REDIS_URL;
    process.env.VALKEY_HOST = "educore-valkey.internal";
    process.env.VALKEY_PORT = "6379";
    process.env.VALKEY_PASSWORD = "aws-auth-token-123";

    const conn = getBullMQValkeyConnection();
    expect(conn.host).toBe("educore-valkey.internal");
    expect(conn.port).toBe(6379);
    expect(conn.password).toBe("aws-auth-token-123");
    expect(conn.maxRetriesPerRequest).toBeNull();
  });

  it("configures BullMQ connection with host/port and maxRetriesPerRequest: null for Redis legacy", () => {
    delete process.env.VALKEY_URL;
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
    delete process.env.VALKEY_URL;
    delete process.env.REDIS_URL;
    delete process.env.educore_VALKEY_URL;
    delete process.env.educore_REDIS_URL;
    delete process.env.VALKEY_HOST;
    delete process.env.VALKEY_PORT;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    (process.env as any).NODE_ENV = "production";

    expect(() => getBullMQRedisConnection()).toThrow(/FATAL: REDIS_URL or REDIS_HOST\/PORT is required/);
  });

  it("returns development localhost fallback when not in production", () => {
    delete process.env.VALKEY_URL;
    delete process.env.REDIS_URL;
    delete process.env.educore_VALKEY_URL;
    delete process.env.educore_REDIS_URL;
    delete process.env.VALKEY_HOST;
    delete process.env.VALKEY_PORT;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    (process.env as any).NODE_ENV = "test";

    const conn = getBullMQRedisConnection();
    expect(conn.host).toBe("127.0.0.1");
    expect(conn.port).toBe(6379);
    expect(conn.maxRetriesPerRequest).toBeNull();
  });
});
