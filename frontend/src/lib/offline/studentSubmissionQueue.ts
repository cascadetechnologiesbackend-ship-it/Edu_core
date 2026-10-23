/**
 * Offline Student Homework Submission Queue
 *
 * Provides client-side resilience for Student PWA homework submissions:
 * 1. When network is down or fetch fails, queues submissions locally in IndexedDB / LocalStorage.
 * 2. Surfaces pending queued submissions in the Homework Center with manual retry and status indicators.
 * 3. Auto-syncs queued items on reconnect listener (window "online" event).
 * 4. Idempotency is mathematically guaranteed by the backend's unique constraint
 *    (assignment_id, student_id) on assignment_submissions via onConflictDoUpdate.
 * 5. Late calculation (isLate) is assigned honestly by the server at receipt time (AC-7, AC-16).
 *
 * Complies with Edu_core PWA Privacy laws: NO authenticated HTML cached; only client-side operational state.
 */

export interface QueuedStudentSubmission {
  id: string; // assignmentId
  assignmentId: string;
  studentId?: string | undefined;
  assignmentTitle: string;
  subjectName: string;
  dueDate: string;
  studentContent: string;
  attachmentS3Key?: string | undefined;
  queuedAt: string;
  status: "pending" | "syncing" | "failed" | "synced";
  retryCount: number;
  lastError?: string | undefined;
}

export interface EnqueueSubmissionInput {
  assignmentId: string;
  assignmentTitle: string;
  subjectName: string;
  dueDate: string;
  studentContent: string;
  attachmentS3Key?: string | undefined;
  studentId?: string | undefined;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  results: Array<{
    id: string;
    success: boolean;
    error?: string | undefined;
    isLate?: boolean | undefined;
  }>;
}

const DB_NAME = "edu_core_offline_db";
const DB_VERSION = 2; // Incremented to register student_submission_queue
const SUBMISSION_QUEUE_STORE = "student_submission_queue";
const LOCAL_STORAGE_KEY = "edu_core_queued_student_submissions";

// In-memory fallback store for SSR or environments without IndexedDB (e.g. unit test runner)
const memorySubmissionQueue = new Map<string, QueuedStudentSubmission>();

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
 * Checks if localStorage is available in the current runtime.
 */
function isLocalStorageAvailable(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined" &&
      window.localStorage !== null
    );
  } catch {
    return false;
  }
}

/**
 * Sync memory queue with localStorage if available.
 */
function persistToLocalStorage(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    const items = Array.from(memorySubmissionQueue.values());
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage write errors (e.g. quota exceeded)
  }
}

/**
 * Restore from localStorage into memory queue if available.
 */
function restoreFromLocalStorage(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const items: QueuedStudentSubmission[] = JSON.parse(raw);
      items.forEach((item) => {
        if (!memorySubmissionQueue.has(item.id)) {
          memorySubmissionQueue.set(item.id, item);
        }
      });
    }
  } catch {
    // Ignore storage read errors
  }
}

// Initial restore on client load
if (typeof window !== "undefined") {
  restoreFromLocalStorage();
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
      if (!db.objectStoreNames.contains(SUBMISSION_QUEUE_STORE)) {
        db.createObjectStore(SUBMISSION_QUEUE_STORE, { keyPath: "id" });
      }
      // Ensure teacher attendance stores also exist if opened first
      if (!db.objectStoreNames.contains("attendance_queue")) {
        db.createObjectStore("attendance_queue", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("roster_cache")) {
        db.createObjectStore("roster_cache", { keyPath: "cacheKey" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Queues a student homework submission locally when offline.
 * Idempotently updates if a submission for the same assignmentId already exists.
 */
export async function enqueueStudentSubmission(
  input: EnqueueSubmissionInput
): Promise<QueuedStudentSubmission> {
  const queuedItem: QueuedStudentSubmission = {
    id: input.assignmentId,
    assignmentId: input.assignmentId,
    studentId: input.studentId,
    assignmentTitle: input.assignmentTitle,
    subjectName: input.subjectName,
    dueDate: input.dueDate,
    studentContent: input.studentContent,
    attachmentS3Key: input.attachmentS3Key,
    queuedAt: new Date().toISOString(),
    status: "pending",
    retryCount: 0,
  };

  memorySubmissionQueue.set(queuedItem.id, queuedItem);
  persistToLocalStorage();

  if (!isIndexedDBAvailable()) {
    return queuedItem;
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SUBMISSION_QUEUE_STORE, "readwrite");
      const store = tx.objectStore(SUBMISSION_QUEUE_STORE);
      const req = store.put(queuedItem);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Graceful fallback to memory and localStorage store
    console.warn("[studentSubmissionQueue] IndexedDB enqueue failed, using fallback:", err);
  }

  return queuedItem;
}

/**
 * Retrieves all currently queued student submissions.
 */
export async function getQueuedStudentSubmissions(): Promise<QueuedStudentSubmission[]> {
  restoreFromLocalStorage();

  if (!isIndexedDBAvailable()) {
    return Array.from(memorySubmissionQueue.values());
  }

  try {
    const db = await openDatabase();
    const items = await new Promise<QueuedStudentSubmission[]>((resolve, reject) => {
      const tx = db.transaction(SUBMISSION_QUEUE_STORE, "readonly");
      const store = tx.objectStore(SUBMISSION_QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // Merge with any in-memory items
    items.forEach((item) => memorySubmissionQueue.set(item.id, item));
    return Array.from(memorySubmissionQueue.values());
  } catch (err) {
    return Array.from(memorySubmissionQueue.values());
  }
}

/**
 * Gets count of items in the offline submission queue.
 */
export async function getQueuedStudentSubmissionCount(): Promise<number> {
  const items = await getQueuedStudentSubmissions();
  return items.length;
}

/**
 * Removes a successfully synced submission from the offline queue.
 */
export async function removeQueuedStudentSubmission(id: string): Promise<void> {
  memorySubmissionQueue.delete(id);
  persistToLocalStorage();

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SUBMISSION_QUEUE_STORE, "readwrite");
      const store = tx.objectStore(SUBMISSION_QUEUE_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore error
  }
}

/**
 * Clears all queued submissions (e.g. for testing or full reset).
 */
export async function clearQueuedStudentSubmissions(): Promise<void> {
  memorySubmissionQueue.clear();
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {}
  }

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SUBMISSION_QUEUE_STORE, "readwrite");
      const store = tx.objectStore(SUBMISSION_QUEUE_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore error
  }
}

/**
 * Synchronizes all queued student submissions to the server.
 * Replays submissions sequentially.
 * On success, removes item from queue.
 * On error, updates retryCount and lastError.
 */
export async function syncQueuedStudentSubmissions(
  syncExecutor?: (input: {
    assignmentId: string;
    studentContent: string;
    attachmentS3Key?: string | undefined;
  }) => Promise<{ success: boolean; error?: string | undefined; isLate?: boolean | undefined }>
): Promise<SyncResult> {
  const queue = await getQueuedStudentSubmissions();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0, failedCount: 0, results: [] };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const results: SyncResult["results"] = [];

  for (const item of queue) {
    item.status = "syncing";
    try {
      let response: { success: boolean; error?: string | undefined; isLate?: boolean | undefined };

      if (syncExecutor) {
        response = await syncExecutor({
          assignmentId: item.assignmentId,
          studentContent: item.studentContent,
          attachmentS3Key: item.attachmentS3Key,
        });
      } else {
        // Dynamic import using relative path to ensure Vite and App Router compatibility
        const { submitHomeworkAction } = await import(
          "../../app/(student)/student/homework/homeworkActions"
        );
        response = await submitHomeworkAction({
          assignmentId: item.assignmentId,
          studentContent: item.studentContent,
          attachmentS3Key: item.attachmentS3Key,
        });
      }

      if (!response.success) {
        throw new Error(response.error || "Submission rejected by server");
      }

      await removeQueuedStudentSubmission(item.id);
      syncedCount++;
      results.push({
        id: item.id,
        success: true,
        isLate: response.isLate,
      });
    } catch (err: any) {
      failedCount++;
      const errorMessage = err?.message || "Sync failed";
      item.status = "failed";
      item.retryCount = (item.retryCount || 0) + 1;
      item.lastError = errorMessage;

      // Update in memory and storage
      memorySubmissionQueue.set(item.id, item);
      persistToLocalStorage();

      if (isIndexedDBAvailable()) {
        try {
          const db = await openDatabase();
          const tx = db.transaction(SUBMISSION_QUEUE_STORE, "readwrite");
          tx.objectStore(SUBMISSION_QUEUE_STORE).put(item);
        } catch (_) {}
      }

      results.push({
        id: item.id,
        success: false,
        error: errorMessage,
      });
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
export function registerStudentOnlineSyncListener(
  onSyncResult?: (result: { syncedCount: number; failedCount: number }) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  let isSyncing = false;

  const handleOnline = async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const result = await syncQueuedStudentSubmissions();
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
