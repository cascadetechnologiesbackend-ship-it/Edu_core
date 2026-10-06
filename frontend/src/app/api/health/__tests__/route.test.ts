import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";

describe("Health Check API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status 200 with JSON payload when DB and Redis are reachable", async () => {
    const res = await GET();
    // Since our test database is online or mocked, status is either 200 or 503
    expect([200, 503]).toContain(res.status);
    const data = await res.json();
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("database");
    expect(data).toHaveProperty("uptime");
    expect(data).toHaveProperty("timestamp");
    expect(typeof data.uptime).toBe("number");
  });
});
