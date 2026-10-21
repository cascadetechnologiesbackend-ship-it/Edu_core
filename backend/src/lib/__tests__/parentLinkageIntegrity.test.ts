/**
 * Phase F2 Parent-Student Linkage Integrity Test Suite
 *
 * Verifies:
 * - AC-4: The engine's parent lookup is schoolId-scoped: an integration test proves a same-email
 *         user from school A is not linked as parent of a student in school B.
 * - AC-5: Active unlinked students are retrieved in the Parent Linkage queue.
 * - AC-6: Admin 'Link' and 'Invite Parent' actions set primaryParentUserId and write audit log rows.
 * - Cross-school linkage rejection: an admin cannot link a student to a parent user from another school.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  students,
  users,
  studentFamilyMembers,
  auditLogs,
} from "@schoolmitra/database";
import { eq, and } from "drizzle-orm";
import {
  provisionOrLinkParent,
  getUnlinkedStudents,
  linkStudentToParentUser,
} from "../parentLinkage";
import { encryptData } from "../encryption";
import { withTenant } from "../tenant";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";

describe("Phase F2: Parent-Student Linkage Integrity", () => {
  const schoolAId = ISOLATION_IDS.schoolA.id;
  const schoolBId = ISOLATION_IDS.schoolB.id;
  const academicYearAId = ISOLATION_IDS.schoolA.academicYearId;
  const academicYearBId = ISOLATION_IDS.schoolB.academicYearId;

  beforeAll(async () => {
    await seedIsolationSchools();
  });

  it("AC-4: Prevents cross-tenant parent linkage when parent email exists in another school", async () => {
    const testEmail = `cross.tenant.${Date.now()}@example.com`;

    // 1. Create a parent user in School A with this email
    let parentAId: string;
    await withTenant(schoolAId, async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          schoolId: schoolAId,
          email: testEmail,
          passwordHash: "dummyHashA",
          isActive: true,
          isEmailVerified: true,
        })
        .returning();
      parentAId = u!.id;
    });

    // 2. Create a dummy student in School B
    let studentBId: string;
    await withTenant(schoolBId, async (tx) => {
      const [s] = await tx
        .insert(students)
        .values({
          schoolId: schoolBId,
          academicYearId: academicYearBId,
          admissionNumber: `TEST-B-${Date.now()}`,
          firstNameEncrypted: encryptData("StudentB"),
          lastNameEncrypted: encryptData("Test"),
          dateOfBirth: new Date("2012-01-01"),
          gender: "MALE",
          category: "GENERAL",
          admissionDate: new Date(),
          isActive: true,
        })
        .returning();
      studentBId = s!.id;
    });

    // 3. Call provisionOrLinkParent for Student B in School B with the same email
    const result = await provisionOrLinkParent({
      schoolId: schoolBId,
      studentId: studentBId!,
      primaryEmail: testEmail,
      guardianName: "Parent B",
      performedByUserId: ISOLATION_IDS.schoolB.adminUserId,
    });

    // 4. Verify that Student B was NOT linked to School A's parent account!
    expect(result.parentUserId).toBeDefined();
    expect(result.parentUserId).not.toBe(parentAId!);

    // Verify the newly created parent user in School B has schoolId = schoolBId
    await withTenant(schoolBId, async (tx) => {
      const parentB = await tx.query.users.findFirst({
        where: and(eq(users.id, result.parentUserId!), eq(users.schoolId, schoolBId)),
      });
      expect(parentB).toBeDefined();
      expect(parentB?.schoolId).toBe(schoolBId);

      // Verify student B's primaryParentUserId is the school B user
      const studentB = await tx.query.students.findFirst({
        where: eq(students.id, studentBId!),
      });
      expect(studentB?.primaryParentUserId).toBe(result.parentUserId);
      expect(studentB?.primaryParentUserId).not.toBe(parentAId!);
    });
  });

  it("Links existing parent within the same school without creating a duplicate user", async () => {
    const localEmail = `local.parent.${Date.now()}@example.com`;

    // 1. Create a parent user in School A
    let parentId: string;
    await withTenant(schoolAId, async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          schoolId: schoolAId,
          email: localEmail,
          passwordHash: "localHash",
          isActive: true,
          isEmailVerified: true,
        })
        .returning();
      parentId = u!.id;
    });

    // 2. Create student in School A
    let studentId: string;
    await withTenant(schoolAId, async (tx) => {
      const [s] = await tx
        .insert(students)
        .values({
          schoolId: schoolAId,
          academicYearId: academicYearAId,
          admissionNumber: `TEST-A-${Date.now()}`,
          firstNameEncrypted: encryptData("StudentA"),
          lastNameEncrypted: encryptData("Local"),
          dateOfBirth: new Date("2012-01-01"),
          gender: "FEMALE",
          category: "GENERAL",
          admissionDate: new Date(),
          isActive: true,
        })
        .returning();
      studentId = s!.id;
    });

    // 3. Link parent
    const result = await provisionOrLinkParent({
      schoolId: schoolAId,
      studentId: studentId!,
      primaryEmail: localEmail,
      guardianName: "Local Guardian",
      performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
    });

    expect(result.isNewlyProvisioned).toBe(false);
    expect(result.parentUserId).toBe(parentId!);

    await withTenant(schoolAId, async (tx) => {
      const student = await tx.query.students.findFirst({
        where: eq(students.id, studentId!),
      });
      expect(student?.primaryParentUserId).toBe(parentId!);
    });
  });

  it("AC-5: getUnlinkedStudents returns active students without a primaryParentUserId", async () => {
    const admNum = `UNLINKED-${Date.now()}`;
    let unlinkedStudentId: string;

    await withTenant(schoolAId, async (tx) => {
      const [s] = await tx
        .insert(students)
        .values({
          schoolId: schoolAId,
          academicYearId: academicYearAId,
          admissionNumber: admNum,
          firstNameEncrypted: encryptData("UnlinkedChild"),
          lastNameEncrypted: encryptData("QueueTest"),
          dateOfBirth: new Date("2013-05-10"),
          gender: "MALE",
          category: "GENERAL",
          admissionDate: new Date(),
          isActive: true,
          primaryParentUserId: null,
        })
        .returning();
      unlinkedStudentId = s!.id;

      await tx.insert(studentFamilyMembers).values({
        studentId: s!.id,
        schoolId: schoolAId,
        relation: "MOTHER",
        nameEncrypted: encryptData("Mother Unlinked"),
        emailEncrypted: encryptData("mother.unlinked@example.com"),
        mobileEncrypted: encryptData("9876543210"),
        isPrimaryContact: true,
      });
    });

    const unlinked = await getUnlinkedStudents(schoolAId);
    const found = unlinked.find((u) => u.id === unlinkedStudentId!);

    expect(found).toBeDefined();
    expect(found?.admissionNumber).toBe(admNum);
    expect(found?.studentName).toBe("UnlinkedChild QueueTest");
    expect(found?.guardianName).toBe("Mother Unlinked");
    expect(found?.guardianEmail).toBe("mother.unlinked@example.com");
  });

  it("AC-6 & Link Action: linkStudentToParentUser links user and writes audit log", async () => {
    let studentId: string;
    let parentId: string;

    await withTenant(schoolAId, async (tx) => {
      const [s] = await tx
        .insert(students)
        .values({
          schoolId: schoolAId,
          academicYearId: academicYearAId,
          admissionNumber: `ADM-LINK-${Date.now()}`,
          firstNameEncrypted: encryptData("ChildToLink"),
          lastNameEncrypted: encryptData("Test"),
          dateOfBirth: new Date("2013-01-01"),
          gender: "FEMALE",
          category: "GENERAL",
          admissionDate: new Date(),
          isActive: true,
          primaryParentUserId: null,
        })
        .returning();
      studentId = s!.id;

      const [p] = await tx
        .insert(users)
        .values({
          schoolId: schoolAId,
          email: `parent.link.${Date.now()}@example.com`,
          passwordHash: "hash",
          isActive: true,
        })
        .returning();
      parentId = p!.id;
    });

    const res = await linkStudentToParentUser({
      schoolId: schoolAId,
      studentId: studentId!,
      parentUserId: parentId!,
      performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      clientIp: "10.0.0.1",
    });

    expect(res.success).toBe(true);

    await withTenant(schoolAId, async (tx) => {
      // Verify student primaryParentUserId was updated
      const student = await tx.query.students.findFirst({
        where: eq(students.id, studentId!),
      });
      expect(student?.primaryParentUserId).toBe(parentId!);

      // Verify audit log entry
      const audit = await tx.query.auditLogs.findFirst({
        where: and(
          eq(auditLogs.schoolId, schoolAId),
          eq(auditLogs.recordId, studentId!),
          eq(auditLogs.action, "WRITE"),
        ),
        orderBy: [auditLogs.createdAt],
      });
      expect(audit).toBeDefined();
      expect(audit?.metadata).toMatchObject({ event: "LINK_PARENT", parentUserId: parentId! });
    });
  });

  it("Cross-school rejection: linkStudentToParentUser rejects linking parent from school B to student in school A", async () => {
    let studentAId: string;
    let parentBId: string;

    await withTenant(schoolAId, async (tx) => {
      const [s] = await tx
        .insert(students)
        .values({
          schoolId: schoolAId,
          academicYearId: academicYearAId,
          admissionNumber: `ADM-FAIL-${Date.now()}`,
          firstNameEncrypted: encryptData("RejectChild"),
          lastNameEncrypted: encryptData("Test"),
          dateOfBirth: new Date("2013-01-01"),
          gender: "MALE",
          category: "GENERAL",
          admissionDate: new Date(),
          isActive: true,
        })
        .returning();
      studentAId = s!.id;
    });

    await withTenant(schoolBId, async (tx) => {
      const [p] = await tx
        .insert(users)
        .values({
          schoolId: schoolBId,
          email: `parent.b.cross.${Date.now()}@example.com`,
          passwordHash: "hash",
          isActive: true,
        })
        .returning();
      parentBId = p!.id;
    });

    await expect(
      linkStudentToParentUser({
        schoolId: schoolAId,
        studentId: studentAId!,
        parentUserId: parentBId!,
        performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      }),
    ).rejects.toThrow("Parent user not found in this school.");
  });
});
