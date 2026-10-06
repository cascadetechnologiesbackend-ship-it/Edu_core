import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signImpersonationToken, verifyImpersonationToken, type ImpersonationPayload } from "../impersonation";

describe("Impersonation Cryptographic Tokens", () => {
  const originalEnv = { ...process.env };
  const mockPayload: Omit<ImpersonationPayload, "exp"> = {
    superAdminId: "admin-uuid-1234",
    superAdminEmail: "superadmin@schoolmitra.com",
    schoolId: "school-uuid-5678",
    schoolName: "Delhi Public School",
    role: "SCHOOL_ADMIN",
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.IMPERSONATION_SECRET = "test-impersonation-signing-secret-32-chars-minimum";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("successfully signs and verifies a valid token", () => {
    const token = signImpersonationToken(mockPayload, 30);
    expect(typeof token).toBe("string");
    expect(token.includes(".")).toBe(true);

    const verified = verifyImpersonationToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.superAdminId).toBe(mockPayload.superAdminId);
    expect(verified?.schoolId).toBe(mockPayload.schoolId);
    expect(verified?.role).toBe("SCHOOL_ADMIN");
    expect(verified?.exp).toBeGreaterThan(Date.now());
  });

  it("rejects token with tampered signature", () => {
    const token = signImpersonationToken(mockPayload, 30);
    const [payloadStr] = token.split(".");
    const tamperedToken = `${payloadStr}.invalid-tampered-signature`;

    const verified = verifyImpersonationToken(tamperedToken);
    expect(verified).toBeNull();
  });

  it("rejects expired token", () => {
    // TTL of negative 5 minutes -> already expired
    const expiredToken = signImpersonationToken(mockPayload, -5);
    const verified = verifyImpersonationToken(expiredToken);
    expect(verified).toBeNull();
  });

  it("safely handles null, undefined, or empty token strings", () => {
    expect(verifyImpersonationToken(null)).toBeNull();
    expect(verifyImpersonationToken(undefined)).toBeNull();
    expect(verifyImpersonationToken("")).toBeNull();
    expect(verifyImpersonationToken("bad-format-without-period")).toBeNull();
  });
});
