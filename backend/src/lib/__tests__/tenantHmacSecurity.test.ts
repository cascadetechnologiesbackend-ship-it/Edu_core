import { describe, it, expect, afterEach, vi } from "vitest";
import { TenantSecurityService } from "../tenant";

describe("TenantSecurityService HMAC Security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws fatal error in production when DATABASE_TENANT_HMAC_KEY is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_TENANT_HMAC_KEY", "");

    expect(() => TenantSecurityService.getSigningSecret()).toThrow(
      /DATABASE_TENANT_HMAC_KEY/
    );
  });

  it("throws fatal error in production when DATABASE_TENANT_HMAC_KEY is shorter than 32 chars", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_TENANT_HMAC_KEY", "short-key-under-32-chars");

    expect(() => TenantSecurityService.getSigningSecret()).toThrow(
      /DATABASE_TENANT_HMAC_KEY/
    );
  });

  it("returns DATABASE_TENANT_HMAC_KEY in production when >= 32 chars", () => {
    vi.stubEnv("NODE_ENV", "production");
    const strongKey = "a-very-strong-production-hmac-key-32-plus-chars";
    vi.stubEnv("DATABASE_TENANT_HMAC_KEY", strongKey);

    expect(TenantSecurityService.getSigningSecret()).toBe(strongKey);
  });

  it("verifies a valid HMAC capability", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "DATABASE_TENANT_HMAC_KEY",
      "a-very-strong-production-hmac-key-32-plus-chars"
    );

    const cap = TenantSecurityService.generateTenantCapability(
      "00000000-0000-0000-0000-000000000001",
      "actor-1",
      "session-1",
      300
    );

    expect(
      TenantSecurityService.verifyCapability(
        cap.schoolId,
        cap.actorId,
        cap.sessionId,
        cap.expiresAt,
        cap.token
      )
    ).toBe(true);
  });

  it("rejects tampered capability token or mismatched schoolId", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "DATABASE_TENANT_HMAC_KEY",
      "a-very-strong-production-hmac-key-32-plus-chars"
    );

    const cap = TenantSecurityService.generateTenantCapability(
      "00000000-0000-0000-0000-000000000001",
      "actor-1",
      "session-1",
      300
    );

    const tamperedToken =
      cap.token.slice(0, -1) + (cap.token.endsWith("0") ? "1" : "0");

    expect(
      TenantSecurityService.verifyCapability(
        cap.schoolId,
        cap.actorId,
        cap.sessionId,
        cap.expiresAt,
        tamperedToken
      )
    ).toBe(false);

    expect(
      TenantSecurityService.verifyCapability(
        "00000000-0000-0000-0000-000000000002",
        cap.actorId,
        cap.sessionId,
        cap.expiresAt,
        cap.token
      )
    ).toBe(false);
  });

  it("rejects expired capability", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "DATABASE_TENANT_HMAC_KEY",
      "a-very-strong-production-hmac-key-32-plus-chars"
    );

    const cap = TenantSecurityService.generateTenantCapability(
      "00000000-0000-0000-0000-000000000001",
      "actor-1",
      "session-1",
      -10
    );

    expect(
      TenantSecurityService.verifyCapability(
        cap.schoolId,
        cap.actorId,
        cap.sessionId,
        cap.expiresAt,
        cap.token
      )
    ).toBe(false);
  });
});
