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
      <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-amber-950/60 backdrop-blur-xl border border-white/[0.12] p-6 sm:p-8 text-white shadow-level-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <BookOpen className="w-3.5 h-3.5" /> Library Management Office
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2">
              Librarian Operations Console
            </h1>
            <p className="text-amber-200/80 text-xs sm:text-sm mt-1 max-w-2xl">
              Live book inventory, circulation telemetry, ISBN cataloging, and overdue fines for {school.name}.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/library"
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-semibold text-xs shadow-level-1 transition-all flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" /> Open Library Catalog
            </Link>
          </div>
        </div>
      </div>

      {/* Fresh Provisioned Library Next-Best-Action State */}
      {isFreshLibrary && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 p-5 shadow-level-1">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                Library Catalog Setup in Progress
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your school has no cataloged books yet. Add titles to the inventory master or import catalog volumes to begin circulation.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <Link
                  href="/library"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline min-h-[44px] py-1 px-2"
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
          className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Book Volume
              </span>
              <BookOpen className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground mt-2 tracking-tight">
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
          className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Currently Issued
              </span>
              <ArrowLeftRight className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2 tracking-tight">
              {metrics.currentlyIssued} Books
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {metrics.currentlyIssued === 0
              ? "No books currently checked out"
              : "Issued to students & staff"}
          </p>
        </div>

        {/* Metric 3: Overdue Returns */}
        <div
          data-testid="librarian-overdue-metric"
          className={`rounded-2xl border p-5 sm:p-6 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between ${
            metrics.overdueCount > 0
              ? "border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/20"
              : "border-border/80 bg-card"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Overdue Returns
              </span>
              <AlertCircle
                className={`w-5 h-5 ${
                  metrics.overdueCount > 0 ? "text-rose-500" : "text-emerald-500"
                }`}
              />
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold mt-2 tracking-tight ${
                metrics.overdueCount > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-foreground"
              }`}
            >
              {metrics.overdueCount} Books
            </div>
          </div>
          <p
            className={`text-xs mt-2 ${
              metrics.overdueCount > 0
                ? "text-rose-600 dark:text-rose-400 font-medium"
                : "text-muted-foreground"
            }`}
          >
            {metrics.overdueCount > 0 ? "Late fine applicable" : "No overdue returns"}
          </p>
        </div>

        {/* Metric 4: Catalog Categories */}
        <div
          data-testid="librarian-categories-metric"
          className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-level-1 hover:shadow-level-2 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Catalog Categories
              </span>
              <Search className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground mt-2 tracking-tight">
              {metrics.distinctCategoriesCount}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 truncate">
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
          className="group p-5 sm:p-6 rounded-2xl border border-border/80 bg-card hover:border-amber-500/50 hover:shadow-level-2 transition-all space-y-3 min-h-[44px]"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition tracking-tight">
            Book Inventory Master
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Add new books, edit stock availability, catalog ISBN numbers, and assign rack locations.
          </p>
        </Link>

        <Link
          href="/library?tab=issues"
          className="group p-5 sm:p-6 rounded-2xl border border-border/80 bg-card hover:border-blue-500/50 hover:shadow-level-2 transition-all space-y-3 min-h-[44px]"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition tracking-tight">
            Issue &amp; Return Log Counter
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Log book issues to students/teachers, process book returns, and log overdue fines.
          </p>
        </Link>
      </div>
    </div>
  );
}
