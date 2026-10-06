import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";
import { db } from "@/db";
import { redis } from "@/lib/rateLimiter";

vi.mock("@/db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

vi.mock("@/lib/rateLimiter", () => ({
  redis: {
    ping: vi.fn(),
  },
}));

describe("Health Check API Route (/api/health)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns HTTP 200 with status 'ok' when both DB and Redis are healthy", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([] as any);
    vi.mocked(redis.ping).mockResolvedValueOnce("PONG" as any);

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.database).toBe("ok");
    expect(data.redis).toBe("ok");
    expect(typeof data.uptime).toBe("number");
    expect(typeof data.durationMs).toBe("number");
  });

  it("returns HTTP 200 with status 'degraded' when Redis is unreachable but DB is healthy", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([] as any);
    vi.mocked(redis.ping).mockRejectedValueOnce(new Error("Connection refused"));

    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("degraded");
    expect(data.database).toBe("ok");
    expect(data.redis).toBe("degraded");
    expect(data.redisNote).toContain("Connection refused");
  });

  it("returns HTTP 503 with status 'error' when Database connection fails", async () => {
    vi.mocked(db.execute).mockRejectedValueOnce(new Error("Postgres connection timeout"));
    vi.mocked(redis.ping).mockResolvedValueOnce("PONG" as any);

    const res = await GET();
    expect(res.status).toBe(503);

    const data = await res.json();
    expect(data.status).toBe("error");
    expect(data.database).toBe("error");
    expect(data.error).toContain("Postgres connection timeout");
  });

  it("returns response in less than 500ms", async () => {
    vi.mocked(db.execute).mockResolvedValueOnce([] as any);
    vi.mocked(redis.ping).mockResolvedValueOnce("PONG" as any);

    const start = Date.now();
    await GET();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500);
  });
});
