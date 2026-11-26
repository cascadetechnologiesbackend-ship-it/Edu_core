/**
 * S23 Role Console Truth Domain Engine
 *
 * Provides authoritative, live, tenant-scoped operational metrics for:
 * 1. Principal Executive Dashboard (sections, teaching faculty, student attendance rate, pending exam marks locks)
 * 2. Librarian Operations Console (book volume, available copies, active issues, overdue returns, categories)
 * 3. Transport Operations Console (fleet vehicles, routes, stops, student pass opt-ins, maintenance alerts, GPS recency)
 *
 * Invariants:
 * - Fail-closed multi-tenant isolation via withTenant(schoolId).
 * - Zero fabricated numbers: newly provisioned or empty tenants render honest zeros.
 * - Single source of truth: derives from canonical database tables without shadow write-paths.
 */

import {
  sections,
  staff,
  students,
  studentAttendance,
  staffAttendance,
  examMarksLocks,
  exams,
  leaveRequests,
  leaveTypes,
  studentLeaveRequests,
  timetableSubstitutions,
  feeConcessions,
  feeRefunds,
  feeInvoices,
  feePayments,
  lessonPlans,
  assignmentSubmissions,
  books,
  bookCopies,
  bookIssues,
  vehicles,
  routes,
  routeStops,
  studentBusPasses,
  gpsPings,
} from "@schoolmitra/database";
import { eq, and, isNull, inArray, desc, gte, lte } from "drizzle-orm";
import { withTenant } from "./tenant";
import { decryptData } from "./encryption";

function safeDecrypt(val: string | null | undefined): string {
  if (!val) return "";
  try {
    return decryptData(val) || "";
  } catch {
    return "";
  }
}

// ─── 1. Principal Executive Console Metrics ──────────────────────────────────

export interface PrincipalPendingMarksApprovalItem {
  id: string;
  examId: string;
  examName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  submittedByName: string;
  submittedAt: string | null;
}

export interface PrincipalPendingStaffLeaveItem {
  id: string;
  staffId: string;
  staffName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason: string;
  status: string;
}

export interface PrincipalPendingStudentLeaveItem {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface PrincipalExamProgressItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
  submittedCount: number;
  lockedCount: number;
  totalTrackedCount: number;
}

export interface PrincipalConsoleMetrics {
  activeSectionsCount: number;
  activeTeachingStaffCount: number;
  todayStudentAttendance: {
    totalMarked: number;
    presentCount: number;
    ratePercent: number | null;
    formattedPercent: string;
    isMarkedToday: boolean;
  };
  pendingExamVerificationsCount: number;
  staffAttendanceRate: {
    totalMarked: number;
    presentCount: number;
    ratePercent: number;
    formattedPercent: string;
  } | null;
  approvalQueue?: {
    pendingMarksApprovals: PrincipalPendingMarksApprovalItem[];
    pendingStaffLeaves: PrincipalPendingStaffLeaveItem[];
    pendingStudentLeaves: PrincipalPendingStudentLeaveItem[];
    pendingFeeConcessionsCount: number;
    pendingFeeRefundsCount: number;
    pendingFeeRefundsAmount: number;
  };
  oversight?: {
    examProgress: PrincipalExamProgressItem[];
    attendanceExceptions: {
      unmarkedSectionsCount: number;
      unmarkedSectionNames: string[];
      lowAttendanceSections: {
        sectionId: string;
        sectionLabel: string;
        presentCount: number;
        totalMarked: number;
        ratePercent: number;
      }[];
    };
    teacherCoverageToday: {
      onLeaveCount: number;
      staffOnLeaveNames: string[];
      pendingSubstitutionsCount: number;
      coveredSubstitutionsCount: number;
    };
    financeOverview: {
      collectedToday: number;
      collectedLast30Days: number;
      totalOutstanding: number;
      agingBuckets: {
        days0to30: number;
        days31to60: number;
        days61to90: number;
        days90Plus: number;
      };
    };
    syllabusPacing?: {
      totalTopics: number;
      completedTopics: number;
      inProgressTopics: number;
      completionPercent: number;
    };
    gradingSla?: {
      overdueUngradedCount: number;
      totalUngradedCount: number;
    };
  };
}

export async function getPrincipalConsoleMetrics(
  schoolId: string,
  options?: { now?: Date }
): Promise<PrincipalConsoleMetrics> {
  return await withTenant(schoolId, async (tenantDb) => {
    const now = options?.now ?? new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const thirtyDaysAgo = new Date(startOfDay.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    const q = tenantDb.query as any;

    const [
      activeSections,
      activeStaffList,
      todayAttendanceRows,
      pendingLocks,
      todayStaffAttendanceRows,
      allLocksRows,
      recentExamsRows,
      pendingStaffLeaveRows,
      approvedLeaveTodayRows,
      leaveTypeRows,
      pendingStudentLeaveRows,
      todaySubstitutionsRows,
      pendingConcessionsRows,
      pendingRefundRows,
      openInvoicesRows,
      recentPaymentsRows,
      allLessonPlanRows,
      ungradedSubmissionRows,
    ] = await Promise.all([
      // 1. Active class sections
      tenantDb.query.sections.findMany({
        where: and(eq(sections.schoolId, schoolId), eq(sections.isActive, true)),
        columns: { id: true, name: true, classId: true },
        with: { class: { columns: { id: true, displayName: true } } },
      }),

      // 2. Active staff members
      tenantDb.query.staff.findMany({
        where: and(
          eq(staff.schoolId, schoolId),
          eq(staff.isActive, true),
          isNull(staff.deletedAt)
        ),
        with: {
          designation: true,
        },
      }),

      // 3. Today's student attendance records
      tenantDb.query.studentAttendance.findMany({
        where: and(
          eq(studentAttendance.schoolId, schoolId),
          gte(studentAttendance.attendanceDate, startOfDay),
          lte(studentAttendance.attendanceDate, endOfDay)
        ),
        columns: { id: true, status: true, sectionId: true },
      }),

      // 4. Pending exam mark locks (SUBMITTED by teacher, waiting for principal lock/approval)
      tenantDb.query.examMarksLocks.findMany({
        where: and(
          eq(examMarksLocks.schoolId, schoolId),
          eq(examMarksLocks.status, "SUBMITTED")
        ),
        with: {
          exam: { columns: { id: true, name: true } },
          class: { columns: { id: true, displayName: true } },
          subject: { columns: { id: true, name: true } },
          submittedBy: { columns: { id: true, email: true } },
        },
      }),

      // 5. Today's staff attendance records (OD3: compute if populated)
      tenantDb.query.staffAttendance.findMany({
        where: and(
          eq(staffAttendance.schoolId, schoolId),
          gte(staffAttendance.attendanceDate, startOfDay),
          lte(staffAttendance.attendanceDate, endOfDay)
        ),
        columns: { id: true, status: true },
      }),

      // 6. All exam marks locks (for exam progress summary)
      typeof q?.examMarksLocks?.findMany === "function"
        ? tenantDb.query.examMarksLocks.findMany({
          where: eq(examMarksLocks.schoolId, schoolId),
          columns: { id: true, examId: true, status: true },
        })
        : Promise.resolve([]),

      // 7. Recent/active exams
      typeof q?.exams?.findMany === "function"
        ? tenantDb.query.exams.findMany({
          where: and(eq(exams.schoolId, schoolId), isNull(exams.deletedAt)),
          orderBy: [desc(exams.startDate)],
          limit: 6,
          columns: { id: true, name: true, startDate: true, endDate: true, isLocked: true },
        })
        : Promise.resolve([]),

      // 8. Pending staff leave requests awaiting Principal/HR decision
      typeof q?.leaveRequests?.findMany === "function"
        ? tenantDb.query.leaveRequests.findMany({
          where: and(
            eq(leaveRequests.schoolId, schoolId),
            inArray(leaveRequests.status, ["PENDING", "HOD_APPROVED"])
          ),
          orderBy: [desc(leaveRequests.createdAt)],
          limit: 15,
        })
        : Promise.resolve([]),

      // 9. Approved staff leaves overlapping today
      typeof q?.leaveRequests?.findMany === "function"
        ? tenantDb.query.leaveRequests.findMany({
          where: and(
            eq(leaveRequests.schoolId, schoolId),
            eq(leaveRequests.status, "HR_APPROVED"),
            lte(leaveRequests.startDate, endOfDay),
            gte(leaveRequests.endDate, startOfDay)
          ),
          columns: { id: true, staffId: true },
        })
        : Promise.resolve([]),

      // 10. Leave types lookup
      typeof q?.leaveTypes?.findMany === "function"
        ? tenantDb.query.leaveTypes.findMany({
          where: eq(leaveTypes.schoolId, schoolId),
          columns: { id: true, name: true },
        })
        : Promise.resolve([]),

      // 11. Pending student leave requests
      typeof q?.studentLeaveRequests?.findMany === "function"
        ? tenantDb.query.studentLeaveRequests.findMany({
          where: and(
            eq(studentLeaveRequests.schoolId, schoolId),
            eq(studentLeaveRequests.status, "PENDING")
          ),
          orderBy: [desc(studentLeaveRequests.createdAt)],
          limit: 15,
        })
        : Promise.resolve([]),

      // 12. Today's timetable substitutions
      typeof q?.timetableSubstitutions?.findMany === "function"
        ? tenantDb.query.timetableSubstitutions.findMany({
          where: and(
            eq(timetableSubstitutions.schoolId, schoolId),
            eq(timetableSubstitutions.date, todayIso)
          ),
          columns: { id: true, status: true, substituteTeacherId: true },
        })
        : Promise.resolve([]),

      // 13. Unapproved active fee concessions
      typeof q?.feeConcessions?.findMany === "function"
        ? tenantDb.query.feeConcessions.findMany({
          where: and(
            eq(feeConcessions.schoolId, schoolId),
            eq(feeConcessions.isActive, true),
            isNull(feeConcessions.approvedById),
            isNull(feeConcessions.deletedAt)
          ),
          columns: { id: true },
        })
        : Promise.resolve([]),

      // 14. Pending fee refunds
      typeof q?.feeRefunds?.findMany === "function"
        ? tenantDb.query.feeRefunds.findMany({
          where: and(eq(feeRefunds.schoolId, schoolId), eq(feeRefunds.status, "PENDING")),
          columns: { id: true, refundAmount: true },
        })
        : Promise.resolve([]),

      // 15. Open / overdue fee invoices for dues aging
      typeof q?.feeInvoices?.findMany === "function"
        ? tenantDb.query.feeInvoices.findMany({
          where: and(
            eq(feeInvoices.schoolId, schoolId),
            inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"]),
            isNull(feeInvoices.deletedAt)
          ),
          columns: { id: true, balanceAmount: true, dueDate: true },
        })
        : Promise.resolve([]),

      // 16. Fee collections over the last 30 days
      typeof q?.feePayments?.findMany === "function"
        ? tenantDb.query.feePayments.findMany({
          where: and(
            eq(feePayments.schoolId, schoolId),
            eq(feePayments.isCancelled, false),
            gte(feePayments.paymentDate, thirtyDaysAgo)
          ),
          columns: { id: true, amountPaid: true, paymentDate: true },
        })
        : Promise.resolve([]),

      // 17. Lesson plans for syllabus pacing summary
      typeof q?.lessonPlans?.findMany === "function"
        ? tenantDb.query.lessonPlans.findMany({
          where: and(eq(lessonPlans.schoolId, schoolId), isNull(lessonPlans.deletedAt)),
          columns: { id: true, status: true },
        })
        : Promise.resolve([]),

      // 18. Ungraded assignment submissions for grading SLA (> 7 days)
      typeof q?.assignmentSubmissions?.findMany === "function"
        ? tenantDb.query.assignmentSubmissions.findMany({
          where: and(
            eq(assignmentSubmissions.schoolId, schoolId),
            isNull(assignmentSubmissions.gradedAt)
          ),
          columns: { id: true, submittedAt: true },
        })
        : Promise.resolve([]),
    ]);

    // Active sections count
    const activeSectionsCount = activeSections.length;

    // Filter teaching faculty: check if any designation explicitly flags isTeaching
    const hasTeachingFlags = activeStaffList.some((s) => s.designation?.isTeaching === true);
    const teachingStaff = hasTeachingFlags
      ? activeStaffList.filter((s) => s.designation?.isTeaching === true)
      : activeStaffList;
    const activeTeachingStaffCount = teachingStaff.length;

    // Staff lookup maps for PII-safe display names
    const staffById = new Map<string, string>();
    const staffNameByUserId = new Map<string, string>();
    for (const st of activeStaffList as any[]) {
      const fullName = `${safeDecrypt(st.firstNameEncrypted)} ${safeDecrypt(st.lastNameEncrypted)}`.trim();
      const label = fullName || st.employeeCode || "Staff Member";
      staffById.set(st.id, label);
      if (st.userId) {
        staffNameByUserId.set(st.userId, label);
      }
    }

    // Fetch student names only for pending student leave requests (if any)
    const pendingStudentIds = Array.from(
      new Set((pendingStudentLeaveRows as any[]).map((r) => r.studentId).filter(Boolean))
    );
    const studentMap = new Map<string, { name: string; admissionNumber: string }>();
    if (pendingStudentIds.length > 0 && typeof q?.students?.findMany === "function") {
      const studentRows = await tenantDb.query.students.findMany({
        where: and(eq(students.schoolId, schoolId), inArray(students.id, pendingStudentIds)),
        columns: {
          id: true,
          firstNameEncrypted: true,
          lastNameEncrypted: true,
          admissionNumber: true,
        },
      });
      for (const st of studentRows) {
        const name =
          `${safeDecrypt(st.firstNameEncrypted)} ${safeDecrypt(st.lastNameEncrypted)}`.trim() ||
          st.admissionNumber ||
          "Student";
        studentMap.set(st.id, { name, admissionNumber: st.admissionNumber });
      }
    }

    // Calculate student attendance metrics
    let todayStudentAttendance: PrincipalConsoleMetrics["todayStudentAttendance"];
    if (todayAttendanceRows.length === 0) {
      todayStudentAttendance = {
        totalMarked: 0,
        presentCount: 0,
        ratePercent: null,
        formattedPercent: "Not Marked",
        isMarkedToday: false,
      };
    } else {
      const nonHolidays = todayAttendanceRows.filter((r) => r.status !== "HOLIDAY");
      const totalMarked = nonHolidays.length;
      const presentCount = nonHolidays.filter(
        (r) => r.status === "PRESENT" || r.status === "LATE"
      ).length;
      const ratePercent = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 1000) / 10 : 0;
      todayStudentAttendance = {
        totalMarked,
        presentCount,
        ratePercent,
        formattedPercent: `${ratePercent.toFixed(1)}%`,
        isMarkedToday: true,
      };
    }

    // Pending marks verifications
    const pendingExamVerificationsCount = pendingLocks.length;

    // Calculate staff attendance rate (OD3: null if 0 records exist for today)
    let staffAttendanceRate: PrincipalConsoleMetrics["staffAttendanceRate"] = null;
    if (todayStaffAttendanceRows.length > 0) {
      const totalStaff = todayStaffAttendanceRows.length;
      const presentStaff = todayStaffAttendanceRows.filter(
        (r) => r.status === "PRESENT" || r.status === "LATE"
      ).length;
      const staffRate = Math.round((presentStaff / totalStaff) * 1000) / 10;
      staffAttendanceRate = {
        totalMarked: totalStaff,
        presentCount: presentStaff,
        ratePercent: staffRate,
        formattedPercent: `${staffRate.toFixed(1)}%`,
      };
    }

    // ─── Build Approval Queue ──────────────────────────────────────────────
    const leaveTypeMap = new Map<string, string>(
      (leaveTypeRows as any[]).map((lt) => [lt.id, lt.name])
    );

    const pendingMarksApprovals: PrincipalPendingMarksApprovalItem[] = (pendingLocks as any[]).map(
      (lock) => ({
        id: lock.id,
        examId: lock.examId ?? "",
        examName: lock.exam?.name ?? "Examination",
        classId: lock.classId ?? "",
        className: lock.class?.displayName ?? "Class",
        subjectId: lock.subjectId ?? "",
        subjectName: lock.subject?.name ?? "Subject",
        submittedByName:
          (lock.submittedById ? staffNameByUserId.get(lock.submittedById) : undefined) ||
          lock.submittedBy?.email ||
          "Faculty",
        submittedAt: lock.submittedAt ? new Date(lock.submittedAt).toISOString() : null,
      })
    );

    const pendingStaffLeaves: PrincipalPendingStaffLeaveItem[] = (pendingStaffLeaveRows as any[]).map(
      (lr) => ({
        id: lr.id,
        staffId: lr.staffId,
        staffName: staffById.get(lr.staffId) ?? "Staff Member",
        leaveTypeName: leaveTypeMap.get(lr.leaveTypeId) ?? "Leave",
        startDate: new Date(lr.startDate).toISOString(),
        endDate: new Date(lr.endDate).toISOString(),
        totalDays: String(lr.totalDays ?? "1"),
        reason: lr.reason ?? "",
        status: lr.status,
      })
    );

    const pendingStudentLeaves: PrincipalPendingStudentLeaveItem[] = (
      pendingStudentLeaveRows as any[]
    ).map((sl) => {
      const sInfo = studentMap.get(sl.studentId);
      return {
        id: sl.id,
        studentId: sl.studentId,
        studentName: sInfo?.name ?? "Student",
        admissionNumber: sInfo?.admissionNumber ?? "",
        leaveType: sl.leaveType,
        startDate: new Date(sl.startDate).toISOString(),
        endDate: new Date(sl.endDate).toISOString(),
        reason: sl.reason ?? "",
      };
    });

    const pendingFeeConcessionsCount = (pendingConcessionsRows as any[]).length;
    const pendingFeeRefundsCount = (pendingRefundRows as any[]).length;
    const pendingFeeRefundsAmount = (pendingRefundRows as any[]).reduce(
      (sum, row) => sum + (Number(row.refundAmount) || 0),
      0
    );

    // ─── Build Oversight Telemetry ─────────────────────────────────────────
    const lockCountsByExam = new Map<
      string,
      { submittedCount: number; lockedCount: number; totalTrackedCount: number }
    >();
    for (const l of allLocksRows as any[]) {
      if (!l.examId) continue;
      const cur = lockCountsByExam.get(l.examId) ?? {
        submittedCount: 0,
        lockedCount: 0,
        totalTrackedCount: 0,
      };
      cur.totalTrackedCount += 1;
      if (l.status === "SUBMITTED") cur.submittedCount += 1;
      if (l.status === "LOCKED") cur.lockedCount += 1;
      lockCountsByExam.set(l.examId, cur);
    }

    const examProgress: PrincipalExamProgressItem[] = (recentExamsRows as any[]).map((ex) => {
      const counts = lockCountsByExam.get(ex.id) ?? {
        submittedCount: 0,
        lockedCount: 0,
        totalTrackedCount: 0,
      };
      return {
        id: ex.id,
        name: ex.name,
        startDate: new Date(ex.startDate).toISOString(),
        endDate: new Date(ex.endDate).toISOString(),
        isLocked: Boolean(ex.isLocked),
        submittedCount: counts.submittedCount,
        lockedCount: counts.lockedCount,
        totalTrackedCount: counts.totalTrackedCount,
      };
    });

    // Attendance exceptions today per active section
    const sectionAttendanceStats = new Map<string, { present: number; total: number }>();
    for (const row of todayAttendanceRows as any[]) {
      if (!row.sectionId || row.status === "HOLIDAY") continue;
      const cur = sectionAttendanceStats.get(row.sectionId) ?? { present: 0, total: 0 };
      cur.total += 1;
      if (row.status === "PRESENT" || row.status === "LATE") cur.present += 1;
      sectionAttendanceStats.set(row.sectionId, cur);
    }

    const unmarkedSectionNames: string[] = [];
    const lowAttendanceSections: {
      sectionId: string;
      sectionLabel: string;
      presentCount: number;
      totalMarked: number;
      ratePercent: number;
    }[] = [];

    for (const sec of activeSections as any[]) {
      if (!sec.id) continue;
      const label = sec.class?.displayName
        ? `${sec.class.displayName}${sec.name ? ` - ${sec.name}` : ""}`
        : sec.name || sec.id;
      const stats = sectionAttendanceStats.get(sec.id);
      if (!stats || stats.total === 0) {
        if (sec.name || sec.class?.displayName) {
          unmarkedSectionNames.push(label);
        }
      } else {
        const ratePercent = Math.round((stats.present / stats.total) * 1000) / 10;
        if (ratePercent < 75) {
          lowAttendanceSections.push({
            sectionId: sec.id,
            sectionLabel: label,
            presentCount: stats.present,
            totalMarked: stats.total,
            ratePercent,
          });
        }
      }
    }

    // Teacher absence & substitution coverage today
    const onLeaveStaffIds = Array.from(
      new Set((approvedLeaveTodayRows as any[]).map((r) => r.staffId).filter(Boolean))
    );
    const staffOnLeaveNames = onLeaveStaffIds.map((id) => staffById.get(id) ?? "Faculty");
    const pendingSubstitutionsCount = (todaySubstitutionsRows as any[]).filter(
      (s) => !s.substituteTeacherId || s.status === "PENDING"
    ).length;
    const coveredSubstitutionsCount = (todaySubstitutionsRows as any[]).filter(
      (s) => Boolean(s.substituteTeacherId) && s.status !== "PENDING" && s.status !== "CANCELLED"
    ).length;

    // Finance collections + dues aging
    let collectedToday = 0;
    let collectedLast30Days = 0;
    for (const p of recentPaymentsRows as any[]) {
      const amt = Number(p.amountPaid) || 0;
      collectedLast30Days += amt;
      const pd = new Date(p.paymentDate);
      if (pd >= startOfDay && pd <= endOfDay) {
        collectedToday += amt;
      }
    }

    let totalOutstanding = 0;
    const agingBuckets = {
      days0to30: 0,
      days31to60: 0,
      days61to90: 0,
      days90Plus: 0,
    };
    for (const inv of openInvoicesRows as any[]) {
      const bal = Number(inv.balanceAmount) || 0;
      if (bal <= 0) continue;
      totalOutstanding += bal;
      const due = new Date(inv.dueDate);
      const overdueDays = Math.floor((startOfDay.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
      if (overdueDays <= 30) agingBuckets.days0to30 += bal;
      else if (overdueDays <= 60) agingBuckets.days31to60 += bal;
      else if (overdueDays <= 90) agingBuckets.days61to90 += bal;
      else agingBuckets.days90Plus += bal;
    }

    // Syllabus pacing summary
    const totalTopics = (allLessonPlanRows as any[]).length;
    const completedTopics = (allLessonPlanRows as any[]).filter(
      (lp) => lp.status === "COMPLETED"
    ).length;
    const inProgressTopics = (allLessonPlanRows as any[]).filter(
      (lp) => lp.status === "IN_PROGRESS"
    ).length;
    const completionPercent =
      totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    // Grading SLA: ungraded submissions older than 7 days
    const totalUngradedCount = (ungradedSubmissionRows as any[]).length;
    const overdueUngradedCount = (ungradedSubmissionRows as any[]).filter((sub) => {
      if (!sub.submittedAt) return false;
      return new Date(sub.submittedAt) < sevenDaysAgo;
    }).length;

    return {
      activeSectionsCount,
      activeTeachingStaffCount,
      todayStudentAttendance,
      pendingExamVerificationsCount,
      staffAttendanceRate,
      approvalQueue: {
        pendingMarksApprovals,
        pendingStaffLeaves,
        pendingStudentLeaves,
        pendingFeeConcessionsCount,
        pendingFeeRefundsCount,
        pendingFeeRefundsAmount,
      },
      oversight: {
        examProgress,
        attendanceExceptions: {
          unmarkedSectionsCount: unmarkedSectionNames.length,
          unmarkedSectionNames: unmarkedSectionNames.slice(0, 12),
          lowAttendanceSections: lowAttendanceSections.slice(0, 8),
        },
        teacherCoverageToday: {
          onLeaveCount: onLeaveStaffIds.length,
          staffOnLeaveNames,
          pendingSubstitutionsCount,
          coveredSubstitutionsCount,
        },
        financeOverview: {
          collectedToday: Math.round(collectedToday * 100) / 100,
          collectedLast30Days: Math.round(collectedLast30Days * 100) / 100,
          totalOutstanding: Math.round(totalOutstanding * 100) / 100,
          agingBuckets: {
            days0to30: Math.round(agingBuckets.days0to30 * 100) / 100,
            days31to60: Math.round(agingBuckets.days31to60 * 100) / 100,
            days61to90: Math.round(agingBuckets.days61to90 * 100) / 100,
            days90Plus: Math.round(agingBuckets.days90Plus * 100) / 100,
          },
        },
        syllabusPacing: {
          totalTopics,
          completedTopics,
          inProgressTopics,
          completionPercent,
        },
        gradingSla: {
          overdueUngradedCount,
          totalUngradedCount,
        },
      },
    };
  });
}

// ─── 2. Librarian Operations Console Metrics ────────────────────────────────

export interface LibrarianConsoleMetrics {
  totalCopies: number;
  availableCopies: number;
  currentlyIssued: number;
  overdueCount: number;
  distinctCategoriesCount: number;
  topCategories: Array<{ category: string; count: number }>;
}

export async function getLibrarianConsoleMetrics(
  schoolId: string,
  options?: { now?: Date }
): Promise<LibrarianConsoleMetrics> {
  return await withTenant(schoolId, async (tenantDb) => {
    const now = options?.now ?? new Date();

    const [activeBooks, allIssues] = await Promise.all([
      // 1. Books and their physical copies
      tenantDb.query.books.findMany({
        where: and(eq(books.schoolId, schoolId), isNull(books.deletedAt)),
        columns: {
          id: true,
          totalCopies: true,
          availableCopies: true,
          category: true,
        },
        with: {
          copies: {
            where: isNull(bookCopies.deletedAt),
            columns: { id: true, isAvailable: true },
          },
        },
      }),

      // 2. Book checkout issues
      tenantDb.query.bookIssues.findMany({
        where: eq(bookIssues.schoolId, schoolId),
        columns: { id: true, status: true, dueDate: true, returnedAt: true },
      }),
    ]);

    // Total and available copies across inventory
    let totalCopies = 0;
    let availableCopies = 0;
    const categoryCountMap = new Map<string, number>();

    for (const b of activeBooks) {
      if (b.copies && b.copies.length > 0) {
        totalCopies += b.copies.length;
        availableCopies += b.copies.filter((c) => c.isAvailable).length;
      } else {
        totalCopies += b.totalCopies;
        availableCopies += b.availableCopies;
      }

      if (b.category && b.category.trim()) {
        const cat = b.category.trim();
        categoryCountMap.set(cat, (categoryCountMap.get(cat) || 0) + 1);
      }
    }

    // Active issues and overdue checkouts
    const activeIssues = allIssues.filter(
      (i) => !i.returnedAt && i.status !== "RETURNED" && i.status !== "LOST"
    );
    const currentlyIssued = activeIssues.length;

    const overdueCount = activeIssues.filter(
      (i) => new Date(i.dueDate).getTime() < now.getTime() || i.status === "OVERDUE"
    ).length;

    const distinctCategoriesCount = categoryCountMap.size;
    const topCategories = Array.from(categoryCountMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalCopies,
      availableCopies,
      currentlyIssued,
      overdueCount,
      distinctCategoriesCount,
      topCategories,
    };
  });
}

// ─── 3. Transport Operations Console Metrics ────────────────────────────────

export interface TransportConsoleMetrics {
  activeVehiclesCount: number;
  activeRoutesCount: number;
  pickupStopsCount: number;
  optedInStudentsCount: number;
  maintenanceAlertsCount: number;
  vehiclesWithMaintenanceAlert: Array<{
    vehicleId: string;
    busNumber: string;
    issue: string;
  }>;
  activeGpsVehiclesCount: number;
  gpsStatus: {
    hasActivePings: boolean;
    lastPingAt: Date | null;
    pingRecencyLabel: string;
  };
}

export async function getTransportConsoleMetrics(
  schoolId: string,
  options?: { now?: Date }
): Promise<TransportConsoleMetrics> {
  return await withTenant(schoolId, async (tenantDb) => {
    const now = options?.now ?? new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const [activeVehicles, activeRoutes, activePasses] = await Promise.all([
      // 1. Active vehicles
      tenantDb.query.vehicles.findMany({
        where: and(eq(vehicles.schoolId, schoolId), isNull(vehicles.deletedAt)),
        columns: {
          id: true,
          busNumber: true,
          registrationNumber: true,
          fitnessCertExpiryDate: true,
          insuranceExpiryDate: true,
          isActive: true,
        },
      }),

      // 2. Active routes with pickup stops
      tenantDb.query.routes.findMany({
        where: and(eq(routes.schoolId, schoolId), isNull(routes.deletedAt)),
        columns: { id: true, vehicleId: true, isActive: true },
        with: {
          stops: {
            columns: { id: true },
          },
        },
      }),

      // 3. Active student bus passes
      tenantDb.query.studentBusPasses.findMany({
        where: and(eq(studentBusPasses.schoolId, schoolId), eq(studentBusPasses.isActive, true)),
        columns: { id: true, studentId: true },
      }),
    ]);

    const activeVehiclesCount = activeVehicles.length;
    const activeRoutesCount = activeRoutes.length;
    const pickupStopsCount = activeRoutes.reduce((sum, r) => sum + (r.stops?.length ?? 0), 0);

    // Unique students opted into transport
    const optedInStudentsCount = new Set(activePasses.map((p) => p.studentId)).size;

    // Real maintenance alerts: expired or upcoming (<30d) fitness or insurance
    const vehiclesWithMaintenanceAlert: TransportConsoleMetrics["vehiclesWithMaintenanceAlert"] = [];
    for (const v of activeVehicles) {
      const issues: string[] = [];
      if (v.fitnessCertExpiryDate) {
        const fitDate = new Date(v.fitnessCertExpiryDate);
        if (fitDate < now) {
          issues.push("Fitness expired");
        } else if (fitDate < thirtyDaysFromNow) {
          issues.push("Fitness check due");
        }
      }
      if (v.insuranceExpiryDate) {
        const insDate = new Date(v.insuranceExpiryDate);
        if (insDate < now) {
          issues.push("Insurance expired");
        } else if (insDate < thirtyDaysFromNow) {
          issues.push("Insurance renewal due");
        }
      }

      if (issues.length > 0) {
        vehiclesWithMaintenanceAlert.push({
          vehicleId: v.id,
          busNumber: v.busNumber,
          issue: issues.join(", "),
        });
      }
    }
    const maintenanceAlertsCount = vehiclesWithMaintenanceAlert.length;

    // Real GPS telemetry recency per vehicle
    const vehicleIds = activeVehicles.map((v) => v.id);
    let latestPingAt: Date | null = null;
    let activeGpsVehiclesCount = 0;

    if (vehicleIds.length > 0) {
      const recentPings = await tenantDb.query.gpsPings.findMany({
        where: inArray(gpsPings.vehicleId, vehicleIds),
        orderBy: [desc(gpsPings.recordedAt)],
        limit: 50,
      });

      const activeGpsSet = new Set<string>();
      for (const p of recentPings) {
        const pDate = new Date(p.recordedAt);
        if (!latestPingAt || pDate > latestPingAt) {
          latestPingAt = pDate;
        }
        if (pDate >= fifteenMinsAgo) {
          activeGpsSet.add(p.vehicleId);
        }
      }
      activeGpsVehiclesCount = activeGpsSet.size;
    }

    let pingRecencyLabel = "No recent GPS signal";
    if (latestPingAt) {
      const diffMs = now.getTime() - latestPingAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) {
        pingRecencyLabel = "Live (just now)";
      } else if (diffMins < 60) {
        pingRecencyLabel = `Active (${diffMins}m ago)`;
      } else {
        const diffHours = Math.floor(diffMins / 60);
        pingRecencyLabel = `Last ping ${diffHours}h ago`;
      }
    }

    const gpsStatus = {
      hasActivePings: activeGpsVehiclesCount > 0,
      lastPingAt: latestPingAt,
      pingRecencyLabel,
    };

    return {
      activeVehiclesCount,
      activeRoutesCount,
      pickupStopsCount,
      optedInStudentsCount,
      maintenanceAlertsCount,
      vehiclesWithMaintenanceAlert,
      activeGpsVehiclesCount,
      gpsStatus,
    };
  });
}
