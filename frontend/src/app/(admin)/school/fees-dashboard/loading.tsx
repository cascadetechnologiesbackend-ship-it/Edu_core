import React from "react";
import { BarChart3 } from "lucide-react";

/**
 * Exact-Height Skeleton Loader for Central Finance & Fees Analytics Hub (PF-R58)
 * Guarantees CLS = 0.00 by matching exact container heights and grid geometries:
 * - Header banner: 116px
 * - Tab navigation: 42px
 * - Band 1 KPI cards: 5 cards at exact h-32 (128px) MoneyKpi height
 * - Band 2 Aging strip: 64px
 * - Band 3 Grid: Two-column widget layout with exact row skeleton heights
 */
export default function FeesDashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Navigation Tabs Skeleton */}
      <div className="h-10 w-full max-w-xl bg-gray-200 dark:bg-slate-800 rounded-xl" />

      {/* Header Banner Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm min-h-[116px]">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <BarChart3 className="w-3.5 h-3.5" /> Finance Hub & Telemetry
          </div>
          <div className="h-7 w-80 bg-gray-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-4 w-96 bg-gray-100 dark:bg-slate-800/60 rounded" />
        </div>

        {/* Action button placeholders */}
        <div className="flex items-center gap-2">
          <div className="h-10 w-32 bg-gray-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* Band 1: 5 KPI Cards at Exact MoneyKpi Height (h-32 / 128px) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-32 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-gray-200 dark:bg-slate-800 rounded" />
              <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-800/80" />
            </div>
            <div className="h-8 w-36 bg-gray-200 dark:bg-slate-800 rounded-md" />
            <div className="h-3 w-20 bg-gray-100 dark:bg-slate-800/60 rounded" />
          </div>
        ))}
      </div>

      {/* Band 2: Overdue Aging Bracket Strip Skeleton (h-16 / 64px) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((j) => (
            <div key={j} className="h-12 bg-gray-100 dark:bg-slate-800/60 rounded-xl p-3 flex flex-col justify-between">
              <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Band 3: Two-Column Widget Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Defaulters & Class Progress */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm h-80 space-y-4">
            <div className="h-5 w-48 bg-gray-200 dark:bg-slate-800 rounded" />
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4, 5].map((k) => (
                <div key={k} className="h-10 w-full bg-gray-100 dark:bg-slate-800/60 rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Payment Mode Split & Recent Feed */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm h-80 space-y-4">
            <div className="h-5 w-40 bg-gray-200 dark:bg-slate-800 rounded" />
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4].map((m) => (
                <div key={m} className="h-12 w-full bg-gray-100 dark:bg-slate-800/60 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
