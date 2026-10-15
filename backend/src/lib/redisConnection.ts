import Redis, { type RedisOptions } from "ioredis";

/**
 * Resolves Valkey / Redis connection URL.
 * Prioritizes VALKEY_URL (Amazon ElastiCache for Valkey / Valkey OSS), falling back to REDIS_URL.
 * Normalizes 'valkeys://' -> 'rediss://' and 'valkey://' -> 'redis://' so the underlying
 * wire-compatible client (ioredis) connects without protocol parse errors.
 */
export function getRedisUrl(): string | null {
  const rawUrl =
    process.env.VALKEY_URL ||
    process.env.REDIS_URL ||
    process.env.educore_VALKEY_URL ||
    process.env.educore_REDIS_URL ||
    null;

  if (!rawUrl) return null;

  // Protocol normalization for ioredis parser compatibility
  if (rawUrl.startsWith("valkeys://")) {
    return "rediss://" + rawUrl.slice("valkeys://".length);
  }
  if (rawUrl.startsWith("valkey://")) {
    return "redis://" + rawUrl.slice("valkey://".length);
  }
  return rawUrl;
}

/** Idiomatic Valkey URL getter */
export const getValkeyUrl = getRedisUrl;

/**
 * Returns connection configuration for BullMQ Queue and Worker instances.
 * BullMQ requires `maxRetriesPerRequest: null` and supports direct URL or host config.
 */
export function getBullMQRedisConnection(): any {
  const url = getRedisUrl();
  if (url) {
    return {
      url,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 10000,
    };
  }

  const host = process.env.VALKEY_HOST || process.env.REDIS_HOST;
  const rawPort = process.env.VALKEY_PORT || process.env.REDIS_PORT;
  const port = rawPort ? parseInt(rawPort, 10) : undefined;
  const password = process.env.VALKEY_PASSWORD || process.env.REDIS_PASSWORD || undefined;

  if (host && port) {
    return {
      host,
      port,
      password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 10000,
    };
  }

  // Refuse hardcoded localhost fallback in production (except during Next.js build)
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("FATAL: REDIS_URL or REDIS_HOST/PORT is required (or VALKEY_URL) in production environment.");
  }

  // Development/test fallback
  return {
    host: "127.0.0.1",
    port: 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 5000,
  };
}

/** Idiomatic BullMQ Valkey connection getter */
export const getBullMQValkeyConnection = getBullMQRedisConnection;

/**
 * Factory for Valkey / Redis client instance (used for rate limiting, locks, caching).
 */
export function getRedisClient(customOptions: RedisOptions = {}): Redis {
  const url = getRedisUrl();
  const defaultOptions: RedisOptions = {
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 5000,
    keepAlive: 10000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times: number) => {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
    ...customOptions,
  };

  if (url) {
    return new Redis(url, defaultOptions);
  }

  const host = process.env.VALKEY_HOST || process.env.REDIS_HOST;
  const rawPort = process.env.VALKEY_PORT || process.env.REDIS_PORT;
  const port = rawPort ? parseInt(rawPort, 10) : undefined;
  const password = process.env.VALKEY_PASSWORD || process.env.REDIS_PASSWORD || undefined;

  if (host && port) {
    return new Redis({
      host,
      port,
      password,
      ...defaultOptions,
    });
  }

  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("FATAL: REDIS_URL or REDIS_HOST/PORT is required (or VALKEY_URL) in production environment.");
  }

  return new Redis({
    host: "127.0.0.1",
    port: 6379,
    ...defaultOptions,
  });
}

/** Idiomatic Valkey client factory */
export const getValkeyClient = getRedisClient;
