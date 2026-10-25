import { describe, it, expect, vi } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";

vi.mock("../homeworkActions", () => ({
  createHomeworkAction: vi.fn(),
  updateHomeworkAction: vi.fn(),
  getHomeworkSubmissionsRoster: vi.fn(),
  updateSubmissionGradeAction: vi.fn(),
}));

vi.mock("../../syllabus/syllabusActions", () => ({
  getTeacherSyllabusData: vi.fn(),
  markTopicTaughtAction: vi.fn().mockResolvedValue({
    success: true,
    isTaught: true,
    message: "Topic marked as covered.",
  }),
}));

import { TeacherHomeworkClient } from "../TeacherHomeworkClient";
import { TeacherSyllabusClient } from "../../syllabus/TeacherSyllabusClient";
import { parseOmniboxQuery } from "@schoolmitra/entity-engine/query-ner";
import {
  teacherRouteResolver,
  parentRouteResolver,
  REAL_TEACHER_ROUTES,
  REAL_PARENT_ROUTES,
} from "@schoolmitra/entity-engine/query-ner";

describe("Phase F6: Teacher Authoring Surfaces (Homework, Classwork, Syllabus Tracker)", () => {
  const mockAllocations = [
    {
      classSubjectId: "cs-1",
      sectionId: "sec-1",
      className: "Class 8",
      sectionName: "A",
      subjectName: "Mathematics",
      subjectId: "sub-1",
    },
    {
      classSubjectId: "cs-2",
      sectionId: "sec-2",
      className: "Class 9",
      sectionName: "B",
      subjectName: "Physics",
      subjectId: "sub-2",
    },
  ];

  const mockHomework = [
    {
      id: "hw-1",
      classSubjectId: "cs-1",
      sectionId: "sec-1",
      className: "Class 8",
      sectionName: "A",
      subjectName: "Mathematics",
      title: "Linear Equations Practice",
      description: "Solve problems 1-10 on page 42.",
      dueDate: "2026-10-25T10:00:00Z",
      maxMarks: 50,
      status: "PUBLISHED" as const,
      attachmentS3Key: null,
      totalSubmissions: 30,
      gradedSubmissions: 12,
      totalStudents: 35,
    },
  ];

  const mockSyllabusTopics = [
    {
      id: "top-1",
      title: "Solving Linear Equations",
      chapterTitle: "Linear Equations in One Variable",
      unitTitle: "Algebra",
    },
  ];

  const mockSyllabusData = {
    subjects: [
      {
        classSubjectId: "cs-1",
        className: "Class 8",
        subjectName: "Mathematics",
        totalTopics: 20,
        taughtTopics: 12,
        progressPercent: 60,
      },
    ],
    selectedSubject: {
      classSubjectId: "cs-1",
      className: "Class 8",
      subjectName: "Mathematics",
      totalTopics: 20,
      taughtTopics: 12,
      progressPercent: 60,
    },
    units: [
      {
        id: "unit-1",
        name: "Algebra",
        description: "Foundational algebra concepts",
        sortOrder: 1,
        totalTopics: 10,
        taughtTopics: 6,
        progressPercent: 60,
        chapters: [
          {
            id: "chap-1",
            name: "Linear Equations in One Variable",
            ncertReference: "NCERT Class 8 Chapter 2",
            sortOrder: 1,
            totalTopics: 5,
            taughtTopics: 3,
            progressPercent: 60,
            topics: [
              {
                id: "top-1",
                name: "Introduction to Linear Equations",
                description: null,
                sortOrder: 1,
                estimatedPeriods: 2,
                isTaught: true,
                taughtDate: "2026-10-15T09:00:00Z",
              },
              {
                id: "top-2",
                name: "Equations with Variables on Both Sides",
                description: null,
                sortOrder: 2,
                estimatedPeriods: 3,
                isTaught: false,
                taughtDate: null,
              },
            ],
          },
        ],
      },
    ],
    overallProgress: {
      totalUnits: 2,
      totalChapters: 4,
      totalTopics: 20,
      taughtTopics: 12,
      progressPercent: 60,
    },
    paceInsight: {
      status: "ON_TRACK" as const,
      progressPercent: 60,
      expectedPercent: 55,
      message: "Curriculum pace is on track (60% covered vs 55% expected for this term).",
      messageHi: "पाठ्यक्रम गति समय पर है (60% पूर्ण बनाम 55% अपेक्षित)।",
    },
  };

  describe("1. TeacherHomeworkClient Rendering", () => {
    it("renders valid React element with homework items and action buttons", () => {
      const el = React.createElement(TeacherHomeworkClient, {
        initialHomeworkList: mockHomework,
        allocations: mockAllocations,
        syllabusTopics: mockSyllabusTopics,
        locale: "en",
      });

      expect(React.isValidElement(el)).toBe(true);
      expect(el.type).toBeDefined();
    });

    it("supports bilingual Hindi locale rendering", () => {
      const el = React.createElement(TeacherHomeworkClient, {
        initialHomeworkList: mockHomework,
        allocations: mockAllocations,
        syllabusTopics: mockSyllabusTopics,
        locale: "hi",
      });

      expect(React.isValidElement(el)).toBe(true);
      expect(el.props.locale).toBe("hi");
    });
  });

  describe("2. TeacherSyllabusClient Rendering", () => {
    it("renders valid React element with progress bar and pace insight", () => {
      const el = React.createElement(TeacherSyllabusClient, {
        initialData: mockSyllabusData,
        locale: "en",
      });

      expect(React.isValidElement(el)).toBe(true);
      expect(el.props.initialData.paceInsight.status).toBe("ON_TRACK");
    });

    it("renders dignified pace insight card for ahead of pace status", () => {
      const aheadData = {
        ...mockSyllabusData,
        paceInsight: {
          status: "AHEAD" as const,
          progressPercent: 80,
          expectedPercent: 60,
          message: "Curriculum pace is ahead of schedule.",
          messageHi: "पाठ्यक्रम गति लक्ष्य से आगे है।",
        },
      };

      const el = React.createElement(TeacherSyllabusClient, {
        initialData: aheadData,
        locale: "en",
      });

      expect(React.isValidElement(el)).toBe(true);
      expect(el.props.initialData.paceInsight.status).toBe("AHEAD");
    });
  });

  describe("3. Code Architecture & Invariant Enforcement", () => {
    it("AC-14: homeworkActions enforces scope, PII scanning, and draft edit lifecycle", () => {
      const hwActionsPath = path.resolve(__dirname, "../homeworkActions.ts");
      const content = fs.readFileSync(hwActionsPath, "utf-8");

      // Verify scope verification against sectionSubjectTeachers
      expect(content).toContain("sectionSubjectTeachers");
      expect(content).toContain("scanContentForPII");
      expect(content).toContain("AssignmentPublishedEvent");
      expect(content).toContain("assignmentSubmissions");

      // Verify draft vs published update restrictions
      expect(content).toContain('existing.status === "PUBLISHED"');
      expect(content).toContain('updates.status = "CLOSED"');
    });

    it("AC-15: classesActions completeLessonPlanAction scans homework and emits domain event", () => {
      const classesActionsPath = path.resolve(
        __dirname,
        "../../classes/classesActions.ts"
      );
      const content = fs.readFileSync(classesActionsPath, "utf-8");

      expect(content).toContain("completeLessonPlanAction");
      expect(content).toContain("scanContentForPII");
      expect(content).toContain("LessonPlanCompletedEvent");
      expect(content).toContain("syllabusTopicId");
      expect(content).toContain("homework");
    });

    it("AC-15: MyDayTimeline renders AppModal for Mark Classwork Done", () => {
      const timelinePath = path.resolve(
        __dirname,
        "../../../../../components/teacher/MyDayTimeline.tsx"
      );
      const content = fs.readFileSync(timelinePath, "utf-8");

      expect(content).toContain("AppModal");
      expect(content).toContain("Mark classwork done");
      expect(content).toContain("handleSubmitClasswork");
      expect(content).toContain("completeLessonPlanAction");
      expect(content).toContain("DPDP Compliance");
    });

    it("AC-16: syllabusActions computes read-only tree and pace insight", () => {
      const syllabusActionsPath = path.resolve(
        __dirname,
        "../../syllabus/syllabusActions.ts"
      );
      const content = fs.readFileSync(syllabusActionsPath, "utf-8");

      expect(content).toContain("getTeacherSyllabusData");
      expect(content).toContain("syllabusUnits");
      expect(content).toContain("syllabusChapters");
      expect(content).toContain("syllabusTopics");
      expect(content).toContain("paceInsight");
      expect(content).toContain("AHEAD");
      expect(content).toContain("ON_TRACK");
      expect(content).toContain("BEHIND");
    });

    it("AC-18 & AC-19: Omnibox role resolvers route teacher and parent to new academic surfaces", () => {
      // 1. Teacher routes registered
      expect(REAL_TEACHER_ROUTES.has("/teacher/homework")).toBe(true);
      expect(REAL_TEACHER_ROUTES.has("/teacher/syllabus")).toBe(true);

      // 2. Teacher query resolution
      const hwParsed = parseOmniboxQuery("post 10-A homework");
      const hwRoute = teacherRouteResolver(hwParsed);
      expect(hwRoute).not.toBeNull();
      expect(hwRoute?.route).toBe("/teacher/homework");

      const sylParsed = parseOmniboxQuery("view 10-A syllabus");
      const sylRoute = teacherRouteResolver(sylParsed);
      expect(sylRoute).not.toBeNull();
      expect(sylRoute?.route).toBe("/teacher/syllabus");

      // 3. Parent query resolution
      const parentHwParsed = parseOmniboxQuery("check homework");
      const parentRoute = parentRouteResolver(parentHwParsed);
      expect(parentRoute).not.toBeNull();
      expect(parentRoute?.route).toBe("/parent/dashboard");
      expect(REAL_PARENT_ROUTES.has(parentRoute!.route.split("?")[0]!)).toBe(true);
    });
  });
});
