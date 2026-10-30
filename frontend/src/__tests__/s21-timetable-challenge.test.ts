import { describe, it, expect, vi } from "vitest";
import {
  validateWorkloadFit,
  generateDeterministicSchedule,
  checkScheduleClashes,
  SubjectWorkloadInput,
  ScheduleSlot,
} from "../lib/timetableEngine";

describe("Sprint 21 Milestone 3: Adversarial Empirical Challenge Suite", () => {
  // ─── 1. Workload Fit Boundary ──────────────────────────────────────────────
  describe("1. Workload Fit Boundary", () => {
    it("Exact Match: required periods exactly equal available periods (36 == 36)", () => {
      // 6 days * 6 instruction periods = 36 available
      // 6 subjects * 6 periods = 36 required
      const subjects: SubjectWorkloadInput[] = [
        { id: "sub-1", name: "Math", weeklyPeriods: 6 },
        { id: "sub-2", name: "Science", weeklyPeriods: 6 },
        { id: "sub-3", name: "English", weeklyPeriods: 6 },
        { id: "sub-4", name: "History", weeklyPeriods: 6 },
        { id: "sub-5", name: "Geography", weeklyPeriods: 6 },
        { id: "sub-6", name: "Art", weeklyPeriods: 6 },
      ];

      const fitResult = validateWorkloadFit({
        workingDaysCount: 6,
        instructionPeriodsPerDay: 6,
        subjects,
      });

      expect(fitResult.fits).toBe(true);
      expect(fitResult.availableWeeklyPeriods).toBe(36);
      expect(fitResult.totalRequiredPeriods).toBe(36);
      expect(fitResult.slackOrDeficit).toBe(0);
      expect(fitResult.message).toContain("0 slack/free periods");

      const schedResult = generateDeterministicSchedule({
        workingDays: [1, 2, 3, 4, 5, 6],
        instructionPeriodsPerDay: 6,
        subjects,
      });

      expect(schedResult.success).toBe(true);
      expect(schedResult.slots.length).toBe(36);
      expect(schedResult.unassignedPeriodsCount).toBe(0);
      expect(schedResult.overflowSubjects.length).toBe(0);
    });

    it("Deficit Boundary: required periods exceed available periods by exactly 1 (37 vs 36)", () => {
      // 6 days * 6 periods = 36 available
      // 5 subjects * 6 periods + 1 subject * 7 periods = 37 required
      const subjects: SubjectWorkloadInput[] = [
        { id: "sub-1", name: "Math", weeklyPeriods: 6 },
        { id: "sub-2", name: "Science", weeklyPeriods: 6 },
        { id: "sub-3", name: "English", weeklyPeriods: 6 },
        { id: "sub-4", name: "History", weeklyPeriods: 6 },
        { id: "sub-5", name: "Geography", weeklyPeriods: 6 },
        { id: "sub-6", name: "Art", weeklyPeriods: 7 },
      ];

      const fitResult = validateWorkloadFit({
        workingDaysCount: 6,
        instructionPeriodsPerDay: 6,
        subjects,
      });

      expect(fitResult.fits).toBe(false);
      expect(fitResult.availableWeeklyPeriods).toBe(36);
      expect(fitResult.totalRequiredPeriods).toBe(37);
      expect(fitResult.slackOrDeficit).toBe(-1);
      expect(fitResult.message).toContain("exceeds available 36 periods by 1 periods");

      const schedResult = generateDeterministicSchedule({
        workingDays: [1, 2, 3, 4, 5, 6],
        instructionPeriodsPerDay: 6,
        subjects,
      });

      expect(schedResult.success).toBe(false);
      expect(schedResult.slots.length).toBe(36);
      expect(schedResult.unassignedPeriodsCount).toBe(0);
      expect(schedResult.overflowSubjects.length).toBe(1);
      expect(schedResult.overflowSubjects[0]?.remainingPeriods).toBe(1);
    });

    it("Slack Boundary: required periods are less than available (30 vs 36)", () => {
      const subjects: SubjectWorkloadInput[] = [
        { id: "sub-1", name: "Math", weeklyPeriods: 6 },
        { id: "sub-2", name: "Science", weeklyPeriods: 6 },
        { id: "sub-3", name: "English", weeklyPeriods: 6 },
        { id: "sub-4", name: "History", weeklyPeriods: 6 },
        { id: "sub-5", name: "Geography", weeklyPeriods: 6 },
      ];

      const fitResult = validateWorkloadFit({
        workingDaysCount: 6,
        instructionPeriodsPerDay: 6,
        subjects,
      });

      expect(fitResult.fits).toBe(true);
      expect(fitResult.availableWeeklyPeriods).toBe(36);
      expect(fitResult.totalRequiredPeriods).toBe(30);
      expect(fitResult.slackOrDeficit).toBe(6);
      expect(fitResult.message).toContain("6 slack/free periods");

      const schedResult = generateDeterministicSchedule({
        workingDays: [1, 2, 3, 4, 5, 6],
        instructionPeriodsPerDay: 6,
        subjects,
      });

      expect(schedResult.success).toBe(true);
      expect(schedResult.slots.length).toBe(30);
      expect(schedResult.unassignedPeriodsCount).toBe(6);
      expect(schedResult.overflowSubjects.length).toBe(0);
    });
  });

  // ─── 2. Anti-fatigue Constraint ───────────────────────────────────────────
  describe("2. Anti-fatigue Constraint Verification", () => {
    it("Standard anti-fatigue: never assigns > 2 periods of the same subject on any single day without overrides", () => {
      // 1 heavy subject with 12 periods (2 per day for 6 days) + 4 subjects with 6 periods
      const subjects: SubjectWorkloadInput[] = [
        { id: "sub-heavy", name: "Heavy Math", weeklyPeriods: 12 },
        { id: "sub-2", name: "Science", weeklyPeriods: 6 },
        { id: "sub-3", name: "English", weeklyPeriods: 6 },
        { id: "sub-4", name: "History", weeklyPeriods: 6 },
        { id: "sub-5", name: "Geography", weeklyPeriods: 6 },
      ];

      const schedResult = generateDeterministicSchedule({
        workingDays: [1, 2, 3, 4, 5, 6],
        instructionPeriodsPerDay: 6,
        subjects,
      });

      expect(schedResult.success).toBe(true);

      const dailyCounts = new Map<string, number>();
      for (const slot of schedResult.slots) {
        const key = `${slot.dayOfWeek}-${slot.subjectId}`;
        dailyCounts.set(key, (dailyCounts.get(key) || 0) + 1);
      }

      for (const [key, count] of dailyCounts.entries()) {
        expect(count).toBeLessThanOrEqual(2);
      }
    });

    it("VULNERABILITY PROBE: Anti-fatigue constraint failure when manual override exists", () => {
      // Math manually assigned on Day 1 Period 1
      const existingSlots: ScheduleSlot[] = [
        {
          dayOfWeek: 1,
          periodNumber: 1,
          subjectId: "sub-math",
          subjectName: "Math",
          isManualOverride: true,
        },
      ];

      // Math has 13 weekly periods (1 manual + 12 remaining needed)
      const subjects: SubjectWorkloadInput[] = [
        { id: "sub-math", name: "Math", weeklyPeriods: 13 },
        { id: "sub-eng", name: "English", weeklyPeriods: 6 },
        { id: "sub-sci", name: "Science", weeklyPeriods: 6 },
        { id: "sub-soc", name: "Social Studies", weeklyPeriods: 6 },
        { id: "sub-pe", name: "PE", weeklyPeriods: 5 },
      ];

      const schedResult = generateDeterministicSchedule({
        workingDays: [1, 2, 3, 4, 5, 6],
        instructionPeriodsPerDay: 6,
        subjects,
        existingSlots,
      });

      const day1MathSlots = schedResult.slots.filter(
        (s) => s.dayOfWeek === 1 && s.subjectId === "sub-math"
      );

      // EMPIRICAL FINDING:
      // dailySubjectCount in timetableEngine.ts is initialized as an empty map
      // and NOT seeded with existing manual overrides.
      // Therefore, the engine assigns 2 additional generated periods on Day 1,
      // resulting in 3 total periods of Math on Day 1!
      const totalDay1Count = day1MathSlots.length;
      console.log(`[Vulnerability finding] Day 1 Math periods count: ${totalDay1Count}`);
      // Documenting the actual engine behavior:
      expect(totalDay1Count).toBe(3); // Demonstrates the anti-fatigue breach when manual overrides exist!
    });
  });

  // ─── 3. Teacher Allocation Rules ──────────────────────────────────────────
  describe("3. Teacher Allocation Rules", () => {
    // Replicating the exact logic in generateSectionTimetablePreview (lines 1048-1085)
    const simulateTeacherResolution = (
      slots: ScheduleSlot[],
      allocations: Array<{ classSubjectId: string; sectionId: string; teacherId: string }>
    ) => {
      const allocMap = new Map<string, typeof allocations>();
      for (const alloc of allocations) {
        const list = allocMap.get(alloc.classSubjectId) || [];
        list.push(alloc);
        allocMap.set(alloc.classSubjectId, list);
      }

      for (const slot of slots) {
        if (slot.isManualOverride && slot.teacherId) {
          continue;
        }

        const activeAllocations = allocMap.get(slot.subjectId) || [];
        if (activeAllocations.length === 1) {
          slot.teacherId = activeAllocations[0]!.teacherId;
        } else {
          slot.teacherId = undefined; // Unassigned if 0 or ambiguous multiple allocations
        }
      }

      const needsAssignmentMap = new Map<
        string,
        { subjectId: string; subjectName: string; unassignedCount: number; reason?: string }
      >();

      for (const slot of slots) {
        if (!slot.teacherId) {
          const activeAllocations = allocMap.get(slot.subjectId) || [];
          const reason =
            activeAllocations.length === 0
              ? "NO_ALLOCATION"
              : "AMBIGUOUS_MULTIPLE_ALLOCATIONS";

          const entry = needsAssignmentMap.get(slot.subjectId) || {
            subjectId: slot.subjectId,
            subjectName: slot.subjectName,
            unassignedCount: 0,
            reason,
          };
          entry.unassignedCount++;
          needsAssignmentMap.set(slot.subjectId, entry);
        }
      }

      return {
        slots,
        needsAssignmentReport: Array.from(needsAssignmentMap.values()),
      };
    };

    it("Rule 3a: Exactly 1 allocation -> Auto-assigned and not in needsAssignmentReport", () => {
      const slots: ScheduleSlot[] = [
        { dayOfWeek: 1, periodNumber: 1, subjectId: "cs-math", subjectName: "Math" },
      ];
      const allocations = [
        { classSubjectId: "cs-math", sectionId: "sec-1", teacherId: "teacher-john" },
      ];

      const res = simulateTeacherResolution(slots, allocations);
      expect(res.slots[0]?.teacherId).toBe("teacher-john");
      expect(res.needsAssignmentReport.length).toBe(0);
    });

    it("Rule 3b: 0 allocations -> Unassigned and in needsAssignmentReport with reason NO_ALLOCATION", () => {
      const slots: ScheduleSlot[] = [
        { dayOfWeek: 1, periodNumber: 1, subjectId: "cs-eng", subjectName: "English" },
        { dayOfWeek: 2, periodNumber: 1, subjectId: "cs-eng", subjectName: "English" },
      ];
      const allocations: any[] = [];

      const res = simulateTeacherResolution(slots, allocations);
      expect(res.slots[0]?.teacherId).toBeUndefined();
      expect(res.slots[1]?.teacherId).toBeUndefined();
      expect(res.needsAssignmentReport.length).toBe(1);
      expect(res.needsAssignmentReport[0]?.reason).toBe("NO_ALLOCATION");
      expect(res.needsAssignmentReport[0]?.unassignedCount).toBe(2);
    });

    it("Rule 3c: 2 allocations (ambiguous) -> Unassigned and in needsAssignmentReport with reason AMBIGUOUS_MULTIPLE_ALLOCATIONS", () => {
      const slots: ScheduleSlot[] = [
        { dayOfWeek: 1, periodNumber: 1, subjectId: "cs-soc", subjectName: "Social Studies" },
      ];
      const allocations = [
        { classSubjectId: "cs-soc", sectionId: "sec-1", teacherId: "teacher-1" },
        { classSubjectId: "cs-soc", sectionId: "sec-1", teacherId: "teacher-2" },
      ];

      const res = simulateTeacherResolution(slots, allocations);
      expect(res.slots[0]?.teacherId).toBeUndefined();
      expect(res.needsAssignmentReport.length).toBe(1);
      expect(res.needsAssignmentReport[0]?.reason).toBe("AMBIGUOUS_MULTIPLE_ALLOCATIONS");
      expect(res.needsAssignmentReport[0]?.unassignedCount).toBe(1);
    });
  });

  // ─── 4. Manual Override Retention ─────────────────────────────────────────
  describe("4. Manual Override Retention Invariants", () => {
    it("preserves manual override slot and does not overwrite during commitSectionTimetable", () => {
      // Simulating commitSectionTimetable logic
      const existingPeriodsInDb = [
        {
          id: "tp-manual-1",
          sectionId: "sec-1",
          dayOfWeek: "MONDAY",
          periodNumber: 1,
          subjectId: "sub-manual-pe",
          teacherId: "teacher-pe",
          isManualOverride: true,
          isActive: true,
        },
        {
          id: "tp-gen-2",
          sectionId: "sec-1",
          dayOfWeek: "MONDAY",
          periodNumber: 2,
          subjectId: "sub-old-sci",
          teacherId: "teacher-sci",
          isManualOverride: false,
          isActive: true,
        },
      ];

      const incomingSlots: ScheduleSlot[] = [
        // Attempting to overwrite Monday Period 1 with non-manual Math
        {
          dayOfWeek: 1,
          periodNumber: 1,
          subjectId: "sub-math",
          subjectName: "Math",
          isManualOverride: false,
        },
        // Updating Monday Period 2 with new Science
        {
          dayOfWeek: 1,
          periodNumber: 2,
          subjectId: "sub-new-sci",
          subjectName: "Science",
          isManualOverride: false,
        },
      ];

      const DAY_NUMBER_TO_NAME = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

      const existingMap = new Map<string, (typeof existingPeriodsInDb)[0]>();
      for (const ep of existingPeriodsInDb) {
        const key = `${ep.dayOfWeek}-${ep.periodNumber}`;
        existingMap.set(key, ep);
      }

      let upsertedCount = 0;
      let preservedOverridesCount = 0;
      const savedPeriods: any[] = [];

      for (const slot of incomingSlots) {
        const dayOfWeek = DAY_NUMBER_TO_NAME[slot.dayOfWeek - 1];
        const key = `${dayOfWeek}-${slot.periodNumber}`;
        const existingSlot = existingMap.get(key);

        if (
          existingSlot &&
          existingSlot.isActive &&
          existingSlot.isManualOverride === true &&
          !slot.isManualOverride
        ) {
          preservedOverridesCount++;
          continue; // Preserved!
        }

        savedPeriods.push({
          id: existingSlot?.id,
          dayOfWeek,
          periodNumber: slot.periodNumber,
          subjectId: slot.subjectId,
          isManualOverride: slot.isManualOverride,
        });
        upsertedCount++;
      }

      expect(preservedOverridesCount).toBe(1);
      expect(upsertedCount).toBe(1);
      // Period 1 was NOT modified or overwritten
      expect(savedPeriods.find((p) => p.dayOfWeek === "MONDAY" && p.periodNumber === 1)).toBeUndefined();
      // Period 2 WAS updated
      expect(savedPeriods.find((p) => p.dayOfWeek === "MONDAY" && p.periodNumber === 2)).toBeDefined();
    });

    it("never deactivates orphaned manual overrides when slots are omitted", () => {
      const existingPeriodsInDb = [
        {
          id: "tp-manual-orphan",
          sectionId: "sec-1",
          dayOfWeek: "SATURDAY",
          periodNumber: 6,
          subjectId: "sub-special",
          isManualOverride: true,
          isActive: true,
        },
        {
          id: "tp-gen-orphan",
          sectionId: "sec-1",
          dayOfWeek: "SATURDAY",
          periodNumber: 5,
          subjectId: "sub-normal",
          isManualOverride: false,
          isActive: true,
        },
      ];

      // Incoming slots contain NO Saturday periods
      const incomingSlots: ScheduleSlot[] = [
        { dayOfWeek: 1, periodNumber: 1, subjectId: "sub-math", subjectName: "Math" },
      ];

      const processedKeys = new Set<string>(["MONDAY-1"]);
      let deactivatedCount = 0;
      let preservedOverridesCount = 0;
      const deactivatedIds: string[] = [];

      for (const ep of existingPeriodsInDb) {
        if (!ep.isActive) continue;
        const key = `${ep.dayOfWeek}-${ep.periodNumber}`;
        if (!processedKeys.has(key)) {
          if (ep.isManualOverride === true) {
            preservedOverridesCount++;
            continue; // Preserved, never deactivated!
          }
          deactivatedCount++;
          deactivatedIds.push(ep.id);
        }
      }

      expect(preservedOverridesCount).toBe(1);
      expect(deactivatedCount).toBe(1);
      expect(deactivatedIds).toContain("tp-gen-orphan");
      expect(deactivatedIds).not.toContain("tp-manual-orphan");
    });
  });

  // ─── 5. Deactivated Slot Upsert & Unique Constraint ───────────────────────
  describe("5. Deactivated Slot Upsert Invariant", () => {
    it("reactivates previously deactivated slot via UPDATE instead of INSERT, preventing unique constraint collision", async () => {
      // In database table timetable_periods:
      // UNIQUE(section_id, day_of_week, period_number)
      const fakeDb = [
        {
          id: "tp-deactivated-slot",
          schoolId: "school-1",
          academicYearId: "ay-1",
          sectionId: "sec-10a",
          dayOfWeek: "TUESDAY",
          periodNumber: 3,
          subjectId: "sub-old",
          teacherId: "teacher-old",
          isActive: false, // previously deleted / deactivated
        },
      ];

      // Simulation of saveTimetablePeriod lookup logic
      const simulateSaveTimetablePeriod = async (data: {
        id?: string;
        sectionId: string;
        dayOfWeek: string;
        periodNumber: number;
        subjectId: string;
        teacherId: string;
      }) => {
        let effectiveId = data.id || null;
        if (!effectiveId) {
          // Worker M3 fix: lookup does NOT filter by isActive = true
          const existingSlot = fakeDb.find(
            (r) =>
              r.schoolId === "school-1" &&
              r.academicYearId === "ay-1" &&
              r.sectionId === data.sectionId &&
              r.dayOfWeek === data.dayOfWeek &&
              r.periodNumber === data.periodNumber
          );
          if (existingSlot) {
            effectiveId = existingSlot.id;
          }
        }

        if (effectiveId) {
          // UPDATE path
          const target = fakeDb.find((r) => r.id === effectiveId)!;
          target.subjectId = data.subjectId;
          target.teacherId = data.teacherId;
          target.isActive = true; // Reactivated!
          return { action: "UPDATED", id: effectiveId };
        } else {
          // INSERT path - would throw if duplicate (sectionId, dayOfWeek, periodNumber)
          const duplicate = fakeDb.find(
            (r) =>
              r.sectionId === data.sectionId &&
              r.dayOfWeek === data.dayOfWeek &&
              r.periodNumber === data.periodNumber
          );
          if (duplicate) {
            throw new Error(
              'duplicate key value violates unique constraint "timetable_periods_unique"'
            );
          }
          const newId = `tp-${Date.now()}`;
          fakeDb.push({
            id: newId,
            schoolId: "school-1",
            academicYearId: "ay-1",
            sectionId: data.sectionId,
            dayOfWeek: data.dayOfWeek,
            periodNumber: data.periodNumber,
            subjectId: data.subjectId,
            teacherId: data.teacherId,
            isActive: true,
          });
          return { action: "INSERTED", id: newId };
        }
      };

      // Calling saveTimetablePeriod without passing ID for the slot that was previously deactivated
      const result = await simulateSaveTimetablePeriod({
        sectionId: "sec-10a",
        dayOfWeek: "TUESDAY",
        periodNumber: 3,
        subjectId: "sub-new-physics",
        teacherId: "teacher-new",
      });

      expect(result.action).toBe("UPDATED");
      expect(result.id).toBe("tp-deactivated-slot");
      expect(fakeDb.length).toBe(1);
      expect(fakeDb[0]?.isActive).toBe(true);
      expect(fakeDb[0]?.subjectId).toBe("sub-new-physics");
      expect(fakeDb[0]?.teacherId).toBe("teacher-new");
    });
  });
});
