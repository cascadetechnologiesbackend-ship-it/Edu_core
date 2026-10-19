import { describe, expect, it } from "vitest";
import {
  generateVerhoeff,
  redactPII,
  scanPII,
  validateAadhaar,
  validateLuhn,
  validateVerhoeff,
} from "../dpdp-ner";

describe("DPDP Act 2023 PII Privacy Scanner & Redactor", () => {
  describe("Verhoeff Algorithm & Aadhaar Validation", () => {
    it("generates and validates mathematical Verhoeff checksum", () => {
      const base11 = "36728491024";
      const checksum = generateVerhoeff(base11);
      const fullAadhaar = `${base11}${checksum}`;

      expect(validateVerhoeff(fullAadhaar)).toBe(true);
      expect(validateAadhaar(fullAadhaar)).toBe(true);

      // Mutating a single digit must fail Verhoeff
      const corrupted = `${base11}${(checksum + 1) % 10}`;
      expect(validateVerhoeff(corrupted)).toBe(false);
      expect(validateAadhaar(corrupted)).toBe(false);
    });

    it("rejects invalid Aadhaar numbers", () => {
      expect(validateAadhaar("123456789012")).toBe(false); // Likely invalid checksum
      expect(validateAadhaar("012345678901")).toBe(false); // Cannot start with 0
      expect(validateAadhaar("12345")).toBe(false); // Too short
    });
  });

  describe("PII Scanner", () => {
    it("detects PAN, Indian Phone, Email, IFSC, and UPI IDs", () => {
      const text =
        "Parent PAN is ABCDE1234F. Contact at +91 9876543210 or email parent.lead@gmail.com. " +
        "Remit fees to IFSC HDFC0000123 or via UPI fee.school@okhdfcbank.";

      const detections = scanPII(text);
      expect(detections.length).toBe(5);

      const types = detections.map((d) => d.type);
      expect(types).toContain("PAN");
      expect(types).toContain("INDIAN_PHONE");
      expect(types).toContain("EMAIL");
      expect(types).toContain("IFSC");
      expect(types).toContain("UPI_ID");

      const panDetection = detections.find((d) => d.type === "PAN");
      expect(panDetection?.riskLevel).toBe("HIGH");
    });

    it("detects verified Aadhaar numbers with CRITICAL risk", () => {
      const validAadhaar = "23456789012" + generateVerhoeff("23456789012");
      const text = `Candidate Aadhaar number recorded: ${validAadhaar}.`;

      const detections = scanPII(text);
      const aadhaar = detections.find((d) => d.type === "AADHAAR");
      expect(aadhaar).toBeDefined();
      expect(aadhaar?.riskLevel).toBe("CRITICAL");
    });

    it("detects SPDI Health and Caste/Social Category", () => {
      const text = "Medical note: blood group: O+, asthma diagnosed. Category: OBC.";
      const detections = scanPII(text);

      expect(detections.some((d) => d.type === "SPDI_HEALTH")).toBe(true);
      expect(detections.some((d) => d.type === "SPDI_CASTE_RELIGION")).toBe(true);
    });
  });

  describe("PII Redactor", () => {
    it("partially masks sensitive data by default", () => {
      const validAadhaar = "23456789012" + generateVerhoeff("23456789012");
      const text = `Student Aadhaar ${validAadhaar}, phone 9876543210, email student@school.edu.in.`;

      const result = redactPII(text, { mode: "MASK_PARTIAL" });
      expect(result.redactedCount).toBe(3);
      expect(result.redactedText).toContain("XXXX-XXXX-");
      expect(result.redactedText).toContain("XXXXXX3210");
      expect(result.redactedText).toContain("s***t@school.edu.in");
      expect(result.redactedText).not.toContain(validAadhaar);
      expect(result.redactedText).not.toContain("9876543210");
    });

    it("fully redacts sensitive data when REDACT_FULL is selected", () => {
      const text = "Applicant PAN: ABCDE1234F, phone: 9876543210.";
      const result = redactPII(text, { mode: "REDACT_FULL" });

      expect(result.redactedText).toBe(
        "Applicant PAN: [REDACTED_PAN], phone: [REDACTED_INDIAN_PHONE]."
      );
    });
  });
});
