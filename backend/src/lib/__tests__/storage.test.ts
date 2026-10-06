import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateSchoolScopedKey, getPresignedUploadUrl } from "../storage";

describe("GAP-006: S3 Tenant Isolation & Path Traversal Guards", () => {
  const schoolId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const otherSchoolId = "b9c8d7e6-f5a4-3210-fedc-ba0987654321";

  describe("validateSchoolScopedKey", () => {
    it("accepts valid keys prefixed with the school ID", () => {
      const key = `${schoolId}/documents/file.pdf`;
      expect(validateSchoolScopedKey(key, schoolId)).toBe(true);
    });

    it("rejects keys belonging to another school", () => {
      const key = `${otherSchoolId}/documents/file.pdf`;
      expect(validateSchoolScopedKey(key, schoolId)).toBe(false);
    });

    it("rejects keys missing prefix or root keys", () => {
      expect(validateSchoolScopedKey("uploads/file.pdf", schoolId)).toBe(false);
      expect(validateSchoolScopedKey("file.pdf", schoolId)).toBe(false);
    });

    it("rejects path traversal attempts with .. or backslashes", () => {
      expect(validateSchoolScopedKey(`${schoolId}/../secret.env`, schoolId)).toBe(false);
      expect(validateSchoolScopedKey(`${schoolId}/..\\windows.sys`, schoolId)).toBe(false);
      expect(validateSchoolScopedKey(`/${schoolId}/documents/file.pdf`, schoolId)).toBe(false);
    });

    it("handles empty key or empty schoolId safely", () => {
      expect(validateSchoolScopedKey("", schoolId)).toBe(false);
      expect(validateSchoolScopedKey(`${schoolId}/test.pdf`, "")).toBe(false);
    });
  });

  describe("getPresignedUploadUrl traversal guard", () => {
    it("throws an error when key contains path traversal characters", async () => {
      await expect(
        getPresignedUploadUrl("../etc/passwd", "application/octet-stream")
      ).rejects.toThrow(/path traversal/);

      await expect(
        getPresignedUploadUrl("sub\\folder\\file.txt", "text/plain")
      ).rejects.toThrow(/path traversal/);

      await expect(
        getPresignedUploadUrl("/leading/slash/file.png", "image/png")
      ).rejects.toThrow(/path traversal/);
    });

    it("returns local fallback URL when AWS credentials are unset", async () => {
      const originalKeyId = process.env.AWS_ACCESS_KEY_ID;
      try {
        delete process.env.AWS_ACCESS_KEY_ID;
        const validKey = `${schoolId}/uploads/file.png`;
        const url = await getPresignedUploadUrl(validKey, "image/png");
        expect(url).toContain("/api/upload?key=");
        expect(url).toContain(encodeURIComponent(validKey));
      } finally {
        if (originalKeyId) process.env.AWS_ACCESS_KEY_ID = originalKeyId;
      }
    });
  });
});
