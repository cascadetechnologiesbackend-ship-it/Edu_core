import { describe, it, expect, vi, beforeEach } from "vitest";
import { assembleTeacherSnapshot } from "../snapshotAssembler";
import { deriveTeacherFeed } from "../deriveTeacherFeed";

vi.mock("../../encryption", () => ({
  decryptData: vi.fn((val: string | null) => {
    if (!val) return null;
    if (val === "enc_Rohan") return "Rohan";
    if (val === "enc_Verma") return "Verma";
    if (val === "enc_Priya") return "Priya";
    if (val === "enc_Singh") return "Singh";
    if (val.startsWith("enc_")) return val.replace("enc_", "");
    return val;
  }),
}));

vi.mock("../scopeResolver", () => ({
  resolveTeacherScope: vi.fn().mockResolvedValue({
    schoolId: "school-test-1",
    userId: "teacher-user-1",
    isClassTeacher: true,
    classTeacherSections: ["sec-7a"],
    teachingSections: [],
    allSectionIds: ["sec-7a"],
  }),
}));

describe("S24 L2: Leave Queue Identity Truth and Decision-Surface Parity", () => {
  const schoolId = "school-test-1";
  const teacherUserId = "teacher-user-1";
  const now = new Date("2026-10-31T09:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves real decrypted student names for pending leave requests and eliminates 'Student' placeholder", async () => {
    const student1 = {
      id: "stu-101",
      firstNameEncrypted: "enc_Rohan",
      lastNameEncrypted: "enc_Verma",
      rollNumber: "14",
      currentClassId: "cls-7",
      currentSectionId: "sec-7a",
      schoolId,
      isActive: true,
    };

    const section1 = {
      id: "sec-7a",
      schoolId,
      name: "A",
      class: { displayName: "Class 7", gradeLevel: "CLASS_7" },
    };

    const leaveRequest1 = {
      id: "leave-req-1",
      schoolId,
      studentId: "stu-101",
      leaveType: "SICK",
      startDate: new Date("2026-11-01T00:00:00Z"),
      endDate: new Date("2026-11-02T00:00:00Z"),
      reason: "Viral fever",
      status: "PENDING",
      createdAt: new Date("2026-10-30T10:00:00Z"),
    };

    const mockTx = {
      query: {
        academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
        sections: {
          findMany: vi.fn().mockResolvedValue([section1]),
          findFirst: vi.fn().mockResolvedValue(section1),
        },
        timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
        assignments: { findMany: vi.fn().mockResolvedValue([]) },
        assignmentSubmissions: { findMany: vi.fn().mockResolvedValue([]) },
        exams: { findMany: vi.fn().mockResolvedValue([]) },
        students: {
          findMany: vi.fn().mockImplementation((args: any) => {
            // If querying by inArray students.id
            return Promise.resolve([student1]);
          }),
        },
        studentLeaveRequests: {
          findMany: vi.fn().mockResolvedValue([leaveRequest1]),
        },
        studentAttendance: { findMany: vi.fn().mockResolvedValue([]) },
        timetableSubstitutions: { findMany: vi.fn().mockResolvedValue([]) },
        ptmSlots: { findMany: vi.fn().mockResolvedValue([]) },
        ptmBookings: { findMany: vi.fn().mockResolvedValue([]) },
        parentTeacherMessages: { findMany: vi.fn().mockResolvedValue([]) },
        notices: { findMany: vi.fn().mockResolvedValue([]) },
        subjects: { findMany: vi.fn().mockResolvedValue([]) },
      },
    };

    const snapshot = await assembleTeacherSnapshot(schoolId, teacherUserId, now, mockTx);

    expect(snapshot.pendingLeaveRequests).toBeDefined();
    expect(snapshot.pendingLeaveRequests!.length).toBe(1);

    const leaveItem = snapshot.pendingLeaveRequests![0]!;
    expect(leaveItem.studentName).toBe("Rohan Verma");
    expect(leaveItem.studentName).not.toBe("Student");
    expect(leaveItem.rollNumber).toBe("14");
    expect(leaveItem.sectionName).toBe("A");
    expect(leaveItem.className).toBe("Class 7");

    // Decision-surface parity check:
    // In leaveActions.ts, decrypted name is: `${first} ${last}`.trim()
    const expectedDecisionSurfaceName = "Rohan Verma";
    expect(leaveItem.studentName).toBe(expectedDecisionSurfaceName);

    // Derive feed card
    const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
    const leaveCard = cards.find((c) => c.cardType === "LeaveQueueCard");
    expect(leaveCard).toBeDefined();
    expect(leaveCard?.payload.requests[0].studentName).toBe("Rohan Verma");
    expect(leaveCard?.payload.requests[0].studentName).not.toBe("Student");
  });
});
