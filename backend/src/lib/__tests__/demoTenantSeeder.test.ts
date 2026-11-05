import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import {
  schools,
  academicYears,
  classes,
  sections,
  staff,
  students,
  feeStructures,
  feeInvoices,
  feePayments,
  studentAttendance,
  timetablePeriods,
  reportCards,
  usageEvents,
  users,
  sessions,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { seedDemoTenant, cleanDemoTenant, DEMO_SCHOOL_CONFIG } from "@/seed/demoTenantSeeder";
import { getDayOneReadiness } from "../dayOneReadiness";
import { getNorthStarMetricsSummary } from "../northStarTelemetry";
import { withTenant } from "../tenant";

describe("Phase D1-L5: The 900-Student Demo Tenant Seeder (Delhi Public Academy [DEMO])", () => {
  // Set extended timeout for seeding large realistic demo dataset
  const TEST_TIMEOUT_MS = 60000;

  beforeAll(async () => {
    // Ensure clean initial state for demo tenant
    await cleanDemoTenant();
  }, TEST_TIMEOUT_MS);

  it(
    "seeds exactly 900 students, 30 sections, 45 staff, fee demands, 45 days attendance, and exam snapshots",
    async () => {
      const result = await seedDemoTenant();

      expect(result.classesCount).toBe(10);
      expect(result.sectionsCount).toBe(30);
      expect(result.studentsCount).toBe(900);
      expect(result.staffCount).toBeGreaterThanOrEqual(40);
      expect(result.staffCount).toBe(45);
      expect(result.feeInvoicesCount).toBe(900);
      expect(result.feePaymentsCount).toBe(720); // 80% paid
      expect(result.attendanceRecordsCount).toBe(40500); // 45 days x 900 students
      expect(result.timetablePeriodsCount).toBe(900);
      expect(result.examSnapshotsCount).toBe(900);
      expect(result.claimedCount).toBe(540); // 60%
      expect(result.pendingCount).toBe(360); // 40%

      // 1. School Metadata Invariants
      const [school] = await db
        .select()
        .from(schools)
        .where(eq(schools.id, result.schoolId))
        .limit(1);

      expect(school).toBeDefined();
      expect(school!.name).toBe(DEMO_SCHOOL_CONFIG.name);
      expect(school!.name).toContain("[DEMO]");
      expect(school!.slug).toBe("dpa-demo");
      expect(school!.udiseCode).toBe("07010199999");
      expect(school!.city).toBe("New Delhi");
      expect(school!.board).toBe("CBSE");
      expect(school!.principalName).toBe("Dr. Rajeshwar Sharma");
      expect(school!.isActive).toBe(true);

      // Verify tenant-scoped records under withTenant RLS context
      await withTenant(result.schoolId, async (tenantDb) => {
        // 2. Class & Section Structure (10 Classes x 3 Sections = 30 Sections)
        const schoolClasses = await tenantDb
          .select()
          .from(classes)
          .where(eq(classes.schoolId, result.schoolId));
        expect(schoolClasses.length).toBe(10);

        const schoolSections = await tenantDb
          .select()
          .from(sections)
          .where(eq(sections.schoolId, result.schoolId));
        expect(schoolSections.length).toBe(30);

        // Verify each class has exactly 3 sections (A, B, C)
        for (const cls of schoolClasses) {
          const secForCls = schoolSections.filter((s) => s.classId === cls.id);
          expect(secForCls.length).toBe(3);
          const secNames = secForCls.map((s) => s.name).sort();
          expect(secNames).toEqual(["A", "B", "C"]);
        }

        // 3. Exactly 900 Enrolled Students (30 per section)
        const enrolledStudents = await tenantDb
          .select({
            id: students.id,
            admissionNumber: students.admissionNumber,
            sectionId: students.currentSectionId,
            primaryParentUserId: students.primaryParentUserId,
          })
          .from(students)
          .where(
            and(
              eq(students.schoolId, result.schoolId),
              eq(students.isActive, true)
            )
          );

        expect(enrolledStudents.length).toBe(900);

        // Check section distribution: exactly 30 students per section
        const countBySection = new Map<string, number>();
        for (const st of enrolledStudents) {
          countBySection.set(st.sectionId!, (countBySection.get(st.sectionId!) || 0) + 1);
        }
        expect(countBySection.size).toBe(30);
        for (const [, cnt] of countBySection) {
          expect(cnt).toBe(30);
        }

        // Check admission numbers: unique format DPA-2026-0001 to DPA-2026-0900
        const admSet = new Set(enrolledStudents.map((s) => s.admissionNumber));
        expect(admSet.size).toBe(900);
        expect(admSet.has("DPA-2026-0001")).toBe(true);
        expect(admSet.has("DPA-2026-0900")).toBe(true);

        // 4. Staff Count (>= 40, verified 45)
        const schoolStaff = await tenantDb
          .select()
          .from(staff)
          .where(eq(staff.schoolId, result.schoolId));
        expect(schoolStaff.length).toBe(45);

        // 5. Fee Collection Curve
        const invoices = await tenantDb
          .select({
            id: feeInvoices.id,
            status: feeInvoices.status,
            netAmount: feeInvoices.netAmount,
            paidAmount: feeInvoices.paidAmount,
          })
          .from(feeInvoices)
          .where(eq(feeInvoices.schoolId, result.schoolId));

        expect(invoices.length).toBe(900);
        const paidInvoices = invoices.filter((i) => i.status === "PAID");
        const pendingInvoices = invoices.filter((i) => i.status === "PENDING");
        const overdueInvoices = invoices.filter((i) => i.status === "OVERDUE");

        expect(paidInvoices.length).toBe(720); // exactly 80%
        expect(pendingInvoices.length).toBe(135); // exactly 15%
        expect(overdueInvoices.length).toBe(45); // exactly 5%

        const feeStructs = await tenantDb
          .select()
          .from(feeStructures)
          .where(eq(feeStructures.schoolId, result.schoolId));
        // 10 classes x 4 structures each (tuition quarterly, tuition half-yearly, annual, transport quarterly) = 40
        expect(feeStructs.length).toBe(40);

        // Verify each invoice feeStructureId belongs to the student's actual class (not hardcoded to Class 1)
        const structClassMap = new Map(feeStructs.map((fs) => [fs.id, fs.classId]));
        const studentClassMap = new Map(enrolledStudents.map((st) => [st.id, schoolSections.find((s) => s.id === st.sectionId)?.classId]));
        for (const inv of invoices) {
          const invFull = await tenantDb.query.feeInvoices.findFirst({
            where: eq(feeInvoices.id, inv.id),
            columns: { studentId: true, feeStructureId: true },
          });
          const studentClassId = studentClassMap.get(invFull!.studentId);
          const structClassId = structClassMap.get(invFull!.feeStructureId!);
          expect(structClassId).toBe(studentClassId);
        }

        const payments = await tenantDb
          .select()
          .from(feePayments)
          .where(eq(feePayments.schoolId, result.schoolId));
        expect(payments.length).toBe(720);

        // 6. 45 Days Classroom Attendance & Realistic Absentees (~94% presence)
        const [attCountRes] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(studentAttendance)
          .where(eq(studentAttendance.schoolId, result.schoolId));
        expect(Number(attCountRes?.count)).toBe(40500);

        const [presentCountRes] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(studentAttendance)
          .where(
            and(
              eq(studentAttendance.schoolId, result.schoolId),
              eq(studentAttendance.status, "PRESENT")
            )
          );
        const presentRate = Number(presentCountRes?.count) / 40500;
        expect(presentRate).toBeGreaterThanOrEqual(0.92);
        expect(presentRate).toBeLessThanOrEqual(0.96);

        // 7. Exam Snapshots
        const reports = await tenantDb
          .select()
          .from(reportCards)
          .where(eq(reportCards.schoolId, result.schoolId));
        expect(reports.length).toBe(900);

        // 8. North-Star Telemetry Emission
        const telemetryEvents = await tenantDb
          .select()
          .from(usageEvents)
          .where(
            and(
              eq(usageEvents.schoolId, result.schoolId),
              eq(usageEvents.elementId, "north_star_onboarding_duration")
            )
          );
        expect(telemetryEvents.length).toBeGreaterThanOrEqual(1);
        const onboardingEvent = telemetryEvents[0]!;
        const payload = JSON.parse(onboardingEvent.elementLabel);
        expect(payload.workingDaysElapsed).toBe(0.85);
      });

      // 9. Day One Cockpit Truthful Evaluation
      const cockpitReport = await getDayOneReadiness(result.schoolId);
      expect(cockpitReport.isReadyForDayOne).toBe(true);
      expect(cockpitReport.readyChecksCount).toBe(8);
      expect(cockpitReport.totalChecks).toBe(8);
      expect(cockpitReport.summaryCounts).toEqual({
        studentsCount: 900,
        staffCount: 45,
        sectionsCount: 30,
      });
      expect(cockpitReport.finishedStateMessage).toContain("900 students, 45 staff, 30 sections configured");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "is 100% idempotent: running seeder twice succeeds without duplicating data or throwing errors",
    async () => {
      // Run second execution
      const reRunResult = await seedDemoTenant();

      expect(reRunResult.classesCount).toBe(10);
      expect(reRunResult.sectionsCount).toBe(30);
      expect(reRunResult.studentsCount).toBe(900);
      expect(reRunResult.staffCount).toBe(45);
      expect(reRunResult.feeInvoicesCount).toBe(900);
      expect(reRunResult.feePaymentsCount).toBe(720);
      expect(reRunResult.attendanceRecordsCount).toBe(40500);
      expect(reRunResult.examSnapshotsCount).toBe(900);

      // Assert total rows for demo tenant in database did NOT duplicate
      const [totalSchools] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schools)
        .where(eq(schools.slug, "dpa-demo"));
      expect(Number(totalSchools?.count)).toBe(1);

      await withTenant(reRunResult.schoolId, async (tenantDb) => {
        const [totalStudents] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(students)
          .where(eq(students.schoolId, reRunResult.schoolId));
        expect(Number(totalStudents?.count)).toBe(900);

        const [totalSections] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(sections)
          .where(eq(sections.schoolId, reRunResult.schoolId));
        expect(Number(totalSections?.count)).toBe(30);

        const [totalStaff] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(staff)
          .where(eq(staff.schoolId, reRunResult.schoolId));
        expect(Number(totalStaff?.count)).toBe(45);

        const [totalInvoices] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(feeInvoices)
          .where(eq(feeInvoices.schoolId, reRunResult.schoolId));
        expect(Number(totalInvoices?.count)).toBe(900);

        const [totalAttendance] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(studentAttendance)
          .where(eq(studentAttendance.schoolId, reRunResult.schoolId));
        expect(Number(totalAttendance?.count)).toBe(40500);

        const [totalReportCards] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(reportCards)
          .where(eq(reportCards.schoolId, reRunResult.schoolId));
        expect(Number(totalReportCards?.count)).toBe(900);
      });
    },
    TEST_TIMEOUT_MS
  );

  it(
    "cleanDemoTenant successfully cleans up even if active user sessions exist",
    async () => {
      const existingSchool = await db.query.schools.findFirst({
        where: eq(schools.slug, DEMO_SCHOOL_CONFIG.slug),
        columns: { id: true },
      });
      expect(existingSchool).toBeDefined();

      // Simulate an active user session for one of the demo users
      await withTenant(existingSchool!.id, async (tenantDb) => {
        const [demoUser] = await tenantDb
          .select({ id: users.id })
          .from(users)
          .where(eq(users.schoolId, existingSchool!.id))
          .limit(1);

        expect(demoUser).toBeDefined();

        await tenantDb.insert(sessions).values({
          userId: demoUser!.id,
          sessionToken: "demo-test-session-token-" + Date.now(),
          expiresAt: new Date(Date.now() + 3600000),
        });
      });

      // Cleanup should succeed without foreign key constraint errors on users -> sessions
      await expect(cleanDemoTenant(existingSchool!.id)).resolves.not.toThrow();

      const [schoolAfterClean] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schools)
        .where(eq(schools.id, existingSchool!.id));

      expect(Number(schoolAfterClean?.count)).toBe(0);
    },
    TEST_TIMEOUT_MS
  );
});
