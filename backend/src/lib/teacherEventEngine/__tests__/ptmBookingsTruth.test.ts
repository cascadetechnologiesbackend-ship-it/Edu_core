import { describe, it, expect, vi, beforeEach } from "vitest";
import { assembleTeacherSnapshot } from "../snapshotAssembler";
import { deriveTeacherFeed } from "../deriveTeacherFeed";

vi.mock("../../encryption", () => ({
  decryptData: vi.fn((val: string | null) => {
    if (!val) return null;
    if (val === "enc_Aarav") return "Aarav";
    if (val === "enc_Sharma") return "Sharma";
    if (val.startsWith("enc_")) return val.replace("enc_", "");
    return val;
  }),
}));

vi.mock("../scopeResolver", () => ({
  resolveTeacherScope: vi.fn().mockResolvedValue({
    schoolId: "school-ptm-1",
    userId: "teacher-user-1",
    isClassTeacher: false,
    classTeacherSections: [],
    teachingSections: [],
    allSectionIds: [],
  }),
}));

describe("S24 L3: PTM Booking Identity Truth & OD3 Row Omission", () => {
  const schoolId = "school-ptm-1";
  const teacherUserId = "teacher-user-1";
  const now = new Date("2026-10-31T09:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves real child name, class-section, and parent name for valid bookings", async () => {
    const student1 = {
      id: "stu-201",
      firstNameEncrypted: "enc_Aarav",
      lastNameEncrypted: "enc_Sharma",
      rollNumber: "5",
      currentClassId: "cls-6",
      currentSectionId: "sec-6a",
      schoolId,
    };

    const section1 = {
      id: "sec-6a",
      schoolId,
      name: "A",
      class: { displayName: "Class 6", gradeLevel: "CLASS_6" },
    };

    const slot1 = {
      id: "slot-1",
      schoolId,
      teacherUserId,
      startAt: new Date("2026-10-31T10:00:00Z"),
      endAt: new Date("2026-10-31T10:15:00Z"),
    };

    const booking1 = {
      id: "booking-1",
      schoolId,
      slotId: "slot-1",
      studentId: "stu-201",
      status: "BOOKED",
      parentUser: { fullName: "Vikram Sharma" },
      teacherNote: "Discuss mathematics progress",
    };

    const mockTx = {
      query: {
        academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
        sections: {
          findMany: vi.fn().mockResolvedValue([section1]),
        },
        timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
        assignments: { findMany: vi.fn().mockResolvedValue([]) },
        assignmentSubmissions: { findMany: vi.fn().mockResolvedValue([]) },
        exams: { findMany: vi.fn().mockResolvedValue([]) },
        students: {
          findMany: vi.fn().mockResolvedValue([student1]),
        },
        studentAttendance: { findMany: vi.fn().mockResolvedValue([]) },
        studentLeaveRequests: { findMany: vi.fn().mockResolvedValue([]) },
        timetableSubstitutions: { findMany: vi.fn().mockResolvedValue([]) },
        ptmSlots: { findMany: vi.fn().mockResolvedValue([slot1]) },
        ptmBookings: { findMany: vi.fn().mockResolvedValue([booking1]) },
        parentTeacherMessages: { findMany: vi.fn().mockResolvedValue([]) },
        notices: { findMany: vi.fn().mockResolvedValue([]) },
        subjects: { findMany: vi.fn().mockResolvedValue([]) },
      },
    };

    const snapshot = await assembleTeacherSnapshot(schoolId, teacherUserId, now, mockTx);

    expect(snapshot.ptmBookingsToday).toBeDefined();
    expect(snapshot.ptmBookingsToday!.length).toBe(1);

    const bookingItem = snapshot.ptmBookingsToday![0]!;
    expect(bookingItem.studentName).toBe("Aarav Sharma");
    expect(bookingItem.studentName).not.toBe("Student");
    expect(bookingItem.sectionName).toBe("Class 6-A");
    expect(bookingItem.sectionName).not.toBe("Section");
    expect(bookingItem.parentName).toBe("Vikram Sharma");

    // Feed Card derivation
    const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
    const ptmCard = cards.find((c) => c.cardType === "PTMTodayCard");
    expect(ptmCard).toBeDefined();
    expect(ptmCard?.payload.bookings[0].studentName).toBe("Aarav Sharma");
    expect(ptmCard?.payload.bookings[0].sectionName).toBe("Class 6-A");
  });

  it("enforces OD3: completely hides unresolvable or orphaned bookings without rendering placeholders", async () => {
    const slot1 = {
      id: "slot-orphan",
      schoolId,
      teacherUserId,
      startAt: new Date("2026-10-31T11:00:00Z"),
      endAt: new Date("2026-10-31T11:15:00Z"),
    };

    // Booking with an unknown/missing studentId
    const orphanedBooking = {
      id: "booking-orphan",
      schoolId,
      slotId: "slot-orphan",
      studentId: "stu-does-not-exist",
      status: "BOOKED",
      parentUser: { fullName: "Anonymous Parent" },
      teacherNote: null,
    };

    const mockTx = {
      query: {
        academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
        sections: { findMany: vi.fn().mockResolvedValue([]) },
        timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
        assignments: { findMany: vi.fn().mockResolvedValue([]) },
        assignmentSubmissions: { findMany: vi.fn().mockResolvedValue([]) },
        exams: { findMany: vi.fn().mockResolvedValue([]) },
        students: {
          findMany: vi.fn().mockResolvedValue([]), // student not found
        },
        studentAttendance: { findMany: vi.fn().mockResolvedValue([]) },
        studentLeaveRequests: { findMany: vi.fn().mockResolvedValue([]) },
        timetableSubstitutions: { findMany: vi.fn().mockResolvedValue([]) },
        ptmSlots: { findMany: vi.fn().mockResolvedValue([slot1]) },
        ptmBookings: { findMany: vi.fn().mockResolvedValue([orphanedBooking]) },
        parentTeacherMessages: { findMany: vi.fn().mockResolvedValue([]) },
        notices: { findMany: vi.fn().mockResolvedValue([]) },
        subjects: { findMany: vi.fn().mockResolvedValue([]) },
      },
    };

    const snapshot = await assembleTeacherSnapshot(schoolId, teacherUserId, now, mockTx);

    expect(snapshot.ptmBookingsToday).toBeDefined();
    // OD3: Orphaned booking must be omitted, not displayed with "Student" or "Section"
    expect(snapshot.ptmBookingsToday!.length).toBe(0);

    // Derived feed card should not render because ptmBookingsToday is empty
    const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
    const ptmCard = cards.find((c) => c.cardType === "PTMTodayCard");
    expect(ptmCard).toBeUndefined();
  });
});

