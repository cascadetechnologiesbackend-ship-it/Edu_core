import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Mock React cache to prevent memoization across tests ───────────────────
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
  };
});

// ─── 2. Hoisted State and Mocks ────────────────────────────────────────────────
const {
  activeSessionRef,
  e2eDatastore,
  mockTx,
  mockClassesFindFirst,
  mockSectionsFindFirst,
  mockClassSubjectsFindFirst,
  mockSectionSubjectTeachersFindFirst,
  mockStaffFindMany,
  mockRolesFindFirst,
  mockUserRolesFindMany,
} = vi.hoisted(() => {
  const activeSessionRef = {
    current: {
      userId: "admin-uuid",
      role: "SCHOOL_ADMIN",
      schoolId: "school-e2e-123",
      email: "admin@school.edu",
    } as any,
  };

  const e2eDatastore = {
    schoolId: "school-e2e-123",
    department: { id: "dept-math-1", name: "Mathematics" },
    designation: { id: "desig-tgt-math", name: "TGT Mathematics", isTeaching: true },
    teachers: [
      {
        id: "staff-priya",
        userId: "user-priya-01",
        schoolId: "school-e2e-123",
        employeeCode: "FAC001",
        firstNameEncrypted: "Priya",
        lastNameEncrypted: "Sharma",
        emailEncrypted: "priya@school.edu",
        isActive: true,
        designation: { id: "desig-tgt-math", name: "TGT Mathematics", isTeaching: true },
        department: { id: "dept-math-1", name: "Mathematics" },
        user: { id: "user-priya-01", email: "priya@school.edu", isActive: true },
      },
      {
        id: "staff-vikram",
        userId: "user-vikram-02",
        schoolId: "school-e2e-123",
        employeeCode: "FAC002",
        firstNameEncrypted: "Vikram",
        lastNameEncrypted: "Seth",
        emailEncrypted: "vikram@school.edu",
        isActive: true,
        designation: { id: "desig-tgt-math", name: "TGT Mathematics", isTeaching: true },
        department: { id: "dept-math-1", name: "Mathematics" },
        user: { id: "user-vikram-02", email: "vikram@school.edu", isActive: true },
      },
    ],
    classes: [
      { id: "class-8", schoolId: "school-e2e-123", displayName: "Class 8", isActive: true },
    ],
    sections: [
      { id: "sec-8a", schoolId: "school-e2e-123", classId: "class-8", name: "A", classTeacherId: null as string | null, isActive: true },
      { id: "sec-8b", schoolId: "school-e2e-123", classId: "class-8", name: "B", classTeacherId: null as string | null, isActive: true },
    ],
    classSubjects: [
      {
        id: "cs-math-8",
        schoolId: "school-e2e-123",
        classId: "class-8",
        subjectId: "sub-math",
        assignedTeacherId: null as string | null,
        periodsPerWeek: 6,
        isElective: false,
        class: { displayName: "Class 8" },
        subject: { name: "Mathematics" },
        teacher: null as any,
      },
    ],
    sectionSubjectTeachers: [] as any[],
  };

  const createChainable = () => {
    const chain: any = {
      values: vi.fn((vals: any) => {
        const items = Array.isArray(vals) ? vals : [vals];
        for (const v of items) {
          if (v?.classId && v?.subjectId) {
            const existing = e2eDatastore.classSubjects.find(
              (cs) => cs.classId === v.classId && cs.subjectId === v.subjectId,
            );
            if (existing) {
              existing.assignedTeacherId = v.assignedTeacherId || null;
            } else {
              e2eDatastore.classSubjects.push({
                id: "cs-math-8",
                schoolId: e2eDatastore.schoolId,
                classId: v.classId,
                subjectId: v.subjectId,
                assignedTeacherId: v.assignedTeacherId || null,
                periodsPerWeek: v.periodsPerWeek || 6,
                isElective: false,
                class: { displayName: "Class 8" },
                subject: { name: "Mathematics" },
                teacher: null,
              });
            }
          }
          if (v?.classSubjectId && v?.sectionId) {
            e2eDatastore.sectionSubjectTeachers.push({
              id: `sst-${Date.now()}`,
              ...v,
              isActive: true,
              effectiveTo: null,
            });
          }
        }
        return chain;
      }),
      set: vi.fn((vals: any) => {
        if (vals.assignedTeacherId !== undefined) {
          const cs = e2eDatastore.classSubjects.find((c) => c.id === "cs-math-8");
          if (cs) cs.assignedTeacherId = vals.assignedTeacherId;
        }
        if (vals.classTeacherId !== undefined) {
          const sec = e2eDatastore.sections.find((s) => s.id === "sec-8a");
          if (sec) sec.classTeacherId = vals.classTeacherId;
        }
        return chain;
      }),
      from: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      where: vi.fn(() => chain),
      returning: vi.fn(() => Promise.resolve([{ id: "generated-id" }])),
      then: (resolve: any) => Promise.resolve([{ c: 0, count: 0, id: "res" }]).then(resolve),
    };
    return chain;
  };

  const mockClassesFindFirst = vi.fn();
  const mockSectionsFindFirst = vi.fn();
  const mockClassSubjectsFindFirst = vi.fn();
  const mockSectionSubjectTeachersFindFirst = vi.fn();
  const mockStaffFindMany = vi.fn();
  const mockRolesFindFirst = vi.fn();
  const mockUserRolesFindMany = vi.fn();

  const mockTx = {
    query: {
      classes: {
        findFirst: mockClassesFindFirst,
        findMany: vi.fn(async () => e2eDatastore.classes),
      },
      sections: {
        findFirst: mockSectionsFindFirst,
        findMany: vi.fn(async () => e2eDatastore.sections),
      },
      classSubjects: {
        findFirst: mockClassSubjectsFindFirst,
        findMany: vi.fn(async () => e2eDatastore.classSubjects),
      },
      sectionSubjectTeachers: {
        findFirst: mockSectionSubjectTeachersFindFirst,
        findMany: vi.fn(async () => e2eDatastore.sectionSubjectTeachers),
      },
      timetablePeriods: {
        findMany: vi.fn(async () => []),
      },
      staff: {
        findMany: mockStaffFindMany,
        findFirst: vi.fn(async () => e2eDatastore.teachers[0]),
      },
      roles: {
        findFirst: mockRolesFindFirst,
      },
      userRoles: {
        findMany: mockUserRolesFindMany,
      },
      academicYears: {
        findFirst: vi.fn(async () => ({ id: "ay-2026", schoolId: "school-e2e-123", isActive: true })),
        findMany: vi.fn(async () => [{ id: "ay-2026", schoolId: "school-e2e-123", isActive: true }]),
      },
    },
    insert: vi.fn(() => createChainable()),
    update: vi.fn(() => createChainable()),
    delete: vi.fn(() => createChainable()),
    select: vi.fn(() => createChainable()),
  };

  return {
    activeSessionRef,
    e2eDatastore,
    mockTx,
    mockClassesFindFirst,
    mockSectionsFindFirst,
    mockClassSubjectsFindFirst,
    mockSectionSubjectTeachersFindFirst,
    mockStaffFindMany,
    mockRolesFindFirst,
    mockUserRolesFindMany,
  };
});

// ─── 3. Mock Next.js & Auth Modules ───────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => activeSessionRef.current),
}));

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    if (
      allowedRoles &&
      allowedRoles.length > 0 &&
      !allowedRoles.includes(activeSessionRef.current.role)
    ) {
      throw new Error(`FORBIDDEN: requires roles [${allowedRoles.join(", ")}]`);
    }
    return activeSessionRef.current;
  }),
  requireSchool: vi.fn(async () => ({ id: activeSessionRef.current.schoolId, name: "E2E School" })),
  getCachedSession: vi.fn(async () => activeSessionRef.current),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: vi.fn((name: string) => (name === "user-agent" ? "vitest" : "127.0.0.1")),
    entries: vi.fn(() => []),
  })),
  cookies: vi.fn(() => ({ get: vi.fn(() => undefined) })),
}));

vi.mock("@/db", () => ({
  db: mockTx,
  withTenant: vi.fn(async (_schoolId: string, cb: any) => cb(mockTx)),
}));

vi.mock("@/lib/encryption", () => ({
  decryptData: vi.fn((val: string) => val || ""),
  encryptData: vi.fn((val: string) => `enc_${val}`),
}));

vi.mock("@/lib/teacherEventEngine/scopeResolver", () => ({
  clearTeacherScopeCache: vi.fn(),
}));

// Import Domain Modules
import { getCanonicalTeachingStaff } from "../../hr/teachingStaff";
import {
  saveSection,
  batchUpdateClassSubjectMappings,
  getTeachersList,
} from "../actions";
import { assignSectionTeacher } from "../actions/class-setup.actions";
import { assertTeacherTeaches } from "@/lib/examPermissions";
import { getTeacherWorkloadReport } from "../actions/reports.actions";

describe("Layer L8: End-to-End Teacher Assignment Population Walkthrough", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockStaffFindMany.mockResolvedValue(e2eDatastore.teachers);
    mockRolesFindFirst.mockResolvedValue({ id: "role-teacher-id", name: "TEACHER" });
    mockUserRolesFindMany.mockResolvedValue([]);

    mockClassesFindFirst.mockResolvedValue(e2eDatastore.classes[0]);
    mockSectionsFindFirst.mockImplementation(async (opts?: any) => {
      return e2eDatastore.sections[0];
    });

    mockClassSubjectsFindFirst.mockResolvedValue(e2eDatastore.classSubjects[0]);
    mockSectionSubjectTeachersFindFirst.mockResolvedValue(null);
  });

  it("executes the complete 9-step teacher assignment population and downstream reflection lifecycle", async () => {
    // ─── Step 1: Create Department + Designation with isTeaching: true ──────────
    expect(e2eDatastore.department.name).toBe("Mathematics");
    expect(e2eDatastore.designation.name).toBe("TGT Mathematics");
    expect(e2eDatastore.designation.isTeaching).toBe(true);

    // ─── Step 2: Onboard Teacher Staff Member & Verify Canonical Appearance ─────
    const canonicalStaff = await getCanonicalTeachingStaff(e2eDatastore.schoolId);
    expect(canonicalStaff).toHaveLength(2);
    expect(canonicalStaff[0]!.name).toBe("Priya Sharma");
    expect(canonicalStaff[0]!.employeeCode).toBe("FAC001");
    expect(canonicalStaff[0]!.classificationConflict).toBe(false);

    // Verify appearance in academics dropdown (which formats displayName)
    const teacherDropdownList = await getTeachersList();
    expect(teacherDropdownList).toHaveLength(2);
    expect(teacherDropdownList[0]!.displayName).toBe("Priya Sharma (FAC001)");
    expect(teacherDropdownList[1]!.displayName).toBe("Vikram Seth (FAC002)");

    // ─── Step 3: Assign Teacher as Lead Teacher in Class 8 Mathematics in Matrix ─
    mockClassSubjectsFindFirst.mockResolvedValueOnce(null);
    const mappingResult = await batchUpdateClassSubjectMappings({
      toAdd: [
        {
          classId: "class-8",
          subjectId: "sub-math",
          assignedTeacherId: "user-priya-01",
          periodsPerWeek: 6,
          isElective: false,
        },
      ],
      toRemove: [],
    });
    expect(mappingResult.success).toBe(true);
    expect(e2eDatastore.classSubjects[0]!.assignedTeacherId).toBe("user-priya-01");

    // ─── Step 4: Assign Section Override for Section 8-B to Teacher 2 ────────────
    mockSectionsFindFirst.mockResolvedValueOnce(e2eDatastore.sections[1]);
    const overrideResult = await assignSectionTeacher({
      classSubjectId: "cs-math-8",
      sectionId: "sec-8b",
      teacherId: "user-vikram-02",
      effectiveFrom: "2026-04-01",
    });
    expect(overrideResult.success).toBe(true);
    expect(e2eDatastore.sectionSubjectTeachers).toHaveLength(1);
    expect(e2eDatastore.sectionSubjectTeachers[0]!.teacherId).toBe("user-vikram-02");
    expect(e2eDatastore.sectionSubjectTeachers[0]!.sectionId).toBe("sec-8b");

    // ─── Step 5: Assign Teacher as Class Teacher of Section 8-A in ClassroomsTab ─
    const sectionResult = await saveSection({
      id: "sec-8a",
      classId: "class-8",
      name: "A",
      classTeacherId: "user-priya-01",
    });
    expect(sectionResult.success).toBe(true);
    expect(e2eDatastore.sections[0]!.classTeacherId).toBe("user-priya-01");

    // ─── Step 6: Verify Teacher PWA Scope Reflection ─────────────────────────────
    // Teacher 1 (Priya): Class Teacher of 8-A
    expect(e2eDatastore.sections[0]!.classTeacherId).toBe("user-priya-01");
    // Teacher 2 (Vikram): Section Override on 8-B
    expect(e2eDatastore.sectionSubjectTeachers[0]!.teacherId).toBe("user-vikram-02");

    // ─── Step 7: Verify Exam Grading Permissions Boundary ────────────────────────
    // Teacher 1 grading Section 8-A: Authorized via lead class teacher mapping
    const priya8AGrading = await assertTeacherTeaches({
      teacherId: "user-priya-01",
      schoolId: e2eDatastore.schoolId,
      classId: "class-8",
      subjectId: "sub-math",
      sectionId: "sec-8a",
    });
    expect(priya8AGrading).toBe(true);

    // Teacher 2 grading Section 8-B: Authorized via section override
    mockSectionSubjectTeachersFindFirst.mockResolvedValueOnce({
      id: "sst-1",
      schoolId: e2eDatastore.schoolId,
      classSubjectId: "cs-math-8",
      sectionId: "sec-8b",
      teacherId: "user-vikram-02",
      isActive: true,
    });
    const vikram8BGrading = await assertTeacherTeaches({
      teacherId: "user-vikram-02",
      schoolId: e2eDatastore.schoolId,
      classId: "class-8",
      subjectId: "sub-math",
      sectionId: "sec-8b",
    });
    expect(vikram8BGrading).toBe(true);

    // Teacher 1 grading Section 8-B: Fails closed because Section 8-B was overridden by Vikram
    mockSectionSubjectTeachersFindFirst.mockResolvedValueOnce({
      id: "sst-1",
      schoolId: e2eDatastore.schoolId,
      classSubjectId: "cs-math-8",
      sectionId: "sec-8b",
      teacherId: "user-vikram-02", // Vikram is override teacher
      isActive: true,
    });
    const priya8BGrading = await assertTeacherTeaches({
      teacherId: "user-priya-01",
      schoolId: e2eDatastore.schoolId,
      classId: "class-8",
      subjectId: "sub-math",
      sectionId: "sec-8b",
    });
    expect(priya8BGrading).toBe(false);

    // ─── Step 8: Verify Workload Report Reflection ───────────────────────────────
    // Attach teacher relation for classSubjects query
    e2eDatastore.classSubjects[0]!.teacher = {
      id: "user-priya-01",
      email: "priya@school.edu",
    };
    e2eDatastore.sectionSubjectTeachers[0]!.teacher = {
      id: "user-vikram-02",
      email: "vikram@school.edu",
    };
    e2eDatastore.sectionSubjectTeachers[0]!.classSubject = e2eDatastore.classSubjects[0];

    const workloadReport = await getTeacherWorkloadReport();
    expect(workloadReport).toBeInstanceOf(Array);
    expect(workloadReport.length).toBeGreaterThanOrEqual(1);

    const priyaWorkload = workloadReport.find((w) => w.teacherId === "user-priya-01");
    expect(priyaWorkload).toBeDefined();
    expect(priyaWorkload!.totalPeriodsPerWeek).toBe(6);
    expect(priyaWorkload!.subjectCount).toBe(1);

    const vikramWorkload = workloadReport.find((w) => w.teacherId === "user-vikram-02");
    expect(vikramWorkload).toBeDefined();
    expect(vikramWorkload!.totalPeriodsPerWeek).toBe(6);

    // ─── Step 9: Verify HR 360 Reflection ───────────────────────────────────────
    // Confirm staff record has isTeaching: true and associated academic links
    expect(e2eDatastore.teachers[0]!.designation.isTeaching).toBe(true);
    expect(e2eDatastore.classSubjects[0]!.assignedTeacherId).toBe(e2eDatastore.teachers[0]!.userId);
    expect(e2eDatastore.sections[0]!.classTeacherId).toBe(e2eDatastore.teachers[0]!.userId);
  });
});
