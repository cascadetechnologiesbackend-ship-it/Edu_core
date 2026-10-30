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
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <GraduationCap className="w-3.5 h-3.5" /> Executive Academic Office
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">
              Principal Command Center
            </h1>
            <p className="text-blue-200/80 text-xs sm:text-sm mt-1 max-w-2xl">
              Live academic performance, faculty strength, scholastic exam evaluation, and daily student attendance for {school.name}.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/academics"
              className="w-full sm:w-auto min-h-[38px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition flex items-center justify-center gap-2"
            >
              <GraduationCap className="w-4 h-4" /> Academic Hub
            </Link>
          </div>
        </div>
      </div>

      {/* Fresh Provisioned School Next-Best-Action State */}
      {isFreshSchool && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-indigo-950 dark:text-indigo-200">
                School Setup in Progress
              </h3>
              <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                Your school has been created. Start by setting up academic classes and appointing teaching staff to see live telemetry here.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <Link
                  href="/academics"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline min-h-[38px] py-1 px-2"
                >
                  Configure Class Sections <ArrowRight className="w-3 h-3" />
                </Link>
                <Link
                  href="/hr"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline min-h-[38px] py-1 px-2"
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
          className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Class Sections
              </span>
              <GraduationCap className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {metrics.activeSectionsCount}
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
            {metrics.activeSectionsCount === 0
              ? "0 active class sections"
              : `${metrics.activeSectionsCount} active sections`}
          </p>
        </div>

        {/* Metric 2: Teaching Staff */}
        <div
          data-testid="principal-staff-metric"
          className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Teaching Staff
              </span>
              <UserCheck className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {metrics.activeTeachingStaffCount}
            </div>
          </div>
          <p
            className={`text-xs mt-2 ${
              metrics.staffAttendanceRate
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-500 dark:text-slate-400"
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
          className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Student Attendance
              </span>
              <CalendarCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold mt-2 ${
                metrics.todayStudentAttendance.isMarkedToday
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-500 dark:text-slate-400"
              }`}
            >
              {metrics.todayStudentAttendance.isMarkedToday
                ? metrics.todayStudentAttendance.formattedPercent
                : "0.0%"}
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
            {metrics.todayStudentAttendance.isMarkedToday
              ? `${metrics.todayStudentAttendance.presentCount} of ${metrics.todayStudentAttendance.totalMarked} students present`
              : "Attendance not taken today"}
          </p>
        </div>

        {/* Metric 4: Pending Exam Marks */}
        <div
          data-testid="principal-exams-metric"
          className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Pending Exam Marks
              </span>
              <Award className="w-5 h-5 text-amber-500" />
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold mt-2 ${
                metrics.pendingExamVerificationsCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-gray-900 dark:text-white"
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
                : "text-gray-500 dark:text-slate-400"
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
          className="group p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition shadow-sm space-y-2 min-h-[38px]"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition">
            Exam Evaluation & GPA Results
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
            Review submitted marks entries, verify scholastic grades, and lock final report cards.
          </p>
        </Link>

        <Link
          href="/attendance"
          className="group p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 transition shadow-sm space-y-2 min-h-[38px]"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition">
            Attendance & Absentees Control
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
            Monitor daily section roll calls, track chronic student absentees, and view leave status.
          </p>
        </Link>

        <Link
          href="/hr"
          className="group p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-500 transition shadow-sm space-y-2 min-h-[38px]"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-purple-600 transition">
            Educator & Faculty Directory
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
            View teaching faculty allocations, department designations, and leave status.
          </p>
        </Link>

        <Link
          href="/students"
          className="group p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 transition shadow-sm space-y-2 min-h-[38px]"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition">
            Student 360 & Profiles
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
            Search enrolled pupils, inspect guardian links, and review academic histories.
          </p>
        </Link>

        <Link
          href="/school/due-fees"
          className="group p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-500 transition shadow-sm space-y-2 min-h-[38px]"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-amber-600 transition">
            Fee Dues & Financial Oversight
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
            Executive oversight of outstanding student fee balances and term concessions.
          </p>
        </Link>

        <Link
          href="/academics"
          className="group p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition shadow-sm space-y-2 min-h-[38px]"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition">
            Class & Subject Catalog
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
            Inspect class sections, subject curriculums, and timetable schedules.
          </p>
        </Link>
      </div>
    </div>
  );
}
