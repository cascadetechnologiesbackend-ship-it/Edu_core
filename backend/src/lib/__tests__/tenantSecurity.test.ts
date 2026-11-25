import { describe, it, expect } from "vitest";
import { TenantSecurityService } from "../tenant";
import crypto from "node:crypto";

describe("TenantSecurityService — Cryptographic HMAC Tenant Context", () => {
  const testSecret = "super-secret-test-key-with-sufficient-entropy-32-chars";
  const schoolId = "11111111-1111-1111-1111-111111111111";
  const actorId = "actor-user-99";
  const sessionId = "session-xyz-123";

  it("generates capability with exact canonical format school_id:actor_id:session_id:expires_at", () => {
    process.env.DATABASE_TENANT_HMAC_KEY = testSecret;

    const cap = TenantSecurityService.generateTenantCapability(schoolId, actorId, sessionId, 300);
    expect(cap.schoolId).toBe(schoolId);
    expect(cap.actorId).toBe(actorId);
    expect(cap.sessionId).toBe(sessionId);
    expect(cap.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(cap.token).toBeDefined();
    expect(cap.token.length).toBe(64); // SHA-256 hex is 64 characters

    // Verify canonical serialization manually
    const expectedMessage = `${schoolId}:${actorId}:${sessionId}:${cap.expiresAt}`;
    const expectedHmac = crypto
      .createHmac("sha256", Buffer.from(testSecret, "utf8"))
      .update(Buffer.from(expectedMessage, "utf8"))
      .digest("hex");

    expect(cap.token).toBe(expectedHmac);
  });

  it("verifies a valid capability token using timing-safe comparison", () => {
    process.env.DATABASE_TENANT_HMAC_KEY = testSecret;

    const cap = TenantSecurityService.generateTenantCapability(schoolId, actorId, sessionId, 600);
    const isValid = TenantSecurityService.verifyCapability(
      cap.schoolId,
      cap.actorId,
      cap.sessionId,
      cap.expiresAt,
      cap.token
    );
    expect(isValid).toBe(true);
  });

  it("rejects token when school_id is tampered", () => {
    process.env.DATABASE_TENANT_HMAC_KEY = testSecret;

    const cap = TenantSecurityService.generateTenantCapability(schoolId, actorId, sessionId, 300);
    const tamperedSchoolId = "22222222-2222-2222-2222-222222222222";

    const isValid = TenantSecurityService.verifyCapability(
      tamperedSchoolId,
      cap.actorId,
      cap.sessionId,
      cap.expiresAt,
      cap.token
    );
    expect(isValid).toBe(false);
  });

  it("rejects token when actor_id is tampered", () => {
    process.env.DATABASE_TENANT_HMAC_KEY = testSecret;

    const cap = TenantSecurityService.generateTenantCapability(schoolId, actorId, sessionId, 300);
    const isValid = TenantSecurityService.verifyCapability(
      cap.schoolId,
      "forged-attacker-actor",
      cap.sessionId,
      cap.expiresAt,
      cap.token
    );
    expect(isValid).toBe(false);
  });

  it("rejects token when session_id is tampered", () => {
    process.env.DATABASE_TENANT_HMAC_KEY = testSecret;

    const cap = TenantSecurityService.generateTenantCapability(schoolId, actorId, sessionId, 300);
    const isValid = TenantSecurityService.verifyCapability(
      cap.schoolId,
      cap.actorId,
      "tampered-session-id",
      cap.expiresAt,
      cap.token
    );
    expect(isValid).toBe(false);
  });

  it("rejects token when expired", () => {
    process.env.DATABASE_TENANT_HMAC_KEY = testSecret;

    const pastExpiresAt = Math.floor(Date.now() / 1000) - 10;
    const message = `${schoolId}:${actorId}:${sessionId}:${pastExpiresAt}`;
    const token = crypto
      .createHmac("sha256", Buffer.from(testSecret, "utf8"))
      .update(Buffer.from(message, "utf8"))
      .digest("hex");

    const isValid = TenantSecurityService.verifyCapability(
      schoolId,
      actorId,
      sessionId,
      pastExpiresAt,
      token
    );
    expect(isValid).toBe(false);
  });
});
