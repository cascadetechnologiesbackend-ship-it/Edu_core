import { describe, it, expect, vi } from "vitest";
import { generateVerhoeff } from "@schoolmitra/entity-engine/dpdp-ner";
import { scanContentForPII } from "../pii/scanEnforcement";

// Mock DB insert
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "mock-audit-id" }]),
      }),
    }),
  },
  withTenant: vi.fn((tenantId, cb) => cb({ insert: vi.fn(), update: vi.fn() })),
}));

vi.mock("@/db/schema", () => ({
  piiAuditTrails: { id: "id" },
  notices: { id: "id" },
  parentTeacherMessages: { id: "id" },
  studentLeaveRequests: { id: "id" },
  assignments: { id: "id" },
  markEntries: { id: "id" },
}));

describe("Content Write-Points DPDP PII Enforcement (Phase E3, AC-E5, AC-E6, AC-E7)", () => {
  const schoolId = "00000000-0000-0000-0000-000000000001";
  const actorUserId = "00000000-0000-0000-0000-000000000002";

  // Helper to generate a checksum-valid Aadhaar
  function getValidAadhaar() {
    const raw11 = "45678901234";
    const chk = generateVerhoeff(raw11);
    return `${raw11}${chk}`;
  }

  // ─── Write-Point 1: Notice compose / update ─────────────────────────────
  describe("Write-Point 1: Notice compose (admin communication)", () => {
    it("BLOCKS notice creation when valid Aadhaar is in content (AC-E5)", async () => {
      const validAadhaar = getValidAadhaar();
      const res = await scanContentForPII({
        schoolId,
        actorUserId,
        surface: "admin.notice.compose",
        sourceTable: "notices",
        text: `Urgent notice: student Aadhaar ${validAadhaar} needs verification.`,
      });

      expect(res.decision).toBe("BLOCKED");
      expect(res.riskLevel).toBe("CRITICAL");
      expect(res.detectedTypes).toContain("AADHAAR");
    });

    it("does NOT block notice creation for random 12-digit number (AC-E5)", async () => {
      const res = await scanContentForPII({
        schoolId,
        actorUserId,
        surface: "admin.notice.compose",
        sourceTable: "notices",
        text: "Reference book ISBN 123456789012 arrived in library.",
      });

      expect(res.decision).not.toBe("BLOCKED");
      expect(res.detectedTypes).not.toContain("AADHAAR");
    });

    it("triggers HIGH risk for mobile and supports MASKED mode (AC-E6)", async () => {
      const res = await scanContentForPII({
        schoolId,
        actorUserId,
        surface: "admin.notice.compose",
        sourceTable: "notices",
        text: "Contact coordinator at 9876543210 for picnic registration.",
        decisionOverride: "MASKED",
        redactionMode: "MASK_PARTIAL",
      });

      expect(res.decision).toBe("MASKED");
      expect(res.redactedText).toBeDefined();
      expect(res.redactedText).toContain("XXXXX");
      expect(res.redactedText).not.toContain("9876543210");
    });
  });

  // ─── Write-Point 2: Parent-Teacher Message ──────────────────────────────
  describe("Write-Point 2: Parent-teacher message send", () => {
    it("BLOCKS message send when bank account or PAN is detected (HIGH)", async () => {
      const res = await scanContentForPII({
        schoolId,
        actorUserId,
        surface: "parent.message.send",
        sourceTable: "parent_teacher_messages",
        text: "Please refund fees to PAN ABCDE1234F.",
      });

      expect(res.decision).toBe("BLOCKED");
      expect(res.riskLevel).toBe("HIGH");
      expect(res.detectedTypes).toContain("PAN");
    });

    it("supports CONFIRMED_SEND override for contact number (AC-E6)", async () => {
      const res = await scanContentForPII({
        schoolId,
        actorUserId,
        surface: "teacher.message.send",
        sourceTable: "parent_teacher_messages",
        text: "Please call me at 9123456789 during office hours.",
        decisionOverride: "CONFIRMED_SEND",
      });

      expect(res.decision).toBe("CONFIRMED_SEND");
      expect(res.hasPII).toBe(true);
      expect(res.riskLevel).toBe("HIGH");
    });
  });

  // ─── Write-Point 3: Exam Remarks ────────────────────────────────────────
  describe("Write-Point 3: Exam and cocurricular remarks", () => {
    it("BLOCKS exam remarks with CRITICAL PII (Aadhaar / card)", async () => {
      const validAadhaar = getValidAadhaar();
      const res = await scanContentForPII({
        schoolId,
        actorUserId,
        surface: "teacher.exam.remark",
        sourceTable: "mark_entries",
        text: `Student verified with Aadhaar ${validAadhaar}.`,
      });

      expect(res.decision).toBe("BLOCKED");
      expect(res.riskLevel).toBe("CRITICAL");
    });

    it("allows standard pedagogical feedback remarks without blocking", async () => {
      const res = await scanContentForPII({
        schoolId,
        actorUserId,
        surface: "teacher.exam.remark",
        sourceTable: "mark_entries",
        text: "Excellent grasp of geometric concepts. Participates actively.",
      });

      expect(res.decision).toBe("LOGGED_ONLY");
      expect(res.hasPII).toBe(false);
    });
  });

  // ─── Write-Point 4: Assignment Description ──────────────────────────────
  describe("Write-Point 4: Assignment description (academics)", () => {
    it("BLOCKS assignment description with critical personal data", async () => {
      const validAadhaar = getValidAadhaar();
      const res = await scanContentForPII({
        schoolId,
        actorUserId,
        surface: "teacher.assignment.compose",
        sourceTable: "assignments",
        text: `Upload document matching Aadhaar ${validAadhaar}.`,
      });

      expect(res.decision).toBe("BLOCKED");
      expect(res.riskLevel).toBe("CRITICAL");
    });

    it("passes academic assignments with normal curriculum text", async () => {
      const res = await scanContentForPII({
        schoolId,
        actorUserId,
        surface: "teacher.assignment.compose",
        sourceTable: "assignments",
        text: "Complete exercise 4.2 questions 1 to 5 from chapter Rational Numbers.",
      });

      expect(res.decision).toBe("LOGGED_ONLY");
      expect(res.hasPII).toBe(false);
    });
  });

  // ─── Write-Point 5: Leave Request Reason (Relaxed Policy) ───────────────
  describe("Write-Point 5: Leave request reason (relaxed policy, AC-E7)", () => {
    it("BLOCKS leave request with CRITICAL PII (e.g. valid Aadhaar or card)", async () => {
      const validAadhaar = getValidAadhaar();
      const res = await scanContentForPII({
        schoolId,
        actorUserId,
        surface: "parent.leave.request",
        sourceTable: "student_leave_requests",
        text: `Medical leave, Aadhaar card ${validAadhaar} attached.`,
        isRelaxedHighWarn: true,
      });

      // CRITICAL is NEVER relaxed — it must always BLOCK (BR4)
      expect(res.decision).toBe("BLOCKED");
      expect(res.riskLevel).toBe("CRITICAL");
    });

    it("RELIEVES mobile number to LOGGED_ONLY under relaxed policy (AC-E7)", async () => {
      const res = await scanContentForPII({
        schoolId,
        actorUserId,
        surface: "parent.leave.request",
        sourceTable: "student_leave_requests",
        text: "Child has fever. In case of emergency contact mother at 9876543210.",
        isRelaxedHighWarn: true,
      });

      // Under relaxed policy, parents legitimately provide contact numbers: not blocked
      expect(res.decision).toBe("LOGGED_ONLY");
      expect(res.riskLevel).toBe("HIGH");
      expect(res.detectedTypes).toContain("INDIAN_PHONE");
    });
  });
});
