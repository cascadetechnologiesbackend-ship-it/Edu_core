export const dynamic = "force-dynamic";

import React from "react";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertQueryBudget } from "@schoolmitra/database";
import { getPrincipalConsoleMetrics } from "@/lib/roleConsoleEngine";
import Link from "next/link";
import {
  GraduationCap,
  Award,
  CalendarCheck,
  UserCheck,
  Users,
  FileText,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const metadata = {
  title: "Principal Executive Dashboard | SchoolMitra ERP",
  description: "Academic oversight, educator monitoring, exam evaluation & operational review.",
};

export default async function PrincipalDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
  const school = await requireSchool(ctx);

  const metrics = await assertQueryBudget(
    async () => getPrincipalConsoleMetrics(school.id),
    { maxQueries: 6, label: "Principal Dashboard" }
  );

  const isFreshSchool =
    metrics.activeSectionsCount === 0 && metrics.activeTeachingStaffCount === 0;

  return (
    <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 max-w-7xl mx-auto overflow-x-hidden">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-blue-950/60 backdrop-blur-xl border border-white/[0.12] p-6 sm:p-8 text-white shadow-level-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <GraduationCap className="w-3.5 h-3.5" /> Executive Academic Office
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2">
              Principal Command Center
            </h1>
            <p className="text-blue-200/80 text-xs sm:text-sm mt-1 max-w-2xl">
              Live academic performance, faculty strength, scholastic exam evaluation, and daily student attendance for {school.name}.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/academics"
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-xs shadow-level-1 transition-all flex items-center justify-center gap-2"
            >
              <GraduationCap className="w-4 h-4" /> Academic Hub
            </Link>
          </div>
        </div>
      </div>

      {/* Fresh Provisioned School Next-Best-Action State */}
      {isFreshSchool && (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 dark:bg-blue-950/20 p-5 shadow-level-1">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                School Setup in Progress
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your school has been created. Start by setting up academic classes and appointing teaching staff to see live telemetry here.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <Link
                  href="/academics"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] py-1 px-2"
                >
                  Configure Class Sections <ArrowRight className="w-3 h-3" />
                </Link>
                <Link
                  href="/hr"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] py-1 px-2"
                >
                  Add Teaching Faculty <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Metric 1: Class Sections */}
        <div
          data-testid="principal-sections-metric"
          className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Class Sections
              </span>
              <GraduationCap className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground mt-2 tracking-tight">
              {metrics.activeSectionsCount}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {metrics.activeSectionsCount === 0
              ? "0 active class sections"
              : `${metrics.activeSectionsCount} active sections`}
          </p>
        </div>

        {/* Metric 2: Teaching Staff */}
        <div
          data-testid="principal-staff-metric"
          className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Teaching Staff
              </span>
              <UserCheck className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground mt-2 tracking-tight">
              {metrics.activeTeachingStaffCount}
            </div>
          </div>
          <p
            className={`text-xs mt-2 ${
              metrics.staffAttendanceRate
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            }`}
          >
            {metrics.staffAttendanceRate
              ? `${metrics.staffAttendanceRate.formattedPercent} Staff Attendance Today`
              : metrics.activeTeachingStaffCount === 0
              ? "0 active faculty members"
              : `${metrics.activeTeachingStaffCount} active educators`}
          </p>
        </div>

        {/* Metric 3: Student Attendance Today */}
        <div
          data-testid="principal-attendance-metric"
          className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Student Attendance
              </span>
              <CalendarCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold mt-2 tracking-tight ${
                metrics.todayStudentAttendance.isMarkedToday
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              }`}
            >
              {metrics.todayStudentAttendance.isMarkedToday
                ? metrics.todayStudentAttendance.formattedPercent
                : "0.0%"}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {metrics.todayStudentAttendance.isMarkedToday
              ? `${metrics.todayStudentAttendance.presentCount} of ${metrics.todayStudentAttendance.totalMarked} students present`
              : "Attendance not taken today"}
          </p>
        </div>

        {/* Metric 4: Pending Exam Marks */}
        <div
          data-testid="principal-exams-metric"
          className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pending Exam Marks
              </span>
              <Award className="w-5 h-5 text-amber-500" />
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold mt-2 tracking-tight ${
                metrics.pendingExamVerificationsCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-foreground"
              }`}
            >
              {metrics.pendingExamVerificationsCount === 0
                ? "0 Classes"
                : `${metrics.pendingExamVerificationsCount} Classes`}
            </div>
          </div>
          <p
            className={`text-xs mt-2 ${
              metrics.pendingExamVerificationsCount > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            }`}
          >
            {metrics.pendingExamVerificationsCount === 0
              ? "All marks verified & locked"
              : "Ready for verification & lock"}
          </p>
        </div>
      </div>

      {/* Matrix-Legal Operational Deep Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Link
          href="/exams"
          className="group p-5 sm:p-6 rounded-2xl border border-border/80 bg-card hover:border-blue-500/50 hover:shadow-level-2 transition-all space-y-2 min-h-[44px]"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition tracking-tight">
            Exam Evaluation &amp; GPA Results
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Review submitted marks entries, verify scholastic grades, and lock final report cards.
          </p>
        </Link>

        <Link
          href="/attendance"
          className="group p-5 sm:p-6 rounded-2xl border border-border/80 bg-card hover:border-blue-500/50 hover:shadow-level-2 transition-all space-y-2 min-h-[44px]"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition tracking-tight">
            Attendance &amp; Absentees Control
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Monitor daily section roll calls, track chronic student absentees, and view leave status.
          </p>
        </Link>

        <Link
          href="/hr"
          className="group p-5 sm:p-6 rounded-2xl border border-border/80 bg-card hover:border-blue-500/50 hover:shadow-level-2 transition-all space-y-2 min-h-[44px]"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition tracking-tight">
            Educator &amp; Faculty Directory
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            View teaching faculty allocations, department designations, and leave status.
          </p>
        </Link>

        <Link
          href="/students"
          className="group p-5 sm:p-6 rounded-2xl border border-border/80 bg-card hover:border-blue-500/50 hover:shadow-level-2 transition-all space-y-2 min-h-[44px]"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition tracking-tight">
            Student 360 &amp; Profiles
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Search enrolled pupils, inspect guardian links, and review academic histories.
          </p>
        </Link>

        <Link
          href="/school/due-fees"
          className="group p-5 sm:p-6 rounded-2xl border border-border/80 bg-card hover:border-blue-500/50 hover:shadow-level-2 transition-all space-y-2 min-h-[44px]"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition tracking-tight">
            Fee Dues &amp; Financial Oversight
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Executive oversight of outstanding student fee balances and term concessions.
          </p>
        </Link>

        <Link
          href="/academics"
          className="group p-5 sm:p-6 rounded-2xl border border-border/80 bg-card hover:border-blue-500/50 hover:shadow-level-2 transition-all space-y-2 min-h-[44px]"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition tracking-tight">
            Class &amp; Subject Catalog
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Inspect class sections, subject curriculums, and timetable schedules.
          </p>
        </Link>
      </div>
    </div>
  );
}
