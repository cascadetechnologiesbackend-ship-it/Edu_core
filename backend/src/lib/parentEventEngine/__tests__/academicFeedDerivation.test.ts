import { describe, it, expect, vi } from "vitest";
import { assembleAcademicSnapshot } from "../academicSnapshotAssembler";
import { deriveParentFeed, mergeMultiWardFeeds } from "../deriveParentFeed";
import type { ParentDataSnapshot } from "../types";

vi.mock("../../encryption", () => ({
  decryptData: vi.fn((val: string) => {
    if (val === "enc_ananya") return "Ananya";
    if (val === "enc_sharma") return "Sharma";
    return val;
  }),
}));

describe("Academic Feed Data Layer & Derivation (Phase F4)", () => {
  const schoolId = "school-a";
  const studentId = "student-101";
  const classId = "class-10";
  const sectionId = "sec-10a";
  const now = new Date("2026-10-22T10:00:00.000Z"); // Thursday 10:00 UTC

  describe("assembleAcademicSnapshot", () => {
    it("assembles homework, classwork, syllabus coverage, progress, and assessments scoped to section and enrollments", async () => {
      const mockTx = {
        query: {
          classSubjects: {
            findMany: vi.fn(async () => [
              {
                id: "cs-math",
                schoolId,
                classId,
                isElective: false,
                subject: { name: "Mathematics" },
              },
              {
                id: "cs-french",
                schoolId,
                classId,
                isElective: true, // Elective not enrolled
                subject: { name: "French" },
              },
              {
                id: "cs-sanskrit",
                schoolId,
                classId,
                isElective: true, // Elective enrolled
                subject: { name: "Sanskrit" },
              },
            ]),
          },
          studentSubjectEnrollments: {
            findMany: vi.fn(async () => [
              {
                schoolId,
                studentId,
                classSubjectId: "cs-sanskrit",
                status: "ACTIVE",
              },
            ]),
          },
          assignments: {
            findMany: vi.fn(async () => [
              {
                id: "assign-1",
                schoolId,
                classSubjectId: "cs-math",
                sectionId,
                createdByTeacherId: "teacher-1",
                title: "Quadratic Equations Exercise 4.2",
                description: "Solve questions 1 through 10 in homework notebook",
                dueDate: new Date("2026-10-23T18:00:00.000Z"), // tomorrow
                status: "PUBLISHED",
                attachmentS3Key: "hw/math-ex-4.2.pdf",
              },
            ]),
          },
          assignmentSubmissions: {
            findMany: vi.fn(async () => []),
          },
          lessonPlans: {
            findMany: vi.fn(async () => [
              {
                id: "lp-1",
                schoolId,
                classSubjectId: "cs-math",
                teacherId: "teacher-1",
                chapterName: "Chapter 4: Quadratic Equations",
                title: "Solving by Factorization",
                objectives: "Understand splitting the middle term",
                homework: "Exercise 4.2 Q1-Q5",
                completedDate: new Date("2026-10-22T08:30:00.000Z"),
                status: "COMPLETED",
                syllabusTopic: {
                  name: "4.2 Solution of a Quadratic Equation by Factorisation",
                },
              },
            ]),
            findFirst: vi.fn(async () => ({
              id: "lp-1",
              chapterName: "Chapter 4: Quadratic Equations",
              title: "Solving by Factorization",
              syllabusTopic: {
                name: "4.2 Solution of a Quadratic Equation by Factorisation",
                chapter: {
                  name: "Chapter 4: Quadratic Equations",
                  sortOrder: 4,
                  unit: {
                    name: "Unit 2: Algebra",
                    sortOrder: 2,
                  },
                },
              },
            })),
          },
          staff: {
            findMany: vi.fn(async () => [
              {
                userId: "teacher-1",
                firstNameEncrypted: "enc_ananya",
                lastNameEncrypted: "enc_sharma",
              },
            ]),
          },
          academicTerms: {
            findFirst: vi.fn(async () => ({
              id: "term-1",
              name: "Term 1 (2026-27)",
              isActive: true,
            })),
          },
          syllabusUnits: {
            findMany: vi.fn(async () => [
              {
                id: "unit-2",
                name: "Unit 2: Algebra",
                sortOrder: 2,
                chapters: [
                  {
                    id: "chap-4",
                    name: "Chapter 4: Quadratic Equations",
                    sortOrder: 4,
                    topics: [
                      { id: "top-4.1", name: "4.1 Introduction", isActive: true },
                      { id: "top-4.2", name: "4.2 Factorisation", isActive: true },
                      { id: "top-4.3", name: "4.3 Completing the Square", isActive: true },
                    ],
                  },
                ],
              },
            ]),
          },
          assessments: {
            findMany: vi.fn(async () => [
              {
                id: "asmt-1",
                schoolId,
                classSubjectId: "cs-math",
                sectionId,
                title: "Mid-Term Assessment — Algebra",
                assessmentType: "MIDTERM",
                date: "2026-10-28",
                maxMarks: 50,
                syllabusCoverage: "Units 1 and 2 (Real Numbers, Polynomials, Quadratic Equations)",
                status: "SCHEDULED",
                updatedAt: new Date("2026-10-20T12:00:00.000Z"),
              },
            ]),
          },
        },
      };

      const result = await assembleAcademicSnapshot(mockTx, {
        schoolId,
        studentId,
        currentClassId: classId,
        currentSectionId: sectionId,
        now,
      });

      // 1. Homework verified
      expect(result.homework).toHaveLength(1);
      expect(result.homework[0].title).toBe("Quadratic Equations Exercise 4.2");
      expect(result.homework[0].subjectName).toBe("Mathematics");
      expect(result.homework[0].teacherName).toBe("Ananya Sharma");
      expect(result.homework[0].isSubmitted).toBe(false);

      // 2. Classwork verified
      expect(result.classwork).toHaveLength(1);
      expect(result.classwork[0].subjectName).toBe("Mathematics");
      expect(result.classwork[0].chapterName).toBe("Chapter 4: Quadratic Equations");
      expect(result.classwork[0].homework).toBe("Exercise 4.2 Q1-Q5");

      // 3. Syllabus Coverage verified
      expect(result.syllabusCoverage).toBeDefined();
      expect(result.syllabusCoverage?.items[0].unitTitle).toBe("Unit 2: Algebra");
      expect(result.syllabusCoverage?.items[0].topicTitle).toContain("Factorisation");

      // 4. Curriculum Progress verified
      expect(result.curriculumProgress).toBeDefined();
      expect(result.curriculumProgress?.subjects).toHaveLength(2); // Math + Sanskrit (enrolled), French excluded
      const mathProgress = result.curriculumProgress?.subjects.find(
        (s) => s.subjectName === "Mathematics"
      );
      expect(mathProgress?.completedTopicsCount).toBe(1);
      expect(mathProgress?.totalTopicsCount).toBe(3);
      expect(mathProgress?.progressPercentage).toBe(33);

      // 5. Assessments verified
      expect(result.upcomingAssessments).toHaveLength(1);
      expect(result.upcomingAssessments[0].title).toBe("Mid-Term Assessment — Algebra");
      expect(result.upcomingAssessments[0].maxMarks).toBe(50);
    });
  });

  describe("deriveParentFeed with Academic Cards", () => {
    it("generates HomeworkPostCard, ClassworkPostCard, SyllabusCoverageCard, CurriculumProgressCard, and AssessmentScheduledCard", () => {
      const snapshot: ParentDataSnapshot = {
        studentName: "Aarav",
        homework: [
          {
            id: "hw-1",
            title: "Trigonometry Heights & Distances",
            subjectName: "Mathematics",
            dueDate: new Date("2026-10-23T18:00:00.000Z"), // tomorrow
            status: "PUBLISHED",
            teacherName: "Ananya Sharma",
            isSubmitted: false,
          },
          {
            id: "hw-draft",
            title: "Draft Homework Not Published",
            subjectName: "Science",
            dueDate: new Date("2026-10-25T18:00:00.000Z"),
            status: "DRAFT", // DRAFT should not appear
            isSubmitted: false,
          },
        ],
        classwork: [
          {
            id: "cw-1",
            subjectName: "Science",
            chapterName: "Acids, Bases and Salts",
            topicTitle: "pH Scale in Everyday Life",
            objectives: "Importance of pH in soil and digestive system",
            homework: "Read NCERT page 26",
            completedDate: new Date("2026-10-22T09:00:00.000Z"),
            teacherName: "Dr. Vikram Seth",
          },
        ],
        syllabusCoverage: {
          weekLabel: "Week of Oct 19",
          items: [
            {
              subjectName: "Mathematics",
              unitTitle: "Algebra",
              chapterTitle: "Quadratic Equations",
              topicTitle: "Factorisation",
              status: "COMPLETED",
            },
          ],
          generatedAt: new Date("2026-10-22T00:00:00.000Z"),
        },
        curriculumProgress: {
          termName: "Term 1",
          subjects: [
            {
              subjectId: "sub-math",
              subjectName: "Mathematics",
              completedTopicsCount: 8,
              totalTopicsCount: 12,
              progressPercentage: 67,
            },
          ],
          generatedAt: new Date("2026-10-22T00:00:00.000Z"),
        },
        upcomingAssessments: [
          {
            id: "asmt-1",
            title: "Unit Test 2 — Light Reflection",
            subjectName: "Science",
            assessmentType: "UNIT_TEST",
            scheduledDate: "2026-10-26",
            maxMarks: 25,
            syllabusCoverage: "Ray diagrams, concave mirrors",
            status: "SCHEDULED",
            updatedAt: new Date("2026-10-21T10:00:00.000Z"),
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);

      // 1. Verify DRAFT homework is excluded
      const draftHw = feed.find((c) => c.payload?.title === "Draft Homework Not Published");
      expect(draftHw).toBeUndefined();

      // 2. Verify HomeworkPostCard
      const hwCard = feed.find((c) => c.cardType === "HomeworkPostCard");
      expect(hwCard).toBeDefined();
      expect(hwCard?.title.en).toBe("Mathematics: Trigonometry Heights & Distances");
      expect(hwCard?.summary.en).toContain("Due tomorrow");
      expect(hwCard?.summary.en).toContain("Pending Submission");
      expect(hwCard?.payload.teacherName).toBe("Ananya Sharma");

      // 3. Verify ClassworkPostCard
      const cwCard = feed.find((c) => c.cardType === "ClassworkPostCard");
      expect(cwCard).toBeDefined();
      expect(cwCard?.title.en).toBe("Today in Science");
      expect(cwCard?.summary.en).toContain("Acids, Bases and Salts");
      expect(cwCard?.summary.en).toContain("pH Scale");
      expect(cwCard?.summary.en).toContain("Read NCERT page 26");

      // 4. Verify SyllabusCoverageCard
      const scCard = feed.find((c) => c.cardType === "SyllabusCoverageCard");
      expect(scCard).toBeDefined();
      expect(scCard?.title.en).toContain("Week of Oct 19");
      expect(scCard?.summary.en).toContain("Mathematics");

      // 5. Verify CurriculumProgressCard
      const cpCard = feed.find((c) => c.cardType === "CurriculumProgressCard");
      expect(cpCard).toBeDefined();
      expect(cpCard?.summary.en).toContain("67%");

      // 6. Verify AssessmentScheduledCard
      const asmtCard = feed.find((c) => c.cardType === "AssessmentScheduledCard");
      expect(asmtCard).toBeDefined();
      expect(asmtCard?.title.en).toContain("UNIT TEST");
      expect(asmtCard?.summary.en).toContain("Max Marks: 25");
      expect(asmtCard?.summary.en).toContain("Ray diagrams");
    });

    it("pins OVERDUE fees and missed attendance to Needs Attention strip while streaming academic cards chronologically", () => {
      const snapshot: ParentDataSnapshot = {
        studentName: "Aarav",
        invoices: [
          {
            id: "inv-overdue",
            termName: "Term 1 Tuition",
            status: "OVERDUE",
            dueDate: new Date("2026-10-01"),
            balanceAmount: 12000,
            lateFeeAmount: 500,
          },
        ],
        attendanceToday: {
          status: "ABSENT",
          markedAt: new Date("2026-10-22T08:30:00.000Z"),
          remarks: "Unexcused morning absence",
        },
        classwork: [
          {
            id: "cw-1",
            subjectName: "English",
            chapterName: "The Road Not Taken",
            completedDate: new Date("2026-10-22T09:30:00.000Z"),
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);

      // Pinned items come first
      expect(feed[0].isPinned).toBe(true);
      expect(feed[1].isPinned).toBe(true);
      expect(feed[0].cardType).toMatch(/PaymentCard|AttendanceCard/);
      expect(feed[1].cardType).toMatch(/PaymentCard|AttendanceCard/);

      // Unpinned academic card follows
      expect(feed[2].cardType).toBe("ClassworkPostCard");
      expect(feed[2].isPinned).toBe(false);
    });

    it("merges multi-ward academic cards chronologically with ward attribution", () => {
      const feedA = deriveParentFeed("ward-a", now, {
        classwork: [
          {
            id: "cw-a",
            subjectName: "Science",
            chapterName: "Electricity",
            completedDate: new Date("2026-10-22T09:00:00.000Z"),
          },
        ],
      }, { wardName: "Aarav" });

      const feedB = deriveParentFeed("ward-b", now, {
        classwork: [
          {
            id: "cw-b",
            subjectName: "History",
            chapterName: "The French Revolution",
            completedDate: new Date("2026-10-22T10:30:00.000Z"),
          },
        ],
      }, { wardName: "Priya" });

      const merged = mergeMultiWardFeeds([
        { wardName: "Aarav", cards: feedA },
        { wardName: "Priya", cards: feedB },
      ], now);

      expect(merged).toHaveLength(2);
      // Newest occurredAt first (10:30 before 09:00)
      expect(merged[0].payload.subjectName).toBe("History");
      expect(merged[0].wardName).toBe("Priya");
      expect(merged[1].payload.subjectName).toBe("Science");
      expect(merged[1].wardName).toBe("Aarav");
    });
  });
});
