/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import GradingQueue from "../GradingQueue";
import MarksEntryGrid from "../MarksEntryGrid";
import type {
  TeacherAssignmentItem,
  StudentSubmissionItem,
  ExamOptionItem,
  ExamAllocationItem,
  StudentExamMarkItem,
} from "@/app/(teacher)/teacher/grading/gradingActions";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock server actions
vi.mock("@/app/(teacher)/teacher/grading/gradingActions", () => ({
  saveAssignmentGrades: vi.fn().mockResolvedValue({
    success: true,
    savedCount: 2,
    message: "2 submission(s) saved!",
  }),
  saveExamMarks: vi.fn().mockResolvedValue({
    success: true,
    count: 2,
    message: "Marks recorded for 2 students.",
  }),
}));

describe("GradingQueue & MarksEntryGrid (Phase T6 & AC-T6, AC-T7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAssignments: TeacherAssignmentItem[] = [
    {
      id: "asg-1",
      title: "Algebra Worksheet 4",
      description: "Solve quadratic equations",
      className: "Class 8",
      sectionName: "A",
      subjectName: "Mathematics",
      maxMarks: 20,
      dueDate: new Date().toISOString(),
      status: "PUBLISHED",
      plagiarismCheckEnabled: true,
      totalSubmissions: 3,
      gradedCount: 1,
      ungradedCount: 2,
      lateCount: 1,
      plagiarismCount: 1,
    },
  ];

  const mockSubmissions: StudentSubmissionItem[] = [
    {
      submissionId: "sub-1",
      studentId: "st-1",
      studentName: "Aarav Sharma",
      admissionNumber: "ADM001",
      rollNumber: "1",
      marksAwarded: 18,
      remarks: "Great work",
      isLate: false,
      plagiarismFlagged: false,
      submittedAt: new Date().toISOString(),
      maxMarks: 20,
    },
    {
      submissionId: "sub-2",
      studentId: "st-2",
      studentName: "Pooja Patel",
      admissionNumber: "ADM002",
      rollNumber: "2",
      marksAwarded: null,
      remarks: null,
      isLate: true,
      plagiarismFlagged: false,
      submittedAt: new Date().toISOString(),
      maxMarks: 20,
    },
    {
      submissionId: "sub-3",
      studentId: "st-3",
      studentName: "Rohan Verma",
      admissionNumber: "ADM003",
      rollNumber: "3",
      marksAwarded: null,
      remarks: null,
      isLate: false,
      plagiarismFlagged: true,
      submittedAt: new Date().toISOString(),
      maxMarks: 20,
    },
  ];

  describe("GradingQueue: Progress, Flags & Keyboard Auto-Advance (AC-T7)", () => {
    it("renders emotional progress bar and calculates percentage correctly", () => {
      render(
        <GradingQueue
          assignments={mockAssignments}
          initialAssignmentId="asg-1"
          initialSubmissions={mockSubmissions}
        />
      );

      expect(screen.getByText("Evaluation Progress:")).toBeDefined();
      expect(screen.getByText("1 / 3")).toBeDefined();
      expect(screen.getByText("33%")).toBeDefined();
    });

    it("displays late and plagiarism flags on student rows", () => {
      render(
        <GradingQueue
          assignments={mockAssignments}
          initialAssignmentId="asg-1"
          initialSubmissions={mockSubmissions}
        />
      );

      expect(screen.getByText("Late")).toBeDefined();
      expect(screen.getByText("Plagiarism")).toBeDefined();
    });

    it("awards full marks to ungraded submissions on bulk action tap", () => {
      render(
        <GradingQueue
          assignments={mockAssignments}
          initialAssignmentId="asg-1"
          initialSubmissions={mockSubmissions}
        />
      );

      const bulkBtn = screen.getByRole("button", { name: /Full Marks/i });
      fireEvent.click(bulkBtn);

      // Now all 3 students should have marks
      expect(screen.getByText("3 / 3")).toBeDefined();
      expect(screen.getByText("100%")).toBeDefined();
      expect(screen.getByText("All Graded")).toBeDefined();
    });

    it("advances focus to the next student row when Enter key is pressed (AC-T7)", () => {
      render(
        <GradingQueue
          assignments={mockAssignments}
          initialAssignmentId="asg-1"
          initialSubmissions={mockSubmissions}
        />
      );

      const inputs = screen.getAllByPlaceholderText("/ 20");
      const firstInput = inputs[0]!;
      const secondInput = inputs[1]!;

      // Focus first input and press Enter
      firstInput.focus();
      fireEvent.keyDown(firstInput, { key: "Enter", code: "Enter" });

      // Focus should advance to second input
      expect(document.activeElement).toBe(secondInput);
    });
  });

  describe("MarksEntryGrid: Lock Window Enforcement & Distribution (AC-T6)", () => {
    const mockExams: ExamOptionItem[] = [
      {
        id: "exam-1",
        name: "Term 1 Final Examination",
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        isLocked: false,
      },
    ];

    const mockAllocations: ExamAllocationItem[] = [
      {
        classId: "cls-1",
        className: "Class 8 (Section A)",
        sectionId: "sec-1",
        sectionName: "A",
        subjectId: "subj-1",
        subjectName: "Mathematics",
        maxMarks: 100,
      },
    ];

    const mockStudents: StudentExamMarkItem[] = [
      {
        studentId: "st-1",
        name: "Aarav Sharma",
        admissionNumber: "ADM001",
        rollNumber: "1",
        marksObtained: 85,
        isAbsent: false,
      },
      {
        studentId: "st-2",
        name: "Pooja Patel",
        admissionNumber: "ADM002",
        rollNumber: "2",
        marksObtained: null,
        isAbsent: false,
      },
      {
        studentId: "st-3",
        name: "Rohan Verma",
        admissionNumber: "ADM003",
        rollNumber: "3",
        marksObtained: null,
        isAbsent: true,
      },
    ];

    it("renders distribution histogram with distinction and absent counts", () => {
      render(
        <MarksEntryGrid
          exams={mockExams}
          allocations={mockAllocations}
          initialExamId="exam-1"
          initialStudents={mockStudents}
          initialIsLocked={false}
        />
      );

      expect(screen.getByText(/Class Performance Distribution/i)).toBeDefined();
      expect(screen.getByText("≥75% (1)")).toBeDefined();
      expect(screen.getByText("Absent (1)")).toBeDefined();
    });

    it("renders read-only state with lock banner when window is locked (AC-T6)", () => {
      render(
        <MarksEntryGrid
          exams={mockExams}
          allocations={mockAllocations}
          initialExamId="exam-1"
          initialStudents={mockStudents}
          initialIsLocked={true}
          initialLockReason="Term 1 examination locked by Principal"
        />
      );

      expect(
        screen.getByText("Term 1 examination locked by Principal")
      ).toBeDefined();

      const inputs = screen.getAllByRole("spinbutton");
      for (const input of inputs) {
        expect((input as HTMLInputElement).disabled).toBe(true);
      }

      const saveBtn = screen.getByRole("button", { name: /Locked \(Read-Only\)/i });
      expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it("allows toggling absent status for students", () => {
      render(
        <MarksEntryGrid
          exams={mockExams}
          allocations={mockAllocations}
          initialExamId="exam-1"
          initialStudents={mockStudents}
          initialIsLocked={false}
        />
      );

      // Student 1 is Aarav (present, 85 marks). Find his "Mark Absent" button
      const absentBtns = screen.getAllByRole("button", { name: /Mark Absent/i });
      fireEvent.click(absentBtns[0]!);

      // Both Aarav and Rohan should now show ABSENT
      const activeAbsentBtns = screen.getAllByRole("button", { name: /^ABSENT$/i });
      expect(activeAbsentBtns.length).toBe(2);
    });

    it("advances input focus on Enter key in marks grid", () => {
      render(
        <MarksEntryGrid
          exams={mockExams}
          allocations={mockAllocations}
          initialExamId="exam-1"
          initialStudents={mockStudents}
          initialIsLocked={false}
        />
      );

      const inputs = screen.getAllByRole("spinbutton");
      const first = inputs[0]!;
      const second = inputs[1]!;

      first.focus();
      fireEvent.keyDown(first, { key: "Enter", code: "Enter" });

      expect(document.activeElement).toBe(second);
    });
  });
});
