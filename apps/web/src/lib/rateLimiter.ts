import Redis from "ioredis";

// Connect to Redis using existing configuration
export const redis = new Redis({
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
  password: process.env.REDIS_PASSWORD ?? undefined,
});

// Lua script for atomic sliding window rate limiting
// KEYS[1]: the rate limit key (e.g. ratelimit:ip:127.0.0.1)
// ARGV[1]: window duration in milliseconds
// ARGV[2]: maximum allowed requests
// ARGV[3]: current timestamp in milliseconds
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

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();
  const result = await redis.eval(
    SLIDING_WINDOW_SCRIPT,
    1,
    key,
    windowMs,
    maxRequests,
    now
  );
  return result === 1;
}

export const RATE_LIMITS = {
  UNAUTHENTICATED: { max: 100, windowMs: 60 * 1000 },
  AUTHENTICATED: { max: 500, windowMs: 60 * 1000 },
  LOGIN: { max: 10, windowMs: 60 * 1000 },
};
