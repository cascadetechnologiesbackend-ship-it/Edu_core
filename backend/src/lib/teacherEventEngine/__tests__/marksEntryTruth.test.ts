import { describe, it, expect, vi, beforeEach } from "vitest";
import { assembleTeacherSnapshot } from "../snapshotAssembler";
import { deriveTeacherFeed } from "../deriveTeacherFeed";

vi.mock("../../encryption", () => ({
  decryptData: vi.fn((val: string | null) => {
    if (!val) return null;
    return val.replace("enc_", "");
  }),
}));

vi.mock("../scopeResolver", () => ({
  resolveTeacherScope: vi.fn().mockResolvedValue({
    schoolId: "school-exam-1",
    userId: "teacher-user-1",
    isClassTeacher: false,
    classTeacherSections: [],
    teachingSections: [
      { sectionId: "sec-8a", subjectId: "sub-math" },
      { sectionId: "sec-8b", subjectId: "sub-sci" },
    ],
    allSectionIds: ["sec-8a", "sec-8b"],
  }),
}));

describe("S24 L4: Marks Entry and Grading Subject Truth", () => {
  const schoolId = "school-exam-1";
  const teacherUserId = "teacher-user-1";
  const now = new Date("2026-10-31T09:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves real subject name and configured maxMarks for marks entry windows", async () => {
    const exam1 = {
      id: "exam-midterm",
      schoolId,
      name: "Midterm Examination",
      startDate: new Date("2026-10-25T00:00:00Z"),
      endDate: new Date("2026-11-05T00:00:00Z"),
      isLocked: false,
    };

    const section8a = {
      id: "sec-8a",
      schoolId,
      name: "A",
      class: { displayName: "Class 8", gradeLevel: "CLASS_8" },
    };

    const section8b = {
      id: "sec-8b",
      schoolId,
      name: "B",
      class: { displayName: "Class 8", gradeLevel: "CLASS_8" },
    };

    const subjectMath = {
      id: "sub-math",
      schoolId,
      name: "Mathematics",
      maxMarks: 100,
    };

    const subjectSci = {
      id: "sub-sci",
      schoolId,
      name: "Science",
      maxMarks: 50,
    };

    // Math has configured maxMarks 80 on midterm exam
    const distMath = {
      id: "dist-math",
      schoolId,
      examId: "exam-midterm",
      subjectId: "sub-math",
      classId: "cls-8",
      maxMarks: "80.00",
    };

    const students8a = [
      { id: "stu-1", schoolId, currentSectionId: "sec-8a", isActive: true },
      { id: "stu-2", schoolId, currentSectionId: "sec-8a", isActive: true },
    ];

    const students8b = [
      { id: "stu-3", schoolId, currentSectionId: "sec-8b", isActive: true },
    ];

    // Math has 1 of 2 entries completed
    const entriesMath = [
      { id: "entry-1", schoolId, examId: "exam-midterm", subjectId: "sub-math", studentId: "stu-1" },
    ];

    const mockTx = {
      query: {
        academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
        sections: {
          findMany: vi.fn().mockResolvedValue([section8a, section8b]),
        },
        subjects: {
          findMany: vi.fn().mockResolvedValue([subjectMath, subjectSci]),
        },
        timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
        assignments: { findMany: vi.fn().mockResolvedValue([]) },
        assignmentSubmissions: { findMany: vi.fn().mockResolvedValue([]) },
        exams: { findMany: vi.fn().mockResolvedValue([exam1]) },
        examMarkDistributions: { findMany: vi.fn().mockResolvedValue([distMath]) },
        students: {
          findMany: vi.fn().mockImplementation((args: any) => {
            if (args?.where?.toString().includes("sec-8a") || args?.columns?.id) {
              return Promise.resolve(students8a);
            }
            return Promise.resolve(students8b);
          }),
        },
        studentAttendance: { findMany: vi.fn().mockResolvedValue([]) },
        studentLeaveRequests: { findMany: vi.fn().mockResolvedValue([]) },
        markEntries: {
          findMany: vi.fn().mockImplementation((args: any) => {
            return Promise.resolve(entriesMath);
          }),
        },
        timetableSubstitutions: { findMany: vi.fn().mockResolvedValue([]) },
        ptmSlots: { findMany: vi.fn().mockResolvedValue([]) },
        ptmBookings: { findMany: vi.fn().mockResolvedValue([]) },
        parentTeacherMessages: { findMany: vi.fn().mockResolvedValue([]) },
        notices: { findMany: vi.fn().mockResolvedValue([]) },
      },
    };

    const snapshot = await assembleTeacherSnapshot(schoolId, teacherUserId, now, mockTx);

    expect(snapshot.marksEntryWindows).toBeDefined();
    expect(snapshot.marksEntryWindows!.length).toBeGreaterThan(0);

    const mathWindow = snapshot.marksEntryWindows!.find((w) => w.subjectId === "sub-math");
    expect(mathWindow).toBeDefined();
    expect(mathWindow?.subjectName).toBe("Mathematics");
    expect(mathWindow?.subjectName).not.toBe("Subject");
    // Midterm distribution configured max marks is 80 (not 100)
    expect(mathWindow?.maxMarks).toBe(80);
    expect(mathWindow?.sectionName).toBe("A");
    expect(mathWindow?.className).toBe("Class 8");

    // Feed card summary truth
    const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
    const marksCard = cards.find((c) => c.cardType === "MarksEntryCard");
    expect(marksCard).toBeDefined();
    expect(marksCard?.summary.en).toContain("Mathematics");
    expect(marksCard?.summary.en).not.toContain("Class-8A Subject");
  });

  it("resolves real subject name for grading assignments queue without fallback to 'Subject'", async () => {
    const mockAssignment = {
      id: "asg-1",
      schoolId,
      createdByTeacherId: teacherUserId,
      title: "Algebra Worksheet 3",
      sectionId: "sec-8a",
      section: {
        name: "A",
        class: { displayName: "Class 8", gradeLevel: "CLASS_8" },
      },
      classSubject: {
        subject: { name: "Mathematics" },
      },
      dueDate: new Date("2026-10-30T23:59:00Z"),
      status: "PUBLISHED",
    };

    const mockSubmissions = [
      { id: "subm-1", assignmentId: "asg-1", gradedAt: null, isLate: false },
    ];

    const mockTx = {
      query: {
        academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
        sections: { findMany: vi.fn().mockResolvedValue([]) },
        subjects: { findMany: vi.fn().mockResolvedValue([]) },
        timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
        assignments: { findMany: vi.fn().mockResolvedValue([mockAssignment]) },
        assignmentSubmissions: { findMany: vi.fn().mockResolvedValue(mockSubmissions) },
        exams: { findMany: vi.fn().mockResolvedValue([]) },
        examMarkDistributions: { findMany: vi.fn().mockResolvedValue([]) },
        students: { findMany: vi.fn().mockResolvedValue([]) },
        studentAttendance: { findMany: vi.fn().mockResolvedValue([]) },
        studentLeaveRequests: { findMany: vi.fn().mockResolvedValue([]) },
        markEntries: { findMany: vi.fn().mockResolvedValue([]) },
        timetableSubstitutions: { findMany: vi.fn().mockResolvedValue([]) },
        ptmSlots: { findMany: vi.fn().mockResolvedValue([]) },
        ptmBookings: { findMany: vi.fn().mockResolvedValue([]) },
        parentTeacherMessages: { findMany: vi.fn().mockResolvedValue([]) },
        notices: { findMany: vi.fn().mockResolvedValue([]) },
      },
    };

    const snapshot = await assembleTeacherSnapshot(schoolId, teacherUserId, now, mockTx);

    expect(snapshot.gradingAssignments).toBeDefined();
    expect(snapshot.gradingAssignments!.length).toBe(1);

    const gradingItem = snapshot.gradingAssignments![0]!;
    expect(gradingItem.subjectName).toBe("Mathematics");
    expect(gradingItem.subjectName).not.toBe("Subject");
  });
});
