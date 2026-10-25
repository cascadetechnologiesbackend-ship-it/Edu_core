import { describe, it, expect } from "vitest";
import {
  formatFullName,
  formatFeeTermName,
  calculateAttendanceMetrics,
} from "@/lib/utils";

describe("Sprint S19 Layer L6: Data-Quality Fixes & Integrity Guarantees", () => {
  // ─── 1. Fee Card Label De-duplication (S19-F07) ───────────────────────────
  describe("Fee Card Label De-duplication", () => {
    it("de-duplicates existing 'Fee' suffixes without creating 'Annual Fee Fee'", () => {
      expect(formatFeeTermName("Annual Fee")).toBe("Annual Fee");
      expect(formatFeeTermName("Annual Fee Fee")).toBe("Annual Fee");
      expect(formatFeeTermName("Quarterly Fee")).toBe("Quarterly Fee");
      expect(formatFeeTermName("Tuition Fee")).toBe("Tuition Fee");
    });

    it("appends 'Fee' only when term name does not already have it", () => {
      expect(formatFeeTermName("Annual")).toBe("Annual Fee");
      expect(formatFeeTermName("Term 1")).toBe("Term 1 Fee");
      expect(formatFeeTermName("Admission")).toBe("Admission Fee");
    });

    it("handles null, empty, or undefined safely with default 'School Fee'", () => {
      expect(formatFeeTermName(null)).toBe("School Fee");
      expect(formatFeeTermName(undefined)).toBe("School Fee");
      expect(formatFeeTermName("")).toBe("School Fee");
    });
  });

  // ─── 2. Single Attendance Computation Consumed by Header & 30-Day Card ─────
  describe("Attendance Consistency (Header vs 30-Day Card)", () => {
    it("proves header and 30-day card agree by construction for new students (0 sessions)", () => {
      const records: Array<{ status: string }> = [];
      const metrics = calculateAttendanceMetrics(records);

      // Header calculation
      const headerPercent = Math.round(metrics.rateRatio * 100);
      // 30-day card calculation
      const cardPercent = Math.round(metrics.ratePercent);

      // Invariant: Both must show 100% when no absences exist, and sessions must be 0 of 0
      expect(headerPercent).toBe(100);
      expect(cardPercent).toBe(100);
      expect(headerPercent).toBe(cardPercent);
      expect(metrics.totalDays).toBe(0);
      expect(metrics.attendedDays).toBe(0);
      expect(metrics.formattedPercent).toBe("100.0%");
    });

    it("proves header and 30-day card agree by construction for 1 session (PRESENT)", () => {
      const records = [{ status: "PRESENT" }];
      const metrics = calculateAttendanceMetrics(records);

      const headerPercent = Math.round(metrics.rateRatio * 100);
      const cardPercent = Math.round(metrics.ratePercent);

      expect(headerPercent).toBe(100);
      expect(cardPercent).toBe(100);
      expect(headerPercent).toBe(cardPercent);
      expect(metrics.totalDays).toBe(1);
      expect(metrics.attendedDays).toBe(1);
      expect(metrics.formattedPercent).toBe("100.0%");
    });

    it("proves header and 30-day card agree by construction for 1 session (ABSENT)", () => {
      const records = [{ status: "ABSENT" }];
      const metrics = calculateAttendanceMetrics(records);

      const headerPercent = Math.round(metrics.rateRatio * 100);
      const cardPercent = Math.round(metrics.ratePercent);

      expect(headerPercent).toBe(0);
      expect(cardPercent).toBe(0);
      expect(headerPercent).toBe(cardPercent);
      expect(metrics.totalDays).toBe(1);
      expect(metrics.attendedDays).toBe(0);
      expect(metrics.formattedPercent).toBe("0.0%");
    });

    it("ignores HOLIDAY status in denominator and marks LATE as attended", () => {
      const records = [
        { status: "PRESENT" },
        { status: "LATE" },
        { status: "HOLIDAY" },
        { status: "ABSENT" },
      ];
      const metrics = calculateAttendanceMetrics(records);

      // 3 school days, 2 attended (PRESENT + LATE)
      expect(metrics.totalDays).toBe(3);
      expect(metrics.attendedDays).toBe(2);
      expect(metrics.absentDays).toBe(1);
      expect(metrics.lateDays).toBe(1);
      expect(metrics.ratePercent).toBe(66.7);
      expect(metrics.formattedPercent).toBe("66.7%");

      const headerPercent = Math.round(metrics.rateRatio * 100);
      expect(headerPercent).toBe(67);
    });
  });

  // ─── 3. Name Assembly Trims 'null' / 'undefined' Strings (S19-F07) ─────────
  describe("Name Assembly Cleanliness (No 'null' Artifacts)", () => {
    it("trims null or missing last name without producing 'Valbhav null'", () => {
      expect(formatFullName("Valbhav", null)).toBe("Valbhav");
      expect(formatFullName("Valbhav", undefined)).toBe("Valbhav");
      expect(formatFullName("Valbhav", "")).toBe("Valbhav");
    });

    it("sanitizes literal 'null' and 'undefined' string values from corrupted decryptions", () => {
      expect(formatFullName("Valbhav", "null")).toBe("Valbhav");
      expect(formatFullName("Valbhav", "undefined")).toBe("Valbhav");
      expect(formatFullName("null", "Sharma")).toBe("Sharma");
      expect(formatFullName("undefined", "Sharma")).toBe("Sharma");
    });

    it("assembles valid first and last names correctly", () => {
      expect(formatFullName("Aarav", "Sharma")).toBe("Aarav Sharma");
      expect(formatFullName("Priya", "Patel")).toBe("Priya Patel");
    });

    it("falls back to default string when both first and last name are empty or null", () => {
      expect(formatFullName(null, null, "Student")).toBe("Student");
      expect(formatFullName("null", "null", "Educator")).toBe("Educator");
      expect(formatFullName("", undefined, "Faculty")).toBe("Faculty");
    });
  });
});
