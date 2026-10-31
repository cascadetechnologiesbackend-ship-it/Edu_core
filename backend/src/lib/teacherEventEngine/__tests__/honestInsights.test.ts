import { describe, it, expect, vi, beforeEach } from "vitest";
import { assembleTeacherSnapshot } from "../snapshotAssembler";
import { deriveTeacherFeed } from "../deriveTeacherFeed";

vi.mock("../../encryption", () => ({
  decryptData: vi.fn((val: string | null) => (val ? val.replace("enc_", "") : null)),
}));

vi.mock("../scopeResolver", () => ({
  resolveTeacherScope: vi.fn().mockResolvedValue({
    schoolId: "school-insight-1",
    userId: "teacher-user-1",
    isClassTeacher: true,
    classTeacherSections: ["sec-class-teacher"],
    teachingSections: [{ sectionId: "sec-class-teacher", subjectId: "sub-sci" }],
    allSectionIds: ["sec-class-teacher"],
  }),
}));

describe("S24 L7: Honest Teacher Insights Assembly and Sufficiency Gates", () => {
  const schoolId = "school-insight-1";
  const teacherUserId = "teacher-user-1";
  const now = new Date(2026, 9, 31, 10, 0, 0); // Oct 31, 2026

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Model 1: section_attendance_trend", () => {
    it("emits InsightCard when >=5 days of history exist and today's attendance dips by >=15%", async () => {
      // 5 past days with 90% attendance, and today with 70% attendance (20% dip >= 15%)
      const historyRecords = [
        // Day -5
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-26", status: "PRESENT" },
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-26", status: "PRESENT" },
        // Day -4
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-27", status: "PRESENT" },
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-27", status: "PRESENT" },
        // Day -3
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-28", status: "PRESENT" },
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-28", status: "PRESENT" },
        // Day -2
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-29", status: "PRESENT" },
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-29", status: "PRESENT" },
        // Day -1
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-30", status: "PRESENT" },
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-30", status: "PRESENT" },
        // Today (Oct 31) - 1 Present, 2 Absent (33% attendance -> dip from 100% is 67%)
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-31", status: "PRESENT" },
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-31", status: "ABSENT" },
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-31", status: "ABSENT" },
      ];

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
          studentAttendance: { findMany: vi.fn().mockResolvedValue(historyRecords) },
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
      expect(snapshot.insights).toBeDefined();

      const attInsight = snapshot.insights!.find((i) => i.model === "section_attendance_trend");
      expect(attInsight).toBeDefined();
      expect(attInsight?.severity).toBe("AMBER");
      expect(attInsight?.payload.sparklineData.length).toBe(6); // 5 trailing + 1 today

      // Feed card derivation
      const cards = deriveTeacherFeed(teacherUserId, now, snapshot);
      const card = cards.find((c) => c.cardType === "InsightCard");
      expect(card).toBeDefined();
      expect(card?.title.en).toBe("Attendance Alert: Significant Dip Today");
    });

    it("stays completely silent when attendance history has fewer than 5 past days", async () => {
      // Only 3 past days (insufficient baseline)
      const shortHistory = [
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-28", status: "PRESENT" },
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-29", status: "PRESENT" },
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-30", status: "PRESENT" },
        { schoolId, sectionId: "sec-class-teacher", attendanceDate: "2026-10-31", status: "ABSENT" },
      ];

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
          studentAttendance: { findMany: vi.fn().mockResolvedValue(shortHistory) },
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
      const attInsight = snapshot.insights?.find((i) => i.model === "section_attendance_trend");
      expect(attInsight).toBeUndefined();
    });
  });

  describe("Model 2: homework_neglect_list", () => {
    it("emits when students have missed 3+ assignments in past 14 days", async () => {
      const mockAssignments = [
        { id: "hw-1", schoolId, sectionId: "sec-class-teacher", status: "PUBLISHED", dueDate: new Date(2026, 9, 20) },
        { id: "hw-2", schoolId, sectionId: "sec-class-teacher", status: "PUBLISHED", dueDate: new Date(2026, 9, 23) },
        { id: "hw-3", schoolId, sectionId: "sec-class-teacher", status: "PUBLISHED", dueDate: new Date(2026, 9, 26) },
      ];

      // Student 1 submitted all 3; Student 2 submitted 0 (missing 3 >= 3)
      const mockSubmissions = [
        { assignmentId: "hw-1", studentId: "stu-good" },
        { assignmentId: "hw-2", studentId: "stu-good" },
        { assignmentId: "hw-3", studentId: "stu-good" },
      ];

      const mockStudents = [
        { id: "stu-good", schoolId, currentSectionId: "sec-class-teacher", isActive: true },
        {
          id: "stu-neglect",
          schoolId,
          currentSectionId: "sec-class-teacher",
          isActive: true,
          firstNameEncrypted: "enc_Manish",
          lastNameEncrypted: "enc_Pandey",
        },
      ];

      const mockTx = {
        query: {
          academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
          sections: { findMany: vi.fn().mockResolvedValue([]) },
          subjects: { findMany: vi.fn().mockResolvedValue([]) },
          timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
          assignments: { findMany: vi.fn().mockResolvedValue(mockAssignments) },
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
      const hwNeglect = snapshot.insights?.find((i) => i.model === "homework_neglect_list");
      expect(hwNeglect).toBeDefined();
      expect(hwNeglect?.payload.students.length).toBe(1);
      expect(hwNeglect?.payload.students[0].studentName).toBe("Manish Pandey");
      expect(hwNeglect?.payload.students[0].missingCount).toBe(3);
    });

    it("stays completely silent when fewer than 3 assignments exist in the window", async () => {
      // Only 2 assignments published (insufficient data)
      const mockAssignments = [
        { id: "hw-1", schoolId, sectionId: "sec-class-teacher", status: "PUBLISHED", dueDate: new Date(2026, 9, 20) },
        { id: "hw-2", schoolId, sectionId: "sec-class-teacher", status: "PUBLISHED", dueDate: new Date(2026, 9, 23) },
      ];

      const mockTx = {
        query: {
          academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
          sections: { findMany: vi.fn().mockResolvedValue([]) },
          subjects: { findMany: vi.fn().mockResolvedValue([]) },
          timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
          assignments: { findMany: vi.fn().mockResolvedValue(mockAssignments) },
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
          classSubjects: { findMany: vi.fn().mockResolvedValue([]) },
          lessonPlans: { findMany: vi.fn().mockResolvedValue([]) },
        },
      };

      const snapshot = await assembleTeacherSnapshot(schoolId, teacherUserId, now, mockTx);
      const hwNeglect = snapshot.insights?.find((i) => i.model === "homework_neglect_list");
      expect(hwNeglect).toBeUndefined();
    });
  });

  describe("Model 3: pre_publish_distribution", () => {
    it("emits when marks entry window is closing in <=48h and >=60% entries exist", async () => {
      // 1 open exam closing in 24 hours
      const openExam = {
        id: "exam-pre-pub",
        schoolId,
        name: "Quarterly Evaluation",
        startDate: new Date(2026, 9, 20),
        endDate: new Date(2026, 9, 31, 23, 59, 59), // Closes in ~14h
        isLocked: false,
      };

      const sectionObj = {
        id: "sec-class-teacher",
        schoolId,
        name: "A",
        class: { displayName: "Class 6", gradeLevel: "CLASS_6" },
      };

      const subjectObj = {
        id: "sub-sci",
        schoolId,
        name: "Science",
        maxMarks: 100,
      };

      // 5 students total
      const studentsRoster = [
        { id: "s-1", schoolId, currentSectionId: "sec-class-teacher", isActive: true },
        { id: "s-2", schoolId, currentSectionId: "sec-class-teacher", isActive: true },
        { id: "s-3", schoolId, currentSectionId: "sec-class-teacher", isActive: true },
        { id: "s-4", schoolId, currentSectionId: "sec-class-teacher", isActive: true },
        { id: "s-5", schoolId, currentSectionId: "sec-class-teacher", isActive: true },
      ];

      // 4 entries out of 5 entered (80% >= 60%)
      const marksEntered = [
        { examId: "exam-pre-pub", subjectId: "sub-sci", studentId: "s-1", marksObtained: "85.00" },
        { examId: "exam-pre-pub", subjectId: "sub-sci", studentId: "s-2", marksObtained: "75.00" },
        { examId: "exam-pre-pub", subjectId: "sub-sci", studentId: "s-3", marksObtained: "90.00" },
        { examId: "exam-pre-pub", subjectId: "sub-sci", studentId: "s-4", marksObtained: "10.00" }, // Outlier (10 <= 20)
      ];

      const mockTx = {
        query: {
          academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
          sections: { findMany: vi.fn().mockResolvedValue([sectionObj]) },
          subjects: { findMany: vi.fn().mockResolvedValue([subjectObj]) },
          timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
          assignments: { findMany: vi.fn().mockResolvedValue([]) },
          assignmentSubmissions: { findMany: vi.fn().mockResolvedValue([]) },
          exams: { findMany: vi.fn().mockResolvedValue([openExam]) },
          examMarkDistributions: { findMany: vi.fn().mockResolvedValue([]) },
          students: { findMany: vi.fn().mockResolvedValue(studentsRoster) },
          studentAttendance: { findMany: vi.fn().mockResolvedValue([]) },
          studentLeaveRequests: { findMany: vi.fn().mockResolvedValue([]) },
          markEntries: { findMany: vi.fn().mockResolvedValue(marksEntered) },
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
      const marksInsight = snapshot.insights?.find((i) => i.model === "pre_publish_distribution");
      expect(marksInsight).toBeDefined();
      expect(marksInsight?.payload.mean).toBe(65); // (85 + 75 + 90 + 10) / 4 = 65
      expect(marksInsight?.payload.maxMarks).toBe(100);
      expect(marksInsight?.payload.outliersCount).toBe(1); // score 10 <= 20
    });

    it("stays completely silent when marks entry completion is below 60%", async () => {
      const openExam = {
        id: "exam-low-comp",
        schoolId,
        name: "Quarterly Evaluation",
        startDate: new Date(2026, 9, 20),
        endDate: new Date(2026, 9, 31, 23, 59, 59),
        isLocked: false,
      };

      const sectionObj = {
        id: "sec-class-teacher",
        schoolId,
        name: "A",
        class: { displayName: "Class 6", gradeLevel: "CLASS_6" },
      };

      const subjectObj = {
        id: "sub-sci",
        schoolId,
        name: "Science",
        maxMarks: 100,
      };

      // 10 students total
      const studentsRoster = Array.from({ length: 10 }).map((_, idx) => ({
        id: `s-${idx}`,
        schoolId,
        currentSectionId: "sec-class-teacher",
        isActive: true,
      }));

      // Only 3 entries out of 10 entered (30% < 60%)
      const marksEntered = [
        { examId: "exam-low-comp", subjectId: "sub-sci", studentId: "s-0", marksObtained: "80.00" },
        { examId: "exam-low-comp", subjectId: "sub-sci", studentId: "s-1", marksObtained: "85.00" },
        { examId: "exam-low-comp", subjectId: "sub-sci", studentId: "s-2", marksObtained: "90.00" },
      ];

      const mockTx = {
        query: {
          academicCalendarEvents: { findMany: vi.fn().mockResolvedValue([]) },
          sections: { findMany: vi.fn().mockResolvedValue([sectionObj]) },
          subjects: { findMany: vi.fn().mockResolvedValue([subjectObj]) },
          timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
          assignments: { findMany: vi.fn().mockResolvedValue([]) },
          assignmentSubmissions: { findMany: vi.fn().mockResolvedValue([]) },
          exams: { findMany: vi.fn().mockResolvedValue([openExam]) },
          examMarkDistributions: { findMany: vi.fn().mockResolvedValue([]) },
          students: { findMany: vi.fn().mockResolvedValue(studentsRoster) },
          studentAttendance: { findMany: vi.fn().mockResolvedValue([]) },
          studentLeaveRequests: { findMany: vi.fn().mockResolvedValue([]) },
          markEntries: { findMany: vi.fn().mockResolvedValue(marksEntered) },
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
      const marksInsight = snapshot.insights?.find((i) => i.model === "pre_publish_distribution");
      expect(marksInsight).toBeUndefined();
    });
  });
});
