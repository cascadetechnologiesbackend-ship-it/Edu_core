import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Mock React cache ───────────────────────────────────────────────────────
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ─── 2. Hoisted Mock State ─────────────────────────────────────────────────────
const {
  mockClassSubjectsUpdate,
  mockSectionSubjectTeachersInsert,
  mockInvalidateTeachingStaffCache,
  mockClearTeacherScopeCache,
} = vi.hoisted(() => ({
  mockClassSubjectsUpdate: vi.fn(),
  mockSectionSubjectTeachersInsert: vi.fn(),
  mockInvalidateTeachingStaffCache: vi.fn(),
  mockClearTeacherScopeCache: vi.fn(),
}));

vi.mock("@/app/(admin)/hr/teachingStaff", () => ({
  invalidateTeachingStaffCache: mockInvalidateTeachingStaffCache,
  getCanonicalTeachingStaff: vi.fn(),
}));

vi.mock("@/lib/teacherEventEngine/scopeResolver", () => ({
  clearTeacherScopeCache: mockClearTeacherScopeCache,
}));

// ─── 3. Mock Database & Tenant ─────────────────────────────────────────────────
const mockClassSubjectRecord = {
  id: "cs-101",
  schoolId: "school-1",
  classId: "class-1",
  subjectId: "subj-1",
  assignedTeacherId: "teacher-old-1",
  periodsPerWeek: 5,
  isElective: false,
};

const mockActiveYear = {
  id: "ay-2026",
  schoolId: "school-1",
  isActive: true,
};

const mockSections = [
  { id: "sec-A", name: "A", classId: "class-1", schoolId: "school-1", isActive: true },
  { id: "sec-B", name: "B", classId: "class-1", schoolId: "school-1", isActive: true },
];

vi.mock("@/db", () => {
  const mockDb = {
    query: {
      classSubjects: {
        findFirst: vi.fn(async () => ({ ...mockClassSubjectRecord })),
      },
      academicYears: {
        findFirst: vi.fn(async () => ({ ...mockActiveYear })),
      },
      sections: {
        findMany: vi.fn(async () => [...mockSections]),
      },
      sectionSubjectTeachers: {
        findFirst: vi.fn(async ({ where }: any) => {
          // Simulate section B having an existing override, section A having none
          return null;
        }),
      },
    },
    update: (table: any) => ({
      set: (values: any) => ({
        where: (condition: any) => {
          mockClassSubjectsUpdate(values);
          return Promise.resolve({ rowCount: 1 });
        },
      }),
    }),
    insert: (table: any) => ({
      values: (values: any) => {
        mockSectionSubjectTeachersInsert(values);
        return {
          returning: () => [{ id: "sst-new-id", ...values }],
        };
      },
    }),
  };

  return {
    db: mockDb,
    withTenant: vi.fn(async (_schoolId: string, callback: (tx: any) => Promise<any>) => {
      return callback(mockDb);
    }),
  };
});

// ─── 4. Import Target Domain Function ──────────────────────────────────────────
import { setClassSubjectLead } from "../actions/teacher-assignment.actions";

describe("S18 L2: Consolidated setClassSubjectLead Domain Function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Updates classSubjects.assignedTeacherId and auto-seeds active sections", async () => {
    const res = await setClassSubjectLead({
      schoolId: "school-1",
      classSubjectId: "cs-101",
      teacherId: "teacher-new-2",
      periodsPerWeek: 6,
    });

    expect(res.success).toBe(true);
    expect(res.oldTeacherId).toBe("teacher-old-1");
    expect(res.newTeacherId).toBe("teacher-new-2");
    expect(res.classId).toBe("class-1");

    // 1. Assert classSubjects update was called with correct values
    expect(mockClassSubjectsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedTeacherId: "teacher-new-2",
        periodsPerWeek: 6,
      }),
    );

    // 2. Assert sections were seeded with S16 invariant rules
    expect(mockSectionSubjectTeachersInsert).toHaveBeenCalledTimes(2);
    expect(mockSectionSubjectTeachersInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: "school-1",
        academicYearId: "ay-2026",
        classSubjectId: "cs-101",
        teacherId: "teacher-new-2",
        isPrimary: true,
        periodsPerWeek: 6,
        isActive: true,
        effectiveTo: null,
      }),
    );
  });

  it("2. Clears scope cache for BOTH old and new teachers (displacement-aware)", async () => {
    await setClassSubjectLead({
      schoolId: "school-1",
      classSubjectId: "cs-101",
      teacherId: "teacher-new-2",
    });

    // Invalidate dropdown cache
    expect(mockInvalidateTeachingStaffCache).toHaveBeenCalledWith("school-1");

    // Displaced teacher cache cleared
    expect(mockClearTeacherScopeCache).toHaveBeenCalledWith("teacher-old-1");

    // Incoming teacher cache cleared
    expect(mockClearTeacherScopeCache).toHaveBeenCalledWith("teacher-new-2");

    // Broad flush
    expect(mockClearTeacherScopeCache).toHaveBeenCalledWith();
  });

  it("3. Unassigning teacher (teacherId = null) clears lead without seeding sections", async () => {
    const res = await setClassSubjectLead({
      schoolId: "school-1",
      classSubjectId: "cs-101",
      teacherId: null,
    });

    expect(res.success).toBe(true);
    expect(res.newTeacherId).toBeNull();
    expect(mockClassSubjectsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedTeacherId: null,
      }),
    );
    // When teacherId is null, sectionSubjectTeachers are not inserted
    expect(mockSectionSubjectTeachersInsert).not.toHaveBeenCalled();

    // Displaced teacher cache is still cleared
    expect(mockClearTeacherScopeCache).toHaveBeenCalledWith("teacher-old-1");
  });
});
