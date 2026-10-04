import Redis from "ioredis";

// Connect to Redis using connection URL or host/port configuration
const redisUrl = process.env.educore_REDIS_URL || process.env.REDIS_URL;

const redisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
  retryStrategy: (times: number) => {
    if (times > 3) return null; // Stop retrying after 3 attempts
    return Math.min(times * 200, 1000);
  },
};

export const redis = redisUrl
  ? new Redis(redisUrl, redisOptions)
  : new Redis({
      host: process.env.REDIS_HOST ?? "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
      password: process.env.REDIS_PASSWORD ?? undefined,
      ...redisOptions,
    });

redis.on("error", (_err) => {
  // Gracefully handle redis connection issues without throwing unhandled exceptions
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

  try {
    const result = await redis.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      key,
      windowMs,
      maxRequests,
      now,
    );
    return result === 1;
  } catch (err) {
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
}

export const RATE_LIMITS = {
  UNAUTHENTICATED: { max: 100, windowMs: 60 * 1000 },
  AUTHENTICATED: { max: 500, windowMs: 60 * 1000 },
  LOGIN: { max: 10, windowMs: 60 * 1000 },
};
