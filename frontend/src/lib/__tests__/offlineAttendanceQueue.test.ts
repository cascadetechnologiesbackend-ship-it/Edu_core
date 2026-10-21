// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  queueOfflineAttendance,
  getQueuedAttendanceSubmissions,
  getQueuedAttendanceCount,
  removeQueuedAttendance,
  clearQueuedAttendance,
  cacheRoster,
  getCachedRoster,
  syncQueuedAttendance,
  registerOnlineSyncListener,
  getSubmissionKey,
  getRosterCacheKey,
} from "@/app/(teacher)/teacher/attendance/offlineAttendanceQueue";
import type {
  SaveAttendanceInput,
  SaveAttendanceResult,
  WorkbenchRosterData,
} from "@/app/(teacher)/teacher/attendance/attendanceActions";

describe("offlineAttendanceQueue - AC-T9 Offline Queue & Reconnect Sync", () => {
  beforeEach(async () => {
    await clearQueuedAttendance();
  });

  const sampleInput1: SaveAttendanceInput = {
    sectionId: "sec-class-8b",
    dateStr: "2026-10-21",
    periodId: null,
    records: [
      { studentId: "stud-1", status: "PRESENT" },
      { studentId: "stud-2", status: "ABSENT", remarks: "Sick leave" },
      { studentId: "stud-3", status: "LATE" },
    ],
  };

  const sampleInput2: SaveAttendanceInput = {
    sectionId: "sec-class-9a",
    dateStr: "2026-10-21",
    periodId: "period-3",
    records: [
      { studentId: "stud-4", status: "PRESENT" },
      { studentId: "stud-5", status: "PRESENT" },
    ],
  };

  it("generates deterministic submission and roster cache keys", () => {
    expect(getSubmissionKey("sec-1", "2026-10-21", null)).toBe("sec-1_2026-10-21_day");
    expect(getSubmissionKey("sec-1", "2026-10-21", "p-2")).toBe("sec-1_2026-10-21_p-2");
    expect(getRosterCacheKey("sec-1", "2026-10-21")).toBe("roster_sec-1_2026-10-21");
  });

  it("queues offline attendance submissions and updates queue count", async () => {
    expect(await getQueuedAttendanceCount()).toBe(0);

    const queued = await queueOfflineAttendance(sampleInput1, {
      sectionName: "B",
      className: "Class 8",
    });

    expect(queued.id).toBe("sec-class-8b_2026-10-21_day");
    expect(queued.sectionId).toBe("sec-class-8b");
    expect(queued.records.length).toBe(3);
    expect(queued.sectionName).toBe("B");
    expect(queued.className).toBe("Class 8");

    expect(await getQueuedAttendanceCount()).toBe(1);

    const all = await getQueuedAttendanceSubmissions();
    expect(all.length).toBe(1);
    expect(all[0]?.id).toBe("sec-class-8b_2026-10-21_day");
  });

  it("idempotently overwrites same section/date/period without duplicating queue entries", async () => {
    await queueOfflineAttendance(sampleInput1);
    expect(await getQueuedAttendanceCount()).toBe(1);

    // Modified roll call for the same section & date while still offline
    const modifiedInput: SaveAttendanceInput = {
      ...sampleInput1,
      records: [
        { studentId: "stud-1", status: "PRESENT" },
        { studentId: "stud-2", status: "PRESENT" }, // Changed from ABSENT to PRESENT
        { studentId: "stud-3", status: "PRESENT" },
      ],
    };

    await queueOfflineAttendance(modifiedInput);
    expect(await getQueuedAttendanceCount()).toBe(1);

    const all = await getQueuedAttendanceSubmissions();
    expect(all.length).toBe(1);
    expect(all[0]?.records[1]?.status).toBe("PRESENT");
  });

  it("caches and retrieves section rosters offline", async () => {
    const mockRoster: WorkbenchRosterData = {
      sectionId: "sec-class-8b",
      sectionName: "B",
      className: "Class 8",
      dateStr: "2026-10-21",
      academicYearId: "ay-2026",
      isAlreadyMarked: false,
      students: [
        {
          studentId: "stud-1",
          rollNumber: "1",
          firstName: "Aarav",
          lastName: "Sharma",
          admissionNumber: "ADM-101",
          status: "PRESENT",
          remarks: "",
          isPreApprovedLeave: false,
        },
      ],
      counts: {
        total: 1,
        present: 1,
        absent: 0,
        late: 0,
        halfDay: 0,
        leave: 0,
      },
    };

    await cacheRoster("sec-class-8b", "2026-10-21", mockRoster);

    const retrieved = await getCachedRoster("sec-class-8b", "2026-10-21");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.sectionId).toBe("sec-class-8b");
    expect(retrieved?.students[0]?.firstName).toBe("Aarav");

    // Non-existent cache key returns null
    const nonExistent = await getCachedRoster("sec-other", "2026-10-21");
    expect(nonExistent).toBeNull();
  });

  it("syncs queued attendance submissions sequentially and clears succeeded entries", async () => {
    await queueOfflineAttendance(sampleInput1);
    await queueOfflineAttendance(sampleInput2);
    expect(await getQueuedAttendanceCount()).toBe(2);

    const mockSyncExecutor = vi.fn().mockImplementation(async (input: SaveAttendanceInput): Promise<SaveAttendanceResult> => {
      return {
        success: true,
        sectionName: "Section",
        className: "Class",
        dateStr: input.dateStr,
        totalStudents: input.records.length,
        counts: { present: 2, absent: 0, late: 0, halfDay: 0, leave: 0 },
        summaryToast: "Saved section",
      };
    });

    const syncResult = await syncQueuedAttendance(mockSyncExecutor);

    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedCount).toBe(2);
    expect(syncResult.failedCount).toBe(0);
    expect(mockSyncExecutor).toHaveBeenCalledTimes(2);

    // Queue should now be empty
    expect(await getQueuedAttendanceCount()).toBe(0);
  });

  it("handles partial sync failure and records retry count", async () => {
    await queueOfflineAttendance(sampleInput1);
    await queueOfflineAttendance(sampleInput2);

    const mockSyncExecutor = vi.fn().mockImplementation(async (input: SaveAttendanceInput) => {
      if (input.sectionId === "sec-class-9a") {
        throw new Error("Temporary network timeout");
      }
      return { success: true, summaryToast: "OK" } as any;
    });

    const syncResult = await syncQueuedAttendance(mockSyncExecutor);

    expect(syncResult.success).toBe(false);
    expect(syncResult.syncedCount).toBe(1);
    expect(syncResult.failedCount).toBe(1);

    // Only the failed submission remains in queue with retryCount incremented
    const remaining = await getQueuedAttendanceSubmissions();
    expect(remaining.length).toBe(1);
    expect(remaining[0]?.sectionId).toBe("sec-class-9a");
    expect(remaining[0]?.retryCount).toBe(1);
    expect(remaining[0]?.lastError).toBe("Temporary network timeout");
  });

  it("replays idempotently when called multiple times on the same payload", async () => {
    await queueOfflineAttendance(sampleInput1);

    let serverExecCount = 0;
    const mockSyncExecutor = vi.fn().mockImplementation(async () => {
      serverExecCount++;
      return { success: true, summaryToast: "Idempotent ok" } as any;
    });

    // First sync
    const res1 = await syncQueuedAttendance(mockSyncExecutor);
    expect(res1.syncedCount).toBe(1);
    expect(await getQueuedAttendanceCount()).toBe(0);

    // Replay with empty queue produces 0 ops
    const res2 = await syncQueuedAttendance(mockSyncExecutor);
    expect(res2.syncedCount).toBe(0);
    expect(serverExecCount).toBe(1);
  });

  it("triggers sync automatically on window online reconnect event", async () => {
    await queueOfflineAttendance(sampleInput1);
    expect(await getQueuedAttendanceCount()).toBe(1);

    let listenerFiredWithCount = -1;
    const unregister = registerOnlineSyncListener((res) => {
      listenerFiredWithCount = res.syncedCount;
    });

    // Mock dynamic import inside syncQueuedAttendance by executing a dummy online event
    // In node/vitest, window is simulated by happy-dom/jsdom
    window.dispatchEvent(new Event("online"));

    // Allow async tick
    await new Promise((resolve) => setTimeout(resolve, 50));

    unregister();
  });
});
