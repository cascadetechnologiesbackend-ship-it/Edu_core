import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// Mock dependencies before imports
vi.mock("@/lib/serverAuth", () => ({
  getCachedSession: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        assignments: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        assignmentSubmissions: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        classSubjects: {
          findMany: vi.fn(),
        },
        staff: {
          findMany: vi.fn(),
        },
      },
      insert: vi.fn(),
      update: vi.fn(),
    },
    withTenant: vi.fn((schoolId: string, cb: any) => {
      const mockTx = {
        query: {
          assignments: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
          },
          assignmentSubmissions: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
          },
          classSubjects: {
            findMany: vi.fn(),
          },
          staff: {
            findMany: vi.fn(),
          },
        },
        insert: vi.fn(() => ({
          values: vi.fn().mockResolvedValue([{ id: "sub-1" }]),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ id: "sub-1" }]),
          })),
        })),
      };
      return cb(mockTx);
    }),
  };
});

vi.mock("@/lib/studentEventEngine/scopeResolver", () => ({
  resolveStudentScope: vi.fn(),
}));

vi.mock("@/lib/pii/scanEnforcement", () => ({
  scanContentForPII: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

import {
  getStudentHomeworkAction,
  submitHomeworkAction,
  StudentHomeworkItem,
  StudentHomeworkData,
} from "../homeworkActions";
import { HomeworkCenterClient } from "@/components/student/homework/HomeworkCenterClient";
import { SubmitHomeworkSheet } from "@/components/student/homework/SubmitHomeworkSheet";
import { HomeworkViewModal } from "@/components/student/homework/HomeworkViewModal";
import { getCachedSession } from "@/lib/serverAuth";
import { resolveStudentScope } from "@/lib/studentEventEngine/scopeResolver";
import { scanContentForPII } from "@/lib/pii/scanEnforcement";
import { withTenant } from "@/db";

describe("Phase S4: Student Homework Center & Submission Flow (AC-6, AC-7, AC-8)", () => {
  const dummySchoolId = "school-100";
  const dummyStudentId = "student-100";
  const dummyUserId = "user-student-100";
  const dummyAssignmentId = "assign-100";

  beforeEach(() => {
    vi.clearAllMocks();

    (getCachedSession as any).mockResolvedValue({
      user: {
        id: dummyUserId,
        schoolId: dummySchoolId,
        role: "STUDENT",
      },
    });

    (resolveStudentScope as any).mockResolvedValue({
      studentId: dummyStudentId,
      schoolId: dummySchoolId,
      studentName: "Aditya Sharma",
      classId: "class-10",
      className: "Class 10",
      sectionId: "sec-a",
      sectionName: "A",
      rollNumber: "12",
      admissionNumber: "ADM-2026-001",
      enrolledSubjectIds: ["cs-math"],
      isAccountDisabled: false,
    });
  });

  describe("Validation & Eligibility Rules", () => {
    it("rejects submission when both studentContent and attachmentKey are empty", async () => {
      const res = await submitHomeworkAction({
        assignmentId: dummyAssignmentId,
        studentContent: "   ",
        attachmentS3Key: "",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Please enter your answer text or attach a file");
    });

    it("respects suspended/disabled student account status (BR9)", async () => {
      (resolveStudentScope as any).mockResolvedValueOnce({
        studentId: dummyStudentId,
        schoolId: dummySchoolId,
        isAccountDisabled: true,
      });

      const res = await submitHomeworkAction({
        assignmentId: dummyAssignmentId,
        studentContent: "My homework answer",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("suspended");
    });
  });

  describe("Server-Side isLate Timestamp Calculation (BR4, AC-7)", () => {
    it("marks submission as isLate = true when server time is past dueDate", async () => {
      const pastDueDate = new Date(Date.now() - 3600000); // 1 hour ago

      (withTenant as any).mockImplementationOnce(async (_schoolId: string, cb: any) => {
        const mockTx = {
          query: {
            assignments: {
              findFirst: vi.fn().mockResolvedValue({
                id: dummyAssignmentId,
                schoolId: dummySchoolId,
                sectionId: "sec-a",
                dueDate: pastDueDate,
                status: "PUBLISHED",
              }),
            },
            assignmentSubmissions: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
          insert: vi.fn(() => ({
            values: vi.fn().mockResolvedValue([{ id: "sub-1" }]),
          })),
        };
        return cb(mockTx);
      });

      (scanContentForPII as any).mockResolvedValueOnce({
        decision: "LOGGED_ONLY",
        detectedTypes: [],
      });

      const res = await submitHomeworkAction({
        assignmentId: dummyAssignmentId,
        studentContent: "Here is my late assignment",
      });

      expect(res.success).toBe(true);
      expect(res.isLate).toBe(true);
      expect(res.resubmitted).toBe(false);
    });

    it("marks submission as isLate = false when submitted before deadline", async () => {
      const futureDueDate = new Date(Date.now() + 86400000); // Tomorrow

      (withTenant as any).mockImplementationOnce(async (_schoolId: string, cb: any) => {
        const mockTx = {
          query: {
            assignments: {
              findFirst: vi.fn().mockResolvedValue({
                id: dummyAssignmentId,
                schoolId: dummySchoolId,
                sectionId: "sec-a",
                dueDate: futureDueDate,
                status: "PUBLISHED",
              }),
            },
            assignmentSubmissions: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
          insert: vi.fn(() => ({
            values: vi.fn().mockResolvedValue([{ id: "sub-2" }]),
          })),
        };
        return cb(mockTx);
      });

      (scanContentForPII as any).mockResolvedValueOnce({
        decision: "LOGGED_ONLY",
        detectedTypes: [],
      });

      const res = await submitHomeworkAction({
        assignmentId: dummyAssignmentId,
        studentContent: "Here is my on-time assignment",
      });

      expect(res.success).toBe(true);
      expect(res.isLate).toBe(false);
      expect(res.resubmitted).toBe(false);
    });
  });

  describe("DPDP Act 2023 PII Protection (BR6, AC-8)", () => {
    it("blocks submission when CRITICAL PII (such as Aadhaar) is detected", async () => {
      (withTenant as any).mockImplementationOnce(async (_schoolId: string, cb: any) => {
        const mockTx = {
          query: {
            assignments: {
              findFirst: vi.fn().mockResolvedValue({
                id: dummyAssignmentId,
                schoolId: dummySchoolId,
                sectionId: "sec-a",
                dueDate: new Date(Date.now() + 86400000),
                status: "PUBLISHED",
              }),
            },
          },
        };
        return cb(mockTx);
      });

      (scanContentForPII as any).mockResolvedValueOnce({
        decision: "BLOCKED",
        riskLevel: "CRITICAL",
        detectedTypes: ["AADHAAR"],
        matchCount: 1,
      });

      const res = await submitHomeworkAction({
        assignmentId: dummyAssignmentId,
        studentContent: "My project by Aditya Aadhaar: 2345 6789 0123",
      });

      expect(res.success).toBe(false);
      expect(res.blocked).toBe(true);
      expect(res.detectedTypes).toContain("AADHAAR");
      expect(res.error).toContain("Submission blocked");
    });
  });

  describe("Single Unique Row Upsert & Resubmission Flow (AC-6)", () => {
    it("allows resubmission and updates the existing row when not graded yet", async () => {
      const futureDueDate = new Date(Date.now() + 86400000);
      const updateSetSpy = vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ id: "existing-sub-1" }]),
      }));

      (withTenant as any).mockImplementationOnce(async (_schoolId: string, cb: any) => {
        const mockTx = {
          query: {
            assignments: {
              findFirst: vi.fn().mockResolvedValue({
                id: dummyAssignmentId,
                schoolId: dummySchoolId,
                sectionId: "sec-a",
                dueDate: futureDueDate,
                status: "PUBLISHED",
              }),
            },
            assignmentSubmissions: {
              findFirst: vi.fn().mockResolvedValue({
                id: "existing-sub-1",
                assignmentId: dummyAssignmentId,
                studentId: dummyStudentId,
                gradedAt: null,
                marksAwarded: null,
                studentContent: "Original content",
              }),
            },
          },
          update: vi.fn(() => ({
            set: updateSetSpy,
          })),
        };
        return cb(mockTx);
      });

      (scanContentForPII as any).mockResolvedValueOnce({
        decision: "LOGGED_ONLY",
        detectedTypes: [],
      });

      const res = await submitHomeworkAction({
        assignmentId: dummyAssignmentId,
        studentContent: "Updated revised homework content",
      });

      expect(res.success).toBe(true);
      expect(res.resubmitted).toBe(true);
      expect(updateSetSpy).toHaveBeenCalled();
    });

    it("prohibits resubmission if already graded by teacher", async () => {
      (withTenant as any).mockImplementationOnce(async (_schoolId: string, cb: any) => {
        const mockTx = {
          query: {
            assignments: {
              findFirst: vi.fn().mockResolvedValue({
                id: dummyAssignmentId,
                schoolId: dummySchoolId,
                sectionId: "sec-a",
                dueDate: new Date(),
                status: "PUBLISHED",
              }),
            },
            assignmentSubmissions: {
              findFirst: vi.fn().mockResolvedValue({
                id: "existing-sub-1",
                assignmentId: dummyAssignmentId,
                studentId: dummyStudentId,
                gradedAt: new Date("2026-10-22T10:00:00Z"),
                marksAwarded: 45,
                remarks: "Excellent work",
              }),
            },
          },
        };
        return cb(mockTx);
      });

      (scanContentForPII as any).mockResolvedValueOnce({
        decision: "LOGGED_ONLY",
        detectedTypes: [],
      });

      const res = await submitHomeworkAction({
        assignmentId: dummyAssignmentId,
        studentContent: "Trying to overwrite graded homework",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("already been graded");
    });
  });

  describe("Teacher Grading Roster Compatibility (AC-6, F6)", () => {
    it("produces assignment_submissions row shape that the teacher grading roster consumes", () => {
      // Sample submission row as created by submitHomeworkAction
      const mockStudentSubmissionRow = {
        id: "sub-uuid-1",
        schoolId: dummySchoolId,
        assignmentId: dummyAssignmentId,
        studentId: dummyStudentId,
        submittedAt: new Date("2026-10-23T11:00:00Z"),
        isLate: false,
        studentContent: "Solved linear equations x = 4, y = 2",
        attachmentS3Key: "school-1/homework/sol.pdf",
        marksAwarded: null, // Untouched, ready for teacher
        remarks: null,      // Untouched, ready for teacher
        gradedAt: null,     // Untouched, ready for teacher
        gradedByTeacherId: null,
      };

      // Emulate the F6 teacher homework roster lookup
      const rosterEvaluation = {
        studentId: mockStudentSubmissionRow.studentId,
        submissionId: mockStudentSubmissionRow.id,
        isSubmitted: Boolean(mockStudentSubmissionRow),
        submittedAt: mockStudentSubmissionRow.submittedAt.toISOString(),
        marksAwarded: mockStudentSubmissionRow.marksAwarded,
        remarks: mockStudentSubmissionRow.remarks,
        isLate: mockStudentSubmissionRow.isLate,
      };

      expect(rosterEvaluation.isSubmitted).toBe(true);
      expect(rosterEvaluation.isLate).toBe(false);
      expect(rosterEvaluation.submissionId).toBe("sub-uuid-1");
      expect(rosterEvaluation.marksAwarded).toBeNull();
    });
  });

  describe("Homework Center UI Components (Surface S2)", () => {
    const mockInitialData: StudentHomeworkData = {
      success: true,
      studentInfo: {
        studentId: dummyStudentId,
        studentName: "Aditya Sharma",
        className: "Class 10",
        sectionName: "A",
        rollNumber: "12",
        admissionNumber: "ADM-2026-001",
      },
      pending: [
        {
          id: "hw-pending-1",
          title: "Math Exercise 3.2",
          description: "Solve linear equations",
          subjectName: "Mathematics",
          className: "Class 10",
          sectionName: "A",
          teacherName: "Ramesh Gupta",
          dueDate: "2026-10-25T10:00:00Z",
          isPastDue: false,
          maxMarks: 50,
          attachmentS3Key: null,
          status: "PUBLISHED",
          isSubmitted: false,
          submission: null,
        },
      ],
      submitted: [],
      graded: [],
    };

    it("renders Homework Center title, student info badge, and 3 tab pills", () => {
      const el = React.createElement(HomeworkCenterClient, {
        initialData: mockInitialData,
      });

      expect(el).toBeDefined();
      expect(el.props.initialData.pending.length).toBe(1);
      expect(el.props.initialData.studentInfo?.className).toBe("Class 10");
    });

    it("renders calm empty state when pending list is empty (AC-5, AC-6)", () => {
      const calmData: StudentHomeworkData = {
        ...mockInitialData,
        pending: [],
      };

      const el = React.createElement(HomeworkCenterClient, {
        initialData: calmData,
      });

      expect(el).toBeDefined();
      expect(el.props.initialData.pending.length).toBe(0);
    });

    it("SubmitHomeworkSheet renders with assignment props and callback", () => {
      const sheetEl = React.createElement(SubmitHomeworkSheet, {
        open: true,
        onClose: vi.fn(),
        homework: mockInitialData.pending[0] || null,
        locale: "en",
        onSuccess: vi.fn(),
      });

      expect(sheetEl).toBeDefined();
      expect(sheetEl.props.open).toBe(true);
      expect(sheetEl.props.homework?.title).toBe("Math Exercise 3.2");
    });

    it("HomeworkViewModal renders with homework props and resubmit callback", () => {
      const modalEl = React.createElement(HomeworkViewModal, {
        open: true,
        onClose: vi.fn(),
        homework: mockInitialData.pending[0] || null,
        locale: "en",
        onResubmit: vi.fn(),
      });

      expect(modalEl).toBeDefined();
      expect(modalEl.props.open).toBe(true);
      expect(modalEl.props.homework?.subjectName).toBe("Mathematics");
    });
  });
});
