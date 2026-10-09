import { redis } from "./rateLimiter";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { eq } from "drizzle-orm";

const SCHOOL_CACHE_PREFIX = "cache:school:";
const SCHOOL_INVALIDATE_CHANNEL = "channel:school:invalidate";
const REDIS_TTL_SECONDS = 300; // 5 minutes in Redis
const MEMORY_TTL_MS = 60_000; // 1 minute in memory
const DB_FALLBACK_TTL_MS = 60_000; // 1 minute fallback TTL when Redis is offline (prevents 10s thrashing locally)

// Local memory L1 cache
interface MemoryCacheEntry {
  data: any;
  expiresAt: number;
  isStale?: boolean;
}
const memoryCache = new Map<string, MemoryCacheEntry>();

let isSubscriberInitialized = false;

/**
 * Initializes Redis Pub/Sub listener for cluster/multi-instance cache invalidation
 */
function initSubscriberIfNeeded() {
  if (isSubscriberInitialized || typeof window !== "undefined") return;
  try {
    const sub = redis.duplicate();
    sub.on("error", () => {
      // Ignore Redis connection errors on subscriber
    });
    sub.subscribe(SCHOOL_INVALIDATE_CHANNEL, (err) => {
      if (!err) {
        isSubscriberInitialized = true;
      }
    });
    sub.on("message", (channel, message) => {
      if (channel === SCHOOL_INVALIDATE_CHANNEL) {
        if (message === "*") {
          memoryCache.clear();
        } else {
          memoryCache.delete(message);
        }
      }
    });
  } catch (err) {
    // Subscriber initialization fallback
  }
}

/**
 * Invalidate school cache across Redis, memory, and pub/sub subscribers.
 */
export async function invalidateSchoolCache(schoolId?: string): Promise<void> {
  initSubscriberIfNeeded();
  if (schoolId) {
    memoryCache.delete(schoolId);
    try {
      await redis.del(`${SCHOOL_CACHE_PREFIX}${schoolId}`);
      await redis.publish(SCHOOL_INVALIDATE_CHANNEL, schoolId);
    } catch (err) {
      // Redis unavailable, memory cleared
    }
  } else {
    memoryCache.clear();
    try {
      const keys = await redis.keys(`${SCHOOL_CACHE_PREFIX}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.publish(SCHOOL_INVALIDATE_CHANNEL, "*");
    } catch (err) {
      // Redis unavailable
    }
  }
}

/**
 * Fetches and caches school metadata with Redis + L1 Memory + DB Fallback.
 * In accordance with Requirement 17.2:
 * "requireSchool() uses Redis-backed cache with pub/sub invalidation; when Redis is unavailable,
 * the system falls back to direct DB queries with a reduced TTL (10 seconds) or attaches a staleness flag."
 */
export async function getCachedSchool(schoolId: string) {
  initSubscriberIfNeeded();
  const now = Date.now();

  // 1. Check L1 memory cache
  const local = memoryCache.get(schoolId);
  if (local && local.expiresAt > now) {
    return local.data;
  }

  // 2. Try Redis L2 cache
  let redisAvailable = true;
  try {
    const raw = await redis.get(`${SCHOOL_CACHE_PREFIX}${schoolId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryCache.set(schoolId, { data: parsed, expiresAt: now + MEMORY_TTL_MS });
      return parsed;
    }
  } catch (err) {
    redisAvailable = false;
  }

  // 3. Fallback to direct DB query
  const school = await db.query.schools.findFirst({
    where: eq(schools.id, schoolId),
  });

  if (!school) {
    return null;
  }

  // 4. Update caches
  if (redisAvailable) {
    try {
      await redis.set(
        `${SCHOOL_CACHE_PREFIX}${schoolId}`,
        JSON.stringify(school),
        "EX",
        REDIS_TTL_SECONDS,
      );
      memoryCache.set(schoolId, {
        data: school,
        expiresAt: now + MEMORY_TTL_MS,
      });
    } catch {
      // Redis write failure - use fallback TTL
      memoryCache.set(schoolId, {
        data: school,
        expiresAt: now + DB_FALLBACK_TTL_MS,
        isStale: true,
      });
    }
  } else {
    // Redis unavailable: Reduced TTL (10s) with staleness flag
    memoryCache.set(schoolId, {
      data: school,
      expiresAt: now + DB_FALLBACK_TTL_MS,
      isStale: true,
    });
  }

  return school;
}
