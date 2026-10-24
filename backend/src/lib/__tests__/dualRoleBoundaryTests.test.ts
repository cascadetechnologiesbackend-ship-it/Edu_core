import { describe, it, expect, vi } from "vitest";
import {
  assertSubjectTeacherPermission,
  assertClassTeacherOverride,
  assertStudentRosterMembership,
  assertStudent360Access,
  TeacherScopeError,
} from "../teacherAuthGuards";
import type { TeacherScope } from "../teacherEventEngine/scopeResolver";
import { classTeacherAssignments, sectionSubjectTeachers } from "@/db/schema";
import fs from "fs";
import path from "path";

describe("S16 Layer L8: Six Dual-Role Boundary Tests & Guard Matrix", () => {
  const schoolId = "11111111-1111-1111-1111-111111111111";
  const otherSchoolId = "99999999-9999-9999-9999-999999999999";
  const academicYearId = "22222222-2222-2222-2222-222222222222";

  const teacherAId = "aaaa0000-0000-0000-0000-000000000001";
  const teacherBId = "bbbb0000-0000-0000-0000-000000000002";

  const section9AId = "99990000-0000-0000-0000-00000000000a";
  const section9BId = "99990000-0000-0000-0000-00000000000b";
  const section10AId = "10100000-0000-0000-0000-00000000000a";

  const mathSubjectId = "sub00000-0000-0000-0000-000000000001";
  const scienceSubjectId = "sub00000-0000-0000-0000-000000000002";

  const student9AId = "st000000-0000-0000-0000-000000000001";
  const student9BId = "st000000-0000-0000-0000-000000000002";

  // Mock Teacher A Scope: Class Teacher of 9-A; Subject Teacher for Math in 9-A, 9-B, and 10-A
  const mockTeacherAScope: TeacherScope = {
    teacherUserId: teacherAId,
    schoolId,
    academicYearId,
    classTeacherSections: [section9AId],
    teachingSections: [
      {
        sectionId: section9AId,
        classSubjectId: "cs-9a-math",
        subjectId: mathSubjectId,
        subjectName: "Mathematics",
        sectionName: "A",
        className: "Class 9",
      },
      {
        sectionId: section9BId,
        classSubjectId: "cs-9b-math",
        subjectId: mathSubjectId,
        subjectName: "Mathematics",
        sectionName: "B",
        className: "Class 9",
      },
      {
        sectionId: section10AId,
        classSubjectId: "cs-10a-math",
        subjectId: mathSubjectId,
        subjectName: "Mathematics",
        sectionName: "A",
        className: "Class 10",
      },
    ],
    scheduledPeriods: [],
    allSectionIds: [section9AId, section9BId, section10AId],
  };

  // Mock Teacher B Scope: Class Teacher of 9-B; Subject Teacher for Science in 9-A and 9-B
  const mockTeacherBScope: TeacherScope = {
    teacherUserId: teacherBId,
    schoolId,
    academicYearId,
    classTeacherSections: [section9BId],
    teachingSections: [
      {
        sectionId: section9AId,
        classSubjectId: "cs-9a-sci",
        subjectId: scienceSubjectId,
        subjectName: "Science",
        sectionName: "A",
        className: "Class 9",
      },
      {
        sectionId: section9BId,
        classSubjectId: "cs-9b-sci",
        subjectId: scienceSubjectId,
        subjectName: "Science",
        sectionName: "B",
        className: "Class 9",
      },
    ],
    scheduledPeriods: [],
    allSectionIds: [section9AId, section9BId],
  };

  // ─── Boundary Test 1: Class Teacher 1:1 Invariant with Predicate Proof ───
  it("Boundary Test 1: Class Teacher unique constraint predicates strictly enforce 1 homeroom per teacher per year even with future effective_to", () => {
    // Read migration 0054 SQL to verify partial unique indexes
    const migrationPath = path.resolve(
      __dirname,
      "../../../../database/src/migrations/0054_dual_role_teacher_assignments.sql"
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    // Must filter strictly on WHERE is_active = true, NOT on effective_to IS NULL
    expect(sqlContent).toContain("WHERE is_active = true");
    expect(sqlContent).toContain("cta_single_teacher_year_idx");
    expect(sqlContent).toContain("cta_single_section_year_idx");

    // Verify Drizzle schema matches
    expect(classTeacherAssignments.isActive).toBeDefined();
    expect(classTeacherAssignments.academicYearId).toBeDefined();
  });

  // ─── Boundary Test 2: M:N Subject Allocations ────────────────────────────
  it("Boundary Test 2: Teacher A can be allocated Math across multiple sections (9-A, 9-B, 10-A) simultaneously", () => {
    expect(mockTeacherAScope.teachingSections).toHaveLength(3);
    const sectionsTaught = mockTeacherAScope.teachingSections.map((ts) => ts.sectionId);
    expect(sectionsTaught).toContain(section9AId);
    expect(sectionsTaught).toContain(section9BId);
    expect(sectionsTaught).toContain(section10AId);

    // Verify section_subject_teachers schema uniqueness is on (school_id, academic_year_id, section_id, class_subject_id)
    // allowing the same teacher to hold allocations in multiple classes
    const migrationPath = path.resolve(
      __dirname,
      "../../../../database/src/migrations/0054_dual_role_teacher_assignments.sql"
    );
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    expect(sqlContent).toContain("sst_active_primary_unique_idx");
    expect(sqlContent).toContain("is_primary");
  });

  // ─── Boundary Test 3: Instructional Scope Guard (Condition A) ───────────
  it("Boundary Test 3: Teacher A (CT of 9-A, Math in 9-A) saves 9-A Math -> OK; attempts 9-A Science -> 403 SUBJECT_TEACHER_FORBIDDEN", async () => {
    const mockTx = {
      execute: vi.fn().mockResolvedValue([{ school_id: schoolId }]),
    };

    // Teacher A saves Math in 9-A -> Allocated -> PASSES
    // We mock resolveTeacherScope in test context
    vi.spyOn(
      await import("../teacherEventEngine/scopeResolver"),
      "resolveTeacherScope"
    ).mockImplementation(async (userId: string) => {
      if (userId === teacherAId) return mockTeacherAScope;
      if (userId === teacherBId) return mockTeacherBScope;
      if (userId.includes("admin")) {
        return {
          teacherUserId: userId,
          schoolId,
          academicYearId,
          classTeacherSections: [section9AId, section9BId, section10AId],
          teachingSections: [],
          scheduledPeriods: [],
          allSectionIds: [section9AId, section9BId, section10AId],
        };
      }
      throw new TeacherScopeError("User not found", 404);
    });

    const passScope = await assertSubjectTeacherPermission(
      teacherAId,
      section9AId,
      mathSubjectId,
      { tx: mockTx, schoolId }
    );
    expect(passScope.teacherUserId).toBe(teacherAId);

    // Teacher A attempts Science in 9-A (taught by Teacher B) -> FORBIDDEN (403)
    await expect(
      assertSubjectTeacherPermission(teacherAId, section9AId, scienceSubjectId, {
        tx: mockTx,
        schoolId,
      })
    ).rejects.toThrow(TeacherScopeError);

    try {
      await assertSubjectTeacherPermission(teacherAId, section9AId, scienceSubjectId, {
        tx: mockTx,
        schoolId,
      });
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("SUBJECT_TEACHER_FORBIDDEN");
    }
  });

  // ─── Boundary Test 4: Cross-Section Student Tamper IDOR Guard ────────────
  it("Boundary Test 4: 9-B studentId inside 9-A payload triggers 403 CROSS_SECTION_STUDENT_TAMPER_ATTEMPT", async () => {
    // Mock DB query where 9-A only contains student9AId
    const mockTx = {
      select: () => ({
        from: () => ({
          where: vi.fn().mockImplementation(async () => {
            // Only returns student9AId as enrolled in 9-A
            return [{ id: student9AId }];
          }),
        }),
      }),
    };

    // Payload containing both student9AId and injected student9BId
    const tamperedStudentIds = [student9AId, student9BId];

    await expect(
      assertStudentRosterMembership(tamperedStudentIds, section9AId, schoolId, mockTx)
    ).rejects.toThrow(TeacherScopeError);

    try {
      await assertStudentRosterMembership(tamperedStudentIds, section9AId, schoolId, mockTx);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("CROSS_SECTION_STUDENT_TAMPER_ATTEMPT");
    }
  });

  // ─── Boundary Test 5: Administrative Scope Guard (Condition B) ───────────
  it("Boundary Test 5: Teacher A views 9-A report card -> OK; Teacher B -> 403 CLASS_TEACHER_OVERRIDE_REQUIRED", async () => {
    const mockTx = {
      execute: vi.fn().mockResolvedValue([{ school_id: schoolId }]),
      query: {
        students: {
          findFirst: vi.fn().mockResolvedValue({
            id: student9AId,
            schoolId,
            currentSectionId: section9AId,
          }),
        },
      },
    };

    // Teacher A is CT of 9-A -> PASSES
    const ctScope = await assertClassTeacherOverride(teacherAId, section9AId, {
      tx: mockTx,
      schoolId,
    });
    expect(ctScope.classTeacherSections).toContain(section9AId);

    // Teacher B is NOT CT of 9-A -> FAILS with 403 CLASS_TEACHER_OVERRIDE_REQUIRED
    await expect(
      assertClassTeacherOverride(teacherBId, section9AId, {
        tx: mockTx,
        schoolId,
      })
    ).rejects.toThrow(TeacherScopeError);

    try {
      await assertClassTeacherOverride(teacherBId, section9AId, {
        tx: mockTx,
        schoolId,
      });
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("CLASS_TEACHER_OVERRIDE_REQUIRED");
    }

    // Student 360: Teacher A gets FULL_HOMEROOM
    const resA = await assertStudent360Access(teacherAId, student9AId, {
      tx: mockTx,
      schoolId,
    });
    expect(resA.accessLevel).toBe("FULL_HOMEROOM");

    // Student 360: Teacher B gets RESTRICTED_SUBJECT (teaches Science in 9-A)
    const resB = await assertStudent360Access(teacherBId, student9AId, {
      tx: mockTx,
      schoolId,
    });
    expect(resB.accessLevel).toBe("RESTRICTED_SUBJECT");
  });

  // ─── Boundary Test 6: Cross-School Fail-Closed Isolation ────────────────
  it("Boundary Test 6: Cross-tenant access fails-closed even if section ID matches", async () => {
    const crossSchoolTx = {
      execute: vi.fn().mockResolvedValue([{ school_id: schoolId }]),
      query: {
        students: {
          findFirst: vi.fn().mockResolvedValue(null), // Filtered out by RLS / schoolId
        },
      },
    };

    // Request from other school
    await expect(
      assertStudent360Access(teacherAId, "student-other-school", {
        tx: crossSchoolTx,
        schoolId: otherSchoolId,
      })
    ).rejects.toThrow();
  });

  // ─── Guard Matrix: Administrative Roles Bypass ──────────────────────────
  it("Guard Matrix: Administrative roles (SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL) bypass instructional and homeroom guards", async () => {
    const adminRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const;

    for (const role of adminRoles) {
      // Admin passes subject permission for any subject/section
      const sScope = await assertSubjectTeacherPermission(
        "admin-user-id",
        section9AId,
        scienceSubjectId,
        { role, schoolId }
      );
      expect(sScope).toBeDefined();

      // Admin passes class teacher override for any section
      const ctScope = await assertClassTeacherOverride(
        "admin-user-id",
        section9AId,
        { role, schoolId }
      );
      expect(ctScope).toBeDefined();
    }
  });

  // ─── Mirror Integrity Test ──────────────────────────────────────────────
  it("Mirror Integrity: sections.classTeacherId remains backward-compatible mirror of class_teacher_assignments", () => {
    const actionsPath = path.resolve(
      __dirname,
      "../../../../frontend/src/app/(admin)/academics/actions/teacher-assignment.actions.ts"
    );
    expect(fs.existsSync(actionsPath)).toBe(true);
    const content = fs.readFileSync(actionsPath, "utf-8");

    // Verifies transactional mirror write into sections.classTeacherId
    expect(content).toContain("classTeacherId: params.teacherId");
  });
});
