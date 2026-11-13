export const dynamic = "force-dynamic";

import React from "react";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { assertQueryBudget } from "@schoolmitra/database";
import { getLibrarianConsoleMetrics } from "@/lib/roleConsoleEngine";
import Link from "next/link";
import {
  BookOpen,
  ArrowLeftRight,
  AlertCircle,
  Search,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const metadata = {
  title: "Librarian Workspace | SchoolMitra ERP",
  description: "Book catalog management, issue & return logs, and overdue fine collection.",
};

export default async function LibrarianDashboardPage() {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "LIBRARIAN"] as const);
  const school = await requireSchool(ctx);

  const metrics = await assertQueryBudget(
    async () => getLibrarianConsoleMetrics(school.id),
    { maxQueries: 6, label: "Librarian Dashboard" }
  );

  const isFreshLibrary = metrics.totalCopies === 0 && metrics.currentlyIssued === 0;

  return (
    <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 max-w-7xl mx-auto overflow-x-hidden">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-900 via-orange-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <BookOpen className="w-3.5 h-3.5" /> Library Management Office
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">
              Librarian Operations Console
            </h1>
            <p className="text-amber-200/80 text-xs sm:text-sm mt-1 max-w-2xl">
              Live book inventory, circulation telemetry, ISBN cataloging, and overdue fines for {school.name}.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/library"
              className="w-full sm:w-auto min-h-[38px] px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" /> Open Library Catalog
            </Link>
          </div>
        </div>
      </div>

      {/* Fresh Provisioned Library Next-Best-Action State */}
      {isFreshLibrary && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                Library Catalog Setup in Progress
              </h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                Your school has no cataloged books yet. Add titles to the inventory master or import catalog volumes to begin circulation.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <Link
                  href="/library"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline min-h-[38px] py-1 px-2"
                >
                  Add Catalog Titles <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Metric 1: Total Copies */}
        <div
          data-testid="librarian-total-copies-metric"
          className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Book Volume
              </span>
              <BookOpen className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {metrics.totalCopies}
            </div>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
            {metrics.totalCopies === 0
              ? "0 physical copies in inventory"
              : `${metrics.availableCopies} available in library`}
          </p>
        </div>

        {/* Metric 2: Currently Issued */}
        <div
          data-testid="librarian-issued-metric"
          className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Currently Issued
              </span>
              <ArrowLeftRight className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
              {metrics.currentlyIssued} Books
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
            {metrics.currentlyIssued === 0
              ? "No books currently checked out"
              : "Issued to students & staff"}
          </p>
        </div>

        {/* Metric 3: Overdue Returns */}
        <div
          data-testid="librarian-overdue-metric"
          className={`rounded-xl border p-5 sm:p-6 shadow-sm flex flex-col justify-between ${
            metrics.overdueCount > 0
              ? "border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/10"
              : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Overdue Returns
              </span>
              <AlertCircle
                className={`w-5 h-5 ${
                  metrics.overdueCount > 0 ? "text-red-500" : "text-emerald-500"
                }`}
              />
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold mt-2 ${
                metrics.overdueCount > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-900 dark:text-white"
              }`}
            >
              {metrics.overdueCount} Books
            </div>
          </div>
          <p
            className={`text-xs mt-2 ${
              metrics.overdueCount > 0
                ? "text-red-600 dark:text-red-400 font-medium"
                : "text-gray-500 dark:text-slate-400"
            }`}
          >
            {metrics.overdueCount > 0 ? "Late fine applicable" : "No overdue returns"}
          </p>
        </div>

        {/* Metric 4: Catalog Categories */}
        <div
          data-testid="librarian-categories-metric"
          className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Catalog Categories
              </span>
              <Search className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {metrics.distinctCategoriesCount}
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 truncate">
            {metrics.distinctCategoriesCount === 0
              ? "No categories configured"
              : metrics.topCategories.length > 0
              ? metrics.topCategories
                  .slice(0, 3)
                  .map((c) => c.category)
                  .join(", ")
              : "Active subjects"}
          </p>
        </div>
      </div>

      {/* Library Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Link
          href="/library"
          className="group p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-500 transition shadow-sm space-y-3 min-h-[38px]"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-amber-600 transition">
            Book Inventory Master
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
            Add new books, edit stock availability, catalog ISBN numbers, and assign rack locations.
          </p>
        </Link>

        <Link
          href="/library?tab=issues"
          className="group p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 transition shadow-sm space-y-3 min-h-[38px]"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition">
            Issue & Return Log Counter
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
            Log book issues to students/teachers, process book returns, and log overdue fines.
          </p>
        </Link>
      </div>
    </div>
  );
}
