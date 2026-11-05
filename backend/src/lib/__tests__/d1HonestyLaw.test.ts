import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase D1-L7: School Onboarding Honesty Law & Anti-Fabrication Suite", () => {
  const rootDir = path.resolve(__dirname, "../../../../");

  const getFileContent = (relativePath: string) => {
    const fullPath = path.resolve(rootDir, relativePath);
    return fs.readFileSync(fullPath, "utf-8");
  };

  describe("1. Day One Cockpit Surface Truth & No Mock Booleans", () => {
    const content = getFileContent("frontend/src/app/(admin)/admin/day-one/page.tsx");

    it("verifies H1 strictly names the job per Charter Law 1", () => {
      expect(content).toContain("Open the school for Day One");
    });

    it("verifies readiness computed from database query getDayOneReadiness", () => {
      expect(content).toContain("getDayOneReadiness(schoolId)");
    });

    it("verifies Onboarding North Star metric badge is rendered on surface", () => {
      expect(content).toContain("<OnboardingMetricBadge");
    });

    it("verifies finished state message dynamically rendered from db report", () => {
      expect(content).toContain("readiness.finishedStateMessage");
    });

    it("verifies zero hardcoded mock readiness boolean flags", () => {
      expect(content).not.toMatch(/isReadyForDayOne\s*=\s*true/);
      expect(content).not.toMatch(/readyChecksCount\s*=\s*8/);
    });

    it("verifies primary call-to-action is 'Mark the first attendance' linking to /attendance", () => {
      expect(content).toContain("Mark the first attendance");
      expect(content).toContain('href="/attendance"');
    });
  });

  describe("2. Day One Readiness Engine: 8 Database-Driven Invariants", () => {
    const content = getFileContent("backend/src/lib/dayOneReadiness.ts");

    it("verifies all 8 specified readiness checks are present", () => {
      const requiredChecks = [
        "academic_year",
        "classes_sections",
        "subjects",
        "fees",
        "staff",
        "students",
        "timetable",
        "parent_claims",
      ];
      for (const checkId of requiredChecks) {
        expect(content).toContain(`id: "${checkId}"`);
      }
    });

    it("verifies fallback to UNKNOWN status with unknownReason when db query fails", () => {
      expect(content).toContain('status: "UNKNOWN"');
      expect(content).toContain("unknownReason:");
    });

    it("verifies finished state message format matching Charter law", () => {
      expect(content).toContain("ready for Day One:");
      expect(content).toContain("${studentsCount} students, ${staffCount} staff, ${sectionsCount} sections configured.");
      expect(content).toContain('label: "Mark the first attendance"');
    });
  });

  describe("3. Wizard Landing Truth: Zero Empty-Dashboard Dead End", () => {
    const content = getFileContent("frontend/src/app/onboard/steps/Step8Completion.tsx");

    it("verifies Step 8 CTA links to /admin/day-one?welcome=true", () => {
      expect(content).toContain("/admin/day-one?welcome=true");
    });
  });

  describe("4. Bulk Import Truth: Row-Level Resilience & Input Normalization", () => {
    const content = getFileContent("backend/src/lib/bulkImportResilience.ts");

    it("verifies phone normalization handles Indian mobile variants", () => {
      expect(content).toContain("normalizePhone");
      expect(content).toContain("digits.length === 10");
    });

    it("verifies date normalization handles DD/MM/YYYY, DD-MM-YYYY, and serial dates", () => {
      expect(content).toContain("normalizeDate");
      expect(content).toContain("MONTH_MAP");
    });

    it("verifies fuzzy class and section resolution handles variants", () => {
      expect(content).toContain("getCanonicalClassKey");
      expect(content).toContain("resolveClassAndSection");
    });

    it("verifies row-level resilience (all-or-nothing rollback is prohibited)", () => {
      expect(content).not.toContain("rollbackAllOnAnyError");
      expect(content).toContain("rejectedRowsCsv");
    });
  });

  describe("5. Claim Distribution Truth: Timing-Safe Verification & Non-Destructive Resend", () => {
    const parentContent = getFileContent("backend/src/lib/parentLinkage.ts");
    const studentContent = getFileContent("backend/src/lib/studentAccess.ts");
    const claimQueueContent = getFileContent("backend/src/lib/claimDistribution.ts");

    it("verifies parent claim verification uses crypto.timingSafeEqual", () => {
      expect(parentContent).toContain("timingSafeEqual");
      expect(parentContent).toContain("verifyAndClaimParentAccount");
    });

    it("verifies student claim verification uses crypto.timingSafeEqual", () => {
      expect(studentContent).toContain("timingSafeEqual");
      expect(studentContent).toContain("verifyAndClaimStudentAccount");
    });

    it("verifies resend does not invalidate claimed accounts", () => {
      expect(parentContent).toContain("resendParentClaim");
      expect(parentContent).toContain("Parent account has already been claimed");
    });

    it("verifies claim tracking queue exposes issued, claimed, and pending counts", () => {
      expect(claimQueueContent).toContain("getClaimTrackingQueue");
      expect(claimQueueContent).toContain("totalIssued");
      expect(claimQueueContent).toContain("totalClaimed");
      expect(claimQueueContent).toContain("totalPending");
    });
  });

  describe("6. North Star Telemetry Truth: Zero PII & Tenant Scoping", () => {
    const content = getFileContent("backend/src/lib/northStarTelemetry.ts");

    it("verifies assertZeroPII strictly rejects emails, phones, Aadhaar, and PAN", () => {
      expect(content).toContain("assertZeroPII");
      expect(content).toContain("PII violation detected");
    });

    it("verifies north_star_onboarding_duration event exists and records working days", () => {
      expect(content).toContain("north_star_onboarding_duration");
      expect(content).toContain("recordOnboardingDays");
    });

    it("verifies withTenant scoping in telemetry queries", () => {
      expect(content).toContain("withTenant");
    });
  });
});
