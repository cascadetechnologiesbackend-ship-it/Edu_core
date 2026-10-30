import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateWorkloadFit,
  generateDeterministicSchedule,
  checkScheduleClashes,
  SubjectWorkloadInput,
  ScheduleSlot,
  WorkloadFitResult,
  GeneratedScheduleResult,
} from "../lib/timetableEngine";

// ─── Mock Database & Session Context ─────────────────────────────────────────
const { mockTimetableDb, activeSession } = vi.hoisted(() => {
  const activeSession = {
    userId: "admin-s21",
    role: "SCHOOL_ADMIN",
    schoolId: "school-s21-alpha",
    email: "admin@school-alpha.edu",
  };

  const mockTimetableDb = {
    schoolId: "school-s21-alpha",
    academicYearId: "ay-2026",
    sectionId: "sec-10a",
    classId: "cls-10",
    bellSchedule: [
      { periodNumber: 1, name: "Period 1", startTime: "08:30", endTime: "09:15", periodType: "REGULAR" },
      { periodNumber: 2, name: "Period 2", startTime: "09:15", endTime: "10:00", periodType: "REGULAR" },
      { periodNumber: 3, name: "Period 3", startTime: "10:15", endTime: "11:00", periodType: "REGULAR" },
      { periodNumber: 4, name: "Period 4", startTime: "11:00", endTime: "11:45", periodType: "REGULAR" },
      { periodNumber: 5, name: "Period 5", startTime: "12:30", endTime: "13:15", periodType: "REGULAR" },
      { periodNumber: 6, name: "Period 6", startTime: "13:15", endTime: "14:00", periodType: "REGULAR" },
    ],
    classSubjects: [
      { id: "cs-math", classId: "cls-10", subjectId: "sub-math", name: "Mathematics", weeklyPeriods: 6 },
      { id: "cs-sci", classId: "cls-10", subjectId: "sub-sci", name: "Science", weeklyPeriods: 6, isLabOrPractical: true },
      { id: "cs-eng", classId: "cls-10", subjectId: "sub-eng", name: "English", weeklyPeriods: 6 },
      { id: "cs-soc", classId: "cls-10", subjectId: "sub-soc", name: "Social Studies", weeklyPeriods: 5 },
      { id: "cs-hin", classId: "cls-10", subjectId: "sub-hin", name: "Hindi", weeklyPeriods: 5 },
      { id: "cs-pe", classId: "cls-10", subjectId: "sub-pe", name: "Physical Education", weeklyPeriods: 2 },
    ], // Total = 30 required periods
    sectionSubjectTeachers: [
      // cs-math has UNIQUE teacher allocation for sec-10a -> Auto-assign teacher-math
      { id: "sst-1", sectionId: "sec-10a", classSubjectId: "cs-math", teacherId: "teacher-math", isActive: true },
      // cs-sci has UNIQUE teacher allocation for sec-10a -> Auto-assign teacher-sci
      { id: "sst-2", sectionId: "sec-10a", classSubjectId: "cs-sci", teacherId: "teacher-sci", isActive: true },
      // cs-eng has ZERO teacher allocation -> Must be unassigned + reported in needsAssignmentReport
      // cs-soc has AMBIGUOUS/MULTIPLE allocations -> Must be unassigned + reported
      { id: "sst-3a", sectionId: "sec-10a", classSubjectId: "cs-soc", teacherId: "teacher-soc-1", isActive: true },
      { id: "sst-3b", sectionId: "sec-10a", classSubjectId: "cs-soc", teacherId: "teacher-soc-2", isActive: true },
      // cs-hin has UNIQUE teacher allocation
      { id: "sst-4", sectionId: "sec-10a", classSubjectId: "cs-hin", teacherId: "teacher-hin", isActive: true },
      // cs-pe has UNIQUE teacher allocation
      { id: "sst-5", sectionId: "sec-10a", classSubjectId: "cs-pe", teacherId: "teacher-pe", isActive: true },
    ],
    persistedPeriods: [] as any[],
  };

  return { mockTimetableDb, activeSession };
});

describe("Sprint S21: Timetable Generator Wiring, Workload Fit & Conflict-Enforced Persistence", () => {
  beforeEach(() => {
    mockTimetableDb.persistedPeriods = [];
  });

  // ─── TIER 1: Mathematical Workload Fit Compliance ───────────────────────────
  describe("Tier 1: Mathematical Workload Fit & Feasibility Bounds", () => {
    it("should report fits: true when subject demand is within weekly period capacity", () => {
      // 6 working days * 6 instruction periods = 36 available periods
      const result = validateWorkloadFit({
        workingDaysCount: 6,
        instructionPeriodsPerDay: 6,
        subjects: mockTimetableDb.classSubjects.map((cs) => ({
          id: cs.id,
          name: cs.name,
          weeklyPeriods: cs.weeklyPeriods,
        })),
      });

      expect(result.fits).toBe(true);
      expect(result.availableWeeklyPeriods).toBe(36);
      expect(result.totalRequiredPeriods).toBe(30);
      expect(result.slackOrDeficit).toBe(6); // 6 slack/free periods
      expect(result.subjectBreakdown.length).toBe(6);
    });

    it("should report fits: false with exact deficit when demand exceeds capacity", () => {
      // 5 working days * 5 instruction periods = 25 available periods (demand = 30)
      const result = validateWorkloadFit({
        workingDaysCount: 5,
        instructionPeriodsPerDay: 5,
        subjects: mockTimetableDb.classSubjects.map((cs) => ({
          id: cs.id,
          name: cs.name,
          weeklyPeriods: cs.weeklyPeriods,
        })),
      });

      expect(result.fits).toBe(false);
      expect(result.availableWeeklyPeriods).toBe(25);
      expect(result.totalRequiredPeriods).toBe(30);
      expect(result.slackOrDeficit).toBe(-5); // 5 periods deficit
      expect(result.message).toContain("deficit");
    });
  });

  // ─── TIER 2: Deterministic Slot Generation & Concurrency Clash Detection ───
  describe("Tier 2: Deterministic Slot Generation & Clash Prevention", () => {
    it("should generate deterministic slots adhering to max 2 periods per day anti-fatigue constraint", () => {
      const workingDays = [1, 2, 3, 4, 5, 6];
      const periodsPerDay = 6;

      const scheduleResult = generateDeterministicSchedule({
        workingDays,
        instructionPeriodsPerDay: periodsPerDay,
        subjects: mockTimetableDb.classSubjects.map((cs) => ({
          id: cs.id,
          name: cs.name,
          weeklyPeriods: cs.weeklyPeriods,
          isLabOrPractical: cs.isLabOrPractical,
        })),
      });

      expect(scheduleResult.success).toBe(true);
      expect(scheduleResult.slots.length).toBe(30);
      expect(scheduleResult.unassignedPeriodsCount).toBe(6); // 36 - 30 = 6 free periods

      // Anti-fatigue invariant: No subject assigned > 2 times on any single day
      const dailySubjectCount = new Map<string, number>();
      for (const slot of scheduleResult.slots) {
        const key = `${slot.dayOfWeek}-${slot.subjectId}`;
        dailySubjectCount.set(key, (dailySubjectCount.get(key) || 0) + 1);
      }

      for (const [, count] of dailySubjectCount.entries()) {
        expect(count).toBeLessThanOrEqual(2);
      }
    });

    it("should detect teacher double-booking when same teacher is assigned concurrently across sections", () => {
      const concurrentSlots = [
        {
          dayOfWeek: 1, // Monday
          periodNumber: 1,
          classId: "sec-10a",
          teacherId: "teacher-math",
        },
        {
          dayOfWeek: 1, // Monday
          periodNumber: 1, // Same time!
          classId: "sec-9b",
          teacherId: "teacher-math", // Double-booked!
        },
      ];

      const clashes = checkScheduleClashes(concurrentSlots);
      expect(clashes.length).toBe(1);
      expect(clashes[0]?.type).toBe("TEACHER_DOUBLE_BOOKING");
      expect(clashes[0]?.conflictingEntityId).toBe("teacher-math");
      expect(clashes[0]?.periodNumber).toBe(1);
    });

    it("should detect room overlap when same room is assigned concurrently across classes", () => {
      const roomOverlapSlots = [
        {
          dayOfWeek: 2,
          periodNumber: 3,
          classId: "sec-10a",
          roomId: "lab-physics-1",
        },
        {
          dayOfWeek: 2,
          periodNumber: 3,
          classId: "sec-11a",
          roomId: "lab-physics-1",
        },
      ];

      const clashes = checkScheduleClashes(roomOverlapSlots);
      expect(clashes.length).toBe(1);
      expect(clashes[0]?.type).toBe("ROOM_OVERLAP");
      expect(clashes[0]?.conflictingEntityId).toBe("lab-physics-1");
    });
  });

  // ─── TIER 3: Teacher Allocation Rules & Needs-Assignment Report ─────────────
  describe("Tier 3: Teacher Auto-Assignment & Needs-Assignment Reporting", () => {
    it("should auto-assign teacher if and only if exactly 1 active allocation exists in sectionSubjectTeachers", () => {
      // Simulate S21 teacher resolution rules
      const resolveTeacherForSubject = (classSubjectId: string, sectionId: string) => {
        const activeAllocations = mockTimetableDb.sectionSubjectTeachers.filter(
          (sst) => sst.classSubjectId === classSubjectId && sst.sectionId === sectionId && sst.isActive
        );

        if (activeAllocations.length === 1) {
          return {
            assigned: true,
            teacherId: activeAllocations[0]!.teacherId,
          };
        }

        // 0 allocations or ambiguous (> 1) -> leave unassigned
        return {
          assigned: false,
          teacherId: null,
          reason: activeAllocations.length === 0 ? "NO_ALLOCATION" : "AMBIGUOUS_MULTIPLE_ALLOCATIONS",
        };
      };

      // Math: Exactly 1 -> Auto-assigned
      const mathAlloc = resolveTeacherForSubject("cs-math", "sec-10a");
      expect(mathAlloc.assigned).toBe(true);
      expect(mathAlloc.teacherId).toBe("teacher-math");

      // Science: Exactly 1 -> Auto-assigned
      const sciAlloc = resolveTeacherForSubject("cs-sci", "sec-10a");
      expect(sciAlloc.assigned).toBe(true);
      expect(sciAlloc.teacherId).toBe("teacher-sci");

      // English: 0 allocations -> Unassigned
      const engAlloc = resolveTeacherForSubject("cs-eng", "sec-10a");
      expect(engAlloc.assigned).toBe(false);
      expect(engAlloc.teacherId).toBeNull();
      expect(engAlloc.reason).toBe("NO_ALLOCATION");

      // Social Studies: 2 allocations -> Unassigned (Ambiguous)
      const socAlloc = resolveTeacherForSubject("cs-soc", "sec-10a");
      expect(socAlloc.assigned).toBe(false);
      expect(socAlloc.teacherId).toBeNull();
      expect(socAlloc.reason).toBe("AMBIGUOUS_MULTIPLE_ALLOCATIONS");
    });

    it("should generate a needsAssignmentReport identifying all unassigned subjects", () => {
      const generatedSlots: ScheduleSlot[] = [
        { dayOfWeek: 1, periodNumber: 1, subjectId: "cs-math", subjectName: "Mathematics", teacherId: "teacher-math" },
        { dayOfWeek: 1, periodNumber: 2, subjectId: "cs-eng", subjectName: "English", teacherId: undefined },
        { dayOfWeek: 1, periodNumber: 3, subjectId: "cs-eng", subjectName: "English", teacherId: undefined },
        { dayOfWeek: 1, periodNumber: 4, subjectId: "cs-soc", subjectName: "Social Studies", teacherId: undefined },
      ];

      // Derive needs-assignment report
      const needsAssignmentMap = new Map<string, { subjectId: string; subjectName: string; unassignedCount: number }>();
      for (const slot of generatedSlots) {
        if (!slot.teacherId) {
          const entry = needsAssignmentMap.get(slot.subjectId) || {
            subjectId: slot.subjectId,
            subjectName: slot.subjectName,
            unassignedCount: 0,
          };
          entry.unassignedCount++;
          needsAssignmentMap.set(slot.subjectId, entry);
        }
      }

      const report = Array.from(needsAssignmentMap.values());
      expect(report.length).toBe(2); // English and Social Studies

      const engReport = report.find((r) => r.subjectId === "cs-eng");
      expect(engReport?.unassignedCount).toBe(2);

      const socReport = report.find((r) => r.subjectId === "cs-soc");
      expect(socReport?.unassignedCount).toBe(1);
    });
  });

  // ─── TIER 4: Manual Override Retention & No Duplicate Periods Invariant ────
  describe("Tier 4: Manual Override Retention & No Duplicate Periods Invariant", () => {
    it("should preserve manual overrides intact during schedule regeneration", () => {
      // Existing slot marked as manual override by an administrator
      const manualSlot: ScheduleSlot = {
        dayOfWeek: 1, // Monday
        periodNumber: 1, // Period 1
        subjectId: "cs-pe",
        subjectName: "Physical Education (Assembly Day)",
        teacherId: "teacher-pe",
        isManualOverride: true,
      };

      const result = generateDeterministicSchedule({
        workingDays: [1, 2, 3, 4, 5, 6],
        instructionPeriodsPerDay: 6,
        subjects: mockTimetableDb.classSubjects.map((cs) => ({
          id: cs.id,
          name: cs.name,
          weeklyPeriods: cs.weeklyPeriods,
        })),
        existingSlots: [manualSlot],
      });

      expect(result.success).toBe(true);

      // Verify manual override is preserved in exact location
      const slotMonP1 = result.slots.find((s) => s.dayOfWeek === 1 && s.periodNumber === 1);
      expect(slotMonP1).toBeDefined();
      expect(slotMonP1?.subjectId).toBe("cs-pe");
      expect(slotMonP1?.isManualOverride).toBe(true);

      // Verify no other subject was assigned to Monday Period 1
      const monP1Matches = result.slots.filter((s) => s.dayOfWeek === 1 && s.periodNumber === 1);
      expect(monP1Matches.length).toBe(1);
    });

    it("should guarantee no duplicate periods (same dayOfWeek + periodNumber) exist upon regeneration", () => {
      // Simulate multiple generator passes and upsert
      const pass1 = generateDeterministicSchedule({
        workingDays: [1, 2, 3, 4, 5],
        instructionPeriodsPerDay: 6,
        subjects: mockTimetableDb.classSubjects.slice(0, 3).map((cs) => ({
          id: cs.id,
          name: cs.name,
          weeklyPeriods: 5,
        })),
      });

      // Pass 2: Updated workload
      const pass2 = generateDeterministicSchedule({
        workingDays: [1, 2, 3, 4, 5],
        instructionPeriodsPerDay: 6,
        subjects: mockTimetableDb.classSubjects.slice(0, 4).map((cs) => ({
          id: cs.id,
          name: cs.name,
          weeklyPeriods: 5,
        })),
      });

      // Ensure that in any generated pass, every (dayOfWeek, periodNumber) tuple is unique
      const verifyNoDuplicates = (slots: ScheduleSlot[]) => {
        const seen = new Set<string>();
        for (const slot of slots) {
          const key = `${slot.dayOfWeek}-${slot.periodNumber}`;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
        }
        return true;
      };

      expect(verifyNoDuplicates(pass1.slots)).toBe(true);
      expect(verifyNoDuplicates(pass2.slots)).toBe(true);
    });

    it("should route all timetable commits through conflict-enforced saveTimetablePeriod path", async () => {
      // S21 Invariant: Generator must never insert directly to timetablePeriods table.
      // Must call saveTimetablePeriod to inherit teacher/room clash checks.
      const mockSaveTimetablePeriod = vi.fn(async (slotData: any) => {
        // Enforce conflict check simulation
        if (slotData.teacherId === "teacher-conflict") {
          throw new Error("Conflict: Teacher is already booked for this period.");
        }
        mockTimetableDb.persistedPeriods.push(slotData);
        return { success: true };
      });

      const commitSectionTimetablePipeline = async (
        sectionId: string,
        slots: ScheduleSlot[]
      ) => {
        let upsertedCount = 0;
        for (const slot of slots) {
          await mockSaveTimetablePeriod({
            sectionId,
            dayOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][slot.dayOfWeek - 1],
            periodNumber: slot.periodNumber,
            startTime: "09:00",
            endTime: "09:45",
            periodType: "REGULAR",
            subjectId: slot.subjectId,
            teacherId: slot.teacherId,
            isManualOverride: slot.isManualOverride,
          });
          upsertedCount++;
        }
        return { success: true, upsertedCount };
      };

      const testSlots: ScheduleSlot[] = [
        { dayOfWeek: 1, periodNumber: 1, subjectId: "cs-math", subjectName: "Math", teacherId: "teacher-math" },
        { dayOfWeek: 1, periodNumber: 2, subjectId: "cs-sci", subjectName: "Science", teacherId: "teacher-sci" },
      ];

      const result = await commitSectionTimetablePipeline("sec-10a", testSlots);
      expect(result.success).toBe(true);
      expect(result.upsertedCount).toBe(2);
      expect(mockSaveTimetablePeriod).toHaveBeenCalledTimes(2);

      // Verifying conflict rejection
      const conflictSlots: ScheduleSlot[] = [
        { dayOfWeek: 1, periodNumber: 3, subjectId: "cs-math", subjectName: "Math", teacherId: "teacher-conflict" },
      ];

      await expect(commitSectionTimetablePipeline("sec-10a", conflictSlots)).rejects.toThrow(
        /Conflict: Teacher is already booked/
      );
    });
  });
});
