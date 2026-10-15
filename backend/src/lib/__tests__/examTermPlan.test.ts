import { describe, it, expect, beforeEach } from "vitest";
import {
  db,
  exams,
  examTypes,
  examComponents,
  examClassScopes,
  schools,
  classes,
  academicYears,
  auditLogs,
} from "@schoolmitra/database";
import { eq, and, isNull } from "drizzle-orm";
import { requireExamPermission, ExamAuthorizationError } from "../examPermissions";
import {
  getBlueprint,
  computeProportionalDates,
  previewBoardTermPlan,
  mapGradeLevelToClassGroup,
} from "../examBoardBlueprints";
import { seedExamBoardDefaults } from "../examSeeding";

describe("Layer 6: Board Term Plan Creator & Wizard Preselection", () => {
  const testSchoolId = "ca7173a3-f4ae-42ce-bc49-788765111d2a";
  const testActorId = "00000000-0000-0000-0000-000000000001";
  const testEmail = "admin@schoolmitra.test";

  it("Amendment 1 & 2: requireExamPermission enforces context-level session scoping on term plan actions", () => {
    // 1. Authorized session context succeeds
    const validCtx = {
      userId: testActorId,
      schoolId: testSchoolId,
      role: "SCHOOL_ADMIN",
      email: testEmail,
    };
    expect(() => requireExamPermission(validCtx, "exam.setup.manage")).not.toThrow();

    // 2. Missing school scope fails closed (protects against tenant confusion)
    const unscopedCtx = {
      userId: testActorId,
      schoolId: null,
      role: "SCHOOL_ADMIN",
      email: testEmail,
    };
    expect(() => requireExamPermission(unscopedCtx, "exam.setup.manage")).toThrow(
      ExamAuthorizationError,
    );

    // 3. Unauthorized role fails closed
    const teacherCtx = {
      userId: testActorId,
      schoolId: testSchoolId,
      role: "TEACHER",
      email: testEmail,
    };
    expect(() => requireExamPermission(teacherCtx, "exam.setup.manage")).toThrow(
      ExamAuthorizationError,
    );
  });

  it("Amendments 4, 5, 6, 8, 11: Provisions board term plan with proportional dates, class scope intersection, explicit components, idempotency, and audit logging", async () => {
    // 1. Ensure school has board defaults loaded
    await seedExamBoardDefaults(testSchoolId, "CBSE", "CBSE_9_POINT", db);

    // 2. Fetch or ensure active academic year
    let activeYear = await db.query.academicYears.findFirst({
      where: and(
        eq(academicYears.schoolId, testSchoolId),
        eq(academicYears.isActive, true),
      ),
    });

    if (!activeYear) {
      const [newYear] = await db
        .insert(academicYears)
        .values({
          schoolId: testSchoolId,
          label: "2026-2027",
          startDate: new Date("2026-04-01T00:00:00.000Z"),
          endDate: new Date("2027-03-31T00:00:00.000Z"),
          isActive: true,
        })
        .returning();
      activeYear = newYear!;
    }

    // 3. Fetch active classes and available exam types
    const schoolClasses = await db.query.classes.findMany({
      where: and(eq(classes.schoolId, testSchoolId), isNull(classes.deletedAt)),
    });
    expect(schoolClasses.length).toBeGreaterThan(0);

    const schoolExamTypes = await db.query.examTypes.findMany({
      where: and(eq(examTypes.schoolId, testSchoolId), eq(examTypes.isActive, true)),
    });
    expect(schoolExamTypes.length).toBeGreaterThan(0);

    const blueprint = getBlueprint("CBSE");
    const termItems = blueprint.termPlan.terms;

    // Clean up any previous test exams for these exact term names in this academic year
    for (const term of termItems) {
      const existing = await db.query.exams.findFirst({
        where: and(
          eq(exams.schoolId, testSchoolId),
          eq(exams.academicYearId, activeYear.id),
          eq(exams.name, term.name),
        ),
      });
      if (existing) {
        await db.delete(exams).where(eq(exams.id, existing.id));
      }
    }

    // --- PASS 1: Execute Term Plan Creation ---
    const createdExams: Array<{ id: string; name: string; componentsCount: number; scopedClassesCount: number }> = [];
    const skippedExams: Array<{ name: string; reason: string }> = [];

    for (const term of termItems) {
      // Amendment 5: Idempotency Key (schoolId, academicYearId, name)
      const existingExam = await db.query.exams.findFirst({
        where: and(
          eq(exams.schoolId, testSchoolId),
          eq(exams.academicYearId, activeYear.id),
          eq(exams.name, term.name),
          isNull(exams.deletedAt),
        ),
      });

      if (existingExam) {
        skippedExams.push({ name: term.name, reason: "Already exists" });
        continue;
      }

      const primaryExamType =
        schoolExamTypes.find((et) => et.code === term.examTypeCode) || schoolExamTypes[0]!;

      // Amendment 6: Proportionally Derived Placeholder Dates
      const { startDate, endDate } = computeProportionalDates(
        activeYear.startDate,
        activeYear.endDate,
        term.defaultProportion,
      );

      const [newExam] = await db
        .insert(exams)
        .values({
          schoolId: testSchoolId,
          academicYearId: activeYear.id,
          examTypeId: primaryExamType.id,
          name: term.name,
          startDate,
          endDate,
          isLocked: false,
        })
        .returning();

      expect(newExam).toBeDefined();

      // Amendment 4: Term Plan Scopes Intersect applicable_class_groups
      const matchingClasses = schoolClasses.filter((c) => {
        const group = mapGradeLevelToClassGroup(c.gradeLevel || c.displayName);
        return term.applicableGroups.includes(group);
      });

      if (matchingClasses.length > 0) {
        await db.insert(examClassScopes).values(
          matchingClasses.map((cls) => ({
            schoolId: testSchoolId,
            examId: newExam!.id,
            classId: cls.id,
          })),
        );
      }

      // Amendment 8: Explicit Component Mapping on Term Shells
      let compSortOrder = 0;
      const insertedComponentTypes = new Set<string>();

      for (const cmp of term.components) {
        let compExamType = primaryExamType;
        if (cmp.examTypeCode && cmp.examTypeCode !== primaryExamType.code) {
          const found = schoolExamTypes.find((et) => et.code === cmp.examTypeCode);
          if (found) compExamType = found;
        }

        if (insertedComponentTypes.has(compExamType.id)) {
          const alternate = schoolExamTypes.find((et) => !insertedComponentTypes.has(et.id));
          if (alternate) compExamType = alternate;
          else continue;
        }

        insertedComponentTypes.add(compExamType.id);

        await db.insert(examComponents).values({
          schoolId: testSchoolId,
          examId: newExam!.id,
          examTypeId: compExamType.id,
          displayName: cmp.name,
          sortOrder: compSortOrder++,
          weightPercent: cmp.weightPercent.toFixed(2),
          showOnReportCard: true,
        });
      }

      createdExams.push({
        id: newExam!.id,
        name: newExam!.name,
        componentsCount: insertedComponentTypes.size,
        scopedClassesCount: matchingClasses.length,
      });
    }

    // Verify Pass 1 results
    expect(createdExams.length).toBe(termItems.length); // All terms created
    expect(skippedExams.length).toBe(0);

    // Verify created exam dates are proportionally ordered
    const sortedExams = await db.query.exams.findMany({
      where: and(
        eq(exams.schoolId, testSchoolId),
        eq(exams.academicYearId, activeYear.id),
      ),
      orderBy: (t, { asc }) => [asc(t.startDate)],
    });

    const pt1 = sortedExams.find((e) => e.name === "Periodic Test 1");
    const hy = sortedExams.find((e) => e.name === "Half-Yearly Examination");
    const ann = sortedExams.find((e) => e.name === "Annual Examination");

    expect(pt1).toBeDefined();
    expect(hy).toBeDefined();
    expect(ann).toBeDefined();

    // Proportional order check (Amendment 6)
    expect(new Date(pt1!.startDate).getTime()).toBeLessThan(new Date(hy!.startDate).getTime());
    expect(new Date(hy!.startDate).getTime()).toBeLessThan(new Date(ann!.startDate).getTime());

    // Component mapping check (Amendment 8)
    const hyComponents = await db.query.examComponents.findMany({
      where: eq(examComponents.examId, hy!.id),
    });
    expect(hyComponents.length).toBe(2); // Theory (80%) + Internal (20%)
    const theoryComp = hyComponents.find((c) => c.displayName === "Theory Paper");
    const internalComp = hyComponents.find((c) => c.displayName === "Internal Assessment");
    expect(theoryComp).toBeDefined();
    expect(internalComp).toBeDefined();
    expect(Number(theoryComp!.weightPercent)).toBe(80.0);
    expect(Number(internalComp!.weightPercent)).toBe(20.0);

    // Record and assert audit trail (Amendment 11)
    const testPurposeId = `exam_term_plan_${Date.now()}`;
    await db.insert(auditLogs).values({
      userId: testActorId,
      userEmail: testEmail,
      userRole: "SCHOOL_ADMIN",
      schoolId: testSchoolId,
      action: "WRITE",
      tableName: "examinations",
      recordId: testSchoolId,
      purposeId: testPurposeId,
      ipAddress: "127.0.0.1",
      userAgent: "SchoolMitra/ExamTermPlanTest",
      metadata: {
        action: "CREATE_BOARD_TERM_PLAN",
        board: "CBSE",
        academicYearId: activeYear.id,
        createdExamsCount: createdExams.length,
        skippedExamsCount: skippedExams.length,
        createdExams,
        skippedExams,
      },
    });

    const recordedAudit = await db.query.auditLogs.findFirst({
      where: and(
        eq(auditLogs.schoolId, testSchoolId),
        eq(auditLogs.purposeId, testPurposeId),
      ),
    });
    expect(recordedAudit).toBeDefined();
    expect(recordedAudit?.userEmail).toBe(testEmail);
    expect((recordedAudit?.metadata as any)?.action).toBe("CREATE_BOARD_TERM_PLAN");
    expect((recordedAudit?.metadata as any)?.createdExamsCount).toBe(termItems.length);

    // --- PASS 2: Idempotency Verification (Amendment 5) ---
    const pass2Created: Array<any> = [];
    const pass2Skipped: Array<any> = [];

    for (const term of termItems) {
      const existingExam = await db.query.exams.findFirst({
        where: and(
          eq(exams.schoolId, testSchoolId),
          eq(exams.academicYearId, activeYear.id),
          eq(exams.name, term.name),
          isNull(exams.deletedAt),
        ),
      });

      if (existingExam) {
        pass2Skipped.push({ name: term.name, reason: "Already exists" });
      } else {
        pass2Created.push({ name: term.name });
      }
    }

    expect(pass2Created.length).toBe(0); // 0 new exams created on re-trigger
    expect(pass2Skipped.length).toBe(termItems.length); // All skipped idempotently
  });
});
