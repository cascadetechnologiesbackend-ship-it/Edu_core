import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import {
  schools,
  academicYears,
  classes,
  sections,
  subjects,
  classSubjects,
  departments,
  designations,
  staff,
  students,
  studentFamilyMembers,
  studentClassHistory,
  feeHeads,
  feeStructures,
  feeInvoices,
  timetablePeriods,
  studentAttendance,
  studentSubjectEnrollments,
  users,
  roles,
  userRoles,
  persons,
  passwordResetTokens,
  usageEvents,
  smsLogs,
  domainEvents,
  consentRecords,
  schoolCounters,
} from "@schoolmitra/database";
import { eq, and, sql, desc } from "drizzle-orm";
import {
  getDayOneReadiness,
  emitDayOneJourneyFinishedIfReady,
} from "../dayOneReadiness";
import {
  executeStaffImportBatch,
  executeStudentImportBatch,
  commitStaffImportAction,
  commitStudentImportAction,
} from "../bulkImportResilience";
import { provisionOrLinkParent } from "../parentLinkage";
import {
  getClaimTrackingQueue,
  queueSmsRemindersForPendingClaims,
  getClassClaimSheetData,
} from "../claimDistribution";
import {
  recordFirstAttendanceOnboarding,
  getNorthStarMetricsSummary,
  recordJourneyCompletion,
  calculateElapsedWorkingDays,
} from "../northStarTelemetry";
import { withTenant } from "../tenant";
import { encryptData, computeSearchHash } from "../encryption";
import bcrypt from "bcryptjs";

// Dedicated fresh tenant IDs for the end-to-end walkthrough run
const WALKTHROUGH_CONFIG = {
  schoolId: "f9999999-9999-4999-8999-999999999999",
  schoolName: "Pragati Modern Academy",
  schoolSlug: "pragati-modern",
  udiseCode: "07010188888",
  board: "CBSE" as const,
  adminUserId: "f9999999-9999-4999-8999-888888888888",
  adminEmail: "admin@pragati.schoolmitra.internal",
  academicYearId: "fa999999-9999-4999-8999-999999999999",
  academicYearLabel: "2026-27",
  class9Id: "fc999999-9999-4999-8999-999999999909",
  class10Id: "fc999999-9999-4999-8999-999999999910",
  section9AId: "fd999999-9999-4999-8999-999999999909",
  section10AId: "fd999999-9999-4999-8999-999999999910",
  subjectEngId: "fb999999-9999-4999-8999-999999999001",
  subjectMathId: "fb999999-9999-4999-8999-999999999002",
  subjectSciId: "fb999999-9999-4999-8999-999999999003",
};

async function cleanTenantData(schoolId: string) {
  await db.delete(usageEvents).where(eq(usageEvents.schoolId, schoolId));
  await db.delete(smsLogs).where(eq(smsLogs.schoolId, schoolId));

  await withTenant(schoolId, async (tx) => {
    const userList = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.schoolId, schoolId));
    if (userList.length > 0) {
      for (const u of userList) {
        await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, u.id));
      }
    }

    await tx.update(students).set({ primaryParentUserId: null, currentSectionId: null }).where(eq(students.schoolId, schoolId));
    await tx.delete(studentAttendance).where(eq(studentAttendance.schoolId, schoolId));
    await tx.delete(timetablePeriods).where(eq(timetablePeriods.schoolId, schoolId));
    await tx.delete(feeInvoices).where(eq(feeInvoices.schoolId, schoolId));
    await tx.delete(feeStructures).where(eq(feeStructures.schoolId, schoolId));
    await tx.delete(feeHeads).where(eq(feeHeads.schoolId, schoolId));
    await tx.delete(studentFamilyMembers).where(eq(studentFamilyMembers.schoolId, schoolId));
    await tx.delete(studentClassHistory).where(eq(studentClassHistory.schoolId, schoolId));
    await tx.delete(studentSubjectEnrollments).where(eq(studentSubjectEnrollments.schoolId, schoolId));
    await tx.delete(consentRecords).where(eq(consentRecords.schoolId, schoolId));
    await tx.delete(domainEvents).where(eq(domainEvents.schoolId, schoolId));
    await tx.delete(students).where(eq(students.schoolId, schoolId));
    await tx.delete(staff).where(eq(staff.schoolId, schoolId));
    await tx.delete(designations).where(eq(designations.schoolId, schoolId));
    await tx.delete(departments).where(eq(departments.schoolId, schoolId));
    await tx.delete(classSubjects).where(eq(classSubjects.schoolId, schoolId));
    await tx.delete(subjects).where(eq(subjects.schoolId, schoolId));
    await tx.delete(sections).where(eq(sections.schoolId, schoolId));
    await tx.delete(classes).where(eq(classes.schoolId, schoolId));
    await tx.delete(academicYears).where(eq(academicYears.schoolId, schoolId));
    await tx.delete(userRoles).where(eq(userRoles.schoolId, schoolId));
    await tx.delete(roles).where(eq(roles.schoolId, schoolId));
    await tx.delete(persons).where(eq(persons.schoolId, schoolId));
    await tx.delete(users).where(eq(users.schoolId, schoolId));
    await tx.delete(schoolCounters).where(eq(schoolCounters.schoolId, schoolId));
  });

  await db.delete(schools).where(eq(schools.id, schoolId));
}

describe("Phase D1-L6: The onboarding_days Walkthrough Verification Run", { timeout: 45000 }, () => {
  const cfg = WALKTHROUGH_CONFIG;
  let tenantCreatedAt: Date;
  let measuredWorkingDaysElapsed: number = 0;

  beforeAll(async () => {
    await cleanTenantData(cfg.schoolId);
  });

  afterAll(async () => {
    await cleanTenantData(cfg.schoolId);
  });

  it("executes the full automated walkthrough on a completely fresh tenant across all 10 steps", async () => {
    // ══════════════════════════════════════════════════════════════════════════
    // Step 1: Tenant Creation (simulating registerSchoolTenant)
    // ══════════════════════════════════════════════════════════════════════════
    // Set tenant creation timestamp to 30 minutes in the past to allow realistic duration calculation
    tenantCreatedAt = new Date(Date.now() - 30 * 60 * 1000);

    const [createdSchool] = await db
      .insert(schools)
      .values({
        id: cfg.schoolId,
        name: cfg.schoolName,
        slug: cfg.schoolSlug,
        udiseCode: cfg.udiseCode,
        board: cfg.board,
        address: "Plot 42, Knowledge Park III",
        city: "Greater Noida",
        state: "Uttar Pradesh",
        pincode: "201310",
        phone: "0120-2329999",
        email: cfg.adminEmail,
        principalName: "Dr. Sunita Deshmukh",
        establishedYear: 2026,
        isActive: true,
        createdAt: tenantCreatedAt,
      })
      .returning();

    expect(createdSchool).toBeDefined();
    expect(createdSchool!.id).toBe(cfg.schoolId);

    await withTenant(cfg.schoolId, async (tx) => {
      // 1.1 Academic Year
      await tx.insert(academicYears).values({
        id: cfg.academicYearId,
        schoolId: cfg.schoolId,
        label: cfg.academicYearLabel,
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        isActive: true,
      });

      // 1.2 Classes & Sections (Class 9 - Sec A, Class 10 - Sec A)
      await tx.insert(classes).values([
        {
          id: cfg.class9Id,
          schoolId: cfg.schoolId,
          academicYearId: cfg.academicYearId,
          gradeLevel: "CLASS_9",
          displayName: "Class 9",
          sortOrder: 1,
          isActive: true,
        },
        {
          id: cfg.class10Id,
          schoolId: cfg.schoolId,
          academicYearId: cfg.academicYearId,
          gradeLevel: "CLASS_10",
          displayName: "Class 10",
          sortOrder: 2,
          isActive: true,
        },
      ]);

      await tx.insert(sections).values([
        {
          id: cfg.section9AId,
          schoolId: cfg.schoolId,
          classId: cfg.class9Id,
          name: "A",
          capacity: 40,
          isActive: true,
        },
        {
          id: cfg.section10AId,
          schoolId: cfg.schoolId,
          classId: cfg.class10Id,
          name: "A",
          capacity: 40,
          isActive: true,
        },
      ]);

      // 1.3 Subjects & Mappings
      await tx.insert(subjects).values([
        {
          id: cfg.subjectEngId,
          schoolId: cfg.schoolId,
          name: "English Language & Literature",
          code: "ENG",
          subjectType: "LANGUAGE",
          isActive: true,
        },
        {
          id: cfg.subjectMathId,
          schoolId: cfg.schoolId,
          name: "Mathematics",
          code: "MATH",
          subjectType: "THEORY",
          isActive: true,
        },
        {
          id: cfg.subjectSciId,
          schoolId: cfg.schoolId,
          name: "General Science",
          code: "SCI",
          subjectType: "THEORY",
          isActive: true,
        },
      ]);

      for (const clsId of [cfg.class9Id, cfg.class10Id]) {
        for (const subId of [cfg.subjectEngId, cfg.subjectMathId, cfg.subjectSciId]) {
          await tx.insert(classSubjects).values({
            schoolId: cfg.schoolId,
            classId: clsId,
            subjectId: subId,
            periodsPerWeek: 6,
          });
        }
      }

      // 1.4 Standard Departments & Designations
      const [dept] = await tx
        .insert(departments)
        .values({
          schoolId: cfg.schoolId,
          name: "Academic Department",
          isActive: true,
        })
        .returning();

      await tx.insert(designations).values([
        {
          schoolId: cfg.schoolId,
          departmentId: dept!.id,
          name: "Secondary Teacher",
          mappedRole: "TEACHER",
          isTeaching: true,
          isActive: true,
        },
        {
          schoolId: cfg.schoolId,
          departmentId: dept!.id,
          name: "Staff",
          mappedRole: "STAFF",
          isTeaching: false,
          isActive: true,
        },
      ]);

      // 1.5 Roles & Admin User Account
      const [adminRole] = await tx
        .insert(roles)
        .values({
          schoolId: cfg.schoolId,
          name: "SCHOOL_ADMIN",
          displayName: "School Administrator",
          isSystemRole: true,
        })
        .returning();

      const pwdHash = await bcrypt.hash("AdminSecurePass123!", 12);
      const [adminUser] = await tx
        .insert(users)
        .values({
          id: cfg.adminUserId,
          schoolId: cfg.schoolId,
          email: cfg.adminEmail,
          passwordHash: pwdHash,
          isActive: true,
          isEmailVerified: true,
        })
        .returning();

      await tx.insert(persons).values({
        schoolId: cfg.schoolId,
        userId: adminUser!.id,
        primaryType: "STAFF",
        firstNameEncrypted: encryptData("Sunita"),
        lastNameEncrypted: encryptData("Deshmukh"),
        firstNameSearchHash: computeSearchHash("Sunita"),
        lastNameSearchHash: computeSearchHash("Deshmukh"),
        gender: "FEMALE",
        primaryEmailEncrypted: encryptData(cfg.adminEmail),
        isActive: true,
      });

      await tx.insert(userRoles).values({
        userId: adminUser!.id,
        roleId: adminRole!.id,
        schoolId: cfg.schoolId,
      });

      // 1.6 J10 Journey Start Telemetry
      await recordJourneyCompletion(
        {
          schoolId: cfg.schoolId,
          userId: cfg.adminUserId,
          role: "SUPER_ADMIN",
          journeyId: "J10_school_onboarding",
          durationMs: 0,
          completed: false,
        },
        tx
      );
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Step 2: Inspect Day One Readiness Baseline
    // ══════════════════════════════════════════════════════════════════════════
    const reportStep2 = await getDayOneReadiness(cfg.schoolId);

    expect(reportStep2.schoolId).toBe(cfg.schoolId);
    expect(reportStep2.schoolName).toBe(cfg.schoolName);
    expect(reportStep2.isReadyForDayOne).toBe(false);
    expect(reportStep2.finishedState.isReady).toBe(false);
    expect(reportStep2.finishedState.message).toBeUndefined();
    expect(reportStep2.finishedStateMessage).toBeUndefined();
    expect(reportStep2.totalChecks).toBe(8);

    // Initial 3 wizard-seeded checks are ready
    const yearCheck = reportStep2.checks.find((c) => c.id === "academic_year");
    expect(yearCheck?.status).toBe("READY");

    const classCheck = reportStep2.checks.find((c) => c.id === "classes_sections");
    expect(classCheck?.status).toBe("READY");
    expect(classCheck?.counts.classesCount).toBe(2);
    expect(classCheck?.counts.sectionsCount).toBe(2);

    const subjCheck = reportStep2.checks.find((c) => c.id === "subjects");
    expect(subjCheck?.status).toBe("READY");
    expect(subjCheck?.counts.assignedSubjectsCount).toBe(6);

    // Assert that incomplete checks are truthfully reported as NOT_STARTED
    const incompleteChecks = reportStep2.checks.filter((c) => c.status !== "READY");
    expect(incompleteChecks.length).toBe(5);
    expect(incompleteChecks.map((c) => c.id)).toEqual([
      "fees",
      "staff",
      "students",
      "timetable",
      "parent_claims",
    ]);

    expect(reportStep2.readyChecksCount).toBe(3);

    // ══════════════════════════════════════════════════════════════════════════
    // Step 3: Staff Bulk Import (commitStaffImportAction)
    // ══════════════════════════════════════════════════════════════════════════
    const staffImportRows = [
      {
        "Employee Code": "PMA-T-001",
        "First Name": "Anita",
        "Last Name": "Sharma",
        "Official Email": "anita.sharma@pragati.schoolmitra.internal",
        "Mobile Number": "9811100001",
        "Department": "Academic Department",
        "Designation": "Secondary Teacher",
        "System Role": "TEACHER",
        "Gender": "Female",
        "Date of Birth": "1988-03-12",
      },
      {
        "Employee Code": "PMA-T-002",
        "First Name": "Rajesh",
        "Last Name": "Verma",
        "Official Email": "rajesh.verma@pragati.schoolmitra.internal",
        "Mobile Number": "9811100002",
        "Department": "Academic Department",
        "Designation": "Secondary Teacher",
        "System Role": "TEACHER",
        "Gender": "Male",
        "Date of Birth": "1985-07-25",
      },
    ];

    const staffImportResult = await commitStaffImportAction(
      cfg.schoolId,
      staffImportRows,
      {
        userId: cfg.adminUserId,
        userEmail: cfg.adminEmail,
        userRole: "SCHOOL_ADMIN",
      },
      db
    );

    expect(staffImportResult.success).toBe(true);
    expect(staffImportResult.createdCount).toBe(2);
    expect(staffImportResult.skippedCount).toBe(0);

    const reportStep3 = await getDayOneReadiness(cfg.schoolId);
    const staffCheck = reportStep3.checks.find((c) => c.id === "staff");
    expect(staffCheck?.status).toBe("READY");
    expect(staffCheck?.counts.staffCount).toBe(2);
    expect(reportStep3.isReadyForDayOne).toBe(false);

    // ══════════════════════════════════════════════════════════════════════════
    // Step 4: Student Bulk Import (commitStudentImportAction)
    // ══════════════════════════════════════════════════════════════════════════
    const studentImportRows = [
      {
        "Admission Number": "PMA-2026-001",
        "First Name": "Rohan",
        "Last Name": "Kapoor",
        "Class": "Class 9",
        "Section": "A",
        "Date of Birth": "2011-04-15",
        "Gender": "Male",
        "Guardian Name": "Alok Kapoor",
        "Guardian Mobile": "9822200001",
        "Guardian Email": "alok.kapoor@example.com",
      },
      {
        "Admission Number": "PMA-2026-002",
        "First Name": "Pooja",
        "Last Name": "Mishra",
        "Class": "Class 9",
        "Section": "A",
        "Date of Birth": "2011-09-20",
        "Gender": "Female",
        "Guardian Name": "Deepak Mishra",
        "Guardian Mobile": "9822200002",
        "Guardian Email": "deepak.mishra@example.com",
      },
      {
        "Admission Number": "PMA-2026-003",
        "First Name": "Amit",
        "Last Name": "Singh",
        "Class": "Class 10",
        "Section": "A",
        "Date of Birth": "2010-06-18",
        "Gender": "Male",
        "Guardian Name": "Suresh Singh",
        "Guardian Mobile": "9822200003",
        "Guardian Email": "suresh.singh@example.com",
      },
      {
        "Admission Number": "PMA-2026-004",
        "First Name": "Priya",
        "Last Name": "Nair",
        "Class": "Class 10",
        "Section": "A",
        "Date of Birth": "2010-11-05",
        "Gender": "Female",
        "Guardian Name": "Ravi Nair",
        "Guardian Mobile": "9822200004",
        "Guardian Email": "ravi.nair@example.com",
      },
    ];

    const studentImportResult = await commitStudentImportAction(
      cfg.schoolId,
      studentImportRows,
      {
        userId: cfg.adminUserId,
        userEmail: cfg.adminEmail,
        userRole: "SCHOOL_ADMIN",
      },
      db
    );

    expect(studentImportResult.success).toBe(true);
    expect(studentImportResult.createdCount).toBe(4);
    expect(studentImportResult.skippedCount).toBe(0);

    // Simulate that the 4th student's parent claim has not yet been distributed/linked
    // so that the claims check truthfully remains IN_PROGRESS until Step 7
    await withTenant(cfg.schoolId, async (tx) => {
      await tx
        .update(students)
        .set({ primaryParentUserId: null })
        .where(
          and(
            eq(students.schoolId, cfg.schoolId),
            eq(students.admissionNumber, "PMA-2026-004")
          )
        );
    });

    const reportStep4 = await getDayOneReadiness(cfg.schoolId);
    const studentCheck = reportStep4.checks.find((c) => c.id === "students");
    expect(studentCheck?.status).toBe("READY");
    expect(studentCheck?.counts.studentsCount).toBe(4);
    expect(studentCheck?.counts.enrolledStudentsCount).toBe(4);

    // Verify parent claims check is not yet READY because 1 student is pending claim distribution
    const claimCheckStep4 = reportStep4.checks.find((c) => c.id === "parent_claims");
    expect(claimCheckStep4?.status).toBe("IN_PROGRESS");
    expect(claimCheckStep4?.counts.issuedCount).toBe(3);
    expect(claimCheckStep4?.counts.totalEnrolled).toBe(4);
    expect(reportStep4.isReadyForDayOne).toBe(false);

    // ══════════════════════════════════════════════════════════════════════════
    // Step 5: Fee Structures & Demands Generation
    // ══════════════════════════════════════════════════════════════════════════
    await withTenant(cfg.schoolId, async (tx) => {
      const [tuitionHead] = await tx
        .insert(feeHeads)
        .values({
          schoolId: cfg.schoolId,
          name: "Tuition Fee",
          code: "TUT",
          headType: "TUITION",
          category: "RECURRING",
          isActive: true,
        })
        .returning();

      for (const clsId of [cfg.class9Id, cfg.class10Id]) {
        const [struct] = await tx
          .insert(feeStructures)
          .values({
            schoolId: cfg.schoolId,
            academicYearId: cfg.academicYearId,
            classId: clsId,
            feeHeadId: tuitionHead!.id,
            term: "ANNUAL",
            amount: "15000",
            dueDate: new Date("2026-05-15"),
            isActive: true,
          })
          .returning();

        // Generate fee invoices (billing demand) for students in this class
        const clsStudents = await tx.query.students.findMany({
          where: and(
            eq(students.schoolId, cfg.schoolId),
            eq(students.currentClassId, clsId)
          ),
        });

        for (const st of clsStudents) {
          await tx.insert(feeInvoices).values({
            schoolId: cfg.schoolId,
            studentId: st.id,
            academicYearId: cfg.academicYearId,
            feeStructureId: struct!.id,
            invoiceNumber: `INV-${st.admissionNumber}`,
            grossAmount: "15000",
            netAmount: "15000",
            balanceAmount: "15000",
            dueDate: new Date("2026-05-15"),
            term: "ANNUAL",
            status: "PENDING",
          });
        }
      }
    });

    const reportStep5 = await getDayOneReadiness(cfg.schoolId);
    const feeCheck = reportStep5.checks.find((c) => c.id === "fees");
    expect(feeCheck?.status).toBe("READY");
    expect(feeCheck?.counts.feeStructuresCount).toBe(2);
    expect(feeCheck?.counts.feeInvoicesCount).toBe(4);
    expect(reportStep5.isReadyForDayOne).toBe(false);

    // ══════════════════════════════════════════════════════════════════════════
    // Step 6: Timetable Periods Generation per Section
    // ══════════════════════════════════════════════════════════════════════════
    await withTenant(cfg.schoolId, async (tx) => {
      const allSections = await tx.query.sections.findMany({
        where: eq(sections.schoolId, cfg.schoolId),
      });

      const staffList = await tx.query.staff.findMany({
        where: eq(staff.schoolId, cfg.schoolId),
      });
      const teacherUserId = staffList[0]!.userId;

      for (const sec of allSections) {
        await tx.insert(timetablePeriods).values({
          schoolId: cfg.schoolId,
          academicYearId: cfg.academicYearId,
          sectionId: sec.id,
          subjectId: cfg.subjectMathId,
          teacherId: teacherUserId,
          dayOfWeek: "MONDAY",
          periodNumber: 1,
          startTime: "09:00:00",
          endTime: "09:45:00",
          isActive: true,
        });
      }
    });

    const reportStep6 = await getDayOneReadiness(cfg.schoolId);
    const timetableCheck = reportStep6.checks.find((c) => c.id === "timetable");
    expect(timetableCheck?.status).toBe("READY");
    expect(timetableCheck?.counts.timetablePeriodsCount).toBe(2);
    expect(reportStep6.isReadyForDayOne).toBe(false);

    // ══════════════════════════════════════════════════════════════════════════
    // Step 7: Parent Claims Distribution
    // ══════════════════════════════════════════════════════════════════════════
    // Find the 4th student and provision/distribute their parent claim
    let fourthStudentId!: string;
    await withTenant(cfg.schoolId, async (tx) => {
      const [fourthStudent] = await tx.query.students.findMany({
        where: and(
          eq(students.schoolId, cfg.schoolId),
          eq(students.admissionNumber, "PMA-2026-004")
        ),
        limit: 1,
      });
      expect(fourthStudent).toBeDefined();
      fourthStudentId = fourthStudent!.id;
    });

    const linkResult = await provisionOrLinkParent({
      schoolId: cfg.schoolId,
      studentId: fourthStudentId,
      primaryMobile: "9822200004",
      primaryEmail: "ravi.nair@example.com",
      guardianName: "Ravi Nair",
      performedByUserId: cfg.adminUserId,
    });
    expect(linkResult.parentUserId).toBeDefined();

    // Verify printable claim sheet distribution generation
    const claimSheetRows = await getClassClaimSheetData(cfg.schoolId);
    expect(claimSheetRows.length).toBe(4);
    for (const row of claimSheetRows) {
      expect(row.claimCode).toBeDefined();
      expect(row.claimCode).not.toBe("NOT ISSUED");
      expect(row.studentName).toBeDefined();
    }

    // Verify SMS reminder queue dispatch for pending claims
    const smsDispatch = await queueSmsRemindersForPendingClaims({
      schoolId: cfg.schoolId,
      performedByUserId: cfg.adminUserId,
    });
    expect(smsDispatch.success).toBe(true);
    expect(smsDispatch.queuedCount).toBeGreaterThan(0);

    // Assert that the parent claims check now becomes READY
    const reportStep7 = await getDayOneReadiness(cfg.schoolId);
    const claimCheckStep7 = reportStep7.checks.find((c) => c.id === "parent_claims");
    expect(claimCheckStep7?.status).toBe("READY");
    expect(claimCheckStep7?.counts.issuedCount).toBe(4);
    expect(claimCheckStep7?.counts.totalEnrolled).toBe(4);

    // ══════════════════════════════════════════════════════════════════════════
    // Step 8: Re-inspect Day One Readiness (ALL 8 Checks READY + Finished State)
    // ══════════════════════════════════════════════════════════════════════════
    const reportStep8 = await getDayOneReadiness(cfg.schoolId);

    expect(reportStep8.totalChecks).toBe(8);
    expect(reportStep8.readyChecksCount).toBe(8);
    expect(reportStep8.isReadyForDayOne).toBe(true);
    expect(reportStep8.finishedState.isReady).toBe(true);

    // Verify all 8 individual check verdicts
    for (const check of reportStep8.checks) {
      expect(check.status).toBe("READY");
    }

    // Verify user-visible finished state message per the Charter and spec formula:
    // "School [Name] ready for Day One: N students, M staff, K sections configured."
    const expectedFinishedMessage = `School ${cfg.schoolName} ready for Day One: 4 students, 2 staff, 2 sections configured.`;
    expect(reportStep8.finishedState.message).toBe(expectedFinishedMessage);
    expect(reportStep8.finishedStateMessage).toBe(expectedFinishedMessage);
    expect(reportStep8.nextAction).toEqual({
      label: "Mark the first attendance",
      href: "/attendance",
    });

    // Trigger Day One finished state telemetry
    const finishedTelemetryResult = await emitDayOneJourneyFinishedIfReady({
      schoolId: cfg.schoolId,
      userId: cfg.adminUserId,
      report: reportStep8,
    });
    expect(finishedTelemetryResult.emitted).toBe(true);

    // ══════════════════════════════════════════════════════════════════════════
    // Step 9: Mark the First Live Classroom Attendance
    // ══════════════════════════════════════════════════════════════════════════
    await withTenant(cfg.schoolId, async (tx) => {
      const [firstStudent] = await tx.query.students.findMany({
        where: eq(students.schoolId, cfg.schoolId),
        limit: 1,
      });

      const staffList = await tx.query.staff.findMany({
        where: eq(staff.schoolId, cfg.schoolId),
        limit: 1,
      });
      const teacherUserId = staffList[0]!.userId!;
      const sectionId = firstStudent!.currentSectionId!;

      // Persist first attendance record
      await tx.insert(studentAttendance).values({
        schoolId: cfg.schoolId,
        academicYearId: cfg.academicYearId,
        studentId: firstStudent!.id,
        sectionId: sectionId as string,
        attendanceDate: new Date(),
        status: "PRESENT",
        markedById: teacherUserId,
        remarks: "Live classroom attendance on Day One",
      });

      // Stop the onboarding clock and emit north star duration
      const clockStopResult = await recordFirstAttendanceOnboarding({
        schoolId: cfg.schoolId,
        userId: teacherUserId,
        role: "TEACHER",
        txDb: tx,
      });

      expect(clockStopResult).not.toBeNull();
      expect(clockStopResult!.onboardingEvent).toBeDefined();
      expect(clockStopResult!.journeyEvent).toBeDefined();
      measuredWorkingDaysElapsed = clockStopResult!.workingDaysElapsed;

      // Verify idempotency: subsequent attendance submission does not emit duplicate onboarding duration event
      const duplicateClockStop = await recordFirstAttendanceOnboarding({
        schoolId: cfg.schoolId,
        userId: teacherUserId,
        role: "TEACHER",
        txDb: tx,
      });
      expect(duplicateClockStop).toBeNull();
    });

    // Verify that Day One cockpit remains ready after first attendance
    const postAttendanceReadiness = await getDayOneReadiness(cfg.schoolId);
    expect(postAttendanceReadiness.isReadyForDayOne).toBe(true);
    expect(postAttendanceReadiness.finishedState.isReady).toBe(true);
    expect(postAttendanceReadiness.readyChecksCount).toBe(8);

    // ══════════════════════════════════════════════════════════════════════════
    // Step 10: Assert North Star Duration & Journey Completion Telemetry
    // ══════════════════════════════════════════════════════════════════════════
    // 10.1 Assert north_star_onboarding_duration event
    const onboardingEvents = await db.query.usageEvents.findMany({
      where: and(
        eq(usageEvents.schoolId, cfg.schoolId),
        eq(usageEvents.elementId, "north_star_onboarding_duration")
      ),
    });
    expect(onboardingEvents.length).toBe(1);

    const onboardingPayload = JSON.parse(onboardingEvents[0]!.elementLabel);
    expect(onboardingPayload.eventName).toBe("north_star_onboarding_duration");
    expect(onboardingPayload.firstAttendanceMarked).toBe(true);
    expect(onboardingPayload.workingDaysElapsed).toBe(measuredWorkingDaysElapsed);
    expect(onboardingPayload.targetMet).toBe(true); // <= 1 working day

    // 10.2 Assert north_star_journey_completion finished event
    const journeyEvents = await db.query.usageEvents.findMany({
      where: and(
        eq(usageEvents.schoolId, cfg.schoolId),
        eq(usageEvents.elementId, "north_star_journey_completion"),
        eq(usageEvents.action, "journey_finished")
      ),
    });
    expect(journeyEvents.length).toBeGreaterThanOrEqual(1);

    const journeyPayload = JSON.parse(journeyEvents[0]!.elementLabel);
    expect(journeyPayload.journeyId).toBe("J10_school_onboarding");
    expect(journeyPayload.completed).toBe(true);
    expect(journeyPayload.finishedState).toBeDefined();

    // 10.3 Assert admin readout displays truthful metrics
    const metricsSummary = await getNorthStarMetricsSummary(cfg.schoolId);

    expect(metricsSummary.onboardingDays.status).toBe("met");
    expect(metricsSummary.onboardingDays.target).toBe(1);
    expect(metricsSummary.onboardingDays.current).toBe(measuredWorkingDaysElapsed);
    expect(metricsSummary.onboardingDays.sampleCount).toBe(1);

    expect(metricsSummary.journeyCompletionRate.status).toBe("met");
    expect(metricsSummary.journeyCompletionRate.current).toBe(100);
    expect(metricsSummary.journeyCompletionRate.sampleCount).toBeGreaterThan(0);

    // Record the measured duration honestly in the test output
    console.log(
      `\n========================================================================` +
      `\n[D1-L6 Honest Verification Report]` +
      `\nTenant: ${cfg.schoolName} (${cfg.schoolId})` +
      `\nOnboarding Clock Started: ${tenantCreatedAt.toISOString()}` +
      `\nFirst Attendance Marked:  ${new Date().toISOString()}` +
      `\nMeasured Onboarding Duration: ${measuredWorkingDaysElapsed} working days` +
      `\nNorth Star Target: <= 1 working day (Status: ${metricsSummary.onboardingDays.status.toUpperCase()})` +
      `\nJ10 Journey Completion:   ${journeyPayload.completed ? "COMPLETED (100%)" : "INCOMPLETE"}` +
      `\nDay One Cockpit Finished State: "${reportStep8.finishedStateMessage}"` +
      `\n========================================================================\n`
    );
  });
});
