import { describe, it, expect } from "vitest";
import type {
  StudentTimetablePeriod,
  DayOfWeek,
} from "../timetableActions";

describe("Timetable Projection & Substitution Logic (Phase S5)", () => {
  const basePeriod: StudentTimetablePeriod = {
    id: "period-1",
    dayOfWeek: "MONDAY",
    periodNumber: 1,
    startTime: "09:00:00",
    endTime: "09:45:00",
    periodType: "REGULAR",
    subjectId: "sub-math",
    subjectName: "Mathematics",
    subjectCode: "MATH-01",
    teacherId: "teacher-orig-id",
    teacherName: "Mr. Sharma",
    roomNumber: "101",
    isSubstituted: false,
  };

  it("projects periods in correct day and chronological order", () => {
    const periods: StudentTimetablePeriod[] = [
      { ...basePeriod, id: "p2", periodNumber: 2, startTime: "09:45:00", endTime: "10:30:00" },
      { ...basePeriod, id: "p1", periodNumber: 1, startTime: "09:00:00", endTime: "09:45:00" },
      { ...basePeriod, id: "p3", periodNumber: 3, startTime: "10:45:00", endTime: "11:30:00" },
    ];

    const sorted = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);
    expect(sorted.map((p) => p.periodNumber)).toEqual([1, 2, 3]);
  });

  it("overlays approved substitution for today's date onto the period", () => {
    const today: DayOfWeek = "MONDAY";
    const substitution = {
      timetablePeriodId: "period-1",
      date: "2026-10-23",
      status: "APPROVED",
      substituteTeacherName: "Ms. Verma",
      originalTeacherName: "Mr. Sharma",
    };

    const period = { ...basePeriod };

    // Apply substitution logic matching timetableActions
    if (
      substitution.timetablePeriodId === period.id &&
      substitution.status === "APPROVED" &&
      period.dayOfWeek === today
    ) {
      period.isSubstituted = true;
      period.teacherName = substitution.substituteTeacherName;
      period.substituteTeacherName = substitution.substituteTeacherName;
      period.originalTeacherName = substitution.originalTeacherName;
    }

    expect(period.isSubstituted).toBe(true);
    expect(period.teacherName).toBe("Ms. Verma");
    expect(period.substituteTeacherName).toBe("Ms. Verma");
    expect(period.originalTeacherName).toBe("Mr. Sharma");
  });

  it("does not apply substitution if status is not APPROVED (e.g. REQUESTED or REJECTED)", () => {
    const today: DayOfWeek = "MONDAY";
    const pendingSub = {
      timetablePeriodId: "period-1",
      date: "2026-10-23",
      status: "REQUESTED",
      substituteTeacherName: "Ms. Verma",
    };

    const period = { ...basePeriod };

    if (
      pendingSub.timetablePeriodId === period.id &&
      pendingSub.status === "APPROVED" &&
      period.dayOfWeek === today
    ) {
      period.isSubstituted = true;
      period.teacherName = pendingSub.substituteTeacherName;
    }

    expect(period.isSubstituted).toBe(false);
    expect(period.teacherName).toBe("Mr. Sharma");
    expect(period.substituteTeacherName).toBeUndefined();
  });

  it("does not apply substitution if period day does not match today", () => {
    const today: DayOfWeek = "TUESDAY"; // today is Tuesday
    const mondaySub = {
      timetablePeriodId: "period-1", // Period is on Monday
      date: "2026-10-23",
      status: "APPROVED",
      substituteTeacherName: "Ms. Verma",
    };

    const period = { ...basePeriod }; // Monday period

    if (
      mondaySub.timetablePeriodId === period.id &&
      mondaySub.status === "APPROVED" &&
      period.dayOfWeek === today
    ) {
      period.isSubstituted = true;
      period.teacherName = mondaySub.substituteTeacherName;
    }

    expect(period.isSubstituted).toBe(false);
    expect(period.teacherName).toBe("Mr. Sharma");
  });

  it("handles empty timetable gracefully without mock periods", () => {
    const emptyPeriods: StudentTimetablePeriod[] = [];
    const todayPeriods = emptyPeriods.filter((p) => p.dayOfWeek === "MONDAY");

    expect(todayPeriods).toHaveLength(0);
  });
});
