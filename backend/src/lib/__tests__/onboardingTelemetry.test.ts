import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/db";
import { usageEvents, schools, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  assertZeroPII,
  emitNorthStarEvent,
  recordOnboardingDays,
  recordJourneyCompletion,
  calculateElapsedWorkingDays,
  recordFirstAttendanceOnboarding,
  getNorthStarMetricsSummary,
  NORTH_STAR_TARGETS,
} from "../northStarTelemetry";
import { withTenant } from "../tenant";
const ONBOARDING_IDS = {
  schoolA: {
    id: "f1111111-1111-4111-8111-111111111111",
    name: "Onboarding Drill School A",
    slug: "onb-drill-a",
    udise: "UDONB0000001",
    adminUserId: "f5555555-5555-4555-8555-555555555555",
    teacherA1UserId: "f6666666-6666-4666-8666-666666666666",
  },
  schoolB: {
    id: "f2222222-2222-4222-8222-222222222222",
    name: "Onboarding Drill School B",
    slug: "onb-drill-b",
    udise: "UDONB0000002",
    adminUserId: "f7777777-7777-4777-8777-777777777777",
    teacherA1UserId: "f8888888-8888-4888-8888-888888888888",
  },
};

describe("Phase D1-L1: North-Star Onboarding Telemetry & The Onboarding Clock", () => {
  const schoolA = ONBOARDING_IDS.schoolA;
  const schoolB = ONBOARDING_IDS.schoolB;

  beforeAll(async () => {
    // Seed dedicated onboarding test schools and users
    for (const s of [schoolA, schoolB]) {
      await db
        .insert(schools)
        .values({
          id: s.id,
          name: s.name,
          slug: s.slug,
          udiseCode: s.udise,
          board: "CBSE",
          address: "123 Onboarding Road",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110001",
          phone: "9876543210",
          email: `${s.slug}@example.com`,
          principalName: "Dr. Principal",
          establishedYear: 2026,
          isActive: true,
        })
        .onConflictDoNothing();

      await withTenant(s.id, async (tx) => {
        await tx
          .insert(users)
          .values({
            id: s.adminUserId,
            schoolId: s.id,
            email: `admin.${s.slug}@example.com`,
            passwordHash: "hash123",
            isActive: true,
            isEmailVerified: true,
          })
          .onConflictDoNothing();

        if (s.teacherA1UserId) {
          await tx
            .insert(users)
            .values({
              id: s.teacherA1UserId,
              schoolId: s.id,
              email: `teacher.${s.slug}@example.com`,
              passwordHash: "hash123",
              isActive: true,
              isEmailVerified: true,
            })
            .onConflictDoNothing();
        }
      });
    }
  });

  beforeEach(async () => {
    // Clean telemetry events for both dedicated onboarding schools before each test
    await db.delete(usageEvents).where(eq(usageEvents.schoolId, schoolA.id));
    await db.delete(usageEvents).where(eq(usageEvents.schoolId, schoolB.id));
    // Reset schoolA.createdAt to right now so elapsed working days calculation starts fresh
    await db.update(schools).set({ createdAt: new Date() }).where(eq(schools.id, schoolA.id));
  });

  describe("1. Strict Tenant Isolation (AC-D1-2)", () => {
    it("ensures telemetry events emitted for School A are completely invisible to School B", async () => {
      // Record onboarding duration event for School A
      await recordOnboardingDays({
        schoolId: schoolA.id,
        userId: schoolA.adminUserId,
        role: "SUPER_ADMIN",
        tenantId: schoolA.id,
        workingDaysElapsed: 0.8,
        firstAttendanceMarked: true,
      });

      // School B should have zero data / no_data status
      const summaryB = await getNorthStarMetricsSummary(schoolB.id);
      expect(summaryB.onboardingDays.status).toBe("no_data");
      expect(summaryB.onboardingDays.sampleCount).toBe(0);
      expect(summaryB.onboardingDays.current).toBe(0);

      // School A should have target met status with exactly 0.8 days
      const summaryA = await getNorthStarMetricsSummary(schoolA.id);
      expect(summaryA.onboardingDays.status).toBe("met");
      expect(summaryA.onboardingDays.sampleCount).toBe(1);
      expect(summaryA.onboardingDays.current).toBe(0.8);
      expect(summaryA.onboardingDays.target).toBe(NORTH_STAR_TARGETS.onboarding_days);
    });
  });

  describe("2. Zero PII Enforcement (BR-D1-5, AC-D1-2)", () => {
    it("allows valid telemetry data with zero PII", () => {
      expect(() => {
        assertZeroPII({
          tenantId: schoolA.id,
          workingDaysElapsed: 1,
          firstAttendanceMarked: true,
          targetMet: true,
        });
      }).not.toThrow();
    });

    it("rejects payloads containing email addresses in values", () => {
      expect(() => {
        assertZeroPII({
          tenantId: schoolA.id,
          userNote: "admin@delhischool.edu.in",
        });
      }).toThrow(/PII violation detected/);
    });

    it("rejects payloads containing Indian mobile phone numbers", () => {
      expect(() => {
        assertZeroPII({
          tenantId: schoolA.id,
          phone: "9876543210",
        });
      }).toThrow(/Prohibited PII key name detected/);
    });

    it("rejects payloads with prohibited key names like studentName or aadhaar", () => {
      expect(() => {
        assertZeroPII({
          studentName: "Aarav Sharma",
        });
      }).toThrow(/Prohibited PII key name detected: "studentName"/);

      expect(() => {
        assertZeroPII({
          aadhaarNumber: "1234 5678 9012",
        });
      }).toThrow(/Prohibited PII key name detected: "aadhaarNumber"/);
    });

    it("throws error if emitNorthStarEvent receives PII", async () => {
      await expect(
        emitNorthStarEvent({
          schoolId: schoolA.id,
          userId: schoolA.adminUserId,
          role: "SUPER_ADMIN",
          screen: "/onboard",
          eventName: "north_star_onboarding_duration",
          action: "complete_onboarding",
          payload: {
            tenantId: schoolA.id,
            workingDaysElapsed: 1,
            userEmail: "parent@test.com",
          },
        })
      ).rejects.toThrow(/PII/);
    });
  });

  describe("3. Onboarding Duration Calculation Correctness", () => {
    it("computes 0 working days for future or identical timestamps", () => {
      const now = new Date("2026-11-02T10:00:00Z");
      expect(calculateElapsedWorkingDays(now, now)).toBe(0);

      const future = new Date("2026-11-05T10:00:00Z");
      expect(calculateElapsedWorkingDays(future, now)).toBe(0);
    });

    it("computes fractional working days for same-day operations under 24 hours", () => {
      // 6 hours later on Monday (0.25 day -> rounds to 0.3 or 0.2)
      const start = new Date("2026-11-02T08:00:00Z");
      const end = new Date("2026-11-02T14:00:00Z");
      const elapsed = calculateElapsedWorkingDays(start, end);

      expect(elapsed).toBeGreaterThan(0);
      expect(elapsed).toBeLessThanOrEqual(1);
      expect(elapsed).toBe(0.3);
    });

    it("computes exactly 1.0 working day for 24-hour turnaround", () => {
      const start = new Date("2026-11-02T09:00:00Z");
      const end = new Date("2026-11-03T09:00:00Z");
      const elapsed = calculateElapsedWorkingDays(start, end);

      expect(elapsed).toBe(1.0);
    });

    it("correctly excludes Sundays when calculating multi-day working days", () => {
      // 2026-11-06 is Friday 10:00 AM
      // 2026-11-09 is Monday 10:00 AM
      // Calendar delta = 3 days (72 hours), but Sunday Nov 8 is non-instructional.
      // Working days elapsed should be 2.0 (Friday->Saturday, Monday)
      const startFriday = new Date("2026-11-06T10:00:00Z");
      const endMonday = new Date("2026-11-09T10:00:00Z");
      const elapsed = calculateElapsedWorkingDays(startFriday, endMonday);

      expect(elapsed).toBe(2.0);
    });

    it("correctly handles Saturday night to Monday morning crossing the Sunday boundary", () => {
      // Provisioned Saturday night 20:00 UTC (4 hours of Saturday)
      // Attendance marked Monday morning 08:00 UTC (8 hours of Monday)
      // Sunday Nov 8 has 0 instructional hours
      // Total elapsed working hours = 4 + 8 = 12 hours = 0.5 working days
      const satNight = new Date("2026-11-07T20:00:00Z");
      const monMorning = new Date("2026-11-09T08:00:00Z");
      const elapsed = calculateElapsedWorkingDays(satNight, monMorning);

      expect(elapsed).toBe(0.5);
      expect(elapsed <= NORTH_STAR_TARGETS.onboarding_days).toBe(true);
    });

    it("returns 0 for invalid dates or negative duration", () => {
      expect(calculateElapsedWorkingDays(new Date("invalid"), new Date())).toBe(0);
      expect(calculateElapsedWorkingDays(new Date(), new Date("invalid"))).toBe(0);
    });

    it("accurately identifies target breaches (> 1 working day)", () => {
      // 3 working days from Monday to Thursday
      const startMon = new Date("2026-11-02T10:00:00Z");
      const endThu = new Date("2026-11-05T10:00:00Z");
      const elapsed = calculateElapsedWorkingDays(startMon, endThu);

      expect(elapsed).toBe(3.0);
      expect(elapsed <= NORTH_STAR_TARGETS.onboarding_days).toBe(false);
    });
  });

  describe("4. Emit-to-Readout Round Trip & First Attendance Clock Stop", () => {
    it("handles full lifecycle: journey start -> first attendance -> clock stop -> readout", async () => {
      // 1. Record J10 journey start upon tenant provisioning
      const startEvt = await recordJourneyCompletion({
        schoolId: schoolA.id,
        userId: schoolA.adminUserId,
        role: "SUPER_ADMIN",
        journeyId: "J10_school_onboarding",
        durationMs: 0,
        completed: false,
      });

      expect(startEvt).toBeDefined();
      expect(startEvt.action).toBe("journey_started");

      // Verify readout before attendance: onboarding clock in progress, completion rate is in-progress
      const midSummary = await getNorthStarMetricsSummary(schoolA.id);
      expect(midSummary.onboardingDays.status).toBe("no_data");

      // 2. Trigger first attendance clock stop
      const clockStopResult = await recordFirstAttendanceOnboarding({
        schoolId: schoolA.id,
        userId: schoolA.teacherA1UserId,
        role: "TEACHER",
      });

      expect(clockStopResult).not.toBeNull();
      expect(clockStopResult?.onboardingEvent).toBeDefined();
      expect(clockStopResult?.journeyEvent).toBeDefined();
      expect(clockStopResult?.journeyEvent.action).toBe("journey_finished");
      const journeyPayload = JSON.parse(clockStopResult!.journeyEvent.elementLabel);
      expect(journeyPayload.finishedState).toBe("A new school opens on day one and takes attendance with real data.");

      // 3. Verify final unvarnished readout reflects clock stop and journey completion
      const finalSummary = await getNorthStarMetricsSummary(schoolA.id);
      expect(finalSummary.onboardingDays.status).toBe("met");
      expect(finalSummary.onboardingDays.sampleCount).toBe(1);
      expect(finalSummary.onboardingDays.unit).toBe("days");

      // Journey completion rate should be 100% (1 started, 1 finished)
      expect(finalSummary.journeyCompletionRate.current).toBe(100);
      expect(finalSummary.journeyCompletionRate.status).toBe("met");
      expect(finalSummary.journeyCompletionRate.sampleCount).toBe(1);

      // 4. Idempotency test: Second call should be a no-op (clock does not stop twice)
      const secondCall = await recordFirstAttendanceOnboarding({
        schoolId: schoolA.id,
        userId: schoolA.teacherA1UserId,
        role: "TEACHER",
      });

      expect(secondCall).toBeNull();

      // Sample count remains 1
      const idempotentSummary = await getNorthStarMetricsSummary(schoolA.id);
      expect(idempotentSummary.onboardingDays.sampleCount).toBe(1);
    });

    it("flags onboarding duration target breach when duration exceeds 1 day", async () => {
      // Record a breached onboarding duration (e.g. 2.5 working days)
      await recordOnboardingDays({
        schoolId: schoolA.id,
        userId: schoolA.adminUserId,
        role: "SUPER_ADMIN",
        tenantId: schoolA.id,
        workingDaysElapsed: 2.5,
        firstAttendanceMarked: true,
      });

      const summary = await getNorthStarMetricsSummary(schoolA.id);
      expect(summary.onboardingDays.current).toBe(2.5);
      expect(summary.onboardingDays.status).toBe("breached");
      expect(summary.overallHealth).toBe("needs_attention");
    });

    it("stops the onboarding clock correctly when first attendance is marked by SCHOOL_ADMIN", async () => {
      const result = await recordFirstAttendanceOnboarding({
        schoolId: schoolB.id,
        userId: schoolB.adminUserId,
        role: "SCHOOL_ADMIN",
      });

      expect(result).not.toBeNull();
      expect(result?.onboardingEvent.role).toBe("SCHOOL_ADMIN");
      expect(result?.journeyEvent.role).toBe("SCHOOL_ADMIN");
      expect(result?.journeyEvent.action).toBe("journey_finished");

      const summary = await getNorthStarMetricsSummary(schoolB.id);
      expect(summary.onboardingDays.status).toBe("met");
      expect(summary.onboardingDays.sampleCount).toBe(1);
    });
  });
});
