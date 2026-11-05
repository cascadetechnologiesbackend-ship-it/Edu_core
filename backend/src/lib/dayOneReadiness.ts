import { db } from "@/db";
import {
  schools,
  academicYears,
  classes,
  sections,
  classSubjects,
  feeStructures,
  feeInvoices,
  staff,
  students,
  timetablePeriods,
  users,
  passwordResetTokens,
  usageEvents,
} from "@/db/schema";
import { eq, and, isNull, isNotNull, sql, inArray } from "drizzle-orm";
import { withTenant } from "./tenant";
import { recordJourneyCompletion } from "./northStarTelemetry";

export type CheckStatus = "READY" | "IN_PROGRESS" | "NOT_STARTED" | "UNKNOWN";

export interface ReadinessCheckItem {
  id: string;
  order: number;
  title: string;
  description: string;
  status: CheckStatus;
  statusLabel: string;
  counts: Record<string, number | string | null>;
  deepLink: {
    label: string;
    href: string;
  };
  unknownReason?: string;
}

export interface DayOneFinishedState {
  isReady: boolean;
  message?: string | undefined;
  nextAction?: {
    label: string;
    href: string;
  } | undefined;
}

export interface DayOneReadinessReport {
  schoolId: string;
  schoolName: string;
  isReadyForDayOne: boolean;
  totalChecks: number;
  readyChecksCount: number;
  checks: ReadinessCheckItem[];
  summaryCounts: {
    studentsCount: number;
    staffCount: number;
    sectionsCount: number;
  };
  finishedStateMessage?: string | undefined;
  finishedState: DayOneFinishedState;
  nextAction?: {
    label: string;
    href: string;
  } | undefined;
}

/**
 * Computes Day One readiness for a school tenant truthfully from the database.
 * Spec Law: Every check computes from the database. A check with no data source
 * renders UNKNOWN with the reason, never green.
 */
export async function getDayOneReadiness(
  schoolId: string,
  executor?: any
): Promise<DayOneReadinessReport> {
  const runner = executor
    ? async (cb: (client: any) => Promise<DayOneReadinessReport>) => cb(executor)
    : async (cb: (client: any) => Promise<DayOneReadinessReport>) =>
        withTenant(schoolId, async (tenantDb) => cb(tenantDb));

  return await runner(async (client) => {
    // 0. Resolve School
    let schoolName = "School";
    let schoolCreatedAt = new Date();
    try {
      const [school] = await client
        .select({
          name: schools.name,
          createdAt: schools.createdAt,
        })
        .from(schools)
        .where(eq(schools.id, schoolId))
        .limit(1);

      if (school) {
        schoolName = school.name;
        schoolCreatedAt = school.createdAt;
      }
    } catch {
      // Keep defaults
    }

    const checks: ReadinessCheckItem[] = [];

    // ─── Check 1: Academic year defined and active (label, dates) ───────────
    try {
      const [activeYear] = await client
        .select({
          id: academicYears.id,
          label: academicYears.label,
          startDate: academicYears.startDate,
          endDate: academicYears.endDate,
          isActive: academicYears.isActive,
        })
        .from(academicYears)
        .where(
          and(
            eq(academicYears.schoolId, schoolId),
            eq(academicYears.isActive, true),
            isNull(academicYears.deletedAt)
          )
        )
        .limit(1);

      if (activeYear) {
        const startStr = activeYear.startDate
          ? (activeYear.startDate instanceof Date
              ? activeYear.startDate.toISOString().split("T")[0]
              : String(activeYear.startDate).split("T")[0])
          : "Not defined";
        const endStr = activeYear.endDate
          ? (activeYear.endDate instanceof Date
              ? activeYear.endDate.toISOString().split("T")[0]
              : String(activeYear.endDate).split("T")[0])
          : "Not defined";

        checks.push({
          id: "academic_year",
          order: 1,
          title: "Academic year defined and active",
          description: "Active academic session with defined start and end dates.",
          status: "READY",
          statusLabel: `Active session: ${activeYear.label} (${startStr} to ${endStr})`,
          counts: {
            label: activeYear.label,
            startDate: startStr,
            endDate: endStr,
          },
          deepLink: {
            label: "Review Session",
            href: "/academics",
          },
        });
      } else {
        const [anyYearCount] = await client
          .select({ count: sql<number>`count(*)` })
          .from(academicYears)
          .where(
            and(
              eq(academicYears.schoolId, schoolId),
              isNull(academicYears.deletedAt)
            )
          );

        const totalYears = Number(anyYearCount?.count || 0);
        checks.push({
          id: "academic_year",
          order: 1,
          title: "Academic year defined and active",
          description: "Active academic session with defined start and end dates.",
          status: totalYears > 0 ? "IN_PROGRESS" : "NOT_STARTED",
          statusLabel:
            totalYears > 0
              ? `${totalYears} academic year(s) configured, but none active`
              : "No academic year defined",
          counts: { count: totalYears },
          deepLink: {
            label: "Configure Academic Year",
            href: "/academics",
          },
        });
      }
    } catch (err: any) {
      checks.push({
        id: "academic_year",
        order: 1,
        title: "Academic year defined and active",
        description: "Active academic session with defined start and end dates.",
        status: "UNKNOWN",
        statusLabel: `UNKNOWN: ${err?.message || "Database query failed"}`,
        unknownReason: `Unable to compute from academic_years table: ${err?.message || "Query failed"}`,
        counts: {},
        deepLink: {
          label: "Configure Academic Year",
          href: "/academics",
        },
      });
    }

    // ─── Check 2: Classes and sections configured (classes count, sections count) ─
    let classesCount = 0;
    let sectionsCount = 0;
    try {
      const [classRes] = await client
        .select({ count: sql<number>`count(*)` })
        .from(classes)
        .where(
          and(
            eq(classes.schoolId, schoolId),
            eq(classes.isActive, true),
            isNull(classes.deletedAt)
          )
        );

      const [sectionRes] = await client
        .select({ count: sql<number>`count(*)` })
        .from(sections)
        .where(
          and(
            eq(sections.schoolId, schoolId),
            eq(sections.isActive, true),
            isNull(sections.deletedAt)
          )
        );

      const classesWithSectionsRes = await client
        .select({ classId: sections.classId })
        .from(sections)
        .where(
          and(
            eq(sections.schoolId, schoolId),
            eq(sections.isActive, true),
            isNull(sections.deletedAt)
          )
        )
        .groupBy(sections.classId);

      classesCount = Number(classRes?.count || 0);
      sectionsCount = Number(sectionRes?.count || 0);
      const classesWithSectionsCount = classesWithSectionsRes.length;

      const isReady =
        classesCount > 0 &&
        sectionsCount > 0 &&
        classesWithSectionsCount >= classesCount;
      const isInProgress = classesCount > 0;

      checks.push({
        id: "classes_sections",
        order: 2,
        title: "Classes and sections configured",
        description: "Grade wings, classes, and classroom sections created.",
        status: isReady ? "READY" : isInProgress ? "IN_PROGRESS" : "NOT_STARTED",
        statusLabel: isReady
          ? `${classesCount} classes, ${sectionsCount} sections configured`
          : isInProgress
          ? `${classesCount} classes configured, ${sectionsCount} sections configured across ${classesWithSectionsCount} classes`
          : "No classes or sections configured",
        counts: { classesCount, sectionsCount, classesWithSectionsCount },
        deepLink: {
          label: "Manage Classes & Sections",
          href: "/academics",
        },
      });
    } catch (err: any) {
      checks.push({
        id: "classes_sections",
        order: 2,
        title: "Classes and sections configured",
        description: "Grade wings, classes, and classroom sections created.",
        status: "UNKNOWN",
        statusLabel: `UNKNOWN: ${err?.message || "Database query failed"}`,
        unknownReason: `Unable to compute from classes/sections tables: ${err?.message || "Query failed"}`,
        counts: {},
        deepLink: {
          label: "Manage Classes & Sections",
          href: "/academics",
        },
      });
    }

    // ─── Check 3: Subjects assigned to classes (count shown) ────────────────
    try {
      const [subjectRes] = await client
        .select({ count: sql<number>`count(*)` })
        .from(classSubjects)
        .where(eq(classSubjects.schoolId, schoolId));

      const classesWithSubjectsRes = await client
        .select({ classId: classSubjects.classId })
        .from(classSubjects)
        .where(eq(classSubjects.schoolId, schoolId))
        .groupBy(classSubjects.classId);

      const assignedSubjectsCount = Number(subjectRes?.count || 0);
      const classesWithSubjectsCount = classesWithSubjectsRes.length;

      const isReady =
        assignedSubjectsCount > 0 &&
        classesCount > 0 &&
        classesWithSubjectsCount >= classesCount;
      const isInProgress = assignedSubjectsCount > 0;

      checks.push({
        id: "subjects",
        order: 3,
        title: "Subjects assigned to classes",
        description: "Curriculum matrix attached and subjects allocated to classes.",
        status: isReady ? "READY" : isInProgress ? "IN_PROGRESS" : "NOT_STARTED",
        statusLabel: isReady
          ? `${assignedSubjectsCount} subject mappings assigned across all ${classesCount} classes`
          : isInProgress
          ? `${assignedSubjectsCount} subjects assigned across ${classesWithSubjectsCount} of ${classesCount} classes`
          : "No subjects assigned to classes",
        counts: {
          assignedSubjectsCount,
          classesWithSubjectsCount,
          totalClasses: classesCount,
        },
        deepLink: {
          label: "Assign Subjects",
          href: "/academics/subjects",
        },
      });
    } catch (err: any) {
      checks.push({
        id: "subjects",
        order: 3,
        title: "Subjects assigned to classes",
        description: "Curriculum matrix attached and subjects allocated to classes.",
        status: "UNKNOWN",
        statusLabel: `UNKNOWN: ${err?.message || "Database query failed"}`,
        unknownReason: `Unable to compute from class_subjects table: ${err?.message || "Query failed"}`,
        counts: {},
        deepLink: {
          label: "Assign Subjects",
          href: "/academics/subjects",
        },
      });
    }

    // ─── Check 4: Fee structures attached & demand generated (count shown) ─
    try {
      // Query imported students count to verify billing demand exists for imported cohort
      let importedStudentsCount = 0;
      try {
        const [studentRes] = await client
          .select({ count: sql<number>`count(*)` })
          .from(students)
          .where(
            and(
              eq(students.schoolId, schoolId),
              eq(students.isActive, true),
              isNull(students.deletedAt)
            )
          );
        importedStudentsCount = Number(studentRes?.count || 0);
      } catch {}

      const [feeStructRes] = await client
        .select({ count: sql<number>`count(*)` })
        .from(feeStructures)
        .where(
          and(
            eq(feeStructures.schoolId, schoolId),
            eq(feeStructures.isActive, true),
            isNull(feeStructures.deletedAt)
          )
        );

      const feeClassesRes = await client
        .select({ classId: feeStructures.classId })
        .from(feeStructures)
        .where(
          and(
            eq(feeStructures.schoolId, schoolId),
            eq(feeStructures.isActive, true),
            isNull(feeStructures.deletedAt)
          )
        )
        .groupBy(feeStructures.classId);

      const [feeInvoiceRes] = await client
        .select({ count: sql<number>`count(*)` })
        .from(feeInvoices)
        .where(
          and(
            eq(feeInvoices.schoolId, schoolId),
            isNull(feeInvoices.deletedAt)
          )
        );

      const studentsWithDemandsRes = await client
        .select({ studentId: feeInvoices.studentId })
        .from(feeInvoices)
        .where(
          and(
            eq(feeInvoices.schoolId, schoolId),
            isNull(feeInvoices.deletedAt)
          )
        )
        .groupBy(feeInvoices.studentId);

      const feeStructuresCount = Number(feeStructRes?.count || 0);
      const classesWithFeeStructures = feeClassesRes.length;
      const feeInvoicesCount = Number(feeInvoiceRes?.count || 0);
      const studentsWithDemandsCount = studentsWithDemandsRes.length;

      // Ready when classes exist, fee structures cover all classes, students are imported, and demand is generated
      const isReady =
        classesCount > 0 &&
        feeStructuresCount > 0 &&
        classesWithFeeStructures >= classesCount &&
        importedStudentsCount > 0 &&
        feeInvoicesCount > 0 &&
        studentsWithDemandsCount > 0;

      const isInProgress = feeStructuresCount > 0;

      checks.push({
        id: "fees",
        order: 4,
        title: "Fee structures attached & demand generated",
        description: "Fee schedules configured per class-section with initial billing demand created.",
        status: isReady ? "READY" : isInProgress ? "IN_PROGRESS" : "NOT_STARTED",
        statusLabel: isReady
          ? `${feeStructuresCount} fee structures attached, ${feeInvoicesCount} fee demands generated`
          : isInProgress
          ? importedStudentsCount === 0
            ? `${feeStructuresCount} fee structures configured, awaiting student import for demand generation`
            : `${feeStructuresCount} fee structures configured, ${feeInvoicesCount} fee demands generated (demand pending)`
          : "No fee structures configured",
        counts: {
          feeStructuresCount,
          feeInvoicesCount,
          classesWithFeeStructures,
          totalClasses: classesCount,
          studentsWithDemandsCount,
          totalStudents: importedStudentsCount,
        },
        deepLink: {
          label: "Configure Fee Structures",
          href: "/school/fee-structures",
        },
      });
    } catch (err: any) {
      checks.push({
        id: "fees",
        order: 4,
        title: "Fee structures attached & demand generated",
        description: "Fee schedules configured per class-section with initial billing demand created.",
        status: "UNKNOWN",
        statusLabel: `UNKNOWN: ${err?.message || "Database query failed"}`,
        unknownReason: `Unable to compute from fee_structures/fee_invoices tables: ${err?.message || "Query failed"}`,
        counts: {},
        deepLink: {
          label: "Configure Fee Structures",
          href: "/school/fee-structures",
        },
      });
    }

    // ─── Check 5: Staff imported and active (count shown) ────────────────────
    let staffCount = 0;
    try {
      const [staffRes] = await client
        .select({ count: sql<number>`count(*)` })
        .from(staff)
        .where(
          and(
            eq(staff.schoolId, schoolId),
            eq(staff.isActive, true),
            isNull(staff.deletedAt)
          )
        );

      staffCount = Number(staffRes?.count || 0);
      const isReady = staffCount > 0;

      checks.push({
        id: "staff",
        order: 5,
        title: "Staff imported and active",
        description: "Faculty and administrative staff accounts active with departmental roles.",
        status: isReady ? "READY" : "NOT_STARTED",
        statusLabel: isReady
          ? `${staffCount} active staff members imported`
          : "0 staff members imported",
        counts: { staffCount },
        deepLink: {
          label: "Import Staff",
          href: "/school/import-center?tab=staff",
        },
      });
    } catch (err: any) {
      checks.push({
        id: "staff",
        order: 5,
        title: "Staff imported and active",
        description: "Faculty and administrative staff accounts active with departmental roles.",
        status: "UNKNOWN",
        statusLabel: `UNKNOWN: ${err?.message || "Database query failed"}`,
        unknownReason: `Unable to compute from staff table: ${err?.message || "Query failed"}`,
        counts: {},
        deepLink: {
          label: "Import Staff",
          href: "/school/import-center?tab=staff",
        },
      });
    }

    // ─── Check 6: Students imported and enrolled into sections (count shown) ─
    let studentsCount = 0;
    let enrolledStudentsCount = 0;
    try {
      const [totalStudentsRes] = await client
        .select({ count: sql<number>`count(*)` })
        .from(students)
        .where(
          and(
            eq(students.schoolId, schoolId),
            eq(students.isActive, true),
            isNull(students.deletedAt)
          )
        );

      const [enrolledStudentsRes] = await client
        .select({ count: sql<number>`count(*)` })
        .from(students)
        .where(
          and(
            eq(students.schoolId, schoolId),
            eq(students.isActive, true),
            isNull(students.deletedAt),
            isNotNull(students.currentSectionId)
          )
        );

      studentsCount = Number(totalStudentsRes?.count || 0);
      enrolledStudentsCount = Number(enrolledStudentsRes?.count || 0);

      const isReady = studentsCount > 0 && enrolledStudentsCount >= studentsCount;
      const isInProgress = studentsCount > 0;

      checks.push({
        id: "students",
        order: 6,
        title: "Students imported and enrolled into sections",
        description: "Student roster registered and placed into active sections.",
        status: isReady ? "READY" : isInProgress ? "IN_PROGRESS" : "NOT_STARTED",
        statusLabel: isReady
          ? `${studentsCount} students imported and enrolled into sections`
          : isInProgress
          ? `${enrolledStudentsCount} of ${studentsCount} students enrolled into sections`
          : "0 students imported",
        counts: { studentsCount, enrolledStudentsCount },
        deepLink: {
          label: "Import Students",
          href: "/school/import-center?tab=students",
        },
      });
    } catch (err: any) {
      checks.push({
        id: "students",
        order: 6,
        title: "Students imported and enrolled into sections",
        description: "Student roster registered and placed into active sections.",
        status: "UNKNOWN",
        statusLabel: `UNKNOWN: ${err?.message || "Database query failed"}`,
        unknownReason: `Unable to compute from students table: ${err?.message || "Query failed"}`,
        counts: {},
        deepLink: {
          label: "Import Students",
          href: "/school/import-center?tab=students",
        },
      });
    }

    // ─── Check 7: Timetable loaded for every section (periods count shown) ──
    try {
      const [periodsRes] = await client
        .select({ count: sql<number>`count(*)` })
        .from(timetablePeriods)
        .where(
          and(
            eq(timetablePeriods.schoolId, schoolId),
            eq(timetablePeriods.isActive, true)
          )
        );

      const sectionsWithPeriodsRes = await client
        .select({ sectionId: timetablePeriods.sectionId })
        .from(timetablePeriods)
        .where(
          and(
            eq(timetablePeriods.schoolId, schoolId),
            eq(timetablePeriods.isActive, true)
          )
        )
        .groupBy(timetablePeriods.sectionId);

      const timetablePeriodsCount = Number(periodsRes?.count || 0);
      const sectionsWithPeriodsCount = sectionsWithPeriodsRes.length;

      const isReady =
        sectionsCount > 0 &&
        sectionsWithPeriodsCount >= sectionsCount &&
        timetablePeriodsCount > 0;
      const isInProgress = timetablePeriodsCount > 0;

      checks.push({
        id: "timetable",
        order: 7,
        title: "Timetable loaded for every section",
        description: "Weekly instructional periods scheduled across all classroom sections.",
        status: isReady ? "READY" : isInProgress ? "IN_PROGRESS" : "NOT_STARTED",
        statusLabel: isReady
          ? `${timetablePeriodsCount} periods loaded across all ${sectionsCount} sections`
          : isInProgress
          ? `${timetablePeriodsCount} periods loaded across ${sectionsWithPeriodsCount} of ${sectionsCount} sections`
          : "0 timetable periods loaded",
        counts: {
          timetablePeriodsCount,
          sectionsWithPeriodsCount,
          totalSections: sectionsCount,
        },
        deepLink: {
          label: "Schedule Timetable",
          href: "/academics/setup/bell-schedule",
        },
      });
    } catch (err: any) {
      checks.push({
        id: "timetable",
        order: 7,
        title: "Timetable loaded for every section",
        description: "Weekly instructional periods scheduled across all classroom sections.",
        status: "UNKNOWN",
        statusLabel: `UNKNOWN: ${err?.message || "Database query failed"}`,
        unknownReason: `Unable to compute from timetable_periods table: ${err?.message || "Query failed"}`,
        counts: {},
        deepLink: {
          label: "Schedule Timetable",
          href: "/academics/setup/bell-schedule",
        },
      });
    }

    // ─── Check 8: Parent claims issued for every enrolled student ───────────
    try {
      const [enrolledRes] = await client
        .select({ count: sql<number>`count(*)` })
        .from(students)
        .where(
          and(
            eq(students.schoolId, schoolId),
            eq(students.isActive, true),
            isNull(students.deletedAt),
            isNotNull(students.currentSectionId)
          )
        );

      const totalEnrolled = Number(enrolledRes?.count || 0);

      if (totalEnrolled === 0) {
        checks.push({
          id: "parent_claims",
          order: 8,
          title: "Parent claims issued for every enrolled student",
          description: "Parent portal verification claim links generated and distributed.",
          status: "NOT_STARTED",
          statusLabel: "No enrolled students to issue parent claims for",
          counts: {
            issuedCount: 0,
            claimedCount: 0,
            pendingCount: 0,
            totalEnrolled: 0,
          },
          deepLink: {
            label: "Distribute & Track Claims",
            href: "/students/linkage",
          },
        });
      } else {
        // Query enrolled students with linked parent user ID
        const linkedStudents = await client
          .select({
            id: students.id,
            primaryParentUserId: students.primaryParentUserId,
          })
          .from(students)
          .where(
            and(
              eq(students.schoolId, schoolId),
              eq(students.isActive, true),
              isNull(students.deletedAt),
              isNotNull(students.currentSectionId),
              isNotNull(students.primaryParentUserId)
            )
          );

        const parentUserIds: string[] = Array.from(
          new Set(
            linkedStudents
              .map((s: { id: string; primaryParentUserId: string | null }) => s.primaryParentUserId)
              .filter((id: string | null): id is string => typeof id === "string" && id.length > 0)
          )
        );

        let claimedUserIds = new Set<string>();

        if (parentUserIds.length > 0) {
          // Users who have already claimed (mustChangePassword == false)
          const claimedUsers = await client
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                inArray(users.id, parentUserIds),
                eq(users.mustChangePassword, false)
              )
            );

          for (const u of claimedUsers) {
            claimedUserIds.add(u.id);
          }

          // Also check password_reset_tokens usedAt
          const usedTokens = await client
            .select({ userId: passwordResetTokens.userId })
            .from(passwordResetTokens)
            .where(
              and(
                inArray(passwordResetTokens.userId, parentUserIds),
                isNotNull(passwordResetTokens.usedAt)
              )
            );

          for (const t of usedTokens) {
            claimedUserIds.add(t.userId);
          }
        }

        let claimedCount = 0;
        let issuedCount = 0;

        for (const s of linkedStudents) {
          if (s.primaryParentUserId) {
            issuedCount++;
            if (claimedUserIds.has(s.primaryParentUserId)) {
              claimedCount++;
            }
          }
        }

        const pendingCount = Math.max(0, issuedCount - claimedCount);
        const isReady =
          totalEnrolled > 0 &&
          issuedCount >= totalEnrolled;
        const isInProgress = issuedCount > 0;

        checks.push({
          id: "parent_claims",
          order: 8,
          title: "Parent claims issued for every enrolled student",
          description: "Parent portal verification claim links generated and distributed.",
          status: isReady ? "READY" : isInProgress ? "IN_PROGRESS" : "NOT_STARTED",
          statusLabel: isReady
            ? `All ${totalEnrolled} parent claims issued (${claimedCount} claimed, ${pendingCount} pending)`
            : isInProgress
            ? `${issuedCount} of ${totalEnrolled} parent claims issued (${claimedCount} claimed, ${pendingCount} pending)`
            : `0 of ${totalEnrolled} parent claims issued (${totalEnrolled} pending)`,
          counts: {
            issuedCount,
            claimedCount,
            pendingCount,
            totalEnrolled,
          },
          deepLink: {
            label: isReady ? "Send reminders to pending claims" : "Distribute & Track Claims",
            href: isReady ? "/students/linkage?tab=tracking" : "/students/linkage",
          },
        });
      }
    } catch (err: any) {
      checks.push({
        id: "parent_claims",
        order: 8,
        title: "Parent claims issued for every enrolled student",
        description: "Parent portal verification claim links generated and distributed.",
        status: "UNKNOWN",
        statusLabel: `UNKNOWN: ${err?.message || "Database query failed"}`,
        unknownReason: `Unable to compute from students/users/passwordResetTokens tables: ${err?.message || "Query failed"}`,
        counts: {},
        deepLink: {
          label: "Distribute & Track Claims",
          href: "/students/linkage",
        },
      });
    }

    // ─── Aggregate Verdict ──────────────────────────────────────────────────
    const totalChecks = checks.length;
    const readyChecksCount = checks.filter((c) => c.status === "READY").length;
    const isReadyForDayOne = totalChecks === 8 && readyChecksCount === 8;

    const summaryCounts = {
      studentsCount,
      staffCount,
      sectionsCount,
    };

    const finishedStateMessage = isReadyForDayOne
      ? `School ${schoolName} ready for Day One: ${studentsCount} students, ${staffCount} staff, ${sectionsCount} sections configured.`
      : undefined;

    const nextAction = isReadyForDayOne
      ? {
          label: "Mark the first attendance",
          href: "/attendance",
        }
      : undefined;

    const finishedState: DayOneFinishedState = {
      isReady: isReadyForDayOne,
      message: finishedStateMessage,
      nextAction,
    };

    return {
      schoolId,
      schoolName,
      isReadyForDayOne,
      totalChecks,
      readyChecksCount,
      checks,
      summaryCounts,
      finishedStateMessage,
      finishedState,
      nextAction,
    };
  });
}

/**
 * Emits J10 journey completion telemetry if the school has reached Day One readiness
 * and has not already emitted a journey_finished event for J10.
 */
export async function emitDayOneJourneyFinishedIfReady(params: {
  schoolId: string;
  userId: string;
  role?: string;
  report?: DayOneReadinessReport;
  txDb?: any;
}): Promise<{ emitted: boolean; event?: any }> {
  const { schoolId, userId, role = "SCHOOL_ADMIN", txDb } = params;
  const client = txDb || db;

  const report = params.report || (await getDayOneReadiness(schoolId, client));
  if (!report.isReadyForDayOne || !report.finishedStateMessage) {
    return { emitted: false };
  }

  // Idempotency: verify whether journey_finished for J10 was already emitted
  const existingFinishedEvents = await client
    .select({ id: usageEvents.id, elementLabel: usageEvents.elementLabel })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.schoolId, schoolId),
        eq(usageEvents.elementId, "north_star_journey_completion"),
        eq(usageEvents.action, "journey_finished")
      )
    )
    .limit(50);

  const alreadyEmitted = existingFinishedEvents.some((ev: { id: string; elementLabel: string }) => {
    try {
      const parsed = JSON.parse(ev.elementLabel);
      return parsed.journeyId === "J10_school_onboarding" && parsed.completed === true;
    } catch {
      return false;
    }
  });

  if (alreadyEmitted) {
    return { emitted: false };
  }

  // Calculate elapsed time from school tenant creation
  const [school] = await client
    .select({ createdAt: schools.createdAt })
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);

  const createdAt = school?.createdAt || new Date();
  const durationMs = Math.max(0, Date.now() - createdAt.getTime());

  const event = await recordJourneyCompletion(
    {
      schoolId,
      userId,
      role,
      journeyId: "J10_school_onboarding",
      durationMs,
      completed: true,
      finishedState: report.finishedStateMessage,
    },
    client
  );

  return { emitted: true, event };
}
