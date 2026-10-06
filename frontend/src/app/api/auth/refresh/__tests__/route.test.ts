import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getJwtSecret } from "@/lib/auth/jwtSecret";

describe("GAP-001: getJwtSecret fail-fast vs preservation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("Property 1: should throw in production if AUTH_SECRET and NEXTAUTH_SECRET are unset", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.NEXT_PHASE;
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    expect(() => getJwtSecret()).toThrow(/FATAL:/);
  });

  it("Property 2: should encode and return valid secret when AUTH_SECRET is set", () => {
    process.env.AUTH_SECRET = "super-secret-key-at-least-32-chars-long";
    const bytes = getJwtSecret();
    expect(bytes).toBeInstanceOf(Uint8Array);
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toBe("super-secret-key-at-least-32-chars-long");
  });

  it("Property 2: should return dev fallback when NODE_ENV=development and secrets are unset", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    const bytes = getJwtSecret();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });
});
