import { describe, it, expect, vi, beforeEach } from "vitest";
import { assembleTeacherSnapshot } from "../snapshotAssembler";
import { deriveTeacherFeed } from "../deriveTeacherFeed";

vi.mock("../../encryption", () => ({
  decryptData: vi.fn((val: string | null) => (val ? val.replace("enc_", "") : null)),
}));

vi.mock("../scopeResolver", () => ({
  resolveTeacherScope: vi.fn().mockResolvedValue({
    schoolId: "school-chain-1",
    userId: "teacher-user-1",
    isClassTeacher: false,
    classTeacherSections: [],
    teachingSections: [{ sectionId: "sec-6a", subjectId: "sub-sci" }],
    allSectionIds: ["sec-6a"],
  }),
}));

describe("S24 L6: HomeworkDueCard and ClassworkPendingCard Assembly & Chain", () => {
  const schoolId = "school-chain-1";
  const teacherUserId = "teacher-user-1";
  // Saturday at 11:30 AM local time
  const now = new Date(2026, 9, 31, 11, 30, 0);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("HomeworkDueCard assembly", () => {
    it("assembles published assignments due within +-24h with accurate submission counts", async () => {
      const mockHw = {
        id: "hw-101",
        schoolId,
        createdByTeacherId: teacherUserId,
        title: "Photosynthesis Diagram",
        sectionId: "sec-6a",
        dueDate: new Date(now.getTime() + 6.5 * 3600000), // 6.5 hours from now
        status: "PUBLISHED",
        section: {
          name: "A",
          class: { displayName: "Class 6", gradeLevel: "CLASS_6" },
        },
        classSubject: {
          subject: { name: "Science" },
        },
      };

      const mockSubmissions = [
        { id: "sub-1", assignmentId: "hw-101" },
        { id: "sub-2", assignmentId: "hw-101" },
      ];

      const mockStudents = [
        { id: "s-1", schoolId, currentSectionId: "sec-6a", isActive: true },
        { id: "s-2", schoolId, currentSectionId: "sec-6a", isActive: true },
        { id: "s-3", schoolId, currentSectionId: "sec-6a", isActive: true },
      ];

      const mockTx = {
        query: {
          academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
          sections: { findMany: vi.fn().mockResolvedValue([]) },
          subjects: { findMany: vi.fn().mockResolvedValue([]) },
          timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
          assignments: { findMany: vi.fn().mockResolvedValue([mockHw]) },
          assignmentSubmissions: { findMany: vi.fn().mockResolvedValue(mockSubmissions) },
          exams: { findMany: vi.fn().mockResolvedValue([]) },
          examMarkDistributions: { findMany: vi.fn().mockResolvedValue([]) },
          students: { findMany: vi.fn().mockResolvedValue(mockStudents) },
          studentAttendance: { findMany: vi.fn().mockResolvedValue([]) },
          studentLeaveRequests: { findMany: vi.fn().mockResolvedValue([]) },
          markEntries: { findMany: vi.fn().mockResolvedValue([]) },
          timetableSubstitutions: { findMany: vi.fn().mockResolvedValue([]) },
          ptmSlots: { findMany: vi.fn().mockResolvedValue([]) },
          ptmBookings: { findMany: vi.fn().mockResolvedValue([]) },
          parentTeacherMessages: { findMany: vi.fn().mockResolvedValue([]) },
          notices: { findMany: vi.fn().mockResolvedValue([]) },
          classSubjects: { findMany: vi.fn().mockResolvedValue([]) },
          lessonPlans: { findMany: vi.fn().mockResolvedValue([]) },
        },
      };

      const snapshot = await assembleTeacherSnapshot(schoolId, teacherUserId, now, mockTx);

      expect(snapshot.upcomingHomeworkDue).toBeDefined();
      expect(snapshot.upcomingHomeworkDue!.length).toBe(1);

      const hwItem = snapshot.upcomingHomeworkDue![0]!;
      expect(hwItem.title).toBe("Photosynthesis Diagram");
      expect(hwItem.subjectName).toBe("Science");
      expect(hwItem.sectionName).toBe("A");
      expect(hwItem.className).toBe("Class 6");
      expect(hwItem.submissionCount).toBe(2);
      expect(hwItem.totalStudents).toBe(3);

      // Derive feed card
      const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
      const hwCard = cards.find((c) => c.cardType === "HomeworkDueCard");
      expect(hwCard).toBeDefined();
      expect(hwCard?.tier).toBe("T2_informational");
      expect(hwCard?.priority).toBe(55);
      expect(hwCard?.title.en).toBe("Homework Due Soon: Science (Class 6-A)");
      expect(hwCard?.summary.en).toBe("Photosynthesis Diagram · 2/3 submitted");
    });
  });

  describe("ClassworkPendingCard assembly and clearing chain", () => {
    it("assembles ended periods with >=30m grace lacking completed lesson plans, and clears when recorded", async () => {
      // Period 1 ended at 10:00 (1.5 hours ago, so >= 30m grace met)
      // Period 2 ended at 11:20 (10 mins ago, grace NOT met)
      const mockTimetablePeriods = [
        {
          id: "period-1",
          periodNumber: 1,
          startTime: "09:15",
          endTime: "10:00",
          sectionId: "sec-6a",
          subjectId: "sub-sci",
          section: {
            name: "A",
            classId: "cls-6",
            class: { displayName: "Class 6", gradeLevel: "CLASS_6" },
          },
          subject: { name: "Science" },
          isFree: false,
        },
        {
          id: "period-2",
          periodNumber: 2,
          startTime: "10:35",
          endTime: "11:20",
          sectionId: "sec-6a",
          subjectId: "sub-sci",
          section: {
            name: "A",
            classId: "cls-6",
            class: { displayName: "Class 6", gradeLevel: "CLASS_6" },
          },
          subject: { name: "Science" },
          isFree: false,
        },
      ];

      const mockClassSubjects = [
        { id: "cs-sci-6", classId: "cls-6", subjectId: "sub-sci", schoolId },
      ];

      const mockSection = {
        id: "sec-6a",
        classId: "cls-6",
        name: "A",
        class: { displayName: "Class 6", gradeLevel: "CLASS_6" },
      };

      // Case A: No completed lesson plan exists today -> Period 1 triggers ClassworkPendingCard
      const mockTxPending = {
        query: {
          academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
          sections: { findMany: vi.fn().mockResolvedValue([mockSection]) },
          subjects: { findMany: vi.fn().mockResolvedValue([]) },
          timetablePeriods: { findMany: vi.fn().mockResolvedValue(mockTimetablePeriods) },
          assignments: { findMany: vi.fn().mockResolvedValue([]) },
          assignmentSubmissions: { findMany: vi.fn().mockResolvedValue([]) },
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
          classSubjects: { findMany: vi.fn().mockResolvedValue(mockClassSubjects) },
          lessonPlans: { findMany: vi.fn().mockResolvedValue([]) }, // none completed
        },
      };

      const snapshotPending = await assembleTeacherSnapshot(schoolId, teacherUserId, now, mockTxPending);

      expect(snapshotPending.pendingClassworkPeriods).toBeDefined();
      // Period 1 is >=30m past, Period 2 is only 10m past
      expect(snapshotPending.pendingClassworkPeriods!.length).toBe(1);

      const pendingP1 = snapshotPending.pendingClassworkPeriods![0]!;
      expect(pendingP1.periodNumber).toBe(1);
      expect(pendingP1.subjectName).toBe("Science");
      expect(pendingP1.className).toBe("Class 6");
      expect(pendingP1.sectionName).toBe("A");
      expect(pendingP1.classSubjectId).toBe("cs-sci-6");

      const cardsPending = deriveTeacherFeed(teacherUserId, now, snapshotPending);
      const classworkCard = cardsPending.find((c) => c.cardType === "ClassworkPendingCard");
      expect(classworkCard).toBeDefined();
      expect(classworkCard?.tier).toBe("T1_action_required");
      expect(classworkCard?.priority).toBe(68);
      expect(classworkCard?.title.en).toBe("Record Classwork: Period 1 (Class 6-A)");

      // Case B: Teacher completes classwork/lesson plan for cs-sci-6 today -> Card clears
      const completedPlan = {
        id: "lp-done",
        schoolId,
        teacherId: teacherUserId,
        classSubjectId: "cs-sci-6",
        status: "COMPLETED",
        completedDate: now,
      };

      const mockTxCompleted = {
        ...mockTxPending,
        query: {
          ...mockTxPending.query,
          lessonPlans: { findMany: vi.fn().mockResolvedValue([completedPlan]) },
        },
      };

      const snapshotCompleted = await assembleTeacherSnapshot(schoolId, teacherUserId, now, mockTxCompleted);
      expect(snapshotCompleted.pendingClassworkPeriods!.length).toBe(0);

      const cardsCompleted = deriveTeacherFeed(teacherUserId, now, snapshotCompleted);
      const classworkCardAfter = cardsCompleted.find((c) => c.cardType === "ClassworkPendingCard");
      expect(classworkCardAfter).toBeUndefined();
    });
  });
});
