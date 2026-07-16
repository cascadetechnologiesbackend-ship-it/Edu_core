import { redis } from "./rateLimiter";

/**
 * Basic cache wrapper over ioredis for frequently accessed read-only data.
 * Used for timetables, fee structures, etc.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`Cache read error for ${key}:`, error);
    return null;
  }
}

export async function setCached(key: string, value: any, ttlSeconds = 3600): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.error(`Cache write error for ${key}:`, error);
  }
}

export async function invalidateCache(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`Cache invalidate error for ${key}:`, error);
  }
}
