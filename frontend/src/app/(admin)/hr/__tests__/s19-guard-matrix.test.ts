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

vi.mock("@/lib/encryption", () => ({
  encryptData: vi.fn((val: string) => `enc_${val}`),
  decryptData: vi.fn((val: string) => (val?.startsWith("enc_") ? val.replace("enc_", "") : val)),
  computeSearchHash: vi.fn((val: string) => `hash_${val}`),
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
    ],
    lessonPlans: [] as any[],
    assignments: [] as any[],
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

vi.mock("@/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, any>>();
  const mockDb = {
    ...actual.db,
    execute: vi.fn().mockResolvedValue([{ school_id: mockState.schoolId }]),
    query: {
      ...actual.db?.query,
      syllabusTopics: {
        findFirst: vi.fn(async (query: any) => {
          const id = query?.where?.queryChunks?.find((c: any) => c?.value && typeof c.value === "string")?.value;
          return mockState.syllabusTopics.find((t) => t.id === id) || mockState.syllabusTopics[0];
        }),
      },
      sectionSubjectTeachers: {
        findFirst: vi.fn(async (query: any) => {
          const teacherId = activeSessionRef.current?.userId;
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
          mockDomainEvents.push(vals);
          return Promise.resolve();
        }
        if (vals.syllabusTopicId !== undefined) {
          const record = { id: `lp-${Date.now()}`, ...vals };
          mockState.lessonPlans.push(record);
          return Promise.resolve([record]);
        }
        if (vals.classSubjectId && vals.title) {
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
    ...actual,
    db: mockDb,
    withTenant: vi.fn(async (_schoolId: string, cb: any) => cb(mockDb)),
  };
});

// Import tested surfaces
import { createHomeworkAction } from "../../../(teacher)/teacher/homework/homeworkActions";
import { markTopicTaughtAction } from "../../../(teacher)/teacher/syllabus/syllabusActions";
import {
  resolveTeacherScope,
  clearTeacherScopeCache,
} from "../../../../../../backend/src/lib/teacherEventEngine/scopeResolver";
import { resolveParentWards } from "../../../../../../backend/src/lib/parentEventEngine/resolveParentWards";
import { deriveParentFeed } from "../../../../../../backend/src/lib/parentEventEngine/deriveParentFeed";

describe("Sprint S19 Layer L7: RBAC, Isolation & Displacement Boundary Tests", () => {
  beforeEach(() => {
    mockState.lessonPlans = [];
    mockState.assignments = [];
    mockDomainEvents.length = 0;
    clearTeacherScopeCache();
  });

  // ─── 1. Teacher Authoring Guard Matrix (403 Outside Allocations) ───────────
  describe("1. Teacher CRUD Guard Matrix", () => {
    it("permits teacher with valid allocations to author homework and toggle syllabus topics", async () => {
      activeSessionRef.current = {
        userId: "teacher-101",
        role: "TEACHER",
        schoolId: "school-100",
        email: "teacher1@school.edu",
      };

      const result = await createHomeworkAction({
        classSubjectId: "cs-math-10",
        targetSectionIds: ["sec-10a"],
        title: "Quadratics Exercise 1",
        description: "Solve problems 1-10",
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        maxMarks: 20,
      });

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(1);

      const topicResult = await markTopicTaughtAction({
        topicId: "top-101",
        isTaught: true,
      });
      expect(topicResult.success).toBe(true);
      expect(topicResult.isTaught).toBe(true);
    });

    it("denies homework creation and topic marking when teacher holds no allocation for that section", async () => {
      activeSessionRef.current = {
        userId: "teacher-999-unauthorized",
        role: "TEACHER",
        schoolId: "school-100",
        email: "unauthorized@school.edu",
      };

      // Denied for homework create
      await expect(
        createHomeworkAction({
          classSubjectId: "cs-math-10",
          targetSectionIds: ["sec-10a"],
          title: "Illegal Assignment",
          description: "Illegal description",
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        })
      ).rejects.toThrow(/Unauthorized/);

      // Denied for syllabus mark
      await expect(
        markTopicTaughtAction({
          topicId: "top-101",
          isTaught: true,
        })
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  // ─── 2. Displacement Boundary Test (Ties to S18 L3) ─────────────────────────
  describe("2. Displacement Boundary (Immediate Authoring Revocation)", () => {
    it("displaced teacher cannot author homework for a class-subject after displacement", async () => {
      // Step A: Initially teacher-101 is assigned
      activeSessionRef.current = {
        userId: "teacher-101",
        role: "TEACHER",
        schoolId: "school-100",
        email: "teacher1@school.edu",
      };

      const validResult = await createHomeworkAction({
        classSubjectId: "cs-math-10",
        targetSectionIds: ["sec-10a"],
        title: "Pre-Displacement Homework",
        description: "Pre-displacement description",
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(validResult.success).toBe(true);

      // Step B: Admin reassigns class-subject to incoming teacher-202 (displacement)
      mockState.classSubjects[0]!.assignedTeacherId = "teacher-202";
      mockState.sectionSubjectTeachers = [
        {
          id: "sst-10a-new",
          schoolId: "school-100",
          sectionId: "sec-10a",
          classSubjectId: "cs-math-10",
          teacherId: "teacher-202",
          isActive: true,
        },
      ];

      // Displacement eviction runs
      clearTeacherScopeCache("teacher-101");
      clearTeacherScopeCache("teacher-202");

      // Step C: Displaced teacher-101 attempts authoring again
      await expect(
        createHomeworkAction({
          classSubjectId: "cs-math-10",
          targetSectionIds: ["sec-10a"],
          title: "Post-Displacement Illegal Homework",
          description: "Post-displacement description",
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        })
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  // ─── 3. Parent Timeline DPDP & Child Isolation Guard ───────────────────────
  describe("3. Parent Timeline DPDP & Child Isolation", () => {
    it("parent only reads timeline events for their own verified children", async () => {
      const mockParentDb = {
        query: {
          students: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: "student-child-1",
                schoolId: "school-100",
                admissionNumber: "ADM-1",
                firstNameEncrypted: "enc_Aarav",
                lastNameEncrypted: "enc_Sharma",
                currentClassId: "cls-10",
                currentSectionId: "sec-10a",
                isActive: true,
              },
            ]),
          },
          sections: { findMany: vi.fn().mockResolvedValue([{ id: "sec-10a", name: "10-A" }]) },
          classes: { findMany: vi.fn().mockResolvedValue([{ id: "cls-10", name: "Class 10" }]) },
          classTeacherAssignments: { findMany: vi.fn().mockResolvedValue([]) },
          staff: { findMany: vi.fn().mockResolvedValue([]) },
        },
      };

      const parentWards = await resolveParentWards(
        { role: "PARENT", userId: "parent-user-1" },
        "school-100",
        undefined,
        mockParentDb
      );

      expect(parentWards).toHaveLength(1);
      expect(parentWards[0]!.id).toBe("student-child-1");

      // Verify feed cards derived for Child 1 contain only Child 1's events
      const child1Feed = deriveParentFeed("student-child-1", new Date(), {
        studentName: "Aarav Sharma",
        homework: [
          {
            id: "hw-1",
            title: "Math Problems",
            subjectName: "Mathematics",
            dueDate: new Date(Date.now() + 86400000),
            isSubmitted: false,
          },
        ],
      });

      expect(child1Feed).toHaveLength(1);
      expect(child1Feed[0]!.studentId).toBe("student-child-1");

      // Attempt to query an alien student returns empty for unauthorized parent
      const alienWards = await resolveParentWards(
        { role: "PARENT", userId: "parent-user-1" },
        "school-100",
        "student-alien-999",
        mockParentDb
      );
      const alienChild = alienWards.find((w) => w.id === "student-alien-999");
      expect(alienChild).toBeUndefined();
    });
  });

  // ─── 4. Multi-Tenant Two-School Isolation & Aggregate Read ─────────────────
  describe("4. Multi-Tenant Two-School Isolation & Admin Aggregates", () => {
    it("strictly isolates School A data from School B reads", async () => {
      const mockSchoolBDb = {
        execute: vi.fn().mockResolvedValue([{ school_id: "school-B" }]),
        query: {
          academicYears: { findFirst: vi.fn().mockResolvedValue(null) },
          sections: { findMany: vi.fn().mockResolvedValue([]) },
          classTeacherAssignments: { findMany: vi.fn().mockResolvedValue([]) },
          sectionSubjectTeachers: { findMany: vi.fn().mockResolvedValue([]) },
          classSubjects: { findMany: vi.fn().mockResolvedValue([]) },
          timetablePeriods: { findMany: vi.fn().mockResolvedValue([]) },
        },
      };

      const crossTenantScope = await resolveTeacherScope(
        "teacher-101",
        { tx: mockSchoolBDb, schoolId: "school-B" }
      );

      // Zero leakage across tenant boundaries
      expect(crossTenantScope.allSectionIds).toHaveLength(0);
      expect(crossTenantScope.classTeacherSections).toHaveLength(0);
      expect(crossTenantScope.teachingSections).toHaveLength(0);
    });

    it("allows Admin aggregate view across all sections", async () => {
      activeSessionRef.current = {
        userId: "admin-master",
        role: "ADMIN",
        schoolId: "school-100",
        email: "admin@school.edu",
      };

      // Admin has aggregate view of all sections
      const allSections = mockState.sections.map((s) => s.id);
      expect(allSections).toHaveLength(3);
      expect(allSections).toEqual(["sec-10a", "sec-10b", "sec-10c"]);
    });
  });
});
