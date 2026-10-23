// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueueStudentSubmission,
  getQueuedStudentSubmissions,
  getQueuedStudentSubmissionCount,
  removeQueuedStudentSubmission,
  clearQueuedStudentSubmissions,
  syncQueuedStudentSubmissions,
  registerStudentOnlineSyncListener,
} from "../studentSubmissionQueue";

describe("Phase S7: Student Offline Submission Queue", () => {
  beforeEach(async () => {
    await clearQueuedStudentSubmissions();
  });

  it("enqueues a submission locally when offline with pending status", async () => {
    const item = await enqueueStudentSubmission({
      assignmentId: "asg-001",
      assignmentTitle: "Algebra Polynomials Exercise 4.2",
      subjectName: "Mathematics",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      studentContent: "Solutions to Q1-Q10 written down.",
      attachmentS3Key: "homework/asg-001/doc.pdf",
    });

    expect(item.id).toBe("asg-001");
    expect(item.status).toBe("pending");
    expect(item.retryCount).toBe(0);

    const queued = await getQueuedStudentSubmissions();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.assignmentTitle).toBe("Algebra Polynomials Exercise 4.2");
  });

  it("idempotently updates the same assignmentId if submitted again before sync", async () => {
    await enqueueStudentSubmission({
      assignmentId: "asg-002",
      assignmentTitle: "Physics Motion Lab",
      subjectName: "Physics",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      studentContent: "Draft 1 notes",
    });

    // Student updates text before going online
    await enqueueStudentSubmission({
      assignmentId: "asg-002",
      assignmentTitle: "Physics Motion Lab",
      subjectName: "Physics",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      studentContent: "Draft 2 finalized answer",
    });

    const count = await getQueuedStudentSubmissionCount();
    expect(count).toBe(1);

    const queued = await getQueuedStudentSubmissions();
    expect(queued[0]?.studentContent).toBe("Draft 2 finalized answer");
  });

  it("successfully replays queued submissions via syncQueuedStudentSubmissions", async () => {
    await enqueueStudentSubmission({
      assignmentId: "asg-sync-1",
      assignmentTitle: "Chemistry Ionic Bonding",
      subjectName: "Chemistry",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      studentContent: "Bonding answers",
    });

    const mockExecutor = vi.fn().mockResolvedValue({
      success: true,
      isLate: false,
    });

    const result = await syncQueuedStudentSubmissions(mockExecutor);

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(mockExecutor).toHaveBeenCalledTimes(1);
    expect(mockExecutor).toHaveBeenCalledWith({
      assignmentId: "asg-sync-1",
      studentContent: "Bonding answers",
      attachmentS3Key: undefined,
    });

    // Queue should now be empty
    const remaining = await getQueuedStudentSubmissions();
    expect(remaining).toHaveLength(0);
  });

  it("retains failed items in queue with incremented retryCount and lastError", async () => {
    await enqueueStudentSubmission({
      assignmentId: "asg-fail-1",
      assignmentTitle: "English Essay",
      subjectName: "English",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      studentContent: "Essay draft",
    });

    const mockFailingExecutor = vi.fn().mockResolvedValue({
      success: false,
      error: "Content contains flagged profanity",
    });

    const result = await syncQueuedStudentSubmissions(mockFailingExecutor);

    expect(result.success).toBe(false);
    expect(result.syncedCount).toBe(0);
    expect(result.failedCount).toBe(1);

    const queued = await getQueuedStudentSubmissions();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.retryCount).toBe(1);
    expect(queued[0]?.status).toBe("failed");
    expect(queued[0]?.lastError).toBe("Content contains flagged profanity");
  });

  it("allows manual removal of queued submissions", async () => {
    await enqueueStudentSubmission({
      assignmentId: "asg-remove",
      assignmentTitle: "History Chapter 3",
      subjectName: "History",
      dueDate: new Date().toISOString(),
      studentContent: "Notes",
    });

    expect(await getQueuedStudentSubmissionCount()).toBe(1);

    await removeQueuedStudentSubmission("asg-remove");
    expect(await getQueuedStudentSubmissionCount()).toBe(0);
  });

  it("registers window online event listener and returns cleanup function", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const cleanup = registerStudentOnlineSyncListener();
    expect(addEventListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));

    cleanup();
    expect(removeEventListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));
  });
});
