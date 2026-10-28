import { describe, it, expect } from "vitest";
import {
  validateWorkloadFit,
  generateDeterministicSchedule,
  checkScheduleClashes,
  SubjectWorkloadInput,
} from "../lib/timetableEngine";

describe("Sprint S20: Timetable Engine & Feasibility Algorithms", () => {
  const sampleSubjects: SubjectWorkloadInput[] = [
    { id: "sub-1", name: "Mathematics", weeklyPeriods: 6 },
    { id: "sub-2", name: "English", weeklyPeriods: 6 },
    { id: "sub-3", name: "Science", weeklyPeriods: 6, isLabOrPractical: true },
    { id: "sub-4", name: "Social Science", weeklyPeriods: 5 },
    { id: "sub-5", name: "Hindi", weeklyPeriods: 5 },
    { id: "sub-6", name: "Physical Education", weeklyPeriods: 2 },
    { id: "sub-7", name: "Art & Craft", weeklyPeriods: 2 },
  ]; // Total = 32 periods

  describe("1. Mathematical Workload Fit Verification", () => {
    it("should return fits: true when required periods fit available schedule", () => {
      // 6 working days * 6 instruction periods/day = 36 available periods
      const result = validateWorkloadFit({
        workingDaysCount: 6,
        instructionPeriodsPerDay: 6,
        subjects: sampleSubjects, // 32 required
      });

      expect(result.fits).toBe(true);
      expect(result.availableWeeklyPeriods).toBe(36);
      expect(result.totalRequiredPeriods).toBe(32);
      expect(result.slackOrDeficit).toBe(4); // 4 free periods
      expect(result.message).toContain("feasible");
    });

    it("should return fits: false when required periods exceed available schedule", () => {
      // 5 working days * 6 instruction periods/day = 30 available periods
      const result = validateWorkloadFit({
        workingDaysCount: 5,
        instructionPeriodsPerDay: 6,
        subjects: sampleSubjects, // 32 required
      });

      expect(result.fits).toBe(false);
      expect(result.availableWeeklyPeriods).toBe(30);
      expect(result.totalRequiredPeriods).toBe(32);
      expect(result.slackOrDeficit).toBe(-2); // deficit of 2
      expect(result.message).toContain("deficit");
    });
  });

  describe("2. Deterministic Provisional Schedule Generation", () => {
    it("should generate a complete schedule without overflow when feasible", () => {
      const result = generateDeterministicSchedule({
        workingDays: [1, 2, 3, 4, 5, 6],
        instructionPeriodsPerDay: 6,
        subjects: sampleSubjects,
      });

      expect(result.success).toBe(true);
      expect(result.overflowSubjects.length).toBe(0);
      expect(result.slots.length).toBe(32);

      // Verify no subject has > 2 periods on any single day
      const dailyCounts = new Map<string, number>();
      for (const slot of result.slots) {
        const key = `${slot.dayOfWeek}-${slot.subjectId}`;
        dailyCounts.set(key, (dailyCounts.get(key) || 0) + 1);
      }

      for (const count of dailyCounts.values()) {
        expect(count).toBeLessThanOrEqual(2);
      }
    });

    it("should preserve manual overrides without overwriting them", () => {
      const manualSlot = {
        dayOfWeek: 1, // Mon
        periodNumber: 1, // Period 1
        subjectId: "manual-sub",
        subjectName: "Special Assembly / Ethics",
        isManualOverride: true,
      };

      const result = generateDeterministicSchedule({
        workingDays: [1, 2, 3, 4, 5, 6],
        instructionPeriodsPerDay: 6,
        subjects: sampleSubjects,
        existingSlots: [manualSlot],
      });

      expect(result.slots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            dayOfWeek: 1,
            periodNumber: 1,
            subjectId: "manual-sub",
            isManualOverride: true,
          }),
        ])
      );
    });
  });

  describe("3. Timetable Concurrency Clash Detection", () => {
    it("should detect teacher double-booking at the same time across different classes", () => {
      const slots = [
        {
          dayOfWeek: 1,
          periodNumber: 2,
          classId: "class-10A",
          teacherId: "teacher-john",
        },
        {
          dayOfWeek: 1,
          periodNumber: 2,
          classId: "class-9B",
          teacherId: "teacher-john", // Same teacher, same time!
        },
      ];

      const clashes = checkScheduleClashes(slots);
      expect(clashes.length).toBe(1);
      expect(clashes[0]?.type).toBe("TEACHER_DOUBLE_BOOKING");
      expect(clashes[0]?.conflictingEntityId).toBe("teacher-john");
    });

    it("should detect room overlap at the same time across different classes", () => {
      const slots = [
        {
          dayOfWeek: 2,
          periodNumber: 4,
          classId: "class-10A",
          roomId: "science-lab-1",
        },
        {
          dayOfWeek: 2,
          periodNumber: 4,
          classId: "class-11B",
          roomId: "science-lab-1", // Same room, same time!
        },
      ];

      const clashes = checkScheduleClashes(slots);
      expect(clashes.length).toBe(1);
      expect(clashes[0]?.type).toBe("ROOM_OVERLAP");
      expect(clashes[0]?.conflictingEntityId).toBe("science-lab-1");
    });

    it("should report zero clashes when assignments do not conflict", () => {
      const slots = [
        {
          dayOfWeek: 1,
          periodNumber: 1,
          classId: "class-10A",
          teacherId: "teacher-john",
          roomId: "room-101",
        },
        {
          dayOfWeek: 1,
          periodNumber: 2,
          classId: "class-10A",
          teacherId: "teacher-john", // Same teacher, different period -> OK
          roomId: "room-101",
        },
        {
          dayOfWeek: 1,
          periodNumber: 1,
          classId: "class-9B",
          teacherId: "teacher-sarah", // Different teacher, same period -> OK
          roomId: "room-102",        // Different room -> OK
        },
      ];

      const clashes = checkScheduleClashes(slots);
      expect(clashes.length).toBe(0);
    });
  });
});
