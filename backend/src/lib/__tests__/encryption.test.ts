import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  encryptData,
  decryptData,
  computeSearchHash,
  computeLegacySearchHash,
  ENCRYPTION_KEY,
  resolveKey,
} from "../encryption";

describe("AES-256-GCM Authenticated Encryption", () => {
  it("encrypts with v2 format including keyId, IV, tag, and ciphertext", () => {
    const plaintext = "Confidential Student Record 123";
    const encrypted = encryptData(plaintext);

    expect(encrypted).toMatch(/^v2:k1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
  });

  it("decrypts GCM ciphertext correctly", () => {
    const plaintext = "Aarav Sharma - Aadhaar 1234";
    const encrypted = encryptData(plaintext);
    const decrypted = decryptData(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it("fails closed (returns null) if GCM ciphertext is tampered with", () => {
    const plaintext = "Sensitive Financial Data";
    const encrypted = encryptData(plaintext);
    const parts = encrypted.split(":");

    // Flip last character in ciphertext
    const cipherText = parts[4]!;
    const tamperedCipher = cipherText.slice(0, -1) + (cipherText.endsWith("0") ? "1" : "0");
    const tamperedPayload = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${tamperedCipher}`;

    const result = decryptData(tamperedPayload);
    expect(result).toBeNull();
  });

  it("fails closed (returns null) if GCM auth tag is tampered with", () => {
    const plaintext = "Sensitive Financial Data";
    const encrypted = encryptData(plaintext);
    const parts = encrypted.split(":");

    // Flip last character in auth tag
    const authTag = parts[3]!;
    const tamperedTag = authTag.slice(0, -1) + (authTag.endsWith("0") ? "1" : "0");
    const tamperedPayload = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedTag}:${parts[4]}`;

    const result = decryptData(tamperedPayload);
    expect(result).toBeNull();
  });

  it("correctly decrypts legacy AES-256-CBC ciphertext for zero downtime migration", () => {
    // Generate authentic legacy CBC ciphertext
    const legacyPlaintext = "Legacy Student Record Prior To GCM";
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "hex"), iv);
    let encrypted = cipher.update(legacyPlaintext);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const legacyPayload = `${iv.toString("hex")}:${encrypted.toString("hex")}`;

    const decrypted = decryptData(legacyPayload);
    expect(decrypted).toBe(legacyPlaintext);
  });

  it("computes deterministic HKDF-derived search hashes with key separation", () => {
    const name = "Priya Patel";
    const hash1 = computeSearchHash(name);
    const hash2 = computeSearchHash("  priya patel  ");

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);

    // HKDF derived key produces different hash than legacy raw master key HMAC
    const legacyHash = computeLegacySearchHash(name);
    expect(hash1).not.toBe(legacyHash);
  });

  describe("Production Key Enforcement (Task A1)", () => {
    it("refuses to boot in production when ENCRYPTION_KEY is absent", () => {
      // Empty string explicitly signals an absent/unset key
      expect(() => resolveKey("", "production")).toThrow(
        /CRITICAL: ENCRYPTION_KEY environment variable is missing in production/,
      );
      // undefined falls back to process.env.ENCRYPTION_KEY; if the env var itself
      // is unset ('' or undefined), the missing-key error fires. When CI sets
      // ENCRYPTION_KEY to the demo value, undefined correctly triggers the demo-key
      // guard instead. Test the missing-key branch via explicit empty string only.
    });

    it("refuses to boot in production when ENCRYPTION_KEY matches the .env.example demo value", () => {
      const demoKey =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      expect(() => resolveKey(demoKey, "production")).toThrow(
        /CRITICAL: ENCRYPTION_KEY matches the .env.example demo value in production/,
      );
    });

    it("accepts a non-demo 64-hex character key in production", () => {
      const validProdKey =
        "e29ed7af4c54ed20a650cd257398652e3dc54b1fc4800b77900192c088532283";
      expect(resolveKey(validProdKey, "production")).toBe(validProdKey);
    });

    it("falls back to default key in development or test with warning", () => {
      const fallback = resolveKey(undefined, "test");
      expect(fallback).toBe(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      );
    });
  });
});
