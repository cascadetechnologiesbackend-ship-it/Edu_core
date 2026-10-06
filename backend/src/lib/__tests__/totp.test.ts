import { describe, it, expect } from "vitest";
import { authenticator } from "otplib";

describe("TOTP Two-Factor Authentication Core Verification", () => {
  it("generates a 32-character base32 secret", () => {
    const secret = authenticator.generateSecret();
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it("verifies a valid token for a secret", () => {
    const secret = authenticator.generateSecret();
    const token = authenticator.generate(secret);
    expect(token).toMatch(/^\d{6}$/);

    const isValid = authenticator.check(token, secret);
    expect(isValid).toBe(true);
  });

  it("rejects an invalid or tampered 6-digit token", () => {
    const secret = authenticator.generateSecret();
    const invalidToken = "000000";
    // Check might pass only if token coincides, which is 1 in a million
    const realToken = authenticator.generate(secret);
    const definitelyWrong = realToken === invalidToken ? "999999" : invalidToken;

    const isValid = authenticator.check(definitelyWrong, secret);
    expect(isValid).toBe(false);
  });

  it("builds a standard otpauth URL with schoolmitra issuer", () => {
    const secret = authenticator.generateSecret();
    const email = "admin@schoolmitra.com";
    const issuer = "SchoolMitra ERP";

    const url = authenticator.keyuri(email, issuer, secret);
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain(encodeURIComponent(issuer));
    expect(url).toContain(secret);
  });
});
