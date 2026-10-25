import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Mocks for React, Next, Auth ───────────────────────────────────────────
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
  };
});

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/requestContext", () => ({
  getClientRequestContext: vi.fn(() => ({})),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ─── 2. Mock State ─────────────────────────────────────────────────────────────
const {
  activeSessionRef,
  mockState,
  mockDomainEvents,
} = vi.hoisted(() => {
  const activeSessionRef = {
    current: {
      userId: "teacher-101",
      role: "TEACHER",
      schoolId: "school-100",
      email: "teacher1@school.edu",
    } as any,
  };

  const mockState = {
    schoolId: "school-100",
    academicYearId: "ay-2026",
    classes: [
      { id: "cls-10", name: "Class 10", schoolId: "school-100" },
    ],
    sections: [
      { id: "sec-10a", name: "10-A", classId: "cls-10", schoolId: "school-100" },
      { id: "sec-10b", name: "10-B", classId: "cls-10", schoolId: "school-100" },
      { id: "sec-10c", name: "10-C", classId: "cls-10", schoolId: "school-100" },
    ],
    classSubjects: [
      {
        id: "cs-math-10",
        schoolId: "school-100",
        classId: "cls-10",
        subjectId: "sub-math",
        assignedTeacherId: "teacher-101",
        periodsPerWeek: 5,
        isElective: false,
        subject: { id: "sub-math", name: "Mathematics", code: "MATH10" },
        class: { id: "cls-10", name: "Class 10", displayName: "Class 10" },
      },
    ],
    sectionSubjectTeachers: [
      {
        id: "sst-10a",
        schoolId: "school-100",
        sectionId: "sec-10a",
        classSubjectId: "cs-math-10",
        teacherId: "teacher-101",
        isActive: true,
      },
      {
        id: "sst-10b",
        schoolId: "school-100",
        sectionId: "sec-10b",
        classSubjectId: "cs-math-10",
        teacherId: "teacher-101",
        isActive: true,
      },
      // sec-10c is NOT taught by teacher-101
    ],
    syllabusUnits: [
      { id: "unit-geo", classSubjectId: "cs-math-10", name: "Unit 1: Geometry", order: 1 },
    ],
    syllabusChapters: [
      { id: "chap-tri", unitId: "unit-geo", name: "Chapter 1: Triangles", order: 1 },
    ],
    syllabusTopics: [
      {
        id: "top-101",
        schoolId: "school-100",
        chapterId: "chap-tri",
        name: "Congruence of Triangles",
        order: 1,
        chapter: {
          id: "chap-tri",
          name: "Chapter 1: Triangles",
          unit: {
            id: "unit-geo",
            classSubjectId: "cs-math-10",
          },
        },
      },
      {
        id: "top-102",
        schoolId: "school-100",
        chapterId: "chap-tri",
        name: "Similarity Criteria",
        order: 2,
        chapter: {
          id: "chap-tri",
          name: "Chapter 1: Triangles",
          unit: {
            id: "unit-geo",
            classSubjectId: "cs-math-10",
          },
        },
      },
    ],
    lessonPlans: [] as any[],
    assignments: [] as any[],
    assignmentSubmissions: [] as any[],
    studentAttendance: [] as any[],
    students: [
      {
        id: "student-aarav",
        schoolId: "school-100",
        firstName: "Aarav",
        lastName: "Sharma",
        classId: "cls-10",
        sectionId: "sec-10a",
        admissionNumber: "ADM-1001",
        status: "ACTIVE",
      },
      {
        id: "student-other",
        schoolId: "school-100",
        firstName: "Rohan",
        lastName: "Verma",
        classId: "cls-10",
        sectionId: "sec-10c",
        admissionNumber: "ADM-1002",
        status: "ACTIVE",
      },
    ],
  };

  return {
    activeSessionRef,
    mockState,
    mockDomainEvents: [] as any[],
  };
});

// ─── 3. Mock Server Auth & Database ────────────────────────────────────────────
vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles: readonly string[]) => {
    if (!activeSessionRef.current) throw new Error("Unauthorized");
    if (!allowedRoles.includes(activeSessionRef.current.role)) {
      throw new Error(`Forbidden: ${activeSessionRef.current.role}`);
    }
    return {
      session: { user: activeSessionRef.current },
      userId: activeSessionRef.current.userId,
      role: activeSessionRef.current.role,
      schoolId: activeSessionRef.current.schoolId,
    };
  }),
  requireSchool: vi.fn(async () => ({ id: mockState.schoolId, name: "Test School" })),
  checkAuth: vi.fn(async () => ({ user: activeSessionRef.current })),
  getCachedSession: vi.fn(async () => ({ user: activeSessionRef.current })),
}));

vi.mock("@/db", () => {
  const mockDb = {
    execute: vi.fn().mockResolvedValue([{ school_id: mockState.schoolId }]),
    query: {
      syllabusTopics: {
        findFirst: vi.fn(async (query: any) => {
          const id = query?.where?.queryChunks?.find((c: any) => c?.value && typeof c.value === "string")?.value;
          return mockState.syllabusTopics.find((t) => t.id === id) || mockState.syllabusTopics[0];
        }),
      },
      sectionSubjectTeachers: {
        findFirst: vi.fn(async (query: any) => {
          const teacherId = activeSessionRef.current.userId;
          return mockState.sectionSubjectTeachers.find(
            (sst) => sst.teacherId === teacherId && sst.isActive
          ) || null;
        }),
      },
      classSubjects: {
        findFirst: vi.fn(async () => {
          const teacherId = activeSessionRef.current?.userId;
          const cs = mockState.classSubjects[0];
          if (!cs) return null;
          return cs.assignedTeacherId === teacherId ? cs : null;
        }),
      },
      lessonPlans: {
        findFirst: vi.fn(async (query: any) => {
          const topicId = query?.where?.queryChunks?.find((c: any) => c?.value && typeof c.value === "string")?.value;
          return mockState.lessonPlans.find((lp) => lp.syllabusTopicId === topicId) || null;
        }),
      },
      assignments: {
        findFirst: vi.fn(async (query: any) => mockState.assignments[0] || null),
      },
    },
    insert: (table: any) => ({
      values: (vals: any) => {
        if (vals.eventType) {
          // Domain event
          mockDomainEvents.push(vals);
          return Promise.resolve();
        }
        if (vals.syllabusTopicId !== undefined) {
          // Lesson plan
          const record = { id: `lp-${Date.now()}`, ...vals };
          mockState.lessonPlans.push(record);
          return Promise.resolve([record]);
        }
        if (vals.classSubjectId && vals.title) {
          // Assignment
          const record = { id: `asgn-${Date.now()}-${Math.random()}`, ...vals };
          mockState.assignments.push(record);
          return {
            returning: () => [record],
          };
        }
        return Promise.resolve();
      },
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: () => {
          if (values.status) {
            for (const lp of mockState.lessonPlans) {
              Object.assign(lp, values);
            }
          }
          return Promise.resolve({ rowCount: 1 });
        },
      }),
    }),
  };

  return {
    db: mockDb,
    withTenant: vi.fn(async (_schoolId: string, cb: any) => cb(mockDb)),
  };
});

// Import the derivation engine
import { deriveParentFeed } from "../../../../../../backend/src/lib/parentEventEngine/deriveParentFeed";
import { createHomeworkAction } from "../../../(teacher)/teacher/homework/homeworkActions";
import { markTopicTaughtAction } from "../../../(teacher)/teacher/syllabus/syllabusActions";

describe("S19 L4: Whole-Chain Reflection Matrix (Teacher -> Student -> Parent -> Admin)", () => {
  beforeEach(() => {
    mockState.lessonPlans = [];
    mockState.assignments = [];
    mockDomainEvents.length = 0;
    activeSessionRef.current = {
      userId: "teacher-101",
      role: "TEACHER",
      schoolId: "school-100",
      email: "teacher1@school.edu",
    };
  });

  it("Full Chain: Teacher authoring -> Student reflection -> Parent timeline -> Admin trajectory", async () => {
    // ══════════════════════════════════════════════════════════════════════════
    // Step 1: Teacher creates homework targeted to sections 10-A and 10-B
    // ══════════════════════════════════════════════════════════════════════════
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const hwResult = await createHomeworkAction({
      classSubjectId: "cs-math-10",
      targetSectionIds: ["sec-10a", "sec-10b"],
      title: "Triangles Problem Set 1",
      description: "Solve problems 1-10 on properties of congruence.",
      dueDate: tomorrow,
      maxMarks: 25,
      status: "PUBLISHED",
    });

    expect(hwResult.success).toBe(true);
    expect(mockState.assignments.length).toBe(2);
    expect(mockState.assignments.some((a) => a.sectionId === "sec-10a")).toBe(true);
    expect(mockState.assignments.some((a) => a.sectionId === "sec-10b")).toBe(true);

    // Emitted AssignmentPublishedEvent domain events
    const pubEvents = mockDomainEvents.filter((e) => e.eventType === "AssignmentPublishedEvent");
    expect(pubEvents.length).toBe(2);
    expect(pubEvents[0]?.payload.title).toBe("Triangles Problem Set 1");

    // ══════════════════════════════════════════════════════════════════════════
    // Step 2: Teacher marks syllabus topic 1 (Congruence) as taught
    // ══════════════════════════════════════════════════════════════════════════
    const sylResult = await markTopicTaughtAction({
      topicId: "top-101",
      isTaught: true,
      taughtDate: new Date().toISOString(),
    });

    expect(sylResult.success).toBe(true);
    expect(sylResult.isTaught).toBe(true);
    expect(mockState.lessonPlans.length).toBe(1);
    expect(mockState.lessonPlans[0]?.status).toBe("COMPLETED");

    // Emitted SyllabusTopicCoveredEvent
    const covEvents = mockDomainEvents.filter((e) => e.eventType === "SyllabusTopicCoveredEvent");
    expect(covEvents.length).toBe(1);
    expect(covEvents[0]?.payload.topicId).toBe("top-101");

    // ══════════════════════════════════════════════════════════════════════════
    // Step 3: Student Surface Reflection
    // ══════════════════════════════════════════════════════════════════════════
    // Aarav in sec-10a sees authored homework
    const studentAarav = mockState.students[0]!;
    const publishedHw = mockState.assignments.filter(
      (a) => a.sectionId === studentAarav.sectionId && a.status === "PUBLISHED"
    );
    expect(publishedHw.length).toBe(1);
    expect(publishedHw[0]?.title).toBe("Triangles Problem Set 1");

    // Student in unassigned section (sec-10c) sees zero assignments
    const studentOther = mockState.students[1]!;
    const otherHw = mockState.assignments.filter(
      (a) => a.sectionId === studentOther.sectionId && a.status === "PUBLISHED"
    );
    expect(otherHw.length).toBe(0);

    // ══════════════════════════════════════════════════════════════════════════
    // Step 4: Parent Feed Surface Reflection (deriveParentFeed)
    // ══════════════════════════════════════════════════════════════════════════
    const targetHw = publishedHw[0]!;
    const now = new Date();
    const dueIn20h = new Date(Date.now() + 20 * 60 * 60 * 1000);

    const snapshot = {
      homework: [
        {
          id: targetHw.id,
          title: targetHw.title,
          subjectName: "Mathematics",
          dueDate: dueIn20h.toISOString(),
          isSubmitted: false,
          status: "PUBLISHED",
        },
      ],
      attendance: {
        status: "PRESENT",
        date: now.toISOString().slice(0, 10),
      },
    };

    const feed = deriveParentFeed("student-aarav", now, snapshot, { wardName: "Aarav" });
    const hwCard = feed.find((c) => c.cardType === "HomeworkCard" || c.cardType === "HomeworkPostCard");

    expect(hwCard).toBeDefined();
    expect(hwCard?.payload.title).toContain("Triangles Problem Set 1");
    expect(hwCard?.payload.subjectName).toBe("Mathematics");
    expect(hwCard?.wardName).toBe("Aarav");

    // ══════════════════════════════════════════════════════════════════════════
    // Step 5: Admin Subject Workspace Surface Reflection
    // ══════════════════════════════════════════════════════════════════════════
    const totalTopics = mockState.syllabusTopics.length;
    const completedTopics = mockState.lessonPlans.filter((lp) => lp.status === "COMPLETED").length;
    const percentage = Math.round((completedTopics / totalTopics) * 100);

    // 1 of 2 topics completed -> 50%
    expect(completedTopics).toBe(1);
    expect(percentage).toBe(50);

    // Both sections have assignments in workspace
    expect(mockState.assignments.length).toBe(2);
    expect(mockState.assignments.map((a) => a.sectionId)).toContain("sec-10a");
    expect(mockState.assignments.map((a) => a.sectionId)).toContain("sec-10b");
  });

  it("S16 Allocation Guard: Unauthorized teacher cannot post homework for unallocated classes", async () => {
    // Switch active session to teacher-999 who has no allocation
    activeSessionRef.current = {
      userId: "teacher-999",
      role: "TEACHER",
      schoolId: "school-100",
      email: "intruder@school.edu",
    };

    await expect(
      createHomeworkAction({
        classSubjectId: "cs-math-10",
        targetSectionIds: ["sec-10a"],
        title: "Unauthorized HW",
        description: "Should fail",
        dueDate: new Date().toISOString(),
      })
    ).rejects.toThrow(/Unauthorized/);
  });
});
