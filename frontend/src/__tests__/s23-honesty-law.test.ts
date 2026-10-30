import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Sprint S23 Layer 7: Honesty Law Static Code Scanner", () => {
  const getFileContent = (relativePath: string) => {
    const fullPath = path.resolve(__dirname, "../../", relativePath);
    return fs.readFileSync(fullPath, "utf-8");
  };

  describe("1. Principal Executive Dashboard Honesty", () => {
    const content = getFileContent("src/app/(principal)/principal/dashboard/page.tsx");

    it("verifies no fabricated metric literals exist in Principal page source", () => {
      // Prior fabricated literals: 24 (sections), 48 (staff), 96% Daily Attendance, 94.2%, 2 Classes
      expect(content).not.toMatch(/>\s*24\s*</);
      expect(content).not.toMatch(/>\s*48\s*</);
      expect(content).not.toContain("96% Daily Attendance");
      expect(content).not.toMatch(/>\s*94\.2%\s*</);
      expect(content).not.toMatch(/>\s*2 Classes\s*</);
    });

    it("verifies binding to live getPrincipalConsoleMetrics", () => {
      expect(content).toContain("getPrincipalConsoleMetrics");
      expect(content).toContain("metrics.activeSectionsCount");
      expect(content).toContain("metrics.activeTeachingStaffCount");
      expect(content).toContain("metrics.todayStudentAttendance");
      expect(content).toContain("metrics.pendingExamVerificationsCount");
    });
  });

  describe("2. Librarian Operations Console Honesty", () => {
    const content = getFileContent("src/app/(librarian)/librarian/dashboard/page.tsx");

    it("verifies no fabricated metric literals exist in Librarian page source", () => {
      // Prior fabricated literals: 4,850, 142 Books, 8 Books, 18
      expect(content).not.toMatch(/>\s*4,850\s*</);
      expect(content).not.toMatch(/>\s*142 Books\s*</);
      expect(content).not.toMatch(/>\s*8 Books\s*</);
      expect(content).not.toMatch(/>\s*18\s*</);
    });

    it("verifies binding to live getLibrarianConsoleMetrics", () => {
      expect(content).toContain("getLibrarianConsoleMetrics");
      expect(content).toContain("metrics.totalCopies");
      expect(content).toContain("metrics.currentlyIssued");
      expect(content).toContain("metrics.overdueCount");
      expect(content).toContain("metrics.distinctCategoriesCount");
    });
  });

  describe("3. Transport Fleet Console Honesty", () => {
    const content = getFileContent("src/app/(transport-manager)/transport/dashboard/page.tsx");

    it("verifies no fabricated metric literals exist in Transport page source", () => {
      // Prior fabricated literals: 8 Vehicles, Active GPS Tracking (blanket), 12 Routes, 45 Pickup Stops, 320 Students, 1 Vehicle
      expect(content).not.toMatch(/>\s*8 Vehicles\s*</);
      expect(content).not.toMatch(/>\s*12 Routes\s*</);
      expect(content).not.toMatch(/>\s*45 Pickup Stops\s*</);
      expect(content).not.toMatch(/>\s*320 Students\s*</);
      // No unconditional blanket claim
      expect(content).not.toMatch(/<p[^>]*>\s*Active GPS Tracking\s*<\/p>/);
    });

    it("verifies binding to live getTransportConsoleMetrics", () => {
      expect(content).toContain("getTransportConsoleMetrics");
      expect(content).toContain("metrics.activeVehiclesCount");
      expect(content).toContain("metrics.activeRoutesCount");
      expect(content).toContain("metrics.optedInStudentsCount");
      expect(content).toContain("metrics.maintenanceAlertsCount");
      expect(content).toContain("metrics.gpsStatus");
    });
  });

  describe("4. Driver Dashboard Honesty & Zero Route Theft", () => {
    const content = getFileContent("src/app/(driver)/driver/dashboard/page.tsx");

    it("verifies DL-DEMO-2026, demo ID, and route theft are permanently eliminated", () => {
      expect(content).not.toContain("DL-DEMO-2026");
      expect(content).not.toContain('id: "demo"');
      expect(content).not.not.toBeNull();
      // No fallback route theft
      expect(content).not.toContain("Fallback: pick first available route");
    });

    it("verifies honest setup-missing card is rendered when unconfigured", () => {
      expect(content).toContain("driver-setup-missing-card");
      expect(content).toContain("No Vehicle or Route Assigned");
      expect(content).toContain("Transport Allocation Pending");
    });
  });
});
