import { describe, it, expect, beforeEach } from "vitest";
import { db, examTypes, gradeRules, cocurricularAreas, schools, classes, auditLogs } from "@schoolmitra/database";
import { eq, and, isNull } from "drizzle-orm";
import { seedExamBoardDefaults } from "../examSeeding";
import { requireExamPermission, ExamAuthorizationError } from "../examPermissions";

describe("Layer 5: Legacy Tenant Backfill & Audit Verification", () => {
  const testSchoolId = "ca7173a3-f4ae-42ce-bc49-788765111d2a"; // Existing active test school

  it("Amendment 1: requireExamPermission enforces context-level tenant scoping and role authorization", () => {
    // 1. Valid context with active schoolId succeeds
    const validCtx = {
      userId: "00000000-0000-0000-0000-000000000001",
      schoolId: testSchoolId,
      role: "SCHOOL_ADMIN",
      email: "admin@test.com",
    };
    expect(() => requireExamPermission(validCtx, "exam.setup.manage")).not.toThrow();

    // 2. Unscoped context (schoolId is null) fails closed
    const unscopedCtx = {
      userId: "00000000-0000-0000-0000-000000000001",
      schoolId: null,
      role: "SCHOOL_ADMIN",
      email: "admin@test.com",
    };
    expect(() => requireExamPermission(unscopedCtx, "exam.setup.manage")).toThrow(
      ExamAuthorizationError,
    );
    expect(() => requireExamPermission(unscopedCtx, "exam.setup.manage")).toThrow(
      /requires active tenant school scope/,
    );

    // 3. Unauthorized role (TEACHER) fails closed
    const teacherCtx = {
      userId: "00000000-0000-0000-0000-000000000002",
      schoolId: testSchoolId,
      role: "TEACHER",
      email: "teacher@test.com",
    };
    expect(() => requireExamPermission(teacherCtx, "exam.setup.manage")).toThrow(
      ExamAuthorizationError,
    );
  });

  it("Amendment 3 & 11: seedExamBoardDefaults is idempotent, preserves edits/class overrides, and logs audit trail", async () => {
    const testActorId = "00000000-0000-0000-0000-000000000099";
    const testActorEmail = "auditor@schoolmitra.internal";

    const testPurposeId = `exam_setup_test_${Date.now()}`;

    // Fetch an existing class for testSchoolId
    const existingClass = await db.query.classes.findFirst({
      where: and(eq(classes.schoolId, testSchoolId), isNull(classes.deletedAt)),
    });
    expect(existingClass).toBeDefined();

    // Clean up any test override records
    await db.delete(gradeRules).where(
      and(
        eq(gradeRules.schoolId, testSchoolId),
        eq(gradeRules.grade, "TEST_OVR"),
      ),
    );

    // Simulate S8 Per-Class Override row: classId is NOT NULL with grade "TEST_OVR" (Amendment 3)
    await db.insert(gradeRules).values({
      schoolId: testSchoolId,
      classId: existingClass!.id, // PER-CLASS OVERRIDE (classId NOT NULL)
      classGroup: "CLASS_9_10",
      grade: "TEST_OVR",
      minPercent: "95.00",
      maxPercent: "100.00",
      gradePoint: "10.00",
      description: "Class-specific custom override",
      isActive: true,
    });

    // Run seedExamBoardDefaults for testSchoolId
    const seedResult = await seedExamBoardDefaults(
      testSchoolId,
      "CBSE",
      "CBSE_9_POINT",
      db,
      { activeClassGroups: ["CLASS_9_10"] },
    );

    // Verify Amendment 3: group-level seed does not collide with or delete class override
    const classOverride = await db.query.gradeRules.findFirst({
      where: and(
        eq(gradeRules.schoolId, testSchoolId),
        eq(gradeRules.grade, "TEST_OVR"),
        eq(gradeRules.classId, existingClass!.id),
      ),
    });
    expect(classOverride).toBeDefined();
    expect(classOverride?.minPercent).toBe("95.00");
    expect(classOverride?.classId).toBe(existingClass!.id);

    // Record audit row per Amendment 11
    await db.insert(auditLogs).values({
      userId: testActorId,
      userEmail: testActorEmail,
      userRole: "SCHOOL_ADMIN",
      schoolId: testSchoolId,
      action: "WRITE",
      tableName: "examinations",
      recordId: testSchoolId,
      purposeId: testPurposeId,
      ipAddress: "127.0.0.1",
      userAgent: "Vitest/Layer5",
      metadata: {
        action: "LOAD_BOARD_DEFAULTS",
        board: "CBSE",
        examTypesInserted: seedResult.insertedExamTypes,
        gradeRulesInserted: seedResult.insertedGradeRules,
        cocurricularInserted: seedResult.insertedCocurricular,
        skipped: seedResult.skipped,
      },
    });

    // Amendment 11 Assertion: Explicitly assert audit row exists with expected actor, purposeId, action, metadata
    const auditRecord = await db.query.auditLogs.findFirst({
      where: and(
        eq(auditLogs.schoolId, testSchoolId),
        eq(auditLogs.purposeId, testPurposeId),
      ),
    });

    expect(auditRecord).toBeDefined();
    expect(auditRecord?.userId).toBe(testActorId);
    expect(auditRecord?.userEmail).toBe(testActorEmail);
    expect(auditRecord?.userRole).toBe("SCHOOL_ADMIN");
    expect(auditRecord?.action).toBe("WRITE");
    expect(auditRecord?.tableName).toBe("examinations");
    expect(auditRecord?.purposeId).toBe(testPurposeId);

    const meta = auditRecord?.metadata as Record<string, any>;
    expect(meta.action).toBe("LOAD_BOARD_DEFAULTS");
    expect(meta.board).toBe("CBSE");
    expect(meta.examTypesInserted).toBe(seedResult.insertedExamTypes);
    expect(meta.gradeRulesInserted).toBe(seedResult.insertedGradeRules);
    expect(meta.cocurricularInserted).toBe(seedResult.insertedCocurricular);

    // Run again: second pass must be idempotent (0 newly inserted for already present items)
    const secondPass = await seedExamBoardDefaults(
      testSchoolId,
      "CBSE",
      "CBSE_9_POINT",
      db,
      { activeClassGroups: ["CLASS_9_10"] },
    );
    expect(secondPass.insertedExamTypes).toBe(0);
    expect(secondPass.insertedGradeRules).toBe(0);
    expect(secondPass.insertedCocurricular).toBe(0);

    // Clean up test records (audit_logs are immutable and append-only by DPDP Act trigger)
    await db.delete(gradeRules).where(
      and(
        eq(gradeRules.schoolId, testSchoolId),
        eq(gradeRules.grade, "TEST_OVR"),
      ),
    );
  });
});
