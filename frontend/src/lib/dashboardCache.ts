export {
  getCachedDashboardSummary,
  setCachedDashboardSummary,
  invalidateDashboardCache,
  getDashboardCacheKey,
  computeJitteredTtlSeconds,
  _resetMemoryCache,
} from "@schoolmitra/backend/lib/dashboardCache";
export type { MemoryCacheEntry } from "@schoolmitra/backend/lib/dashboardCache";
