import Redis, { type RedisOptions } from "ioredis";

export function getRedisUrl(): string | null {
  return process.env.REDIS_URL || process.env.educore_REDIS_URL || null;
}

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

  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;
  const password = process.env.REDIS_PASSWORD || undefined;

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

  // Refuse hardcoded localhost fallback in production
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: REDIS_URL or REDIS_HOST/PORT is required in production environment.");
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

/**
 * Factory for ioredis instance (used for rate limiting, locks, caching).
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

  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;
  const password = process.env.REDIS_PASSWORD || undefined;

  if (host && port) {
    return new Redis({
      host,
      port,
      password,
      ...defaultOptions,
    });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: REDIS_URL or REDIS_HOST/PORT is required in production environment.");
  }

  return new Redis({
    host: "127.0.0.1",
    port: 6379,
    ...defaultOptions,
  });
}
