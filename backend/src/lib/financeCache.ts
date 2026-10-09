import { redis } from "./rateLimiter";

// ─── S2 Finance Cache Engine Configuration ─────────────────────────────────────
// Governing Spec: SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0 (PF-R41, PF-R45, PF-R47, PF-R80)
// Freshness Class S2: Working 5-minute TTL jittered between 270s and 330s to prevent thundering herds.
const S2_BASE_TTL_SECONDS = 300;
const S2_JITTER_SECONDS = 60; // +/- 30s jitter

export interface MemoryCacheEntry<T> {
  data: T;
  expiresAt: number;
  tags: string[];
}

// In-memory L1 cache for sub-millisecond process-level reads
const financeMemoryL1 = new Map<string, MemoryCacheEntry<any>>();

// Tag tracking for in-memory L1 invalidation: tag -> Set of cache keys
const memoryTagIndex = new Map<string, Set<string>>();

/**
 * Computes deterministic yet jittered TTL for S2 entries (270s - 330s).
 */
export function computeFinanceJitteredTtl(
  baseSeconds: number = S2_BASE_TTL_SECONDS,
  jitterRange: number = S2_JITTER_SECONDS
): number {
  const min = baseSeconds - Math.floor(jitterRange / 2);
  const offset = Math.floor(Math.random() * jitterRange);
  return min + offset;
}

/**
 * Normalizes parameter objects/strings into a compact hash/slug.
 */
export function normalizeParamsHash(params?: Record<string, unknown> | string | null): string {
  if (!params) return "default";
  if (typeof params === "string") {
    const cleaned = params.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    return cleaned.length > 0 ? cleaned : "default";
  }
  const keys = Object.keys(params).sort();
  if (keys.length === 0) return "default";
  const parts = keys.map((k) => `${k}=${String(params[k] ?? "")}`);
  return parts.join("&");
}

/**
 * Returns canonical tenant-isolated cache key format:
 * t:{schoolId}:v1:finance:{resource}:{paramsHash} (PF-R45)
 */
export function getFinanceCacheKey(
  schoolId: string,
  resource: string,
  params?: Record<string, unknown> | string | null
): string {
  if (!schoolId || typeof schoolId !== "string" || schoolId.trim() === "") {
    throw new Error("Invalid schoolId provided for finance cache");
  }
  if (!resource || typeof resource !== "string" || resource.trim() === "") {
    throw new Error("Invalid resource name provided for finance cache");
  }
  const cleanSchool = schoolId.trim();
  const cleanResource = resource.trim().toLowerCase();
  const paramsHash = normalizeParamsHash(params);
  return `t:${cleanSchool}:v1:finance:${cleanResource}:${paramsHash}`;
}

/**
 * Retrieves cached S2 finance resource.
 * Checks Memory L1 first, then Redis L2.
 */
export async function getCachedFinanceData<T>(
  schoolId: string,
  resource: string,
  params?: Record<string, unknown> | string | null
): Promise<T | null> {
  if (!schoolId || !resource) return null;
  const key = getFinanceCacheKey(schoolId, resource, params);

  // 1. Memory L1 Check
  const memEntry = financeMemoryL1.get(key);
  if (memEntry) {
    if (Date.now() < memEntry.expiresAt) {
      return memEntry.data as T;
    }
    // Expired
    financeMemoryL1.delete(key);
  }

  // 2. Redis L2 Check
  try {
    const raw = await redis.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as T;
      // Populate L1 memory for up to 60s
      financeMemoryL1.set(key, {
        data: parsed,
        expiresAt: Date.now() + 60_000,
        tags: [],
      });
      return parsed;
    }
  } catch (err) {
    // Redis down or unreachable — fallback gracefully to fresh DB query
  }

  return null;
}

/**
 * Stores finance data with jittered 5-minute TTL and associates tag index.
 */
export async function setCachedFinanceData<T>(
  schoolId: string,
  resource: string,
  data: T,
  options?: {
    params?: Record<string, unknown> | string | null;
    tags?: string[];
    ttlSeconds?: number;
  }
): Promise<void> {
  if (!schoolId || !resource || data === undefined || data === null) return;
  const key = getFinanceCacheKey(schoolId, resource, options?.params);
  const ttlSeconds = options?.ttlSeconds ?? computeFinanceJitteredTtl();
  const tags = options?.tags || [`school:${schoolId}`];

  // 1. Populate Memory L1
  financeMemoryL1.set(key, {
    data,
    expiresAt: Date.now() + Math.min(60, ttlSeconds) * 1000,
    tags,
  });

  // Index tags in memory
  for (const tag of tags) {
    if (!memoryTagIndex.has(tag)) {
      memoryTagIndex.set(tag, new Set());
    }
    memoryTagIndex.get(tag)!.add(key);
  }

  // 2. Populate Redis L2
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));

    // Register key in Redis sets for each tag (with 10-minute TTL to automatically sweep)
    for (const tag of tags) {
      const tagKey = `t:${schoolId}:v1:tag:${tag}`;
      await redis.sadd(tagKey, key);
      await redis.expire(tagKey, ttlSeconds + 300);
    }
  } catch (err) {
    // Redis offline — L1 memory still serves request
  }
}

/**
 * Invalidates finance cache entries matching specified tags for a school.
 * Never purges globally (PF-R41).
 */
export async function invalidateFinanceTags(
  schoolId: string,
  tags: string[]
): Promise<void> {
  if (!schoolId || !tags || tags.length === 0) return;

  const keysToDelete = new Set<string>();

  // 1. Resolve keys from Memory L1 Tag Index
  for (const tag of tags) {
    const keys = memoryTagIndex.get(tag);
    if (keys) {
      for (const k of keys) {
        keysToDelete.add(k);
        financeMemoryL1.delete(k);
      }
      memoryTagIndex.delete(tag);
    }
  }

  // 2. Resolve keys from Redis Tag Sets
  try {
    for (const tag of tags) {
      const tagKey = `t:${schoolId}:v1:tag:${tag}`;
      const redisKeys = await redis.smembers(tagKey);
      if (redisKeys && redisKeys.length > 0) {
        for (const rk of redisKeys) {
          keysToDelete.add(rk);
        }
        await redis.del(...redisKeys);
      }
      await redis.del(tagKey);
    }
  } catch (err) {
    // Redis error handled gracefully
  }

  // Also clean up any lingering memory entries found in Redis
  for (const k of keysToDelete) {
    financeMemoryL1.delete(k);
  }
}

/**
 * Convenience helper to invalidate general finance tags on payments/reversals.
 */
export async function invalidateFinanceOnPayment(
  schoolId: string,
  invoiceIds?: string[]
): Promise<void> {
  const tags = [`school:${schoolId}`, `fin:payments:${schoolId}`, `fin:dues:${schoolId}`, `fin:accounts:${schoolId}`];
  if (invoiceIds && invoiceIds.length > 0) {
    for (const invId of invoiceIds) {
      tags.push(`fin:${invId}`);
    }
  }
  await invalidateFinanceTags(schoolId, tags);
}

/**
 * Testing helper: resets memory L1 and tag index
 */
export function _resetFinanceMemoryCache(): void {
  financeMemoryL1.clear();
  memoryTagIndex.clear();
}
