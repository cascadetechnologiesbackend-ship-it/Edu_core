import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing scanEnforcement
vi.mock("@/db", () => {
  const insertMock = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "test-audit-uuid-1" }]),
    }),
  });
  return {
    db: {
      insert: insertMock,
    },
  };
});

vi.mock("@/db/schema", () => ({
  piiAuditTrails: { id: "id" },
}));

import {
  scanContentForPII,
  deriveRiskLevel,
} from "../pii/scanEnforcement";
import { generateVerhoeff } from "@schoolmitra/entity-engine/dpdp-ner";

describe("DPDP scanContentForPII enforcement (Phase E2 / BR4, BR5, BR6, BR7)", () => {
  const defaultParams = {
    schoolId: "11111111-1111-1111-1111-111111111111",
    actorUserId: "22222222-2222-2222-2222-222222222222",
    surface: "admin.notice.compose",
    sourceTable: "notices",
  };

  it("passes clean text with zero PII and LOGGED_ONLY", async () => {
    const res = await scanContentForPII({
      ...defaultParams,
      text: "School will remain closed tomorrow for sports day celebration.",
    });

    expect(res.hasPII).toBe(false);
    expect(res.riskLevel).toBe("NONE");
    expect(res.detectedTypes).toEqual([]);
    expect(res.matchCount).toBe(0);
    expect(res.decision).toBe("LOGGED_ONLY");
    expect(res.contentHash).toBeDefined();
  });

  it("detects Verhoeff-valid Aadhaar as CRITICAL and defaults to BLOCKED (AC-E5, BR4)", async () => {
    const valid11 = "23456789012";
    const checksum = generateVerhoeff(valid11);
    const validAadhaar = `${valid11}${checksum}`;

    const res = await scanContentForPII({
      ...defaultParams,
      text: `Please submit copy of Aadhaar ${validAadhaar} to front desk.`,
    });

    expect(res.hasPII).toBe(true);
    expect(res.riskLevel).toBe("CRITICAL");
    expect(res.detectedTypes).toContain("AADHAAR");
    expect(res.decision).toBe("BLOCKED");
    expect(res.auditTrailId).toBe("test-audit-uuid-1");
  });

  it("does NOT flag random 12-digit number with invalid Verhoeff checksum as Aadhaar (AC-E5)", async () => {
    const res = await scanContentForPII({
      ...defaultParams,
      text: "Order invoice number is 123456789012 for the lab equipment.",
    });

    // Unless Luhn valid credit card or valid Aadhaar, standard random number should not be CRITICAL Aadhaar
    const hasAadhaar = res.detectedTypes.includes("AADHAAR");
    expect(hasAadhaar).toBe(false);
  });

  it("detects mobile number as HIGH risk and blocks or masks (BR5, AC-E6)", async () => {
    const res = await scanContentForPII({
      ...defaultParams,
      text: "For queries call the coordinator at 9876543210 immediately.",
    });

    expect(res.hasPII).toBe(true);
    expect(res.riskLevel).toBe("HIGH");
    expect(res.detectedTypes).toContain("INDIAN_PHONE");
    expect(res.decision).toBe("BLOCKED");
  });

  it("supports MASKED decision override and outputs redactedText (BR5, AC-E6)", async () => {
    const res = await scanContentForPII({
      ...defaultParams,
      text: "For queries call 9876543210 immediately.",
      decisionOverride: "MASKED",
      redactionMode: "MASK_PARTIAL",
    });

    expect(res.decision).toBe("MASKED");
    expect(res.redactedText).toBeDefined();
    expect(res.redactedText).toContain("XXXXX");
    expect(res.redactedText).not.toContain("9876543210");
  });

  it("supports relaxed HIGH warn policy for leave reason (AC-E7)", async () => {
    const res = await scanContentForPII({
      ...defaultParams,
      surface: "parent.leave.request",
      sourceTable: "student_leave_requests",
      text: "Student is unwell. Reach parent at 9876543210.",
      isRelaxedHighWarn: true,
    });

    expect(res.hasPII).toBe(true);
    expect(res.riskLevel).toBe("HIGH");
    // Under relaxed policy, HIGH risk degrades to LOGGED_ONLY rather than hard block
    expect(res.decision).toBe("LOGGED_ONLY");
  });

  it("derives correct risk hierarchy: CRITICAL > HIGH > MEDIUM > LOW", () => {
    expect(
      deriveRiskLevel([
        {
          type: "INDIAN_PHONE",
          raw: "9876543210",
          startIndex: 0,
          endIndex: 10,
          riskLevel: "HIGH",
          confidence: 0.9,
          description: "phone",
        },
        {
          type: "AADHAAR",
          raw: "123412341234",
          startIndex: 12,
          endIndex: 24,
          riskLevel: "CRITICAL",
          confidence: 0.95,
          description: "aadhaar",
        },
      ])
    ).toBe("CRITICAL");

    expect(
      deriveRiskLevel([
        {
          type: "INDIAN_PHONE",
          raw: "9876543210",
          startIndex: 0,
          endIndex: 10,
          riskLevel: "HIGH",
          confidence: 0.9,
          description: "phone",
        },
      ])
    ).toBe("HIGH");

    expect(
      deriveRiskLevel([
        {
          type: "SPDI_HEALTH",
          raw: "diabetes",
          startIndex: 0,
          endIndex: 8,
          riskLevel: "MEDIUM",
          confidence: 0.8,
          description: "health",
        },
      ])
    ).toBe("MEDIUM");

    expect(deriveRiskLevel([])).toBe("NONE");
  });
});
