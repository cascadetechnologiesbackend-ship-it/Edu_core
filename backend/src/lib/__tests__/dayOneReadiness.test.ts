import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/db";
import {
  schools,
  academicYears,
  classes,
  sections,
  subjects,
  classSubjects,
  feeHeads,
  feeStructures,
  feeInvoices,
  departments,
  designations,
  staff,
  students,
  timetablePeriods,
  users,
  passwordResetTokens,
  usageEvents,
} from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { withTenant } from "../tenant";
import {
  getDayOneReadiness,
  emitDayOneJourneyFinishedIfReady,
} from "../dayOneReadiness";

const READINESS_TEST_IDS = {
  schoolA: {
    id: "e1111111-1111-4111-8111-111111111111",
    name: "Day One Academy A",
    slug: "day-one-acad-a",
    udise: "UDDAY0000001",
    adminUserId: "e5555555-5555-4555-8555-555555555555",
    academicYearId: "ea111111-1111-4111-8111-111111111111",
    classId: "ec111111-1111-4111-8111-111111111111",
    sectionId: "ed111111-1111-4111-8111-111111111111",
    subjectId: "eb111111-1111-4111-8111-111111111111",
    classSubjectId: "ef111111-1111-4111-8111-111111111111",
    feeHeadId: "e0111111-1111-4111-8111-111111111111",
    feeStructureId: "ee111111-1111-4111-8111-111111111111",
    departmentId: "e3111111-1111-4111-8111-111111111111",
    designationId: "e4111111-1111-4111-8111-111111111111",
    staffUserId: "e6111111-1111-4111-8111-111111111111",
    staffId: "e7111111-1111-4111-8111-111111111111",
    studentId: "e8111111-1111-4111-8111-111111111111",
    parentUserId: "e9111111-1111-4111-8111-111111111111",
    feeInvoiceId: "e2111111-1111-4111-8111-111111111111",
    timetablePeriodId: "e5111111-1111-4111-8111-111111111111",
  },
  schoolB: {
    id: "e2222222-2222-4222-8222-222222222222",
    name: "Day One Academy B",
    slug: "day-one-acad-b",
    udise: "UDDAY0000002",
    adminUserId: "e7777777-7777-4777-8777-777777777777",
    academicYearId: "ea222222-2222-4222-8222-222222222222",
  },
};

describe("Phase D1-L2: Day One Readiness Cockpit & Telemetry Verification", () => {
  const schoolA = READINESS_TEST_IDS.schoolA;
  const schoolB = READINESS_TEST_IDS.schoolB;

  beforeAll(async () => {
    // 1. Seed School A & School B
    for (const s of [schoolA, schoolB]) {
      await db
        .insert(schools)
        .values({
          id: s.id,
          name: s.name,
          slug: s.slug,
          udiseCode: s.udise,
          board: "CBSE",
          address: "123 Day One Road",
          city: "New Delhi",
          state: "Delhi",
          pincode: "110001",
          phone: "9876543210",
          email: `${s.slug}@example.com`,
          principalName: "Dr. Day One Principal",
          establishedYear: 2026,
          isActive: true,
        })
        .onConflictDoNothing();

      await withTenant(s.id, async (tx) => {
        await tx
          .insert(users)
          .values({
            id: s.adminUserId,
            schoolId: s.id,
            email: `admin.${s.slug}@example.com`,
            passwordHash: "hash123",
            isActive: true,
            isEmailVerified: true,
          })
          .onConflictDoNothing();
      });
    }
  });

  beforeEach(async () => {
    // Reset School A & B transactional tables before each test under withTenant
    await db.delete(usageEvents).where(eq(usageEvents.schoolId, schoolA.id));
    await db.delete(usageEvents).where(eq(usageEvents.schoolId, schoolB.id));

    await withTenant(schoolA.id, async (tx) => {
      await tx.delete(timetablePeriods).where(eq(timetablePeriods.schoolId, schoolA.id));
      await tx.delete(feeInvoices).where(eq(feeInvoices.schoolId, schoolA.id));
      await tx.delete(feeStructures).where(eq(feeStructures.schoolId, schoolA.id));
      await tx.delete(feeHeads).where(eq(feeHeads.schoolId, schoolA.id));
      await tx.delete(classSubjects).where(eq(classSubjects.schoolId, schoolA.id));
      await tx.delete(subjects).where(eq(subjects.schoolId, schoolA.id));
      await tx.delete(students).where(eq(students.schoolId, schoolA.id));
      await tx.delete(staff).where(eq(staff.schoolId, schoolA.id));
      await tx.delete(designations).where(eq(designations.schoolId, schoolA.id));
      await tx.delete(departments).where(eq(departments.schoolId, schoolA.id));
      await tx.delete(sections).where(eq(sections.schoolId, schoolA.id));
      await tx.delete(classes).where(eq(classes.schoolId, schoolA.id));
      await tx.delete(academicYears).where(eq(academicYears.schoolId, schoolA.id));
      await tx.delete(users).where(
        and(eq(users.schoolId, schoolA.id), ne(users.id, schoolA.adminUserId))
      );
    });

    await withTenant(schoolB.id, async (tx) => {
      await tx.delete(academicYears).where(eq(academicYears.schoolId, schoolB.id));
    });
  });

  it("1. Fresh School: computes truthful incomplete checks with exact next-action deep links", async () => {
    // Fresh school A has an active academic year (simulating tenant provisioning step 1)
    await withTenant(schoolA.id, async (tx) => {
      await tx.insert(academicYears).values({
        id: schoolA.academicYearId,
        schoolId: schoolA.id,
        label: "2026-27",
        startDate: new Date("2026-04-01T00:00:00Z"),
        endDate: new Date("2027-03-31T00:00:00Z"),
        isActive: true,
      });
    });

    const report = await getDayOneReadiness(schoolA.id);

    expect(report.schoolId).toBe(schoolA.id);
    expect(report.schoolName).toBe(schoolA.name);
    expect(report.isReadyForDayOne).toBe(false);
    expect(report.totalChecks).toBe(8);
    expect(report.readyChecksCount).toBe(1); // Only academic year is ready
    expect(report.finishedStateMessage).toBeUndefined();

    // Check 1: Academic Year
    const yearCheck = report.checks.find((c) => c.id === "academic_year");
    expect(yearCheck?.status).toBe("READY");
    expect(yearCheck?.counts.label).toBe("2026-27");
    expect(yearCheck?.statusLabel).toContain("2026-27");

    // Check 2: Classes and sections
    const classCheck = report.checks.find((c) => c.id === "classes_sections");
    expect(classCheck?.status).toBe("NOT_STARTED");
    expect(classCheck?.deepLink.href).toBe("/academics");

    // Check 3: Subjects
    const subjCheck = report.checks.find((c) => c.id === "subjects");
    expect(subjCheck?.status).toBe("NOT_STARTED");
    expect(subjCheck?.deepLink.href).toBe("/academics/subjects");

    // Check 4: Fees
    const feeCheck = report.checks.find((c) => c.id === "fees");
    expect(feeCheck?.status).toBe("NOT_STARTED");
    expect(feeCheck?.deepLink.href).toBe("/school/fee-structures");

    // Check 5: Staff
    const staffCheck = report.checks.find((c) => c.id === "staff");
    expect(staffCheck?.status).toBe("NOT_STARTED");
    expect(staffCheck?.deepLink.href).toBe("/school/import-center?tab=staff");

    // Check 6: Students
    const studentCheck = report.checks.find((c) => c.id === "students");
    expect(studentCheck?.status).toBe("NOT_STARTED");
    expect(studentCheck?.deepLink.href).toBe("/school/import-center?tab=students");

    // Check 7: Timetable
    const timetableCheck = report.checks.find((c) => c.id === "timetable");
    expect(timetableCheck?.status).toBe("NOT_STARTED");
    expect(timetableCheck?.deepLink.href).toBe("/academics/setup/bell-schedule");

    // Check 8: Parent claims
    const claimCheck = report.checks.find((c) => c.id === "parent_claims");
    expect(claimCheck?.status).toBe("NOT_STARTED");
    expect(claimCheck?.deepLink.href).toBe("/students/linkage");
  });

  it("2. Partial Configuration: computes real counts and maintains fail-closed readiness", async () => {
    await withTenant(schoolA.id, async (tx) => {
      // 1. Academic Year
      await tx.insert(academicYears).values({
        id: schoolA.academicYearId,
        schoolId: schoolA.id,
        label: "2026-27",
        startDate: new Date("2026-04-01T00:00:00Z"),
        endDate: new Date("2027-03-31T00:00:00Z"),
        isActive: true,
      });

      // 2. Class and Section
      await tx.insert(classes).values({
        id: schoolA.classId,
        schoolId: schoolA.id,
        academicYearId: schoolA.academicYearId,
        gradeLevel: "CLASS_1",
        displayName: "Class 1",
        sortOrder: 1,
        isActive: true,
      });

      await tx.insert(sections).values({
        id: schoolA.sectionId,
        schoolId: schoolA.id,
        classId: schoolA.classId,
        name: "A",
        capacity: 40,
        isActive: true,
      });

      // 3. Subject mapped to class
      await tx.insert(subjects).values({
        id: schoolA.subjectId,
        schoolId: schoolA.id,
        name: "English",
        code: "ENG",
        subjectType: "THEORY",
      });

      await tx.insert(classSubjects).values({
        id: schoolA.classSubjectId,
        schoolId: schoolA.id,
        classId: schoolA.classId,
        subjectId: schoolA.subjectId,
      });
    });

    const report = await getDayOneReadiness(schoolA.id);

    // Checks 1, 2, 3 should now be READY
    expect(report.readyChecksCount).toBe(3);
    expect(report.isReadyForDayOne).toBe(false);

    const classCheck = report.checks.find((c) => c.id === "classes_sections");
    expect(classCheck?.status).toBe("READY");
    expect(classCheck?.counts.classesCount).toBe(1);
    expect(classCheck?.counts.sectionsCount).toBe(1);

    const subjCheck = report.checks.find((c) => c.id === "subjects");
    expect(subjCheck?.status).toBe("READY");
    expect(subjCheck?.counts.assignedSubjectsCount).toBe(1);
  });

  it("3. Fully Configured School: all 8 checks green, renders finished state and triggers J10 telemetry", async () => {
    await withTenant(schoolA.id, async (tx) => {
      // 1. Academic Year
      await tx.insert(academicYears).values({
        id: schoolA.academicYearId,
        schoolId: schoolA.id,
        label: "2026-27",
        startDate: new Date("2026-04-01T00:00:00Z"),
        endDate: new Date("2027-03-31T00:00:00Z"),
        isActive: true,
      });

      // 2. Class and Section
      await tx.insert(classes).values({
        id: schoolA.classId,
        schoolId: schoolA.id,
        academicYearId: schoolA.academicYearId,
        gradeLevel: "CLASS_1",
        displayName: "Class 1",
        sortOrder: 1,
        isActive: true,
      });

      await tx.insert(sections).values({
        id: schoolA.sectionId,
        schoolId: schoolA.id,
        classId: schoolA.classId,
        name: "A",
        capacity: 40,
        isActive: true,
      });

      // 3. Subject
      await tx.insert(subjects).values({
        id: schoolA.subjectId,
        schoolId: schoolA.id,
        name: "English",
        code: "ENG",
        subjectType: "THEORY",
      });

      await tx.insert(classSubjects).values({
        id: schoolA.classSubjectId,
        schoolId: schoolA.id,
        classId: schoolA.classId,
        subjectId: schoolA.subjectId,
      });

      // 4. Staff
      await tx.insert(departments).values({
        id: schoolA.departmentId,
        schoolId: schoolA.id,
        name: "Academics",
      });

      await tx.insert(designations).values({
        id: schoolA.designationId,
        schoolId: schoolA.id,
        departmentId: schoolA.departmentId,
        name: "Primary Teacher",
      });

      await tx
        .insert(users)
        .values({
          id: schoolA.staffUserId,
          schoolId: schoolA.id,
          email: "teacher.a@schoolmitra.internal",
          passwordHash: "hash123",
          isActive: true,
        })
        .onConflictDoNothing();

      await tx.insert(staff).values({
        id: schoolA.staffId,
        schoolId: schoolA.id,
        userId: schoolA.staffUserId,
        employeeCode: "EMP001",
        departmentId: schoolA.departmentId,
        designationId: schoolA.designationId,
        contractType: "PERMANENT",
        joiningDate: new Date(),
        firstNameEncrypted: "enc",
        lastNameEncrypted: "enc",
        dateOfBirthEncrypted: "enc",
        genderEncrypted: "enc",
        mobileEncrypted: "enc",
        emailEncrypted: "enc",
        isActive: true,
      });

      // 5. Parent User & Student with fresh issued claim (mustChangePassword: true)
      await tx
        .insert(users)
        .values({
          id: schoolA.parentUserId,
          schoolId: schoolA.id,
          email: "parent.a@example.com",
          passwordHash: "hash123",
          mustChangePassword: true, // Freshly issued claim pending parent login
          isActive: true,
        })
        .onConflictDoNothing();

      await tx.insert(students).values({
        id: schoolA.studentId,
        schoolId: schoolA.id,
        academicYearId: schoolA.academicYearId,
        admissionNumber: "ADM001",
        firstNameEncrypted: "enc",
        lastNameEncrypted: "enc",
        dateOfBirth: new Date("2015-01-01"),
        gender: "MALE",
        category: "GENERAL",
        admissionDate: new Date(),
        currentClassId: schoolA.classId,
        currentSectionId: schoolA.sectionId,
        primaryParentUserId: schoolA.parentUserId,
        isActive: true,
      });

      // 6. Fee Structure & Fee Invoice (Demand)
      await tx.insert(feeHeads).values({
        id: schoolA.feeHeadId,
        schoolId: schoolA.id,
        name: "Tuition",
        headType: "TUITION",
      });

      await tx.insert(feeStructures).values({
        id: schoolA.feeStructureId,
        schoolId: schoolA.id,
        academicYearId: schoolA.academicYearId,
        classId: schoolA.classId,
        feeHeadId: schoolA.feeHeadId,
        term: "ANNUAL",
        amount: "15000",
        dueDate: new Date("2026-05-15"),
        isActive: true,
      });

      await tx.insert(feeInvoices).values({
        id: schoolA.feeInvoiceId,
        schoolId: schoolA.id,
        studentId: schoolA.studentId,
        academicYearId: schoolA.academicYearId,
        feeStructureId: schoolA.feeStructureId,
        invoiceNumber: "INV-001",
        grossAmount: "15000",
        netAmount: "15000",
        balanceAmount: "15000",
        dueDate: new Date("2026-05-15"),
        term: "ANNUAL",
        status: "PENDING",
      });

      // 7. Timetable Period
      await tx.insert(timetablePeriods).values({
        id: schoolA.timetablePeriodId,
        schoolId: schoolA.id,
        academicYearId: schoolA.academicYearId,
        sectionId: schoolA.sectionId,
        dayOfWeek: "MONDAY",
        periodNumber: 1,
        startTime: "09:00:00",
        endTime: "09:45:00",
        subjectId: schoolA.subjectId,
        teacherId: schoolA.staffUserId,
        isActive: true,
      });
    });

    // 8. Compute readiness
    const report = await getDayOneReadiness(schoolA.id);

    expect(report.readyChecksCount).toBe(8);
    expect(report.isReadyForDayOne).toBe(true);

    // Assert Check 8 shows claims issued truthfully with real counts
    const claimCheck = report.checks.find((c) => c.id === "parent_claims");
    expect(claimCheck?.status).toBe("READY");
    expect(claimCheck?.counts.issuedCount).toBe(1);
    expect(claimCheck?.counts.claimedCount).toBe(0);
    expect(claimCheck?.counts.pendingCount).toBe(1);
    expect(claimCheck?.counts.totalEnrolled).toBe(1);
    expect(claimCheck?.statusLabel).toBe("All 1 parent claims issued (0 claimed, 1 pending)");

    // Assert Finished State text format
    expect(report.finishedStateMessage).toBe(
      `School ${schoolA.name} ready for Day One: 1 students, 1 staff, 1 sections configured.`
    );
    expect(report.nextAction?.label).toBe("Mark the first attendance");
    expect(report.nextAction?.href).toBe("/attendance");

    // 9. Emit J10 Journey Finished Telemetry
    const telemetryRes = await emitDayOneJourneyFinishedIfReady({
      schoolId: schoolA.id,
      userId: schoolA.adminUserId,
      role: "SCHOOL_ADMIN",
      report,
    });

    expect(telemetryRes.emitted).toBe(true);
    expect(telemetryRes.event).toBeDefined();

    // Verify written event in database
    const [savedEvent] = await db
      .select()
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.schoolId, schoolA.id),
          eq(usageEvents.elementId, "north_star_journey_completion"),
          eq(usageEvents.action, "journey_finished")
        )
      );

    expect(savedEvent).toBeDefined();
    expect(savedEvent?.elementLabel).toBeDefined();
    const payload = JSON.parse(savedEvent!.elementLabel);
    expect(payload.journeyId).toBe("J10_school_onboarding");
    expect(payload.completed).toBe(true);
    expect(payload.finishedState).toBe(report.finishedStateMessage);

    // Assert Idempotency: second call does NOT duplicate
    const secondCall = await emitDayOneJourneyFinishedIfReady({
      schoolId: schoolA.id,
      userId: schoolA.adminUserId,
      role: "SCHOOL_ADMIN",
      report,
    });
    expect(secondCall.emitted).toBe(false);
  });

  it("4. Tenant Isolation: School B does NOT inherit School A's readiness numbers", async () => {
    // School B has only an active academic year
    await withTenant(schoolB.id, async (tx) => {
      await tx.insert(academicYears).values({
        id: schoolB.academicYearId,
        schoolId: schoolB.id,
        label: "2026-27",
        startDate: new Date("2026-04-01T00:00:00Z"),
        endDate: new Date("2027-03-31T00:00:00Z"),
        isActive: true,
      });
    });

    const reportB = await getDayOneReadiness(schoolB.id);

    expect(reportB.schoolId).toBe(schoolB.id);
    expect(reportB.readyChecksCount).toBe(1);
    expect(reportB.isReadyForDayOne).toBe(false);
    expect(reportB.summaryCounts.studentsCount).toBe(0);
    expect(reportB.summaryCounts.staffCount).toBe(0);
    expect(reportB.summaryCounts.sectionsCount).toBe(0);
  });

  it("5. Check Truth Rule: A database error forces UNKNOWN status and NEVER green", async () => {
    // Pass a mock executor that throws on query execution
    const mockExecutor = {
      select: () => {
        throw new Error("Simulated database failure for truth test");
      },
    };

    const report = await getDayOneReadiness(schoolA.id, mockExecutor);

    expect(report.isReadyForDayOne).toBe(false);
    expect(report.readyChecksCount).toBe(0);

    for (const check of report.checks) {
      expect(check.status).toBe("UNKNOWN");
      expect(check.statusLabel).toContain("UNKNOWN");
      expect(check.unknownReason).toBeDefined();
    }
  });

  it("6. Fee Demand Truth: Fee structures without imported students remains IN_PROGRESS", async () => {
    await withTenant(schoolA.id, async (tx) => {
      // Academic year + class
      await tx.insert(academicYears).values({
        id: schoolA.academicYearId,
        schoolId: schoolA.id,
        label: "2026-27",
        startDate: new Date("2026-04-01T00:00:00Z"),
        endDate: new Date("2027-03-31T00:00:00Z"),
        isActive: true,
      });

      await tx.insert(classes).values({
        id: schoolA.classId,
        schoolId: schoolA.id,
        academicYearId: schoolA.academicYearId,
        gradeLevel: "CLASS_1",
        displayName: "Class 1",
        sortOrder: 1,
        isActive: true,
      });

      await tx.insert(feeHeads).values({
        id: schoolA.feeHeadId,
        schoolId: schoolA.id,
        name: "Tuition",
        headType: "TUITION",
      });

      await tx.insert(feeStructures).values({
        id: schoolA.feeStructureId,
        schoolId: schoolA.id,
        academicYearId: schoolA.academicYearId,
        classId: schoolA.classId,
        feeHeadId: schoolA.feeHeadId,
        term: "ANNUAL",
        amount: "15000",
        dueDate: new Date("2026-05-15"),
        isActive: true,
      });
    });

    const report = await getDayOneReadiness(schoolA.id);
    const feeCheck = report.checks.find((c) => c.id === "fees");

    expect(feeCheck?.status).toBe("IN_PROGRESS");
    expect(feeCheck?.statusLabel).toContain("awaiting student import");
    expect(report.isReadyForDayOne).toBe(false);
  });

  it("7. Parent Claims Truth: Partial claim issuance reflects truthful progress", async () => {
    const student2Id = "e8222222-2222-4222-8222-222222222222";

    await withTenant(schoolA.id, async (tx) => {
      await tx.insert(academicYears).values({
        id: schoolA.academicYearId,
        schoolId: schoolA.id,
        label: "2026-27",
        startDate: new Date("2026-04-01T00:00:00Z"),
        endDate: new Date("2027-03-31T00:00:00Z"),
        isActive: true,
      });

      await tx.insert(classes).values({
        id: schoolA.classId,
        schoolId: schoolA.id,
        academicYearId: schoolA.academicYearId,
        gradeLevel: "CLASS_1",
        displayName: "Class 1",
        sortOrder: 1,
        isActive: true,
      });

      await tx.insert(sections).values({
        id: schoolA.sectionId,
        schoolId: schoolA.id,
        classId: schoolA.classId,
        name: "A",
        capacity: 40,
        isActive: true,
      });

      // Student 1: Claim issued (linked to parent user)
      await tx
        .insert(users)
        .values({
          id: schoolA.parentUserId,
          schoolId: schoolA.id,
          email: "parent.one@example.com",
          passwordHash: "hash123",
          mustChangePassword: true,
          isActive: true,
        })
        .onConflictDoNothing();

      await tx.insert(students).values({
        id: schoolA.studentId,
        schoolId: schoolA.id,
        academicYearId: schoolA.academicYearId,
        admissionNumber: "ADM001",
        firstNameEncrypted: "enc",
        lastNameEncrypted: "enc",
        dateOfBirth: new Date("2015-01-01"),
        gender: "MALE",
        category: "GENERAL",
        admissionDate: new Date(),
        currentClassId: schoolA.classId,
        currentSectionId: schoolA.sectionId,
        primaryParentUserId: schoolA.parentUserId,
        isActive: true,
      });

      // Student 2: Enrolled in section, but NO parent claim issued yet
      await tx.insert(students).values({
        id: student2Id,
        schoolId: schoolA.id,
        academicYearId: schoolA.academicYearId,
        admissionNumber: "ADM002",
        firstNameEncrypted: "enc",
        lastNameEncrypted: "enc",
        dateOfBirth: new Date("2015-02-02"),
        gender: "FEMALE",
        category: "GENERAL",
        admissionDate: new Date(),
        currentClassId: schoolA.classId,
        currentSectionId: schoolA.sectionId,
        primaryParentUserId: null,
        isActive: true,
      });
    });

    const report = await getDayOneReadiness(schoolA.id);
    const claimCheck = report.checks.find((c) => c.id === "parent_claims");

    expect(claimCheck?.status).toBe("IN_PROGRESS");
    expect(claimCheck?.counts.issuedCount).toBe(1);
    expect(claimCheck?.counts.totalEnrolled).toBe(2);
    expect(claimCheck?.counts.pendingCount).toBe(1);
    expect(claimCheck?.statusLabel).toBe("1 of 2 parent claims issued (0 claimed, 1 pending)");
    expect(report.isReadyForDayOne).toBe(false);
  });
});
