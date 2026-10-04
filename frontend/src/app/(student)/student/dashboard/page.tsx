export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/serverAuth";
import Link from "next/link";
import { GraduationCap, Award, Calendar, BookOpen, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Student Learning Workspace | SchoolMitra ERP",
  description: "My timetable, homework assignments, report cards & subject resources.",
};

export default async function StudentDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "STUDENT"] as const);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-violet-900 via-purple-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
              <GraduationCap className="w-3.5 h-3.5" /> Student Learning Portal
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2">
              Student Dashboard
            </h1>
            <p className="text-violet-200/80 text-sm mt-1">
              Welcome back! Check your daily class timetable, subject homework, and examination report cards.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 text-xs font-medium">
              Class 5-A • Roll #12
            </span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">My Class</span>
            <GraduationCap className="w-5 h-5 text-violet-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">Class 5-A</div>
          <p className="text-xs text-gray-500 mt-1">Academic Year 2026-27</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">My Attendance</span>
            <Calendar className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">96.5%</div>
          <p className="text-xs text-emerald-600 mt-1">Present 112 / 116 Days</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Latest Grade</span>
            <Award className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-purple-600 mt-2">A+</div>
          <p className="text-xs text-purple-600 mt-1">Term 1 Evaluation</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Active Subjects</span>
            <BookOpen className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">6 Subjects</div>
          <p className="text-xs text-gray-500 mt-1">Math, Science, English, etc.</p>
        </div>
      </div>
    </div>
  );
}
