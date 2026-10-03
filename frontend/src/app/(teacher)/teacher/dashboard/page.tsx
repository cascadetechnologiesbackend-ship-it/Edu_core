import { requireAuth } from "@/lib/serverAuth";
import Link from "next/link";
import { BookOpen, CalendarCheck, Award, Users, CheckCircle2, Clock } from "lucide-react";

export const metadata = {
  title: "Teacher Classroom Workspace | SchoolMitra ERP",
  description: "Educator class dashboard for daily attendance, marks entry, and timetable.",
};

export default async function TeacherDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] as const);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <BookOpen className="w-3.5 h-3.5" /> Educator Workspace
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2">
              Teacher Classroom Console
            </h1>
            <p className="text-emerald-200/80 text-sm mt-1">
              Welcome, Educator! Mark daily student attendance, record test marks, and manage class rosters.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/attendance"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition flex items-center gap-2"
            >
              <CalendarCheck className="w-4 h-4" /> Mark Daily Attendance
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Assigned Classes</span>
            <BookOpen className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">Class 5-A</div>
          <p className="text-xs text-emerald-600 mt-1">Class Teacher</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total Students</span>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">42</div>
          <p className="text-xs text-gray-500 mt-1">Enrolled in 5-A</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Today's Attendance</span>
            <CalendarCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">Completed</div>
          <p className="text-xs text-emerald-600 mt-1">40 Present, 2 Absent</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Pending Marks Entry</span>
            <Award className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-600 mt-2">Unit Test 2</div>
          <p className="text-xs text-amber-600 mt-1">Science & Mathematics</p>
        </div>
      </div>

      {/* Classroom Quick Tools */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/attendance"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition">
            Student Attendance Roll Call
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Quick 1-tap present/absent roll call for your assigned class section.
          </p>
        </Link>

        <Link
          href="/exams"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition">
            Marks & Grade Book Entry
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Enter test scores, assignment marks, and scholastic evaluations for your students.
          </p>
        </Link>

        <Link
          href="/academics"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-purple-600 transition">
            Class Roster & Subject Syllabus
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            View student list, parent contact info, and subject curriculum progress.
          </p>
        </Link>
      </div>
    </div>
  );
}
