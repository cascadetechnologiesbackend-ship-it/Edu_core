import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resolveTeacherScope,
  clearTeacherScopeCache,
} from "../scopeResolver";

describe("S18 L3: Displacement-Aware Scope Cache Eviction", () => {
  const schoolId = "school-111";
  const teacherA = "teacher-user-A";
  const teacherB = "teacher-user-B";

  beforeEach(() => {
    clearTeacherScopeCache();
    vi.clearAllMocks();
  });

  function createMockDb(allocations: {
    teacherASections: string[];
    teacherBSections: string[];
  }) {
    const findInSql = (item: any, target: string): boolean => {
      if (!item) return false;
      if (item === target || item.value === target) return true;
      if (typeof item === "string" && item.includes(target)) return true;
      if (item.queryChunks && Array.isArray(item.queryChunks)) {
        return item.queryChunks.some((child: any) => findInSql(child, target));
      }
      return false;
    };

    const isTeacherMatch = (query: any, targetTeacher: string) => {
      return findInSql(query?.where, targetTeacher);
    };

    const mockSectionsFindMany = vi.fn().mockImplementation(async (query: any) => {
      if (isTeacherMatch(query, teacherA)) {
        return allocations.teacherASections.map((id) => ({ id, name: id.toUpperCase(), classId: "cls-1" }));
      }
      if (isTeacherMatch(query, teacherB)) {
        return allocations.teacherBSections.map((id) => ({ id, name: id.toUpperCase(), classId: "cls-1" }));
      }
      return [];
    });

    const mockClassTeacherAssignmentsFindMany = vi.fn().mockImplementation(async (query: any) => {
      if (isTeacherMatch(query, teacherA)) {
        return allocations.teacherASections.map((id) => ({ sectionId: id }));
      }
      if (isTeacherMatch(query, teacherB)) {
        return allocations.teacherBSections.map((id) => ({ sectionId: id }));
      }
      return [];
    });

    const mockSectionSubjectTeachersFindMany = vi.fn().mockResolvedValue([]);
    const mockClassSubjectsFindMany = vi.fn().mockResolvedValue([]);
    const mockTimetablePeriodsFindMany = vi.fn().mockResolvedValue([]);

    return {
      execute: vi.fn().mockResolvedValue([{ school_id: schoolId }]),
      query: {
        academicYears: {
          findFirst: vi.fn().mockResolvedValue({ id: "ay-2026" }),
        },
        sections: {
          findMany: mockSectionsFindMany,
        },
        classTeacherAssignments: {
          findMany: mockClassTeacherAssignmentsFindMany,
        },
        sectionSubjectTeachers: {
          findMany: mockSectionSubjectTeachersFindMany,
        },
        classSubjects: {
          findMany: mockClassSubjectsFindMany,
        },
        timetablePeriods: {
          findMany: mockTimetablePeriodsFindMany,
        },
      },
      mockClassTeacherAssignmentsFindMany,
    };
  }

  it("1. Scope is cached on initial resolve and reused within TTL", async () => {
    const mockDb = createMockDb({
      teacherASections: ["sec-10a"],
      teacherBSections: [],
    });

    // First call: resolves from DB
    const scope1 = await resolveTeacherScope(teacherA, { schoolId, tx: mockDb });
    expect(scope1.classTeacherSections).toEqual(["sec-10a"]);
    expect(mockDb.mockClassTeacherAssignmentsFindMany).toHaveBeenCalledTimes(1);

    // Second call: served from in-memory scopeCache (DB not queried again)
    const scope2 = await resolveTeacherScope(teacherA, { schoolId, tx: mockDb });
    expect(scope2.classTeacherSections).toEqual(["sec-10a"]);
    expect(mockDb.mockClassTeacherAssignmentsFindMany).toHaveBeenCalledTimes(1);
  });

  it("2. When reassigned, displacement cache eviction immediately removes class from Teacher A and grants to Teacher B without TTL wait", async () => {
    // Initial state: Teacher A owns section 10A, Teacher B has none
    const liveAllocations = {
      teacherASections: ["sec-10a"],
      teacherBSections: [] as string[],
    };

    const mockDb = createMockDb(liveAllocations);

    // Initial resolution
    const scopeA1 = await resolveTeacherScope(teacherA, { schoolId, tx: mockDb });
    expect(scopeA1.classTeacherSections).toContain("sec-10a");

    // Mutation happens in same process: Section 10A reassigned to Teacher B
    liveAllocations.teacherASections = [];
    liveAllocations.teacherBSections = ["sec-10a"];

    // S18-L3: Displacement-aware cache invalidation executed by setClassSubjectLead / upsertClassTeacherAssignment
    clearTeacherScopeCache(teacherA); // Displaced teacher evicted!
    clearTeacherScopeCache(teacherB); // Incoming teacher evicted!

    // In the SAME session (zero TTL wait):
    // Teacher A's scope must no longer contain sec-10a
    const scopeA2 = await resolveTeacherScope(teacherA, { schoolId, tx: mockDb });
    expect(scopeA2.classTeacherSections).not.toContain("sec-10a");
    expect(scopeA2.classTeacherSections).toEqual([]);

    // Teacher B's scope must immediately contain sec-10a
    const scopeB1 = await resolveTeacherScope(teacherB, { schoolId, tx: mockDb });
    expect(scopeB1.classTeacherSections).toContain("sec-10a");
  });

  it("3. Broad clearTeacherScopeCache() flushes all active teacher scopes", async () => {
    const mockDb = createMockDb({
      teacherASections: ["sec-10a"],
      teacherBSections: ["sec-10b"],
    });

    await resolveTeacherScope(teacherA, { schoolId, tx: mockDb });
    await resolveTeacherScope(teacherB, { schoolId, tx: mockDb });

    // Broad flush
    clearTeacherScopeCache();

    // Both should trigger fresh DB queries
    await resolveTeacherScope(teacherA, { schoolId, tx: mockDb });
    await resolveTeacherScope(teacherB, { schoolId, tx: mockDb });

    expect(mockDb.mockClassTeacherAssignmentsFindMany).toHaveBeenCalledTimes(4);
  });
});
