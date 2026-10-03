import { requireAuth } from "@/lib/serverAuth";
import Link from "next/link";
import { Users, CreditCard, Award, CalendarCheck, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Parent Portal Dashboard | SchoolMitra ERP",
  description: "Child academic progress, fee payments, report cards & attendance logs.",
};

export default async function ParentDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PARENT"] as const);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Users className="w-3.5 h-3.5" /> Parent / Guardian Portal
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2">
              Parent Dashboard
            </h1>
            <p className="text-emerald-200/80 text-sm mt-1">
              View your ward's daily attendance, scholastic report cards, online fee payments & school notices.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/portal"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" /> Pay Fees Online
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Enrolled Ward</span>
            <Users className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">Class 5-A</div>
          <p className="text-xs text-gray-500 mt-1">Aarav Sharma</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Attendance Rate</span>
            <CalendarCheck className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-blue-600 mt-2">96.5%</div>
          <p className="text-xs text-emerald-600 mt-1">Excellent Attendance</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Latest Grade / GPA</span>
            <Award className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-purple-600 mt-2">A+ (92%)</div>
          <p className="text-xs text-gray-500 mt-1">Term 1 Evaluation</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Fee Due Status</span>
            <CreditCard className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">Fully Paid</div>
          <p className="text-xs text-emerald-600 mt-1">Zero Balance Due</p>
        </div>
      </div>

      {/* Parent Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/portal"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition">
            Fee Receipts & Online Payment
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Pay term fees via UPI/Card, view itemized invoice breakdowns, and download official receipts.
          </p>
        </Link>

        <Link
          href="/portal"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-purple-600 transition">
            Scholastic Report Cards
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Download official term report cards with subject-wise marks, grades, and teacher remarks.
          </p>
        </Link>

        <Link
          href="/portal"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition">
            Daily Attendance Calendar
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            View monthly attendance calendars and receive instant alerts for absences or leaves.
          </p>
        </Link>
      </div>
    </div>
  );
}
