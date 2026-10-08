import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

vi.mock("@/workers/financeAutomation", () => ({
  getWorkerHeartbeatStatus: vi.fn(),
}));

import { getWorkerHeartbeatStatus } from "@/workers/financeAutomation";

describe("AZ-02: Worker Heartbeat Health Endpoint (/api/health/worker)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns HTTP 200 with status 'ok' when worker heartbeat is alive", async () => {
    vi.mocked(getWorkerHeartbeatStatus).mockResolvedValueOnce({
      status: "alive",
      isAlive: true,
      lastSeenAt: new Date(),
      ageSeconds: 5,
      workerName: "educore-finance-worker",
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.worker).toBe("educore-finance-worker");
    expect(body.heartbeatStatus).toBe("alive");
  });

  it("returns HTTP 503 with status 'degraded' when worker heartbeat is stale", async () => {
    vi.mocked(getWorkerHeartbeatStatus).mockResolvedValueOnce({
      status: "stale",
      isAlive: false,
      lastSeenAt: new Date(Date.now() - 300_000),
      ageSeconds: 300,
      workerName: "educore-finance-worker",
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.heartbeatStatus).toBe("stale");
  });

  it("returns HTTP 200 with status 'waiting' when worker has not started yet", async () => {
    vi.mocked(getWorkerHeartbeatStatus).mockResolvedValueOnce({
      status: "not_started",
      isAlive: false,
      workerName: "educore-finance-worker",
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("waiting");
    expect(body.heartbeatStatus).toBe("not_started");
  });
});
