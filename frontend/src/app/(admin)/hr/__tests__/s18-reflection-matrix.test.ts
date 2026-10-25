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

vi.mock("@/lib/requestContext", () => ({
  getClientRequestContext: vi.fn(() => ({})),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ─── 2. Hoisted Mock State ─────────────────────────────────────────────────────
const {
  activeSessionRef,
  mockState,
  mockAuditLogs,
} = vi.hoisted(() => {
  const activeSessionRef = {
    current: {
      userId: "user-hr-1",
      role: "HR_MANAGER",
      schoolId: "school-100",
      email: "hr@school.edu",
    } as any,
  };

  const mockState = {
    schoolId: "school-100",
    academicYearId: "ay-2026",
    sections: [
      {
        id: "sec-10a",
        name: "10-A",
        classId: "cls-10",
        schoolId: "school-100",
        classTeacherId: null as string | null,
        isActive: true,
        class: { id: "cls-10", displayName: "Class 10", academicYearId: "ay-2026" },
      },
    ],
    classSubjects: [
      {
        id: "cs-math-10",
        schoolId: "school-100",
        classId: "cls-10",
        subjectId: "sub-math",
        assignedTeacherId: null as string | null,
        periodsPerWeek: 5,
        isElective: false,
        subject: { id: "sub-math", name: "Mathematics" },
        class: { id: "cls-10", displayName: "Class 10" },
      },
    ],
    classTeacherAssignments: [] as any[],
    sectionSubjectTeachers: [] as any[],
    teachingStaff: [
      { id: "teacher-1", name: "Teacher One", email: "t1@school.edu", isTeaching: true },
      { id: "teacher-2", name: "Teacher Two", email: "t2@school.edu", isTeaching: true },
    ],
  };

  return {
    activeSessionRef,
    mockState,
    mockAuditLogs: [] as any[],
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

const findTeacherInChunks = (chunks: any[]): string | null => {
  if (!chunks || !Array.isArray(chunks)) return null;
  for (const c of chunks) {
    if (c?.value === "teacher-1" || c?.value === "teacher-2") return c.value;
    if (c?.queryChunks) {
      const nested = findTeacherInChunks(c.queryChunks);
      if (nested) return nested;
    }
  }
  return null;
};

vi.mock("@/db", () => {
  const mockDb = {
    execute: vi.fn().mockResolvedValue([{ school_id: mockState.schoolId }]),
    query: {
      academicYears: {
        findFirst: vi.fn(async () => ({ id: mockState.academicYearId, isActive: true, schoolId: mockState.schoolId })),
      },
      sections: {
        findFirst: vi.fn(async () => mockState.sections[0]),
        findMany: vi.fn(async (query: any) => {
          const targetTeacher = query?.where?.queryChunks ? findTeacherInChunks(query.where.queryChunks) : null;
          return mockState.sections.filter((s) => !targetTeacher || s.classTeacherId === targetTeacher);
        }),
      },
      classSubjects: {
        findFirst: vi.fn(async () => mockState.classSubjects[0]),
        findMany: vi.fn(async (query: any) => {
          const targetTeacher = query?.where?.queryChunks ? findTeacherInChunks(query.where.queryChunks) : null;
          return mockState.classSubjects.filter((cs) => !targetTeacher || cs.assignedTeacherId === targetTeacher);
        }),
      },
      classTeacherAssignments: {
        findFirst: vi.fn(async () => {
          return mockState.classTeacherAssignments.find((a) => a.isActive) || null;
        }),
        findMany: vi.fn(async (query: any) => {
          const targetTeacher = query?.where?.queryChunks ? findTeacherInChunks(query.where.queryChunks) : null;
          return mockState.classTeacherAssignments
            .filter((a) => a.isActive && (!targetTeacher || a.teacherId === targetTeacher))
            .map((a) => ({
              ...a,
              section: { id: a.sectionId, name: "10-A", class: { id: "cls-10", displayName: "Class 10" } },
            }));
        }),
      },
      sectionSubjectTeachers: {
        findFirst: vi.fn(async () => mockState.sectionSubjectTeachers.find((s) => s.isActive) || null),
        findMany: vi.fn(async (query: any) => {
          const targetTeacher = query?.where?.queryChunks ? findTeacherInChunks(query.where.queryChunks) : null;
          return mockState.sectionSubjectTeachers
            .filter((s) => s.isActive && (!targetTeacher || s.teacherId === targetTeacher))
            .map((s) => ({
              ...s,
              section: { id: s.sectionId, name: "10-A", class: { id: "cls-10", displayName: "Class 10" } },
              classSubject: { id: s.classSubjectId, subjectId: "sub-math", subject: { id: "sub-math", name: "Mathematics" } },
            }));
        }),
      },
      timetablePeriods: {
        findMany: vi.fn(async () => []),
      },
      assignments: {
        findFirst: vi.fn(async () => ({
          id: "asgn-1",
          sectionId: "sec-10a",
          classSubjectId: "cs-math-10",
          schoolId: mockState.schoolId,
        })),
      },
    },
    update: (table: any) => ({
      set: (values: any) => ({
        where: () => {
          if (values.assignedTeacherId !== undefined) {
            mockState.classSubjects[0]!.assignedTeacherId = values.assignedTeacherId;
          }
          if (values.classTeacherId !== undefined) {
            mockState.sections[0]!.classTeacherId = values.classTeacherId;
          }
          if (values.isActive === false) {
            for (const cta of mockState.classTeacherAssignments) {
              cta.isActive = false;
            }
            for (const sst of mockState.sectionSubjectTeachers) {
              sst.isActive = false;
            }
          }
          return Promise.resolve({ rowCount: 1 });
        },
      }),
    }),
    insert: (table: any) => ({
      values: (vals: any) => {
        if (vals.tableName === "audit_logs" || vals.purposeId === "hr_records") {
          mockAuditLogs.push(vals);
        } else if (vals.sectionId && vals.teacherId && !vals.classSubjectId) {
          // classTeacherAssignments insert
          for (const cta of mockState.classTeacherAssignments) {
            cta.isActive = false;
          }
          mockState.classTeacherAssignments.push({
            id: `cta-${Date.now()}`,
            ...vals,
            isActive: true,
            effectiveFrom: "2026-01-01",
            effectiveTo: null,
          });
        } else if (vals.classSubjectId && vals.sectionId && vals.teacherId) {
          // sectionSubjectTeachers insert
          for (const sst of mockState.sectionSubjectTeachers) {
            sst.isActive = false;
          }
          mockState.sectionSubjectTeachers.push({
            id: `sst-${Date.now()}`,
            ...vals,
            isActive: true,
            effectiveFrom: "2026-01-01",
            effectiveTo: null,
          });
        }
        return {
          returning: () => [{ id: "new-id", ...vals }],
        };
      },
    }),
  };

  return {
    db: mockDb,
    withTenant: vi.fn(async (_schoolId: string, cb: any) => cb(mockDb)),
  };
});

// ─── 4. Imports for the 6 Consuming Surfaces ──────────────────────────────────
import { hrAssignClassTeacher, hrAssignSubjectTeacher, getStaffAllocationOverview } from "../actions";
import { resolveTeacherScope, assertTeacherCanGradeAssignment } from "@/lib/teacherEventEngine/scopeResolver";
import { db } from "@/db";

describe("S18 L4: Six-Surface Reflection Matrix & Displacement Suite", () => {
  beforeEach(() => {
    mockState.classTeacherAssignments = [];
    mockState.sectionSubjectTeachers = [];
    mockState.sections[0]!.classTeacherId = null;
    mockState.classSubjects[0]!.assignedTeacherId = null;
    mockAuditLogs.length = 0;
  });

  it("Full Chain: Assign Teacher 1 via HR -> Reflect across all 6 surfaces -> Reassign to Teacher 2 -> Displace on all 6 in same session", async () => {
    // ══════════════════════════════════════════════════════════════════════════════
    // STEP 1: HR Hub Assigns Teacher 1 as Homeroom Lead and Subject Lead
    // ══════════════════════════════════════════════════════════════════════════════
    const ctRes1 = await hrAssignClassTeacher({
      sectionId: "sec-10a",
      teacherId: "teacher-1",
    });
    expect(ctRes1.success).toBe(true);

    const subRes1 = await hrAssignSubjectTeacher({
      classSubjectId: "cs-math-10",
      teacherId: "teacher-1",
    });
    expect(subRes1.success).toBe(true);

    // ══════════════════════════════════════════════════════════════════════════════
    // STEP 2: Verify Reflection Truth Across All 6 Consuming Surfaces
    // ══════════════════════════════════════════════════════════════════════════════

    // Surface 1: Class Hub Section Data (sections.classTeacherId mirror)
    const sec1 = await db.query.sections.findFirst({ where: {} as any });
    expect(sec1?.classTeacherId).toBe("teacher-1");

    // Surface 2: Subject Workspace Lead Label (classSubjects.assignedTeacherId)
    const cs1 = await db.query.classSubjects.findFirst({ where: {} as any });
    expect(cs1?.assignedTeacherId).toBe("teacher-1");

    // Surface 3: Teacher PWA Scope (resolveTeacherScope for Teacher 1)
    const scope1 = await resolveTeacherScope("teacher-1", {
      schoolId: mockState.schoolId,
      tx: db,
    });
    expect(scope1.classTeacherSections).toContain("sec-10a");

    // Surface 4: HR Hub Staff Allocation Overview
    const allocOverview1 = await getStaffAllocationOverview();
    expect(allocOverview1.success).toBe(true);
    const ctRecord1 = allocOverview1.ctaRows.find((r: any) => r.teacherId === "teacher-1");
    expect(ctRecord1).toBeDefined();
    expect(ctRecord1?.sectionId).toBe("sec-10a");

    // Surface 5: Exam Module Boundaries & Invigilation (assertTeacherCanGradeAssignment)
    const canGrade1 = await assertTeacherCanGradeAssignment("teacher-1", "asgn-1", {
      schoolId: mockState.schoolId,
      tx: db,
    });
    expect(canGrade1.scope.teacherUserId).toBe("teacher-1");

    // Surface 6: Audit trail integrity
    expect(mockAuditLogs.length).toBeGreaterThanOrEqual(2);
    expect(mockAuditLogs.some((a) => a.tableName === "class_subjects" && a.recordId === "cs-math-10")).toBe(true);
    expect(mockAuditLogs.some((a) => a.tableName === "class_teacher_assignments" && a.recordId === "sec-10a")).toBe(true);

    // ══════════════════════════════════════════════════════════════════════════════
    // STEP 3: Reassign Section 10-A and Subject Math to Teacher 2 (Displacement)
    // ══════════════════════════════════════════════════════════════════════════════
    const ctRes2 = await hrAssignClassTeacher({
      sectionId: "sec-10a",
      teacherId: "teacher-2",
      forceTransfer: true,
    });
    expect(ctRes2.success).toBe(true);

    const subRes2 = await hrAssignSubjectTeacher({
      classSubjectId: "cs-math-10",
      teacherId: "teacher-2",
    });
    expect(subRes2.success).toBe(true);

    // ══════════════════════════════════════════════════════════════════════════════
    // STEP 4: Verify Displacement Across All 6 Surfaces in the SAME Session
    // ══════════════════════════════════════════════════════════════════════════════

    // Surface 1: Class Hub Section Data reflects Teacher 2
    const sec2 = await db.query.sections.findFirst({ where: {} as any });
    expect(sec2?.classTeacherId).toBe("teacher-2");

    // Surface 2: Subject Workspace Lead reflects Teacher 2
    const cs2 = await db.query.classSubjects.findFirst({ where: {} as any });
    expect(cs2?.assignedTeacherId).toBe("teacher-2");

    // Surface 3: Teacher PWA Scope:
    // Displaced Teacher 1 immediately loses section
    const scope1After = await resolveTeacherScope("teacher-1", {
      schoolId: mockState.schoolId,
      tx: db,
    });
    expect(scope1After.classTeacherSections).not.toContain("sec-10a");

    // Incoming Teacher 2 immediately gains section
    const scope2After = await resolveTeacherScope("teacher-2", {
      schoolId: mockState.schoolId,
      tx: db,
    });
    expect(scope2After.classTeacherSections).toContain("sec-10a");

    // Surface 4: HR Hub Staff Allocation Overview reflects Teacher 2
    const allocOverview2 = await getStaffAllocationOverview();
    const ctRecord2 = allocOverview2.ctaRows.find((r: any) => r.teacherId === "teacher-2");
    expect(ctRecord2).toBeDefined();
    expect(ctRecord2?.sectionId).toBe("sec-10a");

    // Surface 5: Exam Boundaries:
    // Teacher 2 can grade
    const canGrade2 = await assertTeacherCanGradeAssignment("teacher-2", "asgn-1", {
      schoolId: mockState.schoolId,
      tx: db,
    });
    expect(canGrade2.scope.teacherUserId).toBe("teacher-2");

    // Teacher 1 is blocked with 403 Forbidden
    await expect(
      assertTeacherCanGradeAssignment("teacher-1", "asgn-1", {
        schoolId: mockState.schoolId,
        tx: db,
      })
    ).rejects.toThrow();
  });
});
