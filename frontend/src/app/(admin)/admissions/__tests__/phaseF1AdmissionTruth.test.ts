import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase F1: Admission Truth — Fee Removal & Document Verification (AC-1, AC-2, AC-3)", () => {
  const wizardPath = path.resolve(
    __dirname,
    "../new/AdmissionsWizard.tsx"
  );
  const parentDocsPath = path.resolve(
    __dirname,
    "../../../(parent)/parent/documents/ParentDocumentsClient.tsx"
  );
  const admissionsActionsPath = path.resolve(
    __dirname,
    "../[id]/actions.ts"
  );
  const studentsActionsPath = path.resolve(
    __dirname,
    "../../students/actions.ts"
  );
  const admissionsPagePath = path.resolve(
    __dirname,
    "../[id]/page.tsx"
  );
  const student360Path = path.resolve(
    __dirname,
    "../../students/[id]/Student360Client.tsx"
  );

  describe("AC-1: Admission Wizard 5-step truth and phantom fee eradication", () => {
    it("AdmissionsWizard.tsx defines exactly 5 steps in the stepper header", () => {
      const content = fs.readFileSync(wizardPath, "utf-8");
      expect(content).toContain("[1, 2, 3, 4, 5].map");
      expect(content).not.toContain("[1, 2, 3, 4, 5, 6].map");
      expect(content).toContain('{s === 1 && "DPDP Notice"}');
      expect(content).toContain('{s === 2 && "Basic Info"}');
      expect(content).toContain('{s === 3 && "Family"}');
      expect(content).toContain('{s === 4 && "Documents"}');
      expect(content).toContain('{s === 5 && "Confirm"}');
      expect(content).not.toContain('{s === 5 && "Fees"}');
    });

    it("AdmissionsWizard.tsx has zero references to ₹500 or Application Fee", () => {
      const content = fs.readFileSync(wizardPath, "utf-8");
      expect(content).not.toContain("₹500");
      expect(content).not.toContain("Application Fee");
      expect(content).not.toContain("Non-refundable registration fee");
    });

    it("AdmissionsWizard.tsx contains neutral post-enrollment fee notice in confirm step", () => {
      const content = fs.readFileSync(wizardPath, "utf-8");
      expect(content).toContain("Fee structure and first invoice will be generated on enrollment.");
    });

    it("AdmissionsWizard.tsx navigation buttons use step < 5 for Continue and step === 5 for Submit", () => {
      const content = fs.readFileSync(wizardPath, "utf-8");
      expect(content).toContain("step < 5 ?");
      expect(content).not.toContain("step < 6 ?");
    });
  });

  describe("AC-2: ParentDocumentsClient state-derived banner", () => {
    it("ParentDocumentsClient computes banner dynamically from document states", () => {
      const content = fs.readFileSync(parentDocsPath, "utf-8");
      expect(content).toContain("const totalDocs = documents.length;");
      expect(content).toContain("const allVerified = totalDocs > 0 && documents.every((d) => d.isVerified);");
      expect(content).toContain('"Encrypted storage • No documents on file"');
      expect(content).toContain('"Encrypted storage • Awaiting school verification"');
      expect(content).toContain('"DPDP Encrypted Storage • Verified by School Administration"');
    });

    it("simulated banner logic never shows 'Verified' with zero uploads", () => {
      const computeBanner = (docs: Array<{ isVerified: boolean }>) => {
        const totalDocs = docs.length;
        const allVerified = totalDocs > 0 && docs.every((d) => d.isVerified);
        return totalDocs === 0
          ? "Encrypted storage • No documents on file"
          : allVerified
          ? "DPDP Encrypted Storage • Verified by School Administration"
          : "Encrypted storage • Awaiting school verification";
      };

      const emptyBanner = computeBanner([]);
      expect(emptyBanner).toBe("Encrypted storage • No documents on file");
      expect(emptyBanner).not.toContain("Verified");

      const unverifiedBanner = computeBanner([{ isVerified: false }]);
      expect(unverifiedBanner).toBe("Encrypted storage • Awaiting school verification");
      expect(unverifiedBanner).not.toContain("Verified");

      const verifiedBanner = computeBanner([{ isVerified: true }, { isVerified: true }]);
      expect(verifiedBanner).toBe("DPDP Encrypted Storage • Verified by School Administration");
      expect(verifiedBanner).toContain("Verified");
    });
  });

  describe("AC-3: Admin document verification actions and UI affordances", () => {
    it("admissions/[id]/actions.ts exports verifyAdmissionDocument and rejectAdmissionDocument", () => {
      const content = fs.readFileSync(admissionsActionsPath, "utf-8");
      expect(content).toContain("export async function verifyAdmissionDocument");
      expect(content).toContain("export async function rejectAdmissionDocument");
      expect(content).toContain('tableName: "admission_documents"');
      expect(content).toContain('action: "WRITE"');
      expect(content).toContain('isVerified: true');
      expect(content).toContain('verifiedById: ctx.userId');
      expect(content).toContain('verifiedAt: now');
    });

    it("students/actions.ts exports verifyStudentDocument and rejectStudentDocument", () => {
      const content = fs.readFileSync(studentsActionsPath, "utf-8");
      expect(content).toContain("export async function verifyStudentDocument");
      expect(content).toContain("export async function rejectStudentDocument");
      expect(content).toContain('tableName: "student_documents"');
      expect(content).toContain('action: "WRITE"');
      expect(content).toContain('isVerified: true');
      expect(content).toContain('verifiedById: ctx.userId');
      expect(content).toContain('verifiedAt: now');
    });

    it("admissions/[id]/page.tsx renders AdmissionDocumentsList", () => {
      const content = fs.readFileSync(admissionsPagePath, "utf-8");
      expect(content).toContain("AdmissionDocumentsList");
      expect(content).toContain("<AdmissionDocumentsList documents={application.documents || []} />");
    });

    it("AdmissionDocumentsList.tsx provides interactive Verify and Reject buttons", () => {
      const listPath = path.resolve(
        __dirname,
        "../[id]/AdmissionDocumentsList.tsx"
      );
      expect(fs.existsSync(listPath)).toBe(true);
      const content = fs.readFileSync(listPath, "utf-8");
      expect(content).toContain("verifyAdmissionDocument");
      expect(content).toContain("rejectAdmissionDocument");
      expect(content).toContain("Verify");
      expect(content).toContain("Reject");
    });

    it("Student360Client.tsx renders Actions column in documents tab with Verify and Reject buttons", () => {
      const content = fs.readFileSync(student360Path, "utf-8");
      expect(content).toContain("verifyStudentDocument");
      expect(content).toContain("rejectStudentDocument");
      expect(content).toContain('<th className="px-4 py-3 text-right">Actions</th>');
      expect(content).toContain("handleVerifyStudentDoc");
      expect(content).toContain("handleRejectStudentDoc");
    });
  });
});
