import { describe, it, expect, vi, beforeEach } from "vitest";
import { assembleTeacherSnapshot } from "../snapshotAssembler";
import { deriveTeacherFeed } from "../deriveTeacherFeed";

vi.mock("../../encryption", () => ({
  decryptData: vi.fn((val: string | null) => (val ? val.replace("enc_", "") : null)),
}));

vi.mock("../scopeResolver", () => ({
  resolveTeacherScope: vi.fn().mockResolvedValue({
    schoolId: "school-sub-1",
    userId: "teacher-user-1",
    isClassTeacher: false,
    classTeacherSections: [],
    teachingSections: [],
    allSectionIds: [],
  }),
}));

vi.mock("../substitutionClash", () => ({
  checkSubstitutionClash: vi.fn().mockImplementation((subId: string) => {
    if (subId === "sub-clash") {
      return Promise.resolve({
        hasConflict: true,
        conflictReason: "Schedule clash: Period 3 (Class 7-B Hindi) already assigned",
      });
    }
    return Promise.resolve({ hasConflict: false });
  }),
}));

describe("S24 L5: Substitution Context Truth and Real Conflict Detection", () => {
  const schoolId = "school-sub-1";
  const teacherUserId = "teacher-user-1";
  const now = new Date("2026-10-31T09:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("populates sectionName, className, and subjectName on incoming substitutions", async () => {
    const mockSub = {
      id: "sub-ok",
      schoolId,
      substituteTeacherId: teacherUserId,
      originalTeacherId: "teacher-other",
      originalTeacher: { fullName: "Rajesh Kumar" },
      substituteTeacher: { fullName: "Pooja Sharma" },
      date: "2026-10-31",
      status: "PENDING",
      reason: "Medical leave",
      timetablePeriod: {
        periodNumber: 3,
        startTime: "10:30",
        endTime: "11:15",
        section: {
          name: "A",
          class: { displayName: "Class 6", gradeLevel: "CLASS_6" },
        },
        subject: {
          name: "Mathematics",
        },
      },
    };

    const mockTx = {
      query: {
        academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
        sections: { findMany: vi.fn().mockResolvedValue([]) },
        subjects: { findMany: vi.fn().mockResolvedValue([]) },
        timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
        assignments: { findMany: vi.fn().mockResolvedValue([]) },
        assignmentSubmissions: { findMany: vi.fn().mockResolvedValue([]) },
        exams: { findMany: vi.fn().mockResolvedValue([]) },
        examMarkDistributions: { findMany: vi.fn().mockResolvedValue([]) },
        students: { findMany: vi.fn().mockResolvedValue([]) },
        studentAttendance: { findMany: vi.fn().mockResolvedValue([]) },
        studentLeaveRequests: { findMany: vi.fn().mockResolvedValue([]) },
        markEntries: { findMany: vi.fn().mockResolvedValue([]) },
        timetableSubstitutions: { findMany: vi.fn().mockResolvedValue([mockSub]) },
        ptmSlots: { findMany: vi.fn().mockResolvedValue([]) },
        ptmBookings: { findMany: vi.fn().mockResolvedValue([]) },
        parentTeacherMessages: { findMany: vi.fn().mockResolvedValue([]) },
        notices: { findMany: vi.fn().mockResolvedValue([]) },
      },
    };

    const snapshot = await assembleTeacherSnapshot(schoolId, teacherUserId, now, mockTx);

    expect(snapshot.substitutions).toBeDefined();
    expect(snapshot.substitutions!.length).toBe(1);

    const subItem = snapshot.substitutions![0]!;
    expect(subItem.periodNumber).toBe(3);
    expect(subItem.sectionName).toBe("A");
    expect(subItem.className).toBe("Class 6");
    expect(subItem.subjectName).toBe("Mathematics");
    expect(subItem.otherTeacherName).toBe("Rajesh Kumar");
    expect(subItem.hasConflict).toBe(false);

    // Feed card verification
    const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
    const subCard = cards.find((c) => c.cardType === "SubstitutionCard");
    expect(subCard).toBeDefined();
    expect(subCard?.title.en).toBe("Cover Period 3 (A)");
    expect(subCard?.summary.en).toContain("Rajesh Kumar (Class 6-A Mathematics)");
    expect(subCard?.summary.en).not.toContain("Warning: Clash");
  });

  it("detects real schedule clash and populates hasConflict and conflict warning on the card", async () => {
    const mockClashingSub = {
      id: "sub-clash",
      schoolId,
      substituteTeacherId: teacherUserId,
      originalTeacherId: "teacher-other",
      originalTeacher: { fullName: "Rajesh Kumar" },
      substituteTeacher: { fullName: "Pooja Sharma" },
      date: "2026-10-31",
      status: "PENDING",
      reason: "Medical leave",
      timetablePeriod: {
        periodNumber: 3,
        startTime: "10:30",
        endTime: "11:15",
        section: {
          name: "B",
          class: { displayName: "Class 7", gradeLevel: "CLASS_7" },
        },
        subject: {
          name: "Science",
        },
      },
    };

    const mockTx = {
      query: {
        academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
        sections: { findMany: vi.fn().mockResolvedValue([]) },
        subjects: { findMany: vi.fn().mockResolvedValue([]) },
        timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
        assignments: { findMany: vi.fn().mockResolvedValue([]) },
        assignmentSubmissions: { findMany: vi.fn().mockResolvedValue([]) },
        exams: { findMany: vi.fn().mockResolvedValue([]) },
        examMarkDistributions: { findMany: vi.fn().mockResolvedValue([]) },
        students: { findMany: vi.fn().mockResolvedValue([]) },
        studentAttendance: { findMany: vi.fn().mockResolvedValue([]) },
        studentLeaveRequests: { findMany: vi.fn().mockResolvedValue([]) },
        markEntries: { findMany: vi.fn().mockResolvedValue([]) },
        timetableSubstitutions: { findMany: vi.fn().mockResolvedValue([mockClashingSub]) },
        ptmSlots: { findMany: vi.fn().mockResolvedValue([]) },
        ptmBookings: { findMany: vi.fn().mockResolvedValue([]) },
        parentTeacherMessages: { findMany: vi.fn().mockResolvedValue([]) },
        notices: { findMany: vi.fn().mockResolvedValue([]) },
      },
    };

    const snapshot = await assembleTeacherSnapshot(schoolId, teacherUserId, now, mockTx);
    const subItem = snapshot.substitutions![0]!;
    expect(subItem.hasConflict).toBe(true);
    expect(subItem.conflictReason).toBe("Schedule clash: Period 3 (Class 7-B Hindi) already assigned");

    // Feed card verification
    const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
    const subCard = cards.find((c) => c.cardType === "SubstitutionCard");
    expect(subCard).toBeDefined();
    expect(subCard?.summary.en).toContain("Warning: Clash with your timetable.");
  });
});

