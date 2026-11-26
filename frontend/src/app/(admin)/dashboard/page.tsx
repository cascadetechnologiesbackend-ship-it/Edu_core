export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { db } from "@/db";
import {
  books,
  bookIssues,
  vehicles,
  routes,
  studentBusPasses,
  students,
  studentAttendance,
  sections,
  schools,
  academicYears,
  admissionApplications,
  feeInvoices,
  feePayments,
  leaveRequests,
  rightsRequests,
  assignments,
  lessonPlans,
} from "@/db/schema";
import { calculateSchoolProfileCompleteness } from "@/lib/profileCompleteness";
import { eq, and, isNull, sql, inArray, ne, or, gte, lt } from "drizzle-orm";
import { getCachedDashboardSummary, setCachedDashboardSummary } from "@/lib/dashboardCache";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import {
  Users,
  IndianRupee,
  CalendarCheck,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Bus,
  Shield,
  Book,
  UserCheck,
  CheckCircle,
  Info,
  Navigation,
  Sparkles,
} from "lucide-react";
import { OnboardingMetricBadge } from "@/components/telemetry/OnboardingMetricBadge";
import { getNorthStarMetricsSummary } from "@/lib/northStarTelemetry";

export const metadata: Metadata = {
  title: "Dashboard",
};

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: string;
  subtext?: string;
  trend?: { value: string; direction: "up" | "down" | "neutral" };
  icon: any;
  iconBgClass: string;
  accentColor: string;
}

function MetricCard({
  title,
  value,
  subtext,
  trend,
  icon: Icon,
  iconBgClass,
  accentColor,
}: MetricCardProps) {
  return (
    <div className="metric-card group relative overflow-hidden bg-card border border-border/40 p-5 sm:p-6 rounded-2xl shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1.5 tracking-tight truncate">
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{subtext}</p>
          )}
          {trend && (
            <div
              className={`inline-flex items-center gap-1 mt-2.5 px-2 py-0.5 rounded-full text-xs font-semibold ${trend.direction === "up"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : trend.direction === "down"
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-muted text-muted-foreground"
                }`}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="w-3 h-3" aria-hidden="true" />
              ) : trend.direction === "down" ? (
                <TrendingDown className="w-3 h-3" aria-hidden="true" />
              ) : null}
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        <div
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ml-3 sm:ml-4 shadow-xs ${iconBgClass}`}
        >
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${accentColor}`} aria-hidden="true" />
        </div>
      </div>
      <div
        className={`absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-300 ${accentColor.replace("text-", "bg-")}`}
      />
    </div>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

function QuickAction({
  label,
  href,
  className,
}: {
  label: string;
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold
                  transition-all duration-150 active:scale-[0.98] shadow-xs select-none ${className}`}
    >
      {label}
    </a>
  );
}

// ─── Dashboard Component Renderers ──────────────────────────────────────────

export default async function DashboardPage() {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch {
    redirect("/login");
  }

  const role = ctx.role;
  const access = assertRouteAccess(role, "/dashboard", { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = ctx.schoolId || "";
  const session = await auth();

  // Render dashboard layout based on the active role
  if (role === "TEACHER") {
    // ─── TEACHER DASHBOARD ───
    const activeTeacherSections = session?.user?.id
      ? await db.query.sections.findMany({
        where: eq(sections.classTeacherId, session.user.id),
      })
      : [];

    const sectionIds = activeTeacherSections.map((s) => s.id);
    const todayStr = new Date().toISOString().slice(0, 10);
    const [studentCountRow, markedCountRow, pendingAssignmentsRow, pendingLessonsRow] =
      sectionIds.length > 0 && schoolId
        ? await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(students)
            .where(
              and(
                eq(students.schoolId, schoolId),
                inArray(students.currentSectionId, sectionIds),
                eq(students.isActive, true)
              )
            ),
          db
            .select({ count: sql<number>`count(distinct ${studentAttendance.studentId})::int` })
            .from(studentAttendance)
            .where(
              and(
                eq(studentAttendance.schoolId, schoolId),
                inArray(studentAttendance.sectionId, sectionIds),
                gte(studentAttendance.attendanceDate, new Date(todayStr))
              )
            ),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(assignments)
            .where(
              and(
                eq(assignments.schoolId, schoolId),
                eq(assignments.createdByTeacherId, ctx.userId),
                eq(assignments.status, "PUBLISHED"),
                isNull(assignments.deletedAt)
              )
            ),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(lessonPlans)
            .where(
              and(
                eq(lessonPlans.schoolId, schoolId),
                eq(lessonPlans.teacherId, ctx.userId),
                inArray(lessonPlans.status, ["PLANNED", "IN_PROGRESS"]),
                isNull(lessonPlans.deletedAt)
              )
            ),
        ])
        : [[{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }]];

    const activePublishedAssignments = pendingAssignmentsRow[0]?.count ?? 0;
    const activeLessonPlansCount = pendingLessonsRow[0]?.count ?? 0;

    const totalStudentsUnderCare = studentCountRow[0]?.count ?? 0;
    const markedTodayCount = markedCountRow[0]?.count ?? 0;
    const attendancePct =
      totalStudentsUnderCare > 0
        ? `${Math.round((markedTodayCount / totalStudentsUnderCare) * 100)}%`
        : "0%";

    const metrics = [
      {
        title: "Assigned Classrooms",
        value: activeTeacherSections.length.toString(),
        subtext:
          activeTeacherSections.map((s) => s.name).join(", ") ||
          "No homeroom assigned",
        icon: UserCheck,
        iconBgClass: "bg-primary/10",
        accentColor: "text-primary",
      },
      {
        title: "Total Students under care",
        value: totalStudentsUnderCare.toString(),
        subtext: "Active enrolled students",
        icon: Users,
        iconBgClass: "bg-secondary/10",
        accentColor: "text-secondary",
      },
      {
        title: "Marked Attendance today",
        value: attendancePct,
        subtext: `${markedTodayCount} of ${totalStudentsUnderCare} marked`,
        icon: CalendarCheck,
        iconBgClass: "bg-warning/20",
        accentColor: "text-warning",
      },
    ];

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back, Teacher 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage your classrooms, student attendance, and homework
              assignments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <QuickAction
              label="Mark Attendance"
              href="/attendance"
              className="bg-primary text-white hover:bg-primary/90"
            />
            <QuickAction
              label="Academics Master"
              href="/academics"
              className="bg-secondary/10 text-secondary hover:bg-secondary/20"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <MetricCard key={m.title} {...m} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" /> Active Tasks
            </h2>
            {activePublishedAssignments === 0 && activeLessonPlansCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pending published assignments or uncompleted lesson plans.
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {activePublishedAssignments > 0 && (
                  <li className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <a href="/teacher/grading" className="hover:underline">
                      {activePublishedAssignments} active published assignment{activePublishedAssignments === 1 ? "" : "s"} to grade
                    </a>
                    <span className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded font-semibold">
                      {activePublishedAssignments}
                    </span>
                  </li>
                )}
                {activeLessonPlansCount > 0 && (
                  <li className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                    <a href="/teacher/classes" className="hover:underline">
                      {activeLessonPlansCount} planned or in-progress lesson plan{activeLessonPlansCount === 1 ? "" : "s"}
                    </a>
                    <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded font-semibold">
                      {activeLessonPlansCount}
                    </span>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (role === "LIBRARIAN") {
    // ─── LIBRARIAN DASHBOARD ───
    const booksCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(eq(books.schoolId, schoolId));
    const activeIssues = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookIssues)
      .where(
        and(eq(bookIssues.schoolId, schoolId), eq(bookIssues.status, "ISSUED")),
      );
    const overdueIssues = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookIssues)
      .where(
        and(
          eq(bookIssues.schoolId, schoolId),
          isNull(bookIssues.returnedAt),
          ne(bookIssues.status, "RETURNED"),
          ne(bookIssues.status, "LOST"),
          or(eq(bookIssues.status, "OVERDUE"), lt(bookIssues.dueDate, new Date())),
        ),
      );

    const metrics = [
      {
        title: "Total Catalog Books",
        value: (booksCount[0]?.count || 0).toString(),
        subtext: "Volumes registered in system",
        icon: Book,
        iconBgClass: "bg-primary/10",
        accentColor: "text-primary",
      },
      {
        title: "Issued Books",
        value: (activeIssues[0]?.count || 0).toString(),
        subtext: "Books out with students/staff",
        icon: BookOpen,
        iconBgClass: "bg-secondary/10",
        accentColor: "text-secondary",
      },
      {
        title: "Overdue Books",
        value: (overdueIssues[0]?.count || 0).toString(),
        subtext: "Past due date across active issues",
        icon: AlertCircle,
        iconBgClass: "bg-danger/10",
        accentColor: "text-danger",
      },
    ];

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Library Dashboard 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage book inventories, member cards, and fine collections.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <QuickAction
              label="Library Directory"
              href="/library"
              className="bg-primary text-white hover:bg-primary/90"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <MetricCard key={m.title} {...m} />
          ))}
        </div>
      </div>
    );
  }

  if (role === "TRANSPORT_MANAGER") {
    // ─── TRANSPORT MANAGER DASHBOARD ───
    const vehiclesCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(vehicles)
      .where(eq(vehicles.schoolId, schoolId));
    const routesCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(routes)
      .where(eq(routes.schoolId, schoolId));
    const activePasses = await db
      .select({ count: sql<number>`count(*)` })
      .from(studentBusPasses)
      .where(
        and(
          eq(studentBusPasses.schoolId, schoolId),
          eq(studentBusPasses.isActive, true),
        ),
      );

    const metrics = [
      {
        title: "Registered Buses",
        value: (vehiclesCount[0]?.count || 0).toString(),
        subtext: "Driver & Conductor encrypted",
        icon: Bus,
        iconBgClass: "bg-primary/10",
        accentColor: "text-primary",
      },
      {
        title: "Total Routes",
        value: (routesCount[0]?.count || 0).toString(),
        subtext: "Mapped locations & stops",
        icon: Navigation,
        iconBgClass: "bg-secondary/10",
        accentColor: "text-secondary",
      },
      {
        title: "Issued Bus Passes",
        value: (activePasses[0]?.count || 0).toString(),
        subtext: "DPDP Consent verified",
        icon: Shield,
        iconBgClass: "bg-warning/20",
        accentColor: "text-warning",
      },
    ];

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Transport Directory 👋
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Live bus simulations, route maps, and student mappings.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <QuickAction
              label="Transport Panel"
              href="/transport"
              className="bg-primary text-white hover:bg-primary/90"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <MetricCard key={m.title} {...m} />
          ))}
        </div>
      </div>
    );
  }

  // ─── ADMIN / PRINCIPAL / SCHOOL_ADMIN DASHBOARD ───
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );

  // Re-use cached school from requireSchool gracefully
  let school: any = null;
  if (ctx.schoolId) {
    try {
      school = await requireSchool(ctx);
    } catch (e) {
      console.warn("DashboardPage: requireSchool fallback", e);
      school = await db.query.schools.findFirst({
        where: eq(schools.id, ctx.schoolId),
      }).catch(() => null);
    }
  }

  interface AdminDashboardSummary {
    activeYearLabel: string;
    totalStudents: number;
    attendancePercent: string;
    attendanceSubtext: string;
    feeCollectedTodayStr: string;
    feeCollectedSubtext: string;
    outstandingDuesStr: string;
    outstandingSubtext: string;
    newAdmissionsToday: number;
    attendanceTrend30d: Array<{
      date: string;
      present: number;
      total: number;
      rate: number;
    }>;
    pendingTasks: Array<{
      label: string;
      href: string;
      urgency: "warning" | "danger" | "info";
    }>;
    examLifecycle?: {
      pendingMarksLocks: number;
      activeAdmitCardExams: number;
      releasedResultExams: number;
      ongoingExams: number;
    };
  }

  // Measure data phase with Server-Timing p95 budget (PF-R00 / PF-R80)
  const summary: AdminDashboardSummary = await withDataPhaseTiming("/dashboard", async () => {
    if (!schoolId) {
      return {
        activeYearLabel: "2025-26",
        totalStudents: 0,
        attendancePercent: "Not Marked",
        attendanceSubtext: "No attendance recorded today",
        feeCollectedTodayStr: "₹0",
        feeCollectedSubtext: "0 transactions today",
        outstandingDuesStr: "₹0",
        outstandingSubtext: "No outstanding dues",
        newAdmissionsToday: 0,
        attendanceTrend30d: [],
        pendingTasks: [],
        examLifecycle: {
          pendingMarksLocks: 0,
          activeAdmitCardExams: 0,
          releasedResultExams: 0,
          ongoingExams: 0,
        },
      };
    }

    // 1. S2 Cache Check (5-min jittered TTL, tenant-isolated key t:{schoolId}:v1:dashboard_summary)
    const cached = await getCachedDashboardSummary<AdminDashboardSummary>(schoolId);
    if (cached) {
      return cached;
    }

    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);

    // 2. Cache Miss: Execute consolidated Promise.all
    const [
      activeYear,
      consolidatedCountsRaw,
      todayAttendance,
      todayFeePayments,
      outstandingInvoices,
      trendRowsRaw,
    ] = await Promise.all([
      // Query 1: Active Academic Year
      db.query.academicYears.findFirst({
        where: and(
          eq(academicYears.schoolId, schoolId),
          eq(academicYears.isActive, true),
        ),
      }),

      // Query 2: Consolidated Rollup Counts (students, admissions, leaves, rights, exam lifecycle) in 1 roundtrip
      db.execute(sql`
        SELECT 
          (SELECT count(*) FROM students WHERE school_id = ${schoolId})::int as total_students,
          (SELECT count(*) FROM admission_applications WHERE school_id = ${schoolId} AND status IN ('APPLIED', 'SCREENING'))::int as pending_admissions,
          (SELECT count(*) FROM students WHERE school_id = ${schoolId} AND created_at >= ${startOfDay} AND created_at <= ${endOfDay})::int as new_admissions_today,
          (SELECT count(*) FROM leave_requests WHERE school_id = ${schoolId} AND status = 'PENDING')::int as pending_leaves,
          (SELECT count(*) FROM rights_requests WHERE school_id = ${schoolId} AND status IN ('SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS'))::int as pending_rights,
          (SELECT count(*) FROM exam_marks_locks WHERE school_id = ${schoolId} AND status = 'SUBMITTED')::int as pending_marks_locks,
          (SELECT count(DISTINCT exam_id) FROM exam_admit_card_settings WHERE school_id = ${schoolId} AND is_released = true)::int as active_admit_card_exams,
          (SELECT count(*) FROM result_settings WHERE school_id = ${schoolId} AND release_at <= NOW())::int as released_result_exams,
          (SELECT count(*) FROM exams WHERE school_id = ${schoolId} AND deleted_at IS NULL AND start_date <= NOW() AND end_date >= NOW())::int as ongoing_exams
      `),

      // Query 3: Today's Student Attendance Grouped by Status
      db
        .select({
          status: studentAttendance.status,
          count: sql<number>`count(*)`,
        })
        .from(studentAttendance)
        .where(
          and(
            eq(studentAttendance.schoolId, schoolId),
            sql`${studentAttendance.attendanceDate} >= ${startOfDay} AND ${studentAttendance.attendanceDate} <= ${endOfDay}`,
            or(isNull(studentAttendance.source), ne(studentAttendance.source, "EXAM")),
          ),
        )
        .groupBy(studentAttendance.status),

      // Query 4: Today's Fee Collections
      db
        .select({
          totalAmount: sql<string>`COALESCE(SUM(${feePayments.amountPaid}), 0)`,
          txCount: sql<number>`count(*)`,
        })
        .from(feePayments)
        .where(
          and(
            eq(feePayments.schoolId, schoolId),
            sql`${feePayments.paymentDate} >= ${startOfDay} AND ${feePayments.paymentDate} <= ${endOfDay}`,
          ),
        ),

      // Query 5: Outstanding Invoices & Overdue Rollup
      db
        .select({
          totalBalance: sql<string>`COALESCE(SUM(${feeInvoices.balanceAmount}), 0)`,
          overdueCount: sql<number>`count(CASE WHEN ${feeInvoices.status} = 'OVERDUE' THEN 1 END)`,
        })
        .from(feeInvoices)
        .where(
          and(
            eq(feeInvoices.schoolId, schoolId),
            inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"]),
          ),
        ),

      // Query 6: 30-day Attendance Trend
      db
        .select({
          day: sql<string>`TO_CHAR(${studentAttendance.attendanceDate}::date, 'YYYY-MM-DD')`,
          total: sql<number>`count(*)::int`,
          present: sql<number>`count(CASE WHEN ${studentAttendance.status} IN ('PRESENT', 'LATE', 'HALF_DAY') THEN 1 END)::int`,
        })
        .from(studentAttendance)
        .where(
          and(
            eq(studentAttendance.schoolId, schoolId),
            gte(studentAttendance.attendanceDate, thirtyDaysAgo),
            ne(studentAttendance.status, "HOLIDAY"),
            or(isNull(studentAttendance.source), ne(studentAttendance.source, "EXAM")),
          ),
        )
        .groupBy(sql`${studentAttendance.attendanceDate}::date`)
        .orderBy(sql`${studentAttendance.attendanceDate}::date`),
    ]);

    // Parse counts from Query 2
    const countsRow = ((consolidatedCountsRaw as any)?.rows && (consolidatedCountsRaw as any).rows[0]) || (consolidatedCountsRaw as any)[0] || {};
    const totalStudents = Number(countsRow.total_students || 0);
    const pendingAdmissionsCount = Number(countsRow.pending_admissions || 0);
    const newAdmissionsToday = Number(countsRow.new_admissions_today || 0);
    const pendingLeavesCount = Number(countsRow.pending_leaves || 0);
    const pendingRightsCount = Number(countsRow.pending_rights || 0);
    const pendingMarksLocksCount = Number(countsRow.pending_marks_locks || 0);
    const activeAdmitCardExamsCount = Number(countsRow.active_admit_card_exams || 0);
    const releasedResultExamsCount = Number(countsRow.released_result_exams || 0);
    const ongoingExamsCount = Number(countsRow.ongoing_exams || 0);

    // Compute attendance metrics
    let totalMarkedToday = 0;
    let presentToday = 0;
    for (const row of todayAttendance) {
      const c = Number(row.count) || 0;
      totalMarkedToday += c;
      if (
        row.status === "PRESENT" ||
        row.status === "LATE" ||
        row.status === "HALF_DAY"
      ) {
        presentToday += c;
      }
    }

    const attendancePercent =
      totalMarkedToday > 0
        ? `${Math.round((presentToday / totalMarkedToday) * 100)}%`
        : "Not Marked";
    const attendanceSubtext =
      totalMarkedToday > 0
        ? `${presentToday} of ${totalMarkedToday} marked present`
        : "No attendance recorded today";

    // Compute fee metrics
    const feeCollectedTodayNum = Number(todayFeePayments[0]?.totalAmount || 0);
    const feeTxCount = Number(todayFeePayments[0]?.txCount || 0);
    const feeCollectedTodayStr = `₹${feeCollectedTodayNum.toLocaleString("en-IN")}`;
    const feeCollectedSubtext =
      feeTxCount > 0
        ? `${feeTxCount} transaction${feeTxCount === 1 ? "" : "s"} today`
        : "0 transactions today";

    const outstandingDuesNum = Number(outstandingInvoices[0]?.totalBalance || 0);
    const overdueCount = Number(outstandingInvoices[0]?.overdueCount || 0);
    const outstandingDuesStr = `₹${outstandingDuesNum.toLocaleString("en-IN")}`;
    const outstandingSubtext =
      overdueCount > 0
        ? `${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"}`
        : outstandingDuesNum > 0
          ? "Pending balance"
          : "No outstanding dues";

    // Build pending tasks
    const pendingTasksList: Array<{
      label: string;
      href: string;
      urgency: "warning" | "danger" | "info";
    }> = [];

    if (newAdmissionsToday > 0) {
      pendingTasksList.push({
        label: `${newAdmissionsToday} new student admission${newAdmissionsToday === 1 ? "" : "s"} enrolled today`,
        href: "/students",
        urgency: "info",
      });
    }

    if (pendingMarksLocksCount > 0) {
      pendingTasksList.push({
        label: `${pendingMarksLocksCount} class-subject marks submission${pendingMarksLocksCount === 1 ? "" : "s"} awaiting final lock`,
        href: "/exams/marks",
        urgency: "warning",
      });
    }

    if (pendingAdmissionsCount > 0) {
      pendingTasksList.push({
        label: `${pendingAdmissionsCount} admission application${pendingAdmissionsCount === 1 ? "" : "s"} pending review`,
        href: "/admissions",
        urgency: "warning",
      });
    }

    if (pendingLeavesCount > 0) {
      pendingTasksList.push({
        label: `${pendingLeavesCount} staff leave request${pendingLeavesCount === 1 ? "" : "s"} awaiting approval`,
        href: "/hr",
        urgency: "warning",
      });
    }

    if (overdueCount > 0) {
      pendingTasksList.push({
        label: `${overdueCount} student fee invoice${overdueCount === 1 ? "" : "s"} overdue`,
        href: "/fees",
        urgency: "danger",
      });
    }

    if (pendingRightsCount > 0) {
      pendingTasksList.push({
        label: `${pendingRightsCount} DPDP rights request${pendingRightsCount === 1 ? "" : "s"} awaiting response`,
        href: "/dpdp",
        urgency: "danger",
      });
    }

    const attendanceTrend30d = (trendRowsRaw || []).map((row) => {
      const total = Number(row.total || 0);
      const present = Number(row.present || 0);
      return {
        date: row.day,
        present,
        total,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    });

    const calculatedSummary: AdminDashboardSummary = {
      activeYearLabel: activeYear?.label || "2025-26",
      totalStudents,
      attendancePercent,
      attendanceSubtext,
      feeCollectedTodayStr,
      feeCollectedSubtext,
      outstandingDuesStr,
      outstandingSubtext,
      newAdmissionsToday,
      attendanceTrend30d,
      pendingTasks: pendingTasksList,
      examLifecycle: {
        pendingMarksLocks: pendingMarksLocksCount,
        activeAdmitCardExams: activeAdmitCardExamsCount,
        releasedResultExams: releasedResultExamsCount,
        ongoingExams: ongoingExamsCount,
      },
    };

    // Store in S2 Cache with jittered 5-min TTL
    await setCachedDashboardSummary(schoolId, calculatedSummary);

    return calculatedSummary;
  });

  const metrics = [
    {
      title: "Total Enrolment",
      value: summary.totalStudents.toLocaleString(),
      subtext: summary.totalStudents > 0 ? "Active Enrolled Students" : "No students enrolled yet",
      icon: Users,
      iconBgClass: "bg-primary/10",
      accentColor: "text-primary",
    },
    {
      title: "Today's Attendance",
      value: summary.attendancePercent,
      subtext: summary.attendanceSubtext,
      icon: CalendarCheck,
      iconBgClass: "bg-secondary/10",
      accentColor: "text-secondary",
    },
    {
      title: "Fee Collected Today",
      value: summary.feeCollectedTodayStr,
      subtext: summary.feeCollectedSubtext,
      icon: IndianRupee,
      iconBgClass: "bg-warning/20",
      accentColor: "text-warning",
    },
    {
      title: "Outstanding Dues",
      value: summary.outstandingDuesStr,
      subtext: summary.outstandingSubtext,
      icon: AlertCircle,
      iconBgClass: "bg-danger/10",
      accentColor: "text-danger",
    },
  ];

  const schoolCompleteness = school
    ? calculateSchoolProfileCompleteness({
      name: school.name,
      address: school.address,
      city: school.city,
      state: school.state,
      pincode: school.pincode,
      phone: school.phone,
      email: school.email,
      principalName: school.principalName,
      establishedYear: school.establishedYear,
      board: school.board,
      udiseCode: school.udiseCode,
      logoS3Key: school.logoS3Key,
      themeColors: school.themeColors,
      website: school.website,
      motto: school.motto,
      about: school.about,
      socialHandles: school.socialHandles,
    })
    : null;

  // D1-L1: Truthful north-star metric readout
  const northStarSummary = await getNorthStarMetricsSummary(schoolId).catch(() => null);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Good morning, {session?.user?.name || "Admin"} 👋
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 leading-relaxed">
            {school?.name || "School ERP"} — Academic Year {summary.activeYearLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar -mx-3 sm:mx-0 px-3 sm:px-0 py-1">
          <QuickAction
            label="+ Add Student"
            href="/admissions"
            className="bg-semantic-interactive hover:bg-semantic-interactive/90 text-white flex-shrink-0 shadow-sm rounded-xl"
          />
          <QuickAction
            label="Collect Fee"
            href="/fees"
            className="bg-semantic-interactive/12 text-semantic-interactive hover:bg-semantic-interactive/18 flex-shrink-0 rounded-xl"
          />
          <QuickAction
            label="Mark Attendance"
            href="/attendance"
            className="bg-muted/60 hover:bg-muted text-foreground flex-shrink-0 rounded-xl"
          />
        </div>
      </div>

      {/* North-Star Onboarding Clock Readout (D1-L1) */}
      {northStarSummary && (
        <OnboardingMetricBadge
          summary={northStarSummary.onboardingDays}
          variant="banner"
        />
      )}

      {/* New Admissions Enrolled Today Card (S13 Layer 8) */}
      {summary.newAdmissionsToday > 0 && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/20 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-extrabold text-base shrink-0">
              +{summary.newAdmissionsToday}
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>New Admissions Enrolled Today</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                  Lifecycle Active
                </span>
              </h3>
              <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                {summary.newAdmissionsToday} student{summary.newAdmissionsToday === 1 ? "" : "s"} admitted and provisioned with mandatory subject enrollments, fee structures, and parent portal access.
              </p>
            </div>
          </div>
          <a
            href="/students"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition whitespace-nowrap self-stretch sm:self-auto text-center"
          >
            View in Directory →
          </a>
        </div>
      )}

      {/* School Profile Completeness Alert Card */}
      {schoolCompleteness && schoolCompleteness.percent < 90 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 flex items-center justify-center font-extrabold text-base shrink-0">
              {schoolCompleteness.percent}%
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>School Profile Incomplete ({schoolCompleteness.percent}%)</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                  Action Required
                </span>
              </h3>
              <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                Missing: {schoolCompleteness.missing.slice(0, 2).join(", ")}
                {schoolCompleteness.missing.length > 2
                  ? ` and ${schoolCompleteness.missing.length - 2} more`
                  : ""}
                . Setup your official logo, digital presence, and accreditation.
              </p>
            </div>
          </div>
          <a
            href="/settings/school-setup"
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm transition whitespace-nowrap self-stretch sm:self-auto text-center"
          >
            Complete Profile →
          </a>
        </div>
      )}

      {/* Metric Cards */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">
          Key Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div key={metric.title} className="relative overflow-hidden">
              <MetricCard {...metric} />
            </div>
          ))}
        </div>
      </section>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trend Chart */}
        <div className="lg:col-span-2 bg-card rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">
              Attendance Trend — Last 30 Days
            </h2>
            <a
              href="/attendance"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Open Attendance &rarr;
            </a>
          </div>
          {summary.attendanceTrend30d && summary.attendanceTrend30d.length > 0 ? (
            <div className="space-y-3">
              <div className="h-40 flex items-end gap-1.5 bg-muted/20 rounded-xl p-3 overflow-x-auto">
                {summary.attendanceTrend30d.slice(-14).map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.rate}% (${d.present}/${d.total})`}
                    className="flex-1 min-w-[18px] flex flex-col items-center justify-end gap-1 h-full"
                  >
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {d.rate}%
                    </span>
                    <div
                      className="w-full rounded-t-md bg-primary/80 transition-all"
                      style={{ height: `${Math.max(8, d.rate)}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {d.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Showing {Math.min(14, summary.attendanceTrend30d.length)} recorded instructional days out of the last 30 days.
              </p>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center bg-muted/30 rounded-lg text-center px-4">
              <CalendarCheck className="w-7 h-7 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground">
                No attendance recorded in the last 30 days
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Daily roll-call bars will appear here once attendance is marked.
              </p>
            </div>
          )}
        </div>

        {/* Pending Tasks */}
        <div className="bg-card rounded-xl border p-6">
          <h2 className="font-semibold text-foreground mb-4">Pending Tasks</h2>
          {summary.pendingTasks.length > 0 ? (
            <ul className="space-y-3" role="list" aria-label="Pending tasks">
              {summary.pendingTasks.map((task) => (
                <li key={task.label}>
                  <a
                    href={task.href}
                    className={`flex items-start gap-2 text-sm hover:underline p-2 rounded-lg transition-colors ${task.urgency === "danger"
                      ? "text-danger hover:bg-danger/10"
                      : task.urgency === "warning"
                        ? "text-warning hover:bg-warning/10"
                        : "text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    <AlertCircle
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {task.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
              <p className="text-sm font-medium text-foreground">
                All caught up!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                No pending tasks or urgent reviews require your attention.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Examination Lifecycle Command Card */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase tracking-wide">
                  Cross-Module Engine
                </span>
                <span className="text-xs text-muted-foreground font-semibold">
                  Examination Lifecycle &amp; Release Control
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground mt-0.5">
                Active Assessment Operations
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/exams/schedule"
              className="px-3.5 py-1.5 rounded-xl border border-border bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold transition flex items-center gap-1.5"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-indigo-500" />
              Datesheets
            </a>
            <a
              href="/exams/marks"
              className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Review Marks
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/80">
          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <span className="text-[11px] text-muted-foreground font-medium block">
              Ongoing Exam Cycles
            </span>
            <strong className="text-base font-bold text-foreground mt-0.5 block">
              {summary.examLifecycle?.ongoingExams || 0}
            </strong>
            <span className="text-[10px] text-muted-foreground">Active in school calendar</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <span className="text-[11px] text-muted-foreground font-medium block">
              Marks Awaiting Lock
            </span>
            <strong className={`text-base font-bold mt-0.5 block ${(summary.examLifecycle?.pendingMarksLocks || 0) > 0 ? "text-amber-500" : "text-foreground"
              }`}>
              {summary.examLifecycle?.pendingMarksLocks || 0}
            </strong>
            <span className="text-[10px] text-muted-foreground">Class-subject marksheets</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <span className="text-[11px] text-muted-foreground font-medium block">
              Admit Cards Live
            </span>
            <strong className="text-base font-bold text-foreground mt-0.5 block">
              {summary.examLifecycle?.activeAdmitCardExams || 0}
            </strong>
            <span className="text-[10px] text-muted-foreground">Fee-gated portal release</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border">
            <span className="text-[11px] text-muted-foreground font-medium block">
              Results Published
            </span>
            <strong className="text-base font-bold text-emerald-500 mt-0.5 block">
              {summary.examLifecycle?.releasedResultExams || 0}
            </strong>
            <span className="text-[10px] text-muted-foreground">Report cards accessible</span>
          </div>
        </div>
      </div>

      {/* DPDP Compliance Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-primary font-bold text-sm">🔒</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            DPDP Act 2023 Compliance Status
          </p>
          <p className="text-xs text-muted-foreground">
            All student data processing is consent-gated.
          </p>
        </div>
        <a
          href="/dpdp"
          className="text-xs text-primary font-medium hover:underline flex-shrink-0"
        >
          View Dashboard →
        </a>
      </div>
    </div>
  );
}
