import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import { usageEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  assertZeroPII,
  recordAttendanceMarkDuration,
  recordFeeDayReconciledBy3pm,
  recordMonthCloseDuration,
  recordOnboardingDays,
  recordParentFeeDuration,
  recordJourneyCompletion,
  getNorthStarMetricsSummary,
  NORTH_STAR_TARGETS,
} from "../northStarTelemetry";
import { seedIsolationSchools, ISOLATION_IDS } from "../isolationFixtures";

describe("Charter Phase D0: North Star Telemetry Engine", () => {
  const schoolId = ISOLATION_IDS.schoolA.id;
  const adminId = ISOLATION_IDS.schoolA.adminUserId;
  const teacherId = ISOLATION_IDS.schoolA.teacherA1UserId;

  beforeAll(async () => {
    await seedIsolationSchools();
    // Clean prior telemetry events for isolation school
    await db.delete(usageEvents).where(eq(usageEvents.schoolId, schoolId));
  });

  describe("1. Zero-PII Enforcement", () => {
    it("allows valid telemetry data with zero PII", () => {
      expect(() => {
        assertZeroPII({
          durationMs: 120000,
          studentCount: 38,
          sectionId: "sec-101",
          status: "completed",
        });
      }).not.toThrow();
    });

    it("rejects payloads containing email addresses", () => {
      expect(() => {
        assertZeroPII({
          durationMs: 120000,
          contact: "parent@example.com",
        });
      }).toThrow(/PII violation detected/);
    });

    it("rejects payloads containing Indian mobile numbers", () => {
      expect(() => {
        assertZeroPII({
          durationMs: 120000,
          mobile: "9876543210",
        });
      }).toThrow(/Prohibited PII key name detected/);
    });

    it("rejects payloads containing Aadhaar patterns", () => {
      expect(() => {
        assertZeroPII({
          durationMs: 120000,
          idPattern: "1234 5678 9012",
        });
      }).toThrow(/PII violation detected/);
    });

    it("rejects prohibited PII key names", () => {
      expect(() => {
        assertZeroPII({
          studentName: "John Doe",
        });
      }).toThrow(/Prohibited PII key name detected: "studentName"/);
    });
  });

  describe("2. Strongly-Typed Metric Recording", () => {
    it("records attendance marking duration (< 4 min target)", async () => {
      // 2.5 minutes (150,000 ms)
      const event = await recordAttendanceMarkDuration({
        schoolId,
        userId: teacherId,
        role: "TEACHER",
        studentCount: 35,
        durationMs: 150000,
        status: "completed",
      });

      expect(event).toBeDefined();
      expect(event.elementId).toBe("north_star_attendance_duration");
      const payload = JSON.parse(event.elementLabel);
      expect(payload.durationMinutes).toBe(2.5);
      expect(payload.targetMet).toBe(true);
      expect(payload.studentCount).toBe(35);
    });

    it("records fee day reconciliation (>= 95% target)", async () => {
      const event = await recordFeeDayReconciledBy3pm({
        schoolId,
        userId: adminId,
        role: "OFFICE_ADMIN",
        date: "2026-11-05",
        collectedPaise: 10000000, // Rs 1,00,000
        reconciledPaise: 9800000,  // Rs 98,000 (98%)
        isReconciledBy3pm: true,
      });

      expect(event).toBeDefined();
      expect(event.elementId).toBe("north_star_fee_day_reconciled");
      const payload = JSON.parse(event.elementLabel);
      expect(payload.reconciliationPct).toBe(98);
      expect(payload.targetMet).toBe(true);
    });

    it("records month close duration (< 4 hr target)", async () => {
      const event = await recordMonthCloseDuration({
        schoolId,
        userId: adminId,
        role: "ACCOUNTANT",
        monthYear: "2026-10",
        durationHours: 2.25,
        invariantsGreen: true,
      });

      expect(event).toBeDefined();
      expect(event.elementId).toBe("north_star_month_close_duration");
      const payload = JSON.parse(event.elementLabel);
      expect(payload.durationHours).toBe(2.25);
      expect(payload.targetMet).toBe(true);
    });

    it("records onboarding working days (<= 1 day target)", async () => {
      const event = await recordOnboardingDays({
        schoolId,
        userId: adminId,
        role: "SUPER_ADMIN",
        tenantId: schoolId,
        workingDaysElapsed: 1,
        firstAttendanceMarked: true,
      });

      expect(event).toBeDefined();
      expect(event.elementId).toBe("north_star_onboarding_duration");
      const payload = JSON.parse(event.elementLabel);
      expect(payload.targetMet).toBe(true);
    });

    it("records parent fee payment seconds (< 90 sec target)", async () => {
      const event = await recordParentFeeDuration({
        schoolId,
        userId: adminId,
        role: "PARENT",
        invoiceId: "inv-demo-101",
        durationSeconds: 42,
        gatewaySuccess: true,
      });

      expect(event).toBeDefined();
      expect(event.elementId).toBe("north_star_parent_fee_duration");
      const payload = JSON.parse(event.elementLabel);
      expect(payload.targetMet).toBe(true);
    });

    it("records journey completion rate", async () => {
      const event = await recordJourneyCompletion({
        schoolId,
        userId: teacherId,
        role: "TEACHER",
        journeyId: "J3_the_period",
        durationMs: 180000,
        completed: true,
        finishedState: "Attendance saved for 10-A: 35/35",
      });

      expect(event).toBeDefined();
      expect(event.elementId).toBe("north_star_journey_completion");
      const payload = JSON.parse(event.elementLabel);
      expect(payload.completed).toBe(true);
      expect(payload.finishedState).toContain("Attendance saved");
    });
  });

  describe("3. Unvarnished Metric Summary Readout", () => {
    it("computes truthful readout with targets and healthy status", async () => {
      const summary = await getNorthStarMetricsSummary(schoolId);

      expect(summary).toBeDefined();
      expect(summary.attendanceMinutes.current).toBe(2.5);
      expect(summary.attendanceMinutes.status).toBe("met");
      expect(summary.attendanceMinutes.target).toBe(NORTH_STAR_TARGETS.attendance_mark_minutes);

      expect(summary.feeDayReconciliationRate.current).toBe(100); // 1 success out of 1
      expect(summary.feeDayReconciliationRate.status).toBe("met");

      expect(summary.monthCloseHours.current).toBe(2.25);
      expect(summary.monthCloseHours.status).toBe("met");

      expect(summary.onboardingDays.current).toBe(1);
      expect(summary.onboardingDays.status).toBe("met");

      expect(summary.parentFeeSeconds.current).toBe(42);
      expect(summary.parentFeeSeconds.status).toBe("met");

      expect(summary.journeyCompletionRate.current).toBe(100);
      expect(summary.journeyCompletionRate.status).toBe("met");

      expect(summary.overallHealth).toBe("healthy");
    });

    it("accurately detects and flags target breach", async () => {
      // Record a breached attendance duration (6 minutes > 4 min target)
      await recordAttendanceMarkDuration({
        schoolId,
        userId: teacherId,
        role: "TEACHER",
        studentCount: 40,
        durationMs: 360000, // 6 minutes
        status: "completed",
      });

      // Also record another long attendance duration so the median is breached
      await recordAttendanceMarkDuration({
        schoolId,
        userId: teacherId,
        role: "TEACHER",
        studentCount: 40,
        durationMs: 360000, // 6 minutes
        status: "completed",
      });

      const summary = await getNorthStarMetricsSummary(schoolId);
      expect(summary.attendanceMinutes.current).toBe(6);
      expect(summary.attendanceMinutes.status).toBe("breached");
      expect(summary.overallHealth).toBe("needs_attention");
    });
  });
});

