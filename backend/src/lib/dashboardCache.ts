import { redis } from "./rateLimiter";

// ─── S2 Dashboard Cache Configuration ──────────────────────────────────────────
// S2 Freshness Class: 5 minutes TTL (Normative from Spec 4.1 / WS2 / PF-R80)
// Jittered between 270s and 330s to prevent thundering herd on operational shifts
const S2_BASE_TTL_SECONDS = 300;
const S2_JITTER_SECONDS = 60; // +/- 30s jitter

export interface MemoryCacheEntry<T> {
  data: T;
  expiresAt: number;
}

// In-memory L1 cache for sub-millisecond process-level reads
const MAX_MEMORY_ENTRIES = 500;
const memoryL1Cache = new Map<string, MemoryCacheEntry<any>>();

function trimDashboardMemoryCache(): void {
  if (memoryL1Cache.size >= MAX_MEMORY_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of memoryL1Cache.entries()) {
      if (entry.expiresAt <= now || memoryL1Cache.size >= MAX_MEMORY_ENTRIES) {
        memoryL1Cache.delete(key);
      }
    }
  }
}

/**
 * Computes deterministic yet jittered TTL for S2 entries.
 */
export function computeJitteredTtlSeconds(
  baseSeconds: number = S2_BASE_TTL_SECONDS,
  jitterRange: number = S2_JITTER_SECONDS
): number {
  const min = baseSeconds - Math.floor(jitterRange / 2);
  const offset = Math.floor(Math.random() * jitterRange);
  return min + offset;
}

/**
 * Returns canonical tenant-isolated cache key format: t:{schoolId}:v1:dashboard_summary
 */
export function getDashboardCacheKey(schoolId: string): string {
  if (!schoolId || typeof schoolId !== "string" || schoolId.trim() === "") {
    throw new Error("Invalid schoolId provided for dashboard cache");
  }
  return `t:${schoolId.trim()}:v1:dashboard_summary`;
}

/**
 * Retrieves cached dashboard summary counters.
 * Checks Memory L1 first, then Redis L2.
 */
export async function getCachedDashboardSummary<T>(schoolId: string): Promise<T | null> {
  if (!schoolId) return null;
  const key = getDashboardCacheKey(schoolId);

  // 1. Memory L1 Check
  const memEntry = memoryL1Cache.get(key);
  if (memEntry) {
    if (Date.now() < memEntry.expiresAt) {
      return memEntry.data as T;
    }
    memoryL1Cache.delete(key);
  }

  // 2. Redis L2 Check
  try {
    const raw = await redis.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as T;
      trimDashboardMemoryCache();
      memoryL1Cache.set(key, {
        data: parsed,
        expiresAt: Date.now() + 60_000,
      });
      return parsed;
    }
  } catch (err) {
    // Redis down or unreachable — fallback gracefully to DB query
  }

  return null;
}

/**
 * Stores dashboard summary counters with jittered 5-minute TTL.
 */
export async function setCachedDashboardSummary<T>(schoolId: string, data: T): Promise<void> {
  if (!schoolId || data === undefined || data === null) return;
  const key = getDashboardCacheKey(schoolId);
  const ttlSeconds = computeJitteredTtlSeconds();

  // Populate L1 with 60s TTL for fast process-level warm hits (PF-R80)
  trimDashboardMemoryCache();
  memoryL1Cache.set(key, {
    data,
    expiresAt: Date.now() + Math.min(60, ttlSeconds) * 1000,
  });

  // Populate L2 Redis
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    // Redis offline — L1 memory still serves request
  }
}

/**
 * Tag-invalidates dashboard counters on mutations (attendance mark, fees collected, admissions, leaves).
 */
export async function invalidateDashboardCache(schoolId: string): Promise<void> {
  if (!schoolId) return;
  const key = getDashboardCacheKey(schoolId);

  // Invalidate Memory L1
  memoryL1Cache.delete(key);

  // Invalidate Redis L2
  try {
    await redis.del(key);
  } catch (err) {
    // Fallback ignored
  }
}

/**
 * Testing helper: resets memory L1 cache
 */
export function _resetMemoryCache(): void {
  memoryL1Cache.clear();
}
