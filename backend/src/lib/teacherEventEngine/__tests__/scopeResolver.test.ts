import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resolveTeacherScope,
  assertTeacherCanMarkAttendance,
  assertTeacherCanGradeAssignment,
  assertTeacherCanAccessStudent,
  projectScopedRosterFeeStatus,
  clearTeacherScopeCache,
  TeacherScopeError,
} from "../scopeResolver";

describe("Teacher Scope Resolver (resolveTeacherScope & RLS Guard Suite, AC-T2)", () => {
  const schoolId = "school-111";
  const teacherId = "teacher-user-1";
  const otherTeacherId = "teacher-user-2";

  beforeEach(() => {
    clearTeacherScopeCache();
    vi.clearAllMocks();
  });

  // Mock DB builder
  function createMockDb(overrides?: {
    academicYear?: any;
    classTeacherSections?: any[];
    sectionSubjectRows?: any[];
    classSubjectDefaultRows?: any[];
    scheduledPeriodRows?: any[];
    assignment?: any;
    student?: any;
    sectionStudents?: any[];
    feeInvoices?: any[];
  }) {
    return {
      execute: vi.fn().mockResolvedValue([{ school_id: schoolId }]),
      query: {
        academicYears: {
          findFirst: vi.fn().mockResolvedValue(
            overrides?.academicYear ?? { id: "ay-2026" }
          ),
        },
        sections: {
          findMany: vi.fn().mockResolvedValue(
            overrides?.classTeacherSections ?? [
              { id: "sec-8a", name: "A", classId: "cls-8" },
            ]
          ),
        },
        sectionSubjectTeachers: {
          findMany: vi.fn().mockResolvedValue(
            overrides?.sectionSubjectRows ?? [
              {
                id: "sst-1",
                sectionId: "sec-8b",
                classSubjectId: "cs-math-8",
                section: {
                  id: "sec-8b",
                  name: "B",
                  class: { id: "cls-8", displayName: "Class 8" },
                },
                classSubject: {
                  id: "cs-math-8",
                  subjectId: "sub-math",
                  subject: { id: "sub-math", name: "Mathematics" },
                },
              },
            ]
          ),
        },
        classSubjects: {
          findMany: vi.fn().mockResolvedValue(
            overrides?.classSubjectDefaultRows ?? [
              {
                id: "cs-sci-9",
                classId: "cls-9",
                subjectId: "sub-sci",
                class: {
                  id: "cls-9",
                  displayName: "Class 9",
                  sections: [
                    { id: "sec-9a", name: "A" },
                    { id: "sec-9b", name: "B" },
                  ],
                },
                subject: { id: "sub-sci", name: "Science" },
              },
            ]
          ),
        },
        timetablePeriods: {
          findMany: vi.fn().mockResolvedValue(
            overrides?.scheduledPeriodRows ?? [
              { id: "period-1" },
              { id: "period-2" },
            ]
          ),
        },
        assignments: {
          findFirst: vi.fn().mockResolvedValue(
            overrides?.assignment ?? {
              id: "asg-1",
              schoolId,
              sectionId: "sec-8b",
              classSubjectId: "cs-math-8",
              createdByTeacherId: teacherId,
            }
          ),
        },
        students: {
          findFirst: vi.fn().mockResolvedValue(
            overrides?.student ?? {
              id: "stu-1",
              schoolId,
              currentSectionId: "sec-8a",
            }
          ),
        },
      },
      select: vi.fn().mockImplementation((fields) => {
        // Handle projectScopedRosterFeeStatus student & fee queries
        return {
          from: vi.fn().mockImplementation((table) => {
            return {
              where: vi.fn().mockImplementation(() => {
                if (fields?.status) {
                  // Invoices query
                  return Promise.resolve(
                    overrides?.feeInvoices ?? [
                      { studentId: "stu-1", status: "PAID" },
                      { studentId: "stu-2", status: "OVERDUE" },
                    ]
                  );
                }
                // Students query
                return Promise.resolve(
                  overrides?.sectionStudents ?? [
                    { id: "stu-1" },
                    { id: "stu-2" },
                  ]
                );
              }),
            };
          }),
        };
      }),
    };
  }

  describe("resolveTeacherScope", () => {
    it("correctly derives classTeacherSections, teachingSections, scheduledPeriods, and allSectionIds", async () => {
      const mockDb = createMockDb();

      const scope = await resolveTeacherScope(teacherId, {
        tx: mockDb,
        schoolId,
      });

      expect(scope.teacherUserId).toBe(teacherId);
      expect(scope.schoolId).toBe(schoolId);
      expect(scope.academicYearId).toBe("ay-2026");

      // Class teacher sections
      expect(scope.classTeacherSections).toContain("sec-8a");

      // Teaching sections (override + default)
      const allocatedSectionIds = scope.teachingSections.map((ts) => ts.sectionId);
      expect(allocatedSectionIds).toContain("sec-8b");
      expect(allocatedSectionIds).toContain("sec-9a");
      expect(allocatedSectionIds).toContain("sec-9b");

      // Scheduled periods
      expect(scope.scheduledPeriods).toEqual(["period-1", "period-2"]);

      // All unique section IDs
      expect(scope.allSectionIds).toContain("sec-8a");
      expect(scope.allSectionIds).toContain("sec-8b");
      expect(scope.allSectionIds).toContain("sec-9a");
      expect(scope.allSectionIds).toContain("sec-9b");
    });

    it("uses short-lived cache on repeated calls without hitting DB queries again", async () => {
      const mockDb = createMockDb();

      await resolveTeacherScope(teacherId, { tx: mockDb, schoolId });
      expect(mockDb.query.sections.findMany).toHaveBeenCalledTimes(1);

      // Second call should hit in-memory cache
      await resolveTeacherScope(teacherId, { tx: mockDb, schoolId });
      expect(mockDb.query.sections.findMany).toHaveBeenCalledTimes(1);

      // Bypassing cache queries DB again
      await resolveTeacherScope(teacherId, {
        tx: mockDb,
        schoolId,
        bypassCache: true,
      });
      expect(mockDb.query.sections.findMany).toHaveBeenCalledTimes(2);
    });

    it("fails closed when no schoolId is present in transaction context", async () => {
      const mockDb = {
        execute: vi.fn().mockResolvedValue([{ school_id: null }]),
      };

      await expect(
        resolveTeacherScope(teacherId, { tx: mockDb })
      ).rejects.toThrow(TeacherScopeError);
    });
  });

  describe("assertTeacherCanMarkAttendance", () => {
    it("allows attendance marking for an assigned section", async () => {
      const mockDb = createMockDb();

      const scope = await assertTeacherCanMarkAttendance(teacherId, "sec-8a", {
        tx: mockDb,
        schoolId,
      });

      expect(scope.allSectionIds).toContain("sec-8a");
    });

    it("throws TeacherScopeError (403) when marking an unallocated section", async () => {
      const mockDb = createMockDb();

      await expect(
        assertTeacherCanMarkAttendance(teacherId, "sec-unallocated-12", {
          tx: mockDb,
          schoolId,
        })
      ).rejects.toThrow("Teacher teacher-user-1 is not authorized to mark attendance");
    });
  });

  describe("assertTeacherCanGradeAssignment", () => {
    it("allows author teacher to grade assignment", async () => {
      const mockDb = createMockDb({
        assignment: {
          id: "asg-math",
          schoolId,
          sectionId: "sec-8b",
          classSubjectId: "cs-math-8",
          createdByTeacherId: teacherId,
        },
      });

      const res = await assertTeacherCanGradeAssignment(teacherId, "asg-math", {
        tx: mockDb,
        schoolId,
      });

      expect(res.assignment.id).toBe("asg-math");
    });

    it("allows allocated section-subject teacher to grade even if created by another user", async () => {
      const mockDb = createMockDb({
        assignment: {
          id: "asg-math-shared",
          schoolId,
          sectionId: "sec-8b",
          classSubjectId: "cs-math-8",
          createdByTeacherId: "department-head",
        },
      });

      const res = await assertTeacherCanGradeAssignment(
        teacherId,
        "asg-math-shared",
        { tx: mockDb, schoolId }
      );

      expect(res.assignment.id).toBe("asg-math-shared");
    });

    it("throws TeacherScopeError (403) when teacher has neither authorship nor subject allocation", async () => {
      const mockDb = createMockDb({
        assignment: {
          id: "asg-other",
          schoolId,
          sectionId: "sec-7c",
          classSubjectId: "cs-french-7",
          createdByTeacherId: otherTeacherId,
        },
      });

      await expect(
        assertTeacherCanGradeAssignment(teacherId, "asg-other", {
          tx: mockDb,
          schoolId,
        })
      ).rejects.toThrow("Teacher teacher-user-1 is not authorized to grade assignment asg-other");
    });
  });

  describe("assertTeacherCanAccessStudent", () => {
    it("allows access to student within teacher's active sections", async () => {
      const mockDb = createMockDb({
        student: {
          id: "stu-1",
          schoolId,
          currentSectionId: "sec-8a",
        },
      });

      const res = await assertTeacherCanAccessStudent(teacherId, "stu-1", {
        tx: mockDb,
        schoolId,
      });

      expect(res.student.id).toBe("stu-1");
    });

    it("throws TeacherScopeError (403) when student is outside teacher's sections", async () => {
      const mockDb = createMockDb({
        student: {
          id: "stu-stranger",
          schoolId,
          currentSectionId: "sec-unknown-class",
        },
      });

      await expect(
        assertTeacherCanAccessStudent(teacherId, "stu-stranger", {
          tx: mockDb,
          schoolId,
        })
      ).rejects.toThrow("Teacher teacher-user-1 is not authorized to access student stu-stranger");
    });
  });

  describe("projectScopedRosterFeeStatus (Hard Data Privacy Contract AC-T2)", () => {
    it("projects only studentId and status badge, strictly excluding financial amounts", async () => {
      const mockDb = createMockDb({
        sectionStudents: [{ id: "stu-1" }, { id: "stu-2" }],
        feeInvoices: [
          { studentId: "stu-1", status: "PAID" },
          { studentId: "stu-2", status: "OVERDUE" },
        ],
      });

      const feeProjection = await projectScopedRosterFeeStatus(
        teacherId,
        "sec-8a",
        { tx: mockDb, schoolId }
      );

      expect(feeProjection).toHaveLength(2);

      // Verify returned objects carry strictly studentId and status
      expect(feeProjection[0]).toEqual({
        studentId: "stu-1",
        status: "PAID",
      });
      expect(feeProjection[1]).toEqual({
        studentId: "stu-2",
        status: "OVERDUE",
      });

      // Assert that financial amount properties are absent
      for (const item of feeProjection) {
        expect((item as any).balanceAmount).toBeUndefined();
        expect((item as any).amount).toBeUndefined();
        expect((item as any).lateFeeAmount).toBeUndefined();
        expect((item as any).paymentHistory).toBeUndefined();
      }
    });

    it("throws TeacherScopeError (403) if teacher attempts to read fee statuses for an out-of-scope section", async () => {
      const mockDb = createMockDb();

      await expect(
        projectScopedRosterFeeStatus(teacherId, "sec-unauthorized", {
          tx: mockDb,
          schoolId,
        })
      ).rejects.toThrow("Teacher teacher-user-1 is not authorized to mark attendance for section sec-unauthorized");
    });
  });
});
