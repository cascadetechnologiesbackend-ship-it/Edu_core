import { requireAuth } from "@/lib/serverAuth";
import Link from "next/link";
import { GraduationCap, Award, CalendarCheck, UserCheck, Users, FileText, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Principal Executive Dashboard | SchoolMitra ERP",
  description: "Academic oversight, educator monitoring, exam evaluation & operational review.",
};

export default async function PrincipalDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <GraduationCap className="w-3.5 h-3.5" /> Executive Academic Office
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2">
              Principal Command Center
            </h1>
            <p className="text-blue-200/80 text-sm mt-1">
              Holistic academic performance, teacher evaluations, exam results, and student attendance analytics.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/academics"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition"
            >
              Academic Hub & Classes
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Class Sections</span>
            <GraduationCap className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">24</div>
          <p className="text-xs text-gray-500 mt-1">Nursery to Class 12</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Teaching Staff</span>
            <UserCheck className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">48</div>
          <p className="text-xs text-emerald-600 mt-1">96% Daily Attendance</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Avg Student Attendance</span>
            <CalendarCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">94.2%</div>
          <p className="text-xs text-gray-500 mt-1">Current Academic Term</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Pending Exam Marks</span>
            <Award className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-amber-600 mt-2">2 Classes</div>
          <p className="text-xs text-amber-600 mt-1">Ready for verification</p>
        </div>
      </div>

      {/* Quick Academic Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/exams"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition">
            Exam Evaluation & GPA Results
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Review scholastic marks entry, approve grade books, and issue PDF report cards.
          </p>
        </Link>

        <Link
          href="/attendance"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition">
            Attendance & Absentees Control
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Monitor daily section roll calls, track chronic absentees, and review staff leave requests.
          </p>
        </Link>

        <Link
          href="/hr"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-purple-600 transition">
            Educator & Staff Directory
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            View teaching faculty profiles, department designations, and leave balances.
          </p>
        </Link>
      </div>
    </div>
  );
}
