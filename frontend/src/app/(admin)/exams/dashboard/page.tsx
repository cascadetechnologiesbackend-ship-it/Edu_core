import { db } from "@/db";
import {
  exams,
  academicYears,
  examTypes,
  examSchedules,
  examMarksLocks,
  resultSettings,
  reportCardSetups,
  schools,
  studentAttendance,
  classes,
  subjects,
} from "@/db/schema";
import { BoardTermPlanCard } from "./BoardTermPlanCard";
import { ExamAttendanceTrendCard, type ExamAttendanceMetricItem } from "./ExamAttendanceTrendCard";
import { eq, and, sql, lte } from "drizzle-orm";
import Link from "next/link";
import {
  Calendar,
  Lock,
  FileCheck2,
  GraduationCap,
  PlusCircle,
  Clock,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Award,
  SlidersHorizontal,
  Activity,
} from "lucide-react";
import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";

export const metadata: Metadata = {
  title: "Exams Dashboard | SchoolMitra ERP",
  description: "Six-stage examination lifecycle operations command center",
};

export default async function ExamsDashboardPage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/exams", {
    id: ctx.userId,
    email: ctx.email,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = ctx.schoolId || "";

  const data = await withDataPhaseTiming("/exams/dashboard", async () => {
    return assertQueryBudget(
      async () => {
        const activeYear = await db.query.academicYears.findFirst({
          where: and(
            eq(academicYears.schoolId, schoolId),
            eq(academicYears.isActive, true),
          ),
        });

        if (!activeYear) {
          return {
            activeYear: null,
            board: "CBSE",
            hasBoardDefaults: false,
            examsList: [],
            totalSchedules: 0,
            lockedMarksCount: 0,
            releasedResultsCount: 0,
            attendanceTrendMetrics: [],
            totalAbsents: 0,
            totalLeaves: 0,
            totalPresent: 0,
          };
        }

        const [
          examsList,
          schedulesCountRes,
          locksCountRes,
          releasedRes,
          schoolRow,
          examTypesCountRes,
          examAttendanceRes,
        ] = await Promise.all([
          db.query.exams.findMany({
            where: and(
              eq(exams.schoolId, schoolId),
              eq(exams.academicYearId, activeYear.id),
            ),
            with: {
              examType: true,
              classScopes: {
                with: {
                  class: true,
                },
              },
            },
            orderBy: (t, { desc }) => [desc(t.startDate)],
          }),
          db
            .select({ count: sql<number>`count(*)` })
            .from(examSchedules)
            .where(eq(examSchedules.schoolId, schoolId)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(examMarksLocks)
            .where(
              and(
                eq(examMarksLocks.schoolId, schoolId),
                eq(examMarksLocks.status, "LOCKED"),
              ),
            ),
          db
            .select({ count: sql<number>`count(*)` })
            .from(resultSettings)
            .where(
              and(
                eq(resultSettings.schoolId, schoolId),
                lte(resultSettings.releaseAt, new Date()),
              ),
            ),
          db.query.schools.findFirst({
            where: eq(schools.id, schoolId),
            columns: { board: true },
          }),
          db
            .select({ count: sql<number>`count(*)` })
            .from(examTypes)
            .where(
              and(eq(examTypes.schoolId, schoolId), eq(examTypes.isActive, true)),
            ),
          db
            .select({
              status: studentAttendance.status,
              examName: exams.name,
              className: classes.displayName,
              subjectName: subjects.name,
              examDate: examSchedules.examDate,
            })
            .from(studentAttendance)
            .leftJoin(
              examSchedules,
              eq(studentAttendance.examScheduleId, examSchedules.id),
            )
            .leftJoin(exams, eq(examSchedules.examId, exams.id))
            .leftJoin(classes, eq(examSchedules.classId, classes.id))
            .leftJoin(subjects, eq(examSchedules.subjectId, subjects.id))
            .where(
              and(
                eq(studentAttendance.schoolId, schoolId),
                eq(studentAttendance.source, "EXAM"),
              ),
            )
            .limit(100),
        ]);

        let totalAbsents = 0;
        let totalLeaves = 0;
        let totalPresent = 0;
        const trendMap = new Map<string, ExamAttendanceMetricItem>();

        for (const row of examAttendanceRes) {
          if (row.status === "ABSENT") totalAbsents++;
          else if (row.status === "LEAVE") totalLeaves++;
          else if (row.status === "PRESENT") totalPresent++;

          const key = `${row.examName || "Exam"}::${row.className || "Class"}::${row.subjectName || "Subject"}`;
          const existing = trendMap.get(key) || {
            examName: row.examName || "Exam",
            className: row.className || "Class",
            subjectName: row.subjectName || "Subject",
            examDate: row.examDate ? String(row.examDate) : "Scheduled",
            absentCount: 0,
            leaveCount: 0,
            presentCount: 0,
          };

          if (row.status === "ABSENT") existing.absentCount++;
          else if (row.status === "LEAVE") existing.leaveCount++;
          else if (row.status === "PRESENT") existing.presentCount++;

          trendMap.set(key, existing);
        }

        return {
          activeYear,
          board: schoolRow?.board || "CBSE",
          hasBoardDefaults: Number(examTypesCountRes[0]?.count || 0) > 0,
          examsList,
          totalSchedules: Number(schedulesCountRes[0]?.count || 0),
          lockedMarksCount: Number(locksCountRes[0]?.count || 0),
          releasedResultsCount: Number(releasedRes[0]?.count || 0),
          attendanceTrendMetrics: Array.from(trendMap.values()),
          totalAbsents,
          totalLeaves,
          totalPresent,
        };
      },
      { maxQueries: 10, label: "Exams Dashboard KPIs" },
    );
  });

  const {
    activeYear,
    board,
    hasBoardDefaults,
    examsList,
    totalSchedules,
    lockedMarksCount,
    releasedResultsCount,
    attendanceTrendMetrics,
    totalAbsents,
    totalLeaves,
    totalPresent,
  } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header and Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
            <GraduationCap className="w-4 h-4" />
            <span>Academic Assessment Engine</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Examinations Operations
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Active Year:{" "}
            <span className="font-semibold text-gray-700 dark:text-slate-300">
              {activeYear?.label ?? "No active academic year configured"}
            </span>{" "}
            • Six-stage assessment lifecycle management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/exams/usage"
            data-ux-id="btn_view_usage"
            data-ux-label="Usage & Heat Map"
            className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 px-3.5 py-2.5 rounded-lg font-medium text-sm transition-all"
          >
            <Activity className="w-4 h-4 text-emerald-500" />
            <span>Usage & Heat Map</span>
          </Link>
          <Link
            href="/exams/manage"
            data-ux-id="btn_quick_create_exam"
            data-ux-label="New Exam Setup"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm shadow-indigo-200 dark:shadow-none hover:shadow"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Exam Setup</span>
          </Link>
          <Link
            href="/exams/schedule"
            data-ux-id="btn_view_schedule"
            data-ux-label="Datesheets"
            className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 px-4 py-2.5 rounded-lg font-medium text-sm transition-all"
          >
            <Calendar className="w-4 h-4 text-gray-500" />
            <span>Datesheets</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Exams */}
        <div 
          data-ux-id="card_active_exams"
          data-ux-label="Active Exams KPI"
          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm cursor-pointer hover:border-indigo-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Total Exams
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {examsList.length}
            </span>
            <span className="text-xs text-gray-500">configured in year</span>
          </div>
        </div>

        {/* Active Schedules */}
        <div 
          data-ux-id="card_pending_marks"
          data-ux-label="Active Schedules KPI"
          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm cursor-pointer hover:border-emerald-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Active Schedules
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {totalSchedules}
            </span>
            <span className="text-xs text-gray-500">subject datesheets</span>
          </div>
        </div>

        {/* Marks Locked Subjects */}
        <div 
          data-ux-id="card_pending_marks"
          data-ux-label="Marks Locked KPI"
          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm cursor-pointer hover:border-amber-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Marks Locked
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {lockedMarksCount}
            </span>
            <span className="text-xs text-gray-500">subjects frozen</span>
          </div>
        </div>

        {/* Results Released */}
        <div 
          data-ux-id="card_published_results"
          data-ux-label="Results Released KPI"
          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm cursor-pointer hover:border-sky-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              Results Released
            </span>
            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {releasedResultsCount}
            </span>
            <span className="text-xs text-gray-500">live published setups</span>
          </div>
        </div>
      </div>

      {/* Lifecycle Navigation Stage Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-900/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Full Six-Stage Workflow</span>
            </div>
            <h2 className="text-xl font-bold">Examination Operations Pipeline</h2>
            <p className="text-xs text-indigo-200 max-w-xl">
              Navigate seamlessly across stages: setup exam components, schedule datesheets, configure admit cards, record and lock component marks, generate frozen snapshots, and publish reports.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <Link
              href="/exams/manage"
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/10 hover:bg-white/15 transition-all text-center border border-white/10"
            >
              <SlidersHorizontal className="w-5 h-5 text-indigo-300 mb-1" />
              <span className="text-xs font-semibold">1. Setup</span>
            </Link>
            <Link
              href="/exams/schedule"
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/10 hover:bg-white/15 transition-all text-center border border-white/10"
            >
              <Calendar className="w-5 h-5 text-indigo-300 mb-1" />
              <span className="text-xs font-semibold">2. Schedule</span>
            </Link>
            <Link
              href="/exams/admit-cards"
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/10 hover:bg-white/15 transition-all text-center border border-white/10"
            >
              <FileCheck2 className="w-5 h-5 text-indigo-300 mb-1" />
              <span className="text-xs font-semibold">3. Admit Cards</span>
            </Link>
            <Link
              href="/exams/marks"
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/10 hover:bg-white/15 transition-all text-center border border-white/10"
            >
              <Lock className="w-5 h-5 text-indigo-300 mb-1" />
              <span className="text-xs font-semibold">4. Marks & Lock</span>
            </Link>
            <Link
              href="/exams/results"
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/10 hover:bg-white/15 transition-all text-center border border-white/10 col-span-2 sm:col-span-1"
            >
              <Award className="w-5 h-5 text-indigo-300 mb-1" />
              <span className="text-xs font-semibold">5 & 6. Results</span>
            </Link>
          </div>
        </div>
      </div>

      {/* UX-P10 & UX-P09: Board Term Plan Action Card & Confirmation Drawer */}
      <BoardTermPlanCard
        board={board}
        hasExams={examsList.length > 0}
        hasBoardDefaults={hasBoardDefaults}
        activeYearLabel={activeYear?.label}
      />

      {/* S11 Layer 2: Guide Attendance Trend Chart */}
      <ExamAttendanceTrendCard
        metrics={attendanceTrendMetrics}
        totalAbsents={totalAbsents}
        totalLeaves={totalLeaves}
        totalPresent={totalPresent}
      />

      {/* Active Exams Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Configured Examinations
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Exams registered for the current academic session
            </p>
          </div>
          <Link
            href="/exams/manage"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <span>Manage All Configuration</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {examsList.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                No examinations found
              </h4>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
                No exams have been configured for the current session. Create your first exam using the setup wizard.
              </p>
            </div>
            <Link
              href="/exams/manage"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Exam</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Exam Name</th>
                  <th className="px-6 py-3.5">Type & Weightage</th>
                  <th className="px-6 py-3.5">Date Range</th>
                  <th className="px-6 py-3.5">Class Scope</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Lifecycle Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {examsList.map((exam) => {
                  const startDateStr = new Date(exam.startDate).toLocaleDateString(
                    "en-IN",
                    { day: "numeric", month: "short", year: "numeric" },
                  );
                  const endDateStr = new Date(exam.endDate).toLocaleDateString(
                    "en-IN",
                    { day: "numeric", month: "short", year: "numeric" },
                  );
                  const scopedClassesCount = exam.classScopes?.length || 0;

                  return (
                    <tr
                      key={exam.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                        {exam.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          {exam.examType?.name ?? "General"}
                          {exam.examType?.weightagePercent
                            ? ` (${exam.examType.weightagePercent}%)`
                            : ""}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-slate-300 whitespace-nowrap">
                        {startDateStr} – {endDateStr}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-slate-300">
                        {scopedClassesCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {scopedClassesCount} classes scoped
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            All Classes
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {exam.isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                            <Lock className="w-3 h-3" />
                            Locked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/exams/schedule?examId=${exam.id}`}
                            className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 transition-colors"
                          >
                            Schedule
                          </Link>
                          <Link
                            href={`/exams/admit-cards?examId=${exam.id}`}
                            className="px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 transition-colors"
                          >
                            Admit Cards
                          </Link>
                          <Link
                            href={`/exams/marks?examId=${exam.id}`}
                            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors"
                          >
                            Marks
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
