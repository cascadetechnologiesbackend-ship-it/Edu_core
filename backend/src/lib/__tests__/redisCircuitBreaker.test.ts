import { describe, it, expect, beforeEach, vi } from "vitest";
import { isRedisAvailable, recordRedisFailure, redis, checkRateLimit } from "../rateLimiter";

describe("Redis Circuit Breaker & Timeout Resiliency (Flaw Audit P0 #2)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("identifies ready status as available", () => {
    // If status is ready, returns true
    Object.defineProperty(redis, "status", { value: "ready", configurable: true });
    expect(isRedisAvailable()).toBe(true);
  });

  it("circuit breaks when status is not ready and failure is recorded", () => {
    Object.defineProperty(redis, "status", { value: "close", configurable: true });
    recordRedisFailure(new Error("Connection refused"));

    // Should immediately return false without trying network
    expect(isRedisAvailable()).toBe(false);
  });

  it("falls back to in-memory rate limiting when Redis is unavailable", async () => {
    Object.defineProperty(redis, "status", { value: "close", configurable: true });
    recordRedisFailure(new Error("Connection refused"));

    const key = `test:rl:${Date.now()}`;
    // Max 2 requests allowed in 60s
    const allowed1 = await checkRateLimit(key, 2, 60000);
    const allowed2 = await checkRateLimit(key, 2, 60000);
    const allowed3 = await checkRateLimit(key, 2, 60000);

    expect(allowed1).toBe(true);
    expect(allowed2).toBe(true);
    expect(allowed3).toBe(false); // Rate limit enforced in-memory
  });
});
