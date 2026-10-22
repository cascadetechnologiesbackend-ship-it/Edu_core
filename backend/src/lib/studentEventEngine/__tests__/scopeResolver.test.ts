/**
 * Phase S2: Student Scope Resolver Integration Test Suite
 *
 * Verifies:
 * - Direct student scoping via students.userId.
 * - Admin preview strictly requires ?studentId= (SD4 findFirst deletion proved).
 * - Multi-tenant isolation: cannot access student of another school.
 * - Account disabled status (isActive = false on user row).
 * - Fallback to class non-elective subjects when no explicit electives enrolled.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  students,
  users,
  classes,
  sections,
  subjects,
  classSubjects,
  studentSubjectEnrollments,
} from "@schoolmitra/database";
import { eq, and } from "drizzle-orm";
import {
  resolveStudentScope,
  StudentScopeError,
  clearStudentScopeCache,
} from "../scopeResolver";
import { encryptData } from "../../encryption";
import { withTenant } from "../../tenant";
import { ISOLATION_IDS, seedIsolationSchools } from "../../isolationFixtures";

describe("Phase S2: Student Scope Resolver (resolveStudentScope & Security Guards)", { timeout: 30000 }, () => {
  const schoolAId = ISOLATION_IDS.schoolA.id;
  const schoolBId = ISOLATION_IDS.schoolB.id;
  const academicYearAId = ISOLATION_IDS.schoolA.academicYearId;
  const classAId = ISOLATION_IDS.schoolA.classId;
  const adminAId = ISOLATION_IDS.schoolA.adminUserId;

  let testStudentId: string;
  let testStudentUserId: string;
  let testSectionId: string;
  let testSectionName: string;
  let testSubjectId: string;
  let testClassSubjectId: string;

  beforeAll(async () => {
    await seedIsolationSchools();
    clearStudentScopeCache();

    // Seed student test fixture in School A
    await withTenant(schoolAId, async (tx) => {
      testSectionName = `S2-${Date.now()}`;
      const [sec] = await tx
        .insert(sections)
        .values({
          schoolId: schoolAId,
          classId: classAId,
          name: testSectionName,
          capacity: 40,
        })
        .returning();
      testSectionId = sec!.id;

      // 2. Create subject and class_subject
      const [subj] = await tx
        .insert(subjects)
        .values({
          schoolId: schoolAId,
          code: `SCI-${Date.now()}`,
          name: "General Science",
          subjectType: "THEORY",
        })
        .returning();
      testSubjectId = subj!.id;

      const [cs] = await tx
        .insert(classSubjects)
        .values({
          schoolId: schoolAId,
          classId: classAId,
          subjectId: testSubjectId,
          isElective: false,
        })
        .returning();
      testClassSubjectId = cs!.id;

      // 3. Create student user
      const [u] = await tx
        .insert(users)
        .values({
          schoolId: schoolAId,
          email: `student.s2.${Date.now()}@schoolmitra.internal`,
          passwordHash: "$2a$12$DummyHashForTestPurposesOnlyxxxxxxxxxxxxxxxxxxxxxxxxx",
          isActive: true,
        })
        .returning();
      testStudentUserId = u!.id;

      // 4. Create student
      const [s] = await tx
        .insert(students)
        .values({
          schoolId: schoolAId,
          academicYearId: academicYearAId,
          currentClassId: classAId,
          currentSectionId: testSectionId,
          admissionNumber: `S2-ADM-${Date.now()}`,
          firstNameEncrypted: encryptData("Rohan"),
          lastNameEncrypted: encryptData("Verma"),
          rollNumber: "15",
          userId: testStudentUserId,
          category: "GENERAL",
          dateOfBirth: new Date("2012-06-10"),
          gender: "MALE",
          admissionDate: new Date(),
          isActive: true,
        })
        .returning();
      testStudentId = s!.id;
    });
  });

  it("1. Resolves complete student scope for an authenticated STUDENT", async () => {
    const scope = await withTenant(schoolAId, async (tx) => {
      return await resolveStudentScope(testStudentUserId, {
        tx,
        schoolId: schoolAId,
        role: "STUDENT",
        bypassCache: true,
      });
    });

    expect(scope.studentId).toBe(testStudentId);
    expect(scope.studentUserId).toBe(testStudentUserId);
    expect(scope.studentName).toBe("Rohan Verma");
    expect(scope.sectionName).toBe(testSectionName);
    expect(scope.rollNumber).toBe("15");
    expect(scope.isAccountDisabled).toBe(false);
    expect(scope.enrolledSubjectIds).toContain(testSubjectId);
    expect(scope.enrolledClassSubjectIds).toContain(testClassSubjectId);
  });

  it("2. SD4 Closure: Admin preview strictly requires ?studentId= and rejects without fallback", async () => {
    // Calling as admin WITHOUT studentId must reject
    await expect(
      withTenant(schoolAId, async (tx) => {
        return await resolveStudentScope(adminAId, {
          tx,
          schoolId: schoolAId,
          role: "SCHOOL_ADMIN",
          studentId: null, // No fallback to findFirst!
          bypassCache: true,
        });
      })
    ).rejects.toThrow(/Admin preview requires an explicit studentId parameter/);

    // Calling as admin WITH explicit studentId succeeds
    const adminScope = await withTenant(schoolAId, async (tx) => {
      return await resolveStudentScope(adminAId, {
        tx,
        schoolId: schoolAId,
        role: "SCHOOL_ADMIN",
        studentId: testStudentId,
        bypassCache: true,
      });
    });

    expect(adminScope.studentId).toBe(testStudentId);
    expect(adminScope.studentName).toBe("Rohan Verma");
  });

  it("3. Multi-Tenant Guard: Cannot access student belonging to another school", async () => {
    // School B admin attempts to resolve School A's student
    await expect(
      withTenant(schoolBId, async (tx) => {
        return await resolveStudentScope(adminAId, {
          tx,
          schoolId: schoolBId,
          role: "SCHOOL_ADMIN",
          studentId: testStudentId,
          bypassCache: true,
        });
      })
    ).rejects.toThrow(/Student record not found/);
  });

  it("4. Detects disabled student account when user.isActive is false", async () => {
    // Deactivate user
    await withTenant(schoolAId, async (tx) => {
      await tx
        .update(users)
        .set({ isActive: false })
        .where(eq(users.id, testStudentUserId));
    });

    clearStudentScopeCache(testStudentId);

    const disabledScope = await withTenant(schoolAId, async (tx) => {
      return await resolveStudentScope(testStudentUserId, {
        tx,
        schoolId: schoolAId,
        role: "STUDENT",
        bypassCache: true,
      });
    });

    expect(disabledScope.isAccountDisabled).toBe(true);

    // Restore user
    await withTenant(schoolAId, async (tx) => {
      await tx
        .update(users)
        .set({ isActive: true })
        .where(eq(users.id, testStudentUserId));
    });
  });
});
