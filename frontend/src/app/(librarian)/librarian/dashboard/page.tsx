export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/serverAuth";
import Link from "next/link";
import { BookOpen, ArrowLeftRight, AlertCircle, Search, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Librarian Workspace | SchoolMitra ERP",
  description: "Book catalog management, issue & return logs, and overdue fine collection.",
};

export default async function LibrarianDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "LIBRARIAN"] as const);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-900 via-orange-900 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <BookOpen className="w-3.5 h-3.5" /> Library Management Office
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2">
              Librarian Operations Console
            </h1>
            <p className="text-amber-200/80 text-sm mt-1">
              Book inventory master, issue/return logging, ISBN barcode lookup & overdue fine management.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/library"
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" /> Open Library Catalog
            </Link>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total Book Volume</span>
            <BookOpen className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">4,850</div>
          <p className="text-xs text-emerald-600 mt-1">Available in library</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Currently Issued</span>
            <ArrowLeftRight className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-blue-600 mt-2">142 Books</div>
          <p className="text-xs text-gray-500 mt-1">Issued to students & staff</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Overdue Returns</span>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-bold text-red-600 mt-2">8 Books</div>
          <p className="text-xs text-red-600 mt-1">Late fine applicable</p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Catalog Categories</span>
            <Search className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">18</div>
          <p className="text-xs text-gray-500 mt-1">Fiction, Science, Math, etc.</p>
        </div>
      </div>

      {/* Library Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/library"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-amber-600 transition">
            Book Inventory Master
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Add new books, edit stock availability, catalog ISBN numbers, and assign rack locations.
          </p>
        </Link>

        <Link
          href="/library?tab=issues"
          className="group p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition shadow-sm space-y-3"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition">
            Issue & Return Log Counter
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Log book issues to students/teachers, process book returns, and log overdue fines.
          </p>
        </Link>
      </div>
    </div>
  );
}
