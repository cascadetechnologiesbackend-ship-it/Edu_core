import { getRedisClient } from "./redisConnection";

export const redis = getRedisClient({
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  connectTimeout: 1000,
  commandTimeout: 1000,
  keepAlive: 10000,
  retryStrategy: (times: number) => {
    if (times > 3) return null; // Stop retrying after 3 attempts
    return Math.min(times * 200, 1000);
  },
});

// ─── Module-Level Valkey / Redis Circuit Breaker (Flaw Audit P0 #2) ──────────
let lastRedisAttempt = 0;
export const REDIS_RETRY_INTERVAL_MS = 30_000;
export const VALKEY_RETRY_INTERVAL_MS = REDIS_RETRY_INTERVAL_MS;

export function recordRedisFailure(err?: unknown): void {
  lastRedisAttempt = Date.now();
}
export const recordValkeyFailure = recordRedisFailure;

export function isRedisAvailable(): boolean {
  if (redis.status === "ready") {
    return true;
  }
  const now = Date.now();
  // If not ready and within the 30s cooldown window, skip immediately
  if (now - lastRedisAttempt < REDIS_RETRY_INTERVAL_MS) {
    return false;
  }
  // Allow an attempt every 30s (or initial 'wait' status)
  lastRedisAttempt = now;
  return true;
}
export const isValkeyAvailable = isRedisAvailable;

/** Canonical Valkey client alias */
export const valkey = redis;

redis.on("error", (_err) => {
  recordRedisFailure(_err);
  // Gracefully handle Valkey / Redis connection issues without throwing unhandled exceptions
});

// Lua script for atomic sliding window rate limiting
const SLIDING_WINDOW_SCRIPT = `
  local key = KEYS[1]
  local window_size = tonumber(ARGV[1])
  local max_requests = tonumber(ARGV[2])
  local current_time = tonumber(ARGV[3])
  local window_start = current_time - window_size

  -- Remove timestamps older than the window
  redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

  -- Count requests in the current window
  local current_requests = redis.call('ZCARD', key)

  if current_requests >= max_requests then
    return 0 -- Rate limit exceeded
  end

  -- Add the current request timestamp
  redis.call('ZADD', key, current_time, current_time .. '-' .. redis.call('INCR', key .. ':counter'))
  
  -- Set expiration to clean up old keys
  redis.call('PEXPIRE', key, window_size)
  redis.call('PEXPIRE', key .. ':counter', window_size)

  return 1 -- Allowed
`;

// In-memory fallback if Redis is unreachable
const memoryRateLimitMap = new Map<string, number[]>();

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();

  // Check Valkey primary (or Redis fallback)
  const client = valkey || redis;
  const isAvailable = isValkeyAvailable();

  if (isAvailable && client) {
    try {
      const result = await client.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        key,
        windowMs,
        maxRequests,
        now,
      );
      return result === 1;
    } catch (err) {
      recordValkeyFailure(err);
      // Fall through to in-memory sliding window fallback
    }
  }

  // In-memory sliding window fallback
    const timestamps = memoryRateLimitMap.get(key) || [];
    const validTimestamps = timestamps.filter((t) => t > now - windowMs);

    if (validTimestamps.length >= maxRequests) {
      return false;
    }

    validTimestamps.push(now);
    memoryRateLimitMap.set(key, validTimestamps);

    // Periodically clean up old keys
    if (memoryRateLimitMap.size > 10000) {
      memoryRateLimitMap.clear();
    }

    return true;
  }

export const RATE_LIMITS = {
  UNAUTHENTICATED: { max: 100, windowMs: 60 * 1000 },
  AUTHENTICATED: { max: 500, windowMs: 60 * 1000 },
  LOGIN: { max: 10, windowMs: 60 * 1000 },
};
