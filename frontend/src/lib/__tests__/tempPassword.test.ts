import { describe, it, expect } from "vitest";
import {
  formatRolePrefix,
  generateRoleTempPassword,
  generateRandomTempPassword,
} from "../tempPassword";

describe("Dynamic Role-Based Initial Passwords (Role@<last4mobile>)", () => {
  describe("formatRolePrefix", () => {
    it("formats known system roles to expected PascalCase prefixes", () => {
      expect(formatRolePrefix("PARENT")).toBe("Parent");
      expect(formatRolePrefix("TEACHER")).toBe("Teacher");
      expect(formatRolePrefix("DRIVER")).toBe("Driver");
      expect(formatRolePrefix("ACCOUNTANT")).toBe("Accountant");
      expect(formatRolePrefix("SCHOOL_ADMIN")).toBe("Admin");
      expect(formatRolePrefix("SUPER_ADMIN")).toBe("Admin");
      expect(formatRolePrefix("PRINCIPAL")).toBe("Principal");
      expect(formatRolePrefix("LIBRARIAN")).toBe("Librarian");
      expect(formatRolePrefix("TRANSPORT_MANAGER")).toBe("Transport");
      expect(formatRolePrefix("STUDENT")).toBe("Student");
      expect(formatRolePrefix("STAFF")).toBe("Staff");
    });

    it("falls back to 'Staff' for empty or falsy inputs", () => {
      expect(formatRolePrefix("")).toBe("Staff");
      expect(formatRolePrefix(undefined as any)).toBe("Staff");
      expect(formatRolePrefix(null as any)).toBe("Staff");
    });

    it("converts unknown multi-word roles into TitleCase prefix", () => {
      expect(formatRolePrefix("HR_EXECUTIVE")).toBe("HrExecutive");
      expect(formatRolePrefix("lab assistant")).toBe("LabAssistant");
    });
  });

  describe("generateRoleTempPassword", () => {
    it("generates Parent@<last4> for parent mobile", () => {
      expect(generateRoleTempPassword("PARENT", "9876543210")).toBe("Parent@3210");
      expect(generateRoleTempPassword("PARENT", "+91-98765-43210")).toBe("Parent@3210");
    });

    it("generates Teacher@<last4> for teacher mobile", () => {
      expect(generateRoleTempPassword("TEACHER", "9988776655")).toBe("Teacher@6655");
    });

    it("generates Driver@<last4> for driver mobile", () => {
      expect(generateRoleTempPassword("DRIVER", "9123456789")).toBe("Driver@6789");
    });

    it("generates Accountant@<last4> for accountant mobile", () => {
      expect(generateRoleTempPassword("ACCOUNTANT", "9000001122")).toBe("Accountant@1122");
    });

    it("safely falls back to 1234 when mobile is missing or has fewer than 4 digits", () => {
      expect(generateRoleTempPassword("PARENT", null)).toBe("Parent@1234");
      expect(generateRoleTempPassword("TEACHER", "")).toBe("Teacher@1234");
      expect(generateRoleTempPassword("DRIVER", "12")).toBe("Driver@1234");
      expect(generateRoleTempPassword("ACCOUNTANT", undefined)).toBe("Accountant@1234");
    });
  });

  describe("generateRandomTempPassword (compatibility)", () => {
    it("generates an 8-character string with required character classes", () => {
      const pwd = generateRandomTempPassword();
      expect(pwd).toHaveLength(8);
      expect(/[A-Z]/.test(pwd)).toBe(true);
      expect(/[a-z]/.test(pwd)).toBe(true);
      expect(/[0-9]/.test(pwd)).toBe(true);
      expect(/[!@#$%]/.test(pwd)).toBe(true);
    });
  });
});
