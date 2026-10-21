import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  timeStringToMinutes,
  intervalsOverlap,
  getDayOfWeekEnum,
  checkSubstitutionClash,
} from "../substitutionClash";

describe("Phase T8: Backend Substitution Clash Engine & Math (AC-T8)", () => {
  describe("1. Time Interval Calculations", () => {
    it("converts HH:MM strings to minutes accurately", () => {
      expect(timeStringToMinutes("00:00")).toBe(0);
      expect(timeStringToMinutes("08:30")).toBe(510);
      expect(timeStringToMinutes("12:15")).toBe(735);
      expect(timeStringToMinutes("16:45")).toBe(1005);
      expect(timeStringToMinutes("")).toBe(0);
    });

    it("evaluates interval overlap accurately", () => {
      // Adjacent periods do not overlap: [510, 555] and [555, 600]
      expect(intervalsOverlap(510, 555, 555, 600)).toBe(false);

      // Partial overlap: [510, 555] and [540, 580]
      expect(intervalsOverlap(510, 555, 540, 580)).toBe(true);

      // Fully enclosed: [500, 600] and [520, 550]
      expect(intervalsOverlap(500, 600, 520, 550)).toBe(true);

      // Disjoint: [500, 540] and [600, 640]
      expect(intervalsOverlap(500, 540, 600, 640)).toBe(false);
    });

    it("extracts correct school week day enum from calendar dates", () => {
      // 2026-10-19 is a Monday
      expect(getDayOfWeekEnum(new Date("2026-10-19T12:00:00Z"))).toBe("MONDAY");
      // 2026-10-20 is a Tuesday
      expect(getDayOfWeekEnum(new Date("2026-10-20T12:00:00Z"))).toBe("TUESDAY");
      // 2026-10-21 is a Wednesday
      expect(getDayOfWeekEnum(new Date("2026-10-21T12:00:00Z"))).toBe("WEDNESDAY");
      // 2026-10-22 is a Thursday
      expect(getDayOfWeekEnum(new Date("2026-10-22T12:00:00Z"))).toBe("THURSDAY");
      // 2026-10-23 is a Friday
      expect(getDayOfWeekEnum(new Date("2026-10-23T12:00:00Z"))).toBe("FRIDAY");
      // 2026-10-24 is a Saturday
      expect(getDayOfWeekEnum(new Date("2026-10-24T12:00:00Z"))).toBe("SATURDAY");
    });
  });

  describe("2. checkSubstitutionClash Rules (AC-T8)", () => {
    it("returns no conflict if substitution or target period does not exist", async () => {
      const mockTx = {
        query: {
          timetableSubstitutions: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      };

      const result = await checkSubstitutionClash("non-existent-sub", "teacher-1", mockTx, "school-1");
      expect(result.hasConflict).toBe(false);
    });

    it("detects clash when substitute teacher has an assigned period at the same time", async () => {
      let firstCall = true;
      const mockTx = {
        query: {
          timetableSubstitutions: {
            findFirst: vi.fn().mockImplementation(() => {
              if (firstCall) {
                firstCall = false;
                return Promise.resolve({
                  id: "sub-target",
                  date: "2026-10-21",
                  timetablePeriod: {
                    id: "period-sub",
                    periodNumber: 2,
                    startTime: "09:15",
                    endTime: "10:00",
                    dayOfWeek: "WEDNESDAY",
                    section: { class: { displayName: "Class 8" }, name: "A" },
                    subject: { name: "Science" },
                  },
                });
              }
              return Promise.resolve(null); // Period not covered away
            }),
            findMany: vi.fn().mockResolvedValue([]),
          },
          timetablePeriods: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: "teacher-own-period",
                periodNumber: 2,
                startTime: "09:15",
                endTime: "10:00",
                dayOfWeek: "WEDNESDAY",
                isActive: true,
                section: { class: { displayName: "Class 9" }, name: "B" },
                subject: { name: "Mathematics" },
              },
            ]),
          },
        },
      };

      const result = await checkSubstitutionClash("sub-target", "substitute-teacher-id", mockTx, "school-1");
      expect(result.hasConflict).toBe(true);
      expect(result.conflictReason).toContain("Clashes with your scheduled Class 9-B Mathematics (Period 2)");
    });

    it("allows accepting when substitute teacher's assigned period is already covered away", async () => {
      let callCount = 0;
      const mockTx = {
        query: {
          timetableSubstitutions: {
            findFirst: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // First call: find the target substitution
                return Promise.resolve({
                  id: "sub-target",
                  date: "2026-10-21",
                  timetablePeriod: {
                    id: "period-sub",
                    periodNumber: 3,
                    startTime: "10:15",
                    endTime: "11:00",
                    dayOfWeek: "WEDNESDAY",
                    section: { class: { displayName: "Class 7" }, name: "A" },
                    subject: { name: "Social Studies" },
                  },
                });
              } else {
                // Second call: check if teacher's own period was covered away -> return CONFIRMED cover!
                return Promise.resolve({
                  id: "own-sub-covered",
                  status: "CONFIRMED",
                });
              }
            }),
            findMany: vi.fn().mockResolvedValue([]),
          },
          timetablePeriods: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: "teacher-own-period-3",
                periodNumber: 3,
                startTime: "10:15",
                endTime: "11:00",
                dayOfWeek: "WEDNESDAY",
                isActive: true,
                section: { class: { displayName: "Class 10" }, name: "C" },
                subject: { name: "English" },
              },
            ]),
          },
        },
      };

      const result = await checkSubstitutionClash("sub-target", "substitute-teacher-id", mockTx, "school-1");
      expect(result.hasConflict).toBe(false);
    });

    it("detects clash when substitute teacher already has another confirmed proxy cover at this time", async () => {
      const mockTx = {
        query: {
          timetableSubstitutions: {
            findFirst: vi.fn().mockResolvedValue({
              id: "sub-target",
              date: "2026-10-21",
              timetablePeriod: {
                id: "period-sub",
                periodNumber: 4,
                startTime: "11:00",
                endTime: "11:45",
                dayOfWeek: "WEDNESDAY",
                section: { class: { displayName: "Class 8" }, name: "B" },
                subject: { name: "Hindi" },
              },
            }),
            findMany: vi.fn().mockResolvedValue([
              {
                id: "prior-confirmed-sub",
                status: "CONFIRMED",
                timetablePeriod: {
                  id: "prior-period",
                  periodNumber: 4,
                  startTime: "11:00",
                  endTime: "11:45",
                  section: { class: { displayName: "Class 6" }, name: "A" },
                  subject: { name: "Art" },
                },
              },
            ]),
          },
          timetablePeriods: {
            findMany: vi.fn().mockResolvedValue([]), // No regular assigned class
          },
        },
      };

      const result = await checkSubstitutionClash("sub-target", "substitute-teacher-id", mockTx, "school-1");
      expect(result.hasConflict).toBe(true);
      expect(result.conflictReason).toContain("Clashes with another confirmed cover for Class 6 (Period 4)");
    });
  });
});
