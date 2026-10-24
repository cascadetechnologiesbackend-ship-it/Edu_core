import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Mock React cache ────────────────────────────────────────────────────────
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
  };
});

// ─── 2. Hoisted State & Spies ──────────────────────────────────────────────────
const {
  sessionState,
  store,
  spies,
} = vi.hoisted(() => {
  const sessionState = {
    userId: "admin-1",
    role: "SCHOOL_ADMIN",
    schoolId: "school-nh",
    email: "admin@newhorizen.edu",
  };

  const store = {
    classes: [
      {
        id: "class-1",
        schoolId: "school-nh",
        name: "Class 1",
        displayName: "Class 1",
        numericOrder: 1,
        academicYearId: "ay-1",
        isActive: true,
      },
    ],
    sections: [
      {
        id: "sec-A",
        schoolId: "school-nh",
        classId: "class-1",
        name: "A",
        capacity: 40,
        classTeacherId: null as string | null,
        roomNumber: "101",
        isActive: true,
      },
    ],
    subjects: [
      {
        id: "sub-math",
        schoolId: "school-nh",
        name: "Mathematics",
        code: "MATH-01",
        subjectType: "THEORY",
        isActive: true,
      },
    ],
    classSubjects: [
      {
        id: "cs-math",
        schoolId: "school-nh",
        classId: "class-1",
        subjectId: "sub-math",
        assignedTeacherId: null as string | null,
        periodsPerWeek: 5,
        isElective: false,
      },
    ],
    sectionSubjectTeachers: [] as Array<{
      id: string;
      schoolId: string;
      classSubjectId: string;
      sectionId: string;
      teacherId: string | null;
      effectiveFrom: string;
      effectiveTo: string | null;
      isActive: boolean;
    }>,
    teachingStaff: [
      {
        id: "user-priya",
        staffId: "staff-priya",
        schoolId: "school-nh",
        name: "Priya Sharma",
        email: "priya.sharma@newhorizen.edu",
        employeeCode: "NH-T01",
        designationName: "PRT Primary Teacher",
        departmentName: "Primary Wing",
        isTeaching: true,
      },
      {
        id: "user-rajesh",
        staffId: "staff-rajesh",
        schoolId: "school-nh",
        name: "Rajesh Kumar",
        email: "rajesh.kumar@newhorizen.edu",
        employeeCode: "NH-T02",
        designationName: "TGT Mathematics",
        departmentName: "Secondary Wing",
        isTeaching: true,
      },
    ],
  };

  const spies = {
    clearTeacherScopeCache: vi.fn(),
    revalidatePath: vi.fn(),
  };

  return { sessionState, store, spies };
});

// ─── 3. Mock Next.js & Server Auth ─────────────────────────────────────────────
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn((path: string) => spies.revalidatePath(path)),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: vi.fn(() => "vitest-agent"),
    entries: vi.fn(() => []),
  })),
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined),
  })),
}));

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async () => sessionState),
  requireSchool: vi.fn(async () => ({ id: sessionState.schoolId, name: "New Horizen School" })),
  getCachedSession: vi.fn(async () => sessionState),
}));

vi.mock("@/lib/teacherEventEngine/scopeResolver", () => ({
  clearTeacherScopeCache: vi.fn(() => spies.clearTeacherScopeCache()),
}));

// ─── 4. Mock HR Canonical Faculty ──────────────────────────────────────────────
vi.mock("@/app/(admin)/hr/teachingStaff", () => ({
  getCanonicalTeachingStaff: vi.fn(async (schoolId: string) => {
    return store.teachingStaff.filter((s) => s.schoolId === schoolId);
  }),
}));

// ─── 5. Mock DB & withTenant ───────────────────────────────────────────────────
vi.mock("@/db", () => {
  const createChainable = (action: string) => {
    let targetValues: any = null;
    let targetSet: any = null;
    const chain: any = {
      values: vi.fn((vals: any) => {
        targetValues = vals;
        if (action === "insert-sst" && vals) {
          const newRec = {
            id: `sst-${Date.now()}`,
            ...vals,
            isActive: true,
          };
          store.sectionSubjectTeachers.push(newRec);
        }
        return chain;
      }),
      set: vi.fn((vals: any) => {
        targetSet = vals;
        return chain;
      }),
      where: vi.fn(() => {
        if (action === "update-section" && targetSet) {
          const sec = store.sections[0];
          if (sec) Object.assign(sec, targetSet);
        } else if (action === "update-class-subject" && targetSet) {
          const cs = store.classSubjects[0];
          if (cs) Object.assign(cs, targetSet);
        } else if (action === "update-sst" && targetSet) {
          store.sectionSubjectTeachers.forEach((r) => {
            if (!r.effectiveTo) r.effectiveTo = targetSet.effectiveTo;
          });
        }
        return Promise.resolve([{ id: "updated" }]);
      }),
      returning: vi.fn(() => {
        if (action === "insert-sst" && targetValues) {
          const newRec = {
            id: `sst-${Date.now()}`,
            ...targetValues,
            isActive: true,
          };
          store.sectionSubjectTeachers.push(newRec);
          return Promise.resolve([newRec]);
        }
        return Promise.resolve([{ id: "inserted" }]);
      }),
      then: (resolve: any) => Promise.resolve([{ id: "ok" }]).then(resolve),
    };
    return chain;
  };

  const mockDb = {
    query: {
      classes: {
        findFirst: vi.fn(async () => {
          const cls = store.classes[0];
          if (!cls) return null;
          return {
            ...cls,
            sections: store.sections.map((s) => ({
              ...s,
              classTeacher: s.classTeacherId
                ? store.teachingStaff.find((t) => t.id === s.classTeacherId)
                : null,
            })),
            classSubjects: store.classSubjects.map((cs) => {
              const subj = store.subjects.find((s) => s.id === cs.subjectId);
              const teacher = cs.assignedTeacherId
                ? store.teachingStaff.find((t) => t.id === cs.assignedTeacherId)
                : null;
              return {
                ...cs,
                subject: subj,
                teacher,
              };
            }),
          };
        }),
      },
      sections: {
        findFirst: vi.fn(async () => store.sections[0] || null),
      },
      subjects: {
        findFirst: vi.fn(async () => store.subjects[0] || null),
      },
      classSubjects: {
        findFirst: vi.fn(async () => store.classSubjects[0] || null),
      },
      sectionSubjectTeachers: {
        findFirst: vi.fn(async () => {
          return (
            store.sectionSubjectTeachers.find((sst) => !sst.effectiveTo) || null
          );
        }),
        findMany: vi.fn(async () => {
          return store.sectionSubjectTeachers.map((sst) => {
            const teacher = sst.teacherId
              ? store.teachingStaff.find((t) => t.id === sst.teacherId)
              : null;
            const sec = store.sections.find((s) => s.id === sst.sectionId);
            return {
              ...sst,
              teacher: teacher ? { id: teacher.id, email: teacher.email } : null,
              section: sec ? { id: sec.id, name: sec.name } : null,
            };
          });
        }),
      },
      academicYears: {
        findFirst: vi.fn(async () => ({ id: "ay-1", schoolId: "school-nh", isActive: true })),
      },
    },
    insert: vi.fn((table: any) => createChainable("insert-sst")),
    update: vi.fn((table: any) => createChainable("update-class-subject")),
    delete: vi.fn(() => createChainable("delete")),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
  };

  const mockTx = {
    ...mockDb,
    update: vi.fn((table: any) => createChainable("update-section")),
    insert: vi.fn((table: any) => createChainable("insert-sst")),
  };

  return {
    db: mockDb,
    withTenant: vi.fn(async (schoolId: string, callback: (tx: any) => Promise<any>) => {
      return callback(mockTx);
    }),
  };
});

// ─── 6. Import Actions Under Test ─────────────────────────────────────────────
import {
  saveSection,
  saveClassSubject,
  getTeachersList,
} from "../actions";
import {
  getClassWithDetails,
  getSectionSubjectTeachers,
  assignSectionTeacher,
} from "../actions/class-setup.actions";

// ─── 7. End-to-End Walkthrough Test Suite ─────────────────────────────────────
describe("S15 Class Hub Assignment Surfaces: End-to-End Walkthrough", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutable store
    if (store.sections[0]) store.sections[0].classTeacherId = null;
    if (store.classSubjects[0]) store.classSubjects[0].assignedTeacherId = null;
    store.sectionSubjectTeachers.length = 0;
  });

  it("completes full 7-step admin assignment walkthrough with canonical reflection & cache invalidation", async () => {
    // ═════════════════════════════════════════════════════════════════════════
    // Step 1: Initial Class Hub Load — Unassigned Baseline
    // ═════════════════════════════════════════════════════════════════════════
    const initialClass = await getClassWithDetails("class-1");
    expect(initialClass).not.toBeNull();
    expect(initialClass?.sections[0]?.classTeacher).toBeNull();
    expect(initialClass?.classSubjects[0]?.teacher).toBeNull();

    // Verify initial teachers dropdown is ready & populated with 2 active teaching faculty
    const initialTeachers = await getTeachersList();
    expect(initialTeachers).toHaveLength(2);
    expect(initialTeachers.map((t) => t.displayName)).toEqual([
      "Priya Sharma (NH-T01)",
      "Rajesh Kumar (NH-T02)",
    ]);

    // ═════════════════════════════════════════════════════════════════════════
    // Step 2: Admin Assigns Class Teacher to Section A
    // Action: saveSection with classTeacherId = "user-priya"
    // ═════════════════════════════════════════════════════════════════════════
    const assignSectionResult = await saveSection({
      id: "sec-A",
      classId: "class-1",
      name: "A",
      capacity: 40,
      classTeacherId: "user-priya",
      roomNumber: "101",
    });

    expect(assignSectionResult).toEqual({ success: true });
    expect(spies.clearTeacherScopeCache).toHaveBeenCalledTimes(1);
    expect(spies.revalidatePath).toHaveBeenCalledWith("/academics");
    expect(spies.revalidatePath).toHaveBeenCalledWith("/academics/classes/class-1");

    // ═════════════════════════════════════════════════════════════════════════
    // Step 3: Admin Assigns Subject Lead Teacher to Mathematics
    // Action: saveClassSubject with assignedTeacherId = "user-rajesh"
    // ═════════════════════════════════════════════════════════════════════════
    const assignSubjectResult = await saveClassSubject({
      id: "cs-math",
      classId: "class-1",
      subjectId: "sub-math",
      assignedTeacherId: "user-rajesh",
      periodsPerWeek: 5,
    });

    expect(assignSubjectResult).toEqual({ success: true });
    expect(spies.clearTeacherScopeCache).toHaveBeenCalledTimes(2);
    expect(spies.revalidatePath).toHaveBeenCalledWith("/academics");
    expect(spies.revalidatePath).toHaveBeenCalledWith("/academics/classes/class-1");

    // ═════════════════════════════════════════════════════════════════════════
    // Step 4: Admin Navigates into Subject Workspace & Overrides Section Teacher
    // Action: assignSectionTeacher with sectionId = "sec-A", teacherId = "user-priya"
    // ═════════════════════════════════════════════════════════════════════════
    const overrideResult = await assignSectionTeacher({
      classSubjectId: "cs-math",
      sectionId: "sec-A",
      teacherId: "user-priya",
      effectiveFrom: "2026-04-01",
    });

    expect(overrideResult).toEqual({ success: true });
    expect(spies.clearTeacherScopeCache).toHaveBeenCalledTimes(3);
    expect(spies.revalidatePath).toHaveBeenCalledWith("/academics/classes/class-1/subjects/cs-math");

    // ═════════════════════════════════════════════════════════════════════════
    // Step 5: Read-back Reflection on Class Hub & Subject Workspace Surfaces
    // ═════════════════════════════════════════════════════════════════════════
    const updatedClass = await getClassWithDetails("class-1");
    expect(updatedClass).not.toBeNull();

    // Section class teacher reflected with canonical decrypted name & code
    const sectionTeacher = updatedClass?.sections[0]?.classTeacher;
    expect(sectionTeacher?.displayName).toBe("Priya Sharma (NH-T01)");
    expect(sectionTeacher?.name).toBe("Priya Sharma");

    // Subject lead teacher reflected with canonical decrypted name & code
    const leadTeacher = updatedClass?.classSubjects[0]?.teacher;
    expect(leadTeacher?.displayName).toBe("Rajesh Kumar (NH-T02)");
    expect(leadTeacher?.name).toBe("Rajesh Kumar");

    // Section override reflected in subject workspace
    const sectionOverrides = await getSectionSubjectTeachers("cs-math");
    expect(sectionOverrides).toHaveLength(1);
    const overrideTeacher = sectionOverrides[0]?.teacher as { displayName?: string; name?: string } | null;
    expect(overrideTeacher?.displayName).toBe("Priya Sharma (NH-T01)");
    expect(overrideTeacher?.name).toBe("Priya Sharma");

    // ═════════════════════════════════════════════════════════════════════════
    // Step 6: Readiness State Evaluation
    // ═════════════════════════════════════════════════════════════════════════
    const sectionsWithoutClassTeacher = (updatedClass?.sections || []).filter(
      (s: any) => !s.classTeacherId && !s.classTeacher,
    );
    expect(sectionsWithoutClassTeacher).toHaveLength(0);

    const subjectsAssigned = (updatedClass?.classSubjects || []).every(
      (cs: any) => Boolean(cs.assignedTeacherId || cs.teacher),
    );
    expect(subjectsAssigned).toBe(true);

    // ═════════════════════════════════════════════════════════════════════════
    // Step 7: Downstream Guard & Invalidation Invariants
    // ═════════════════════════════════════════════════════════════════════════
    expect(spies.clearTeacherScopeCache).toHaveBeenCalledTimes(3);
  });
});
