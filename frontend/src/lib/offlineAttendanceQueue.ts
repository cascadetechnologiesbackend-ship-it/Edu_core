/**
 * Offline Attendance Queue and Cache Manager
 *
 * Provides client-side resilience for Teacher PWA attendance marking:
 * 1. Caches today's section rosters in IndexedDB / Local Cache when opened.
 * 2. When network is down, queues submissions locally in IndexedDB with visible offline state.
 * 3. Auto-syncs queued roll calls on reconnect listener (window "online" event).
 * 4. Idempotency is mathematically guaranteed by the backend's student_attendance_unique constraint
 *    (student_id, attendance_date, period_id) onConflictDoUpdate.
 *
 * Complies with Edu_core PWA Privacy laws: NO authenticated HTML cached; only client-side operational state.
 */

import type {
  SaveAttendanceInput,
  SaveAttendanceResult,
  WorkbenchRosterData,
  AttendanceStatus,
} from "@/app/(teacher)/teacher/attendance/attendanceActions";

export interface QueuedAttendanceSubmission {
  id: string; // `${sectionId}_${dateStr}_${periodId || "day"}`
  sectionId: string;
  dateStr: string;
  periodId: string | null;
  sectionName?: string | undefined;
  className?: string | undefined;
  records: Array<{
    studentId: string;
    status: AttendanceStatus;
    remarks?: string | undefined;
  }>;
  queuedAt: string;
  retryCount: number;
  lastError?: string | undefined;
}

export interface CachedRoster {
  cacheKey: string;
  sectionId: string;
  dateStr: string;
  cachedAt: string;
  roster: WorkbenchRosterData;
}

const DB_NAME = "edu_core_offline_db";
const DB_VERSION = 1;
const QUEUE_STORE = "attendance_queue";
const CACHE_STORE = "roster_cache";

// In-memory fallback stores for SSR or environments without IndexedDB (e.g. unit test runner)
const memoryQueue = new Map<string, QueuedAttendanceSubmission>();
const memoryCache = new Map<string, CachedRoster>();

/**
 * Checks if IndexedDB is supported in the current runtime.
 */
function isIndexedDBAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.indexedDB !== "undefined" &&
    window.indexedDB !== null
  );
}

/**
 * Opens or upgrades the IndexedDB instance.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error("IndexedDB is not supported in this environment"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "cacheKey" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generates canonical ID for an attendance submission.
 */
export function getSubmissionKey(
  sectionId: string,
  dateStr: string,
  periodId?: string | null
): string {
  return `${sectionId}_${dateStr}_${periodId || "day"}`;
}

/**
 * Generates canonical key for a roster cache entry.
 */
export function getRosterCacheKey(sectionId: string, dateStr: string): string {
  return `roster_${sectionId}_${dateStr}`;
}

/**
 * Queues an attendance submission locally when network save fails.
 * Idempotently updates if a submission for the same section/date/period already exists.
 */
export async function queueOfflineAttendance(
  input: SaveAttendanceInput,
  meta?: { sectionName?: string; className?: string }
): Promise<QueuedAttendanceSubmission> {
  const id = getSubmissionKey(input.sectionId, input.dateStr, input.periodId);
  const queuedItem: QueuedAttendanceSubmission = {
    id,
    sectionId: input.sectionId,
    dateStr: input.dateStr,
    periodId: input.periodId || null,
    sectionName: meta?.sectionName,
    className: meta?.className,
    records: input.records,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
  };

  if (!isIndexedDBAvailable()) {
    memoryQueue.set(id, queuedItem);
    return queuedItem;
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.put(queuedItem);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Graceful fallback to memory store
    memoryQueue.set(id, queuedItem);
  }

  return queuedItem;
}

/**
 * Retrieves all currently queued attendance submissions.
 */
export async function getQueuedAttendanceSubmissions(): Promise<
  QueuedAttendanceSubmission[]
> {
  if (!isIndexedDBAvailable()) {
    return Array.from(memoryQueue.values());
  }

  try {
    const db = await openDatabase();
    return await new Promise<QueuedAttendanceSubmission[]>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readonly");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return Array.from(memoryQueue.values());
  }
}

/**
 * Gets count of items in the offline attendance queue.
 */
export async function getQueuedAttendanceCount(): Promise<number> {
  const items = await getQueuedAttendanceSubmissions();
  return items.length;
}

/**
 * Removes a successfully synced attendance submission from the offline queue.
 */
export async function removeQueuedAttendance(id: string): Promise<void> {
  memoryQueue.delete(id);

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Ignore error
  }
}

/**
 * Clears all queued attendance submissions (e.g. for testing or full reset).
 */
export async function clearQueuedAttendance(): Promise<void> {
  memoryQueue.clear();

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Ignore error
  }
}

/**
 * Caches roster data for today's section locally in IndexedDB / Memory.
 */
export async function cacheRoster(
  sectionId: string,
  dateStr: string,
  roster: WorkbenchRosterData
): Promise<void> {
  const cacheKey = getRosterCacheKey(sectionId, dateStr);
  const cacheEntry: CachedRoster = {
    cacheKey,
    sectionId,
    dateStr,
    cachedAt: new Date().toISOString(),
    roster,
  };

  memoryCache.set(cacheKey, cacheEntry);

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      const store = tx.objectStore(CACHE_STORE);
      const req = store.put(cacheEntry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Memory cache already set
  }
}

/**
 * Retrieves cached roster data when offline.
 */
export async function getCachedRoster(
  sectionId: string,
  dateStr: string
): Promise<WorkbenchRosterData | null> {
  const cacheKey = getRosterCacheKey(sectionId, dateStr);

  if (!isIndexedDBAvailable()) {
    const cached = memoryCache.get(cacheKey);
    return cached ? cached.roster : null;
  }

  try {
    const db = await openDatabase();
    const entry = await new Promise<CachedRoster | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, "readonly");
        const store = tx.objectStore(CACHE_STORE);
        const req = store.get(cacheKey);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }
    );

    if (entry?.roster) {
      return entry.roster;
    }
  } catch (err) {
    // Fall back to memory cache
  }

  const memoryEntry = memoryCache.get(cacheKey);
  return memoryEntry ? memoryEntry.roster : null;
}

/**
 * Synchronizes all queued attendance submissions to the server.
 * Replays submissions sequentially.
 * On success, removes item from queue.
 * On error, updates retryCount and lastError.
 */
export async function syncQueuedAttendance(
  syncExecutor?: (input: SaveAttendanceInput) => Promise<SaveAttendanceResult>
): Promise<{
  success: boolean;
  syncedCount: number;
  failedCount: number;
  results: Array<{ id: string; success: boolean; error?: string }>;
}> {
  const queue = await getQueuedAttendanceSubmissions();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0, failedCount: 0, results: [] };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const item of queue) {
    try {
      if (syncExecutor) {
        await syncExecutor({
          sectionId: item.sectionId,
          dateStr: item.dateStr,
          periodId: item.periodId,
          records: item.records,
        });
      } else {
        // Dynamic import to avoid circular dependencies in client-only modules
        const { saveTeacherAttendanceRoster } = await import(
          "@/app/(teacher)/teacher/attendance/attendanceActions"
        );
        await saveTeacherAttendanceRoster({
          sectionId: item.sectionId,
          dateStr: item.dateStr,
          periodId: item.periodId,
          records: item.records,
        });
      }

      await removeQueuedAttendance(item.id);
      syncedCount++;
      results.push({ id: item.id, success: true });
    } catch (err: any) {
      failedCount++;
      const errorMessage = err?.message || "Sync failed";
      item.retryCount = (item.retryCount || 0) + 1;
      item.lastError = errorMessage;

      // Update in store
      if (isIndexedDBAvailable()) {
        try {
          const db = await openDatabase();
          const tx = db.transaction(QUEUE_STORE, "readwrite");
          tx.objectStore(QUEUE_STORE).put(item);
        } catch (_) {}
      } else {
        memoryQueue.set(item.id, item);
      }

      results.push({ id: item.id, success: false, error: errorMessage });
    }
  }

  return {
    success: failedCount === 0,
    syncedCount,
    failedCount,
    results,
  };
}

/**
 * Initializes a window "online" listener that triggers background sync
 * whenever internet connectivity is restored.
 */
export function registerOnlineSyncListener(
  onSyncResult?: (result: {
    syncedCount: number;
    failedCount: number;
  }) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let isSyncing = false;

  const handleOnline = async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const result = await syncQueuedAttendance();
      if (onSyncResult && (result.syncedCount > 0 || result.failedCount > 0)) {
        onSyncResult({
          syncedCount: result.syncedCount,
          failedCount: result.failedCount,
        });
      }
    } finally {
      isSyncing = false;
    }
  };

  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}
