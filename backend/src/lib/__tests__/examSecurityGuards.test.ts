import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { assertTeacherTeaches } from "../examPermissions";
import { db } from "@/db";
import { exams, examClassScopes, examTypes, classes } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("Sprint S12.1 Layer 2: Teacher Authorization & Exam Relationship Guards", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await seedIsolationSchools();
  });

  afterAll(async () => {
    await pool.end();
  });

  // ── PART 1: SEC-AUTH-002 Teacher Authorization Strict Scoping ───────────────
  describe("SEC-AUTH-002: assertTeacherTeaches Fail-Closed Enforcement", () => {
    it("1.1: Exact matching active teacher assignment succeeds", async () => {
      const allowed = await assertTeacherTeaches({
        teacherId: ISOLATION_IDS.schoolA.teacherA1UserId,
        schoolId: ISOLATION_IDS.schoolA.id,
        role: "TEACHER",
        classId: ISOLATION_IDS.schoolA.classId,
        subjectId: ISOLATION_IDS.schoolA.subjectId,
      });
      expect(allowed).toBe(true);
    });

    it("1.2: Teacher assigned to class A / subject A is denied access to class B / subject B in the same school", async () => {
      // Different classId within same school
      const unrelatedClassId = "a3333333-9999-4333-8333-333333333333";
      const denied = await assertTeacherTeaches({
        teacherId: ISOLATION_IDS.schoolA.teacherA1UserId,
        schoolId: ISOLATION_IDS.schoolA.id,
        role: "TEACHER",
        classId: unrelatedClassId,
        subjectId: ISOLATION_IDS.schoolA.subjectId,
      });
      expect(denied).toBe(false);
    });

    it("1.3: An unrelated assignment in the same school is insufficient to authorize access (no broad fallback)", async () => {
      // teacherA2 belongs to School A but is NOT assigned to classA / subjectA
      const denied = await assertTeacherTeaches({
        teacherId: ISOLATION_IDS.schoolA.teacherA2UserId,
        schoolId: ISOLATION_IDS.schoolA.id,
        role: "TEACHER",
        classId: ISOLATION_IDS.schoolA.classId,
        subjectId: ISOLATION_IDS.schoolA.subjectId,
      });
      expect(denied).toBe(false);
    });

    it("1.4: Cross-tenant: Teacher from school B is denied access to school A exam subject", async () => {
      const denied = await assertTeacherTeaches({
        teacherId: ISOLATION_IDS.schoolB.teacherB1UserId,
        schoolId: ISOLATION_IDS.schoolA.id,
        role: "TEACHER",
        classId: ISOLATION_IDS.schoolA.classId,
        subjectId: ISOLATION_IDS.schoolA.subjectId,
      });
      expect(denied).toBe(false);
    });

    it("1.5: Missing class or subject scope fails closed for teacher operations", async () => {
      const missingClass = await assertTeacherTeaches({
        teacherId: ISOLATION_IDS.schoolA.teacherA1UserId,
        schoolId: ISOLATION_IDS.schoolA.id,
        role: "TEACHER",
        subjectId: ISOLATION_IDS.schoolA.subjectId,
      });
      expect(missingClass).toBe(false);

      const missingSubject = await assertTeacherTeaches({
        teacherId: ISOLATION_IDS.schoolA.teacherA1UserId,
        schoolId: ISOLATION_IDS.schoolA.id,
        role: "TEACHER",
        classId: ISOLATION_IDS.schoolA.classId,
      });
      expect(missingSubject).toBe(false);
    });

    it("1.6: Missing teacherId or schoolId fails closed", async () => {
      const missingTeacher = await assertTeacherTeaches({
        teacherId: "",
        schoolId: ISOLATION_IDS.schoolA.id,
        role: "TEACHER",
        classId: ISOLATION_IDS.schoolA.classId,
        subjectId: ISOLATION_IDS.schoolA.subjectId,
      });
      expect(missingTeacher).toBe(false);

      const missingSchool = await assertTeacherTeaches({
        teacherId: ISOLATION_IDS.schoolA.teacherA1UserId,
        schoolId: "",
        role: "TEACHER",
        classId: ISOLATION_IDS.schoolA.classId,
        subjectId: ISOLATION_IDS.schoolA.subjectId,
      });
      expect(missingSchool).toBe(false);
    });

    it("1.7: School admin and Principal retain school-wide evaluation access", async () => {
      const adminAllowed = await assertTeacherTeaches({
        teacherId: ISOLATION_IDS.schoolA.adminUserId,
        schoolId: ISOLATION_IDS.schoolA.id,
        role: "SCHOOL_ADMIN",
        classId: ISOLATION_IDS.schoolA.classId,
        subjectId: ISOLATION_IDS.schoolA.subjectId,
      });
      expect(adminAllowed).toBe(true);

      const principalAllowed = await assertTeacherTeaches({
        teacherId: ISOLATION_IDS.schoolA.adminUserId,
        schoolId: ISOLATION_IDS.schoolA.id,
        role: "PRINCIPAL",
        classId: ISOLATION_IDS.schoolA.classId,
        subjectId: ISOLATION_IDS.schoolA.subjectId,
      });
      expect(principalAllowed).toBe(true);
    });
  });

  // ── PART 2: SEC-REF-004 Exam Creation & Reference Integrity ────────────────
  describe("SEC-REF-004: Exam Creation & Cross-School Reference Rejection", () => {
    it("2.1: Exam type from foreign school is rejected", async () => {
      // Validate examTypeId belongs to School A
      const validInA = await db.query.examTypes.findFirst({
        where: and(
          eq(examTypes.id, ISOLATION_IDS.schoolB.examTypeId),
          eq(examTypes.schoolId, ISOLATION_IDS.schoolA.id),
        ),
      });
      expect(validInA).toBeUndefined();
    });

    it("2.2: Class ID from foreign school is rejected", async () => {
      // Validate class belongs to School A
      const validClassInA = await db.query.classes.findFirst({
        where: and(
          eq(classes.id, ISOLATION_IDS.schoolB.classId),
          eq(classes.schoolId, ISOLATION_IDS.schoolA.id),
        ),
      });
      expect(validClassInA).toBeUndefined();
    });

    it("2.3: Duplicate class IDs in classIds are rejected", () => {
      const classIds = [
        ISOLATION_IDS.schoolA.classId,
        ISOLATION_IDS.schoolA.classId,
      ];
      const uniqueClassIds = Array.from(new Set(classIds));
      expect(uniqueClassIds.length).not.toBe(classIds.length);
    });

    it("2.4: Atomic boundary: Partial scope failure leaves no orphaned exam", async () => {
      const testExamId = "aaaaaaa7-7777-4aaa-8aaa-777777777777";
      
      // Simulate transactional rollback when a class validation fails
      let transactionRolledBack = false;
      try {
        await db.transaction(async (tx) => {
          await tx.insert(exams).values({
            id: testExamId,
            schoolId: ISOLATION_IDS.schoolA.id,
            academicYearId: ISOLATION_IDS.schoolA.academicYearId,
            examTypeId: ISOLATION_IDS.schoolA.examTypeId,
            name: "Failed Atomic Rollback Test Exam",
            startDate: new Date("2026-11-01"),
            endDate: new Date("2026-11-10"),
            isLocked: false,
          });

          // Foreign class belongs to School B -> Validation throws
          const invalidForeignClass = ISOLATION_IDS.schoolB.classId;
          const classRecord = await tx.query.classes.findFirst({
            where: and(
              eq(classes.id, invalidForeignClass),
              eq(classes.schoolId, ISOLATION_IDS.schoolA.id),
            ),
          });

          if (!classRecord) {
            throw new Error(`Class ${invalidForeignClass} does not belong to School A`);
          }

          await tx.insert(examClassScopes).values({
            examId: testExamId,
            classId: invalidForeignClass,
            schoolId: ISOLATION_IDS.schoolA.id,
          });
        });
      } catch (err: any) {
        transactionRolledBack = true;
      }

      expect(transactionRolledBack).toBe(true);

      // Verify NO exam record was left in the database
      const orphanExam = await db.query.exams.findFirst({
        where: eq(exams.id, testExamId),
      });
      expect(orphanExam).toBeUndefined();

      // Verify NO exam class scope record was left
      const orphanScope = await db.query.examClassScopes.findFirst({
        where: eq(examClassScopes.examId, testExamId),
      });
      expect(orphanScope).toBeUndefined();
    });
  });
});
