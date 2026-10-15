"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  Flame,
  MousePointerClick,
  Users,
  Layers,
  ArrowUpRight,
  Filter,
  BarChart2,
  Calendar,
  Sparkles,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import { KNOWN_UX_ELEMENTS, type KnownUxScreen } from "@/lib/telemetryRegistry";

export interface SerializedUsageEvent {
  id: string;
  screen: string;
  elementId: string;
  elementLabel: string;
  action: string;
  role: string;
  createdAt: string;
}

interface UsageAnalyticsClientProps {
  events: SerializedUsageEvent[];
  schoolName: string;
}

export function UsageAnalyticsClient({
  events,
  schoolName,
}: UsageAnalyticsClientProps) {
  const [selectedScreen, setSelectedScreen] = useState<string>("ALL");
  const [timeRangeDays, setTimeRangeDays] = useState<number>(30);

  // Filter events by time range and screen
  const filteredEvents = useMemo(() => {
    const cutoff = Date.now() - timeRangeDays * 24 * 60 * 60 * 1000;
    return events.filter((e) => {
      const isWithinTime = new Date(e.createdAt).getTime() >= cutoff;
      const isScreenMatch = selectedScreen === "ALL" || e.screen === selectedScreen;
      return isWithinTime && isScreenMatch;
    });
  }, [events, selectedScreen, timeRangeDays]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    const total = filteredEvents.length;
    const uniqueUsers = new Set(filteredEvents.map((e) => e.role)).size;

    // By Screen
    const screenCounts: Record<string, number> = {};
    for (const e of filteredEvents) {
      screenCounts[e.screen] = (screenCounts[e.screen] || 0) + 1;
    }
    const topScreen = Object.entries(screenCounts).sort((a, b) => b[1] - a[1])[0];

    // By Element (Frequency Ranking)
    const elementCounts: Record<string, { label: string; screen: string; count: number; actions: Set<string> }> = {};
    for (const e of filteredEvents) {
      const key = `${e.screen}::${e.elementId}`;
      if (!elementCounts[key]) {
        elementCounts[key] = {
          label: e.elementLabel,
          screen: e.screen,
          count: 0,
          actions: new Set(),
        };
      }
      elementCounts[key].count++;
      elementCounts[key].actions.add(e.action);
    }

    const rankedElements = Object.entries(elementCounts)
      .map(([key, data]) => ({
        key,
        elementId: key.split("::")[1] || "",
        screen: data.screen,
        label: data.label,
        count: data.count,
        actions: Array.from(data.actions),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      uniqueUsers,
      topScreen: topScreen ? `${topScreen[0]} (${topScreen[1]})` : "N/A",
      rankedElements,
      screenCounts,
    };
  }, [filteredEvents]);

  // Screens available for filter
  const availableScreens = useMemo(() => {
    const screens = new Set(events.map((e) => e.screen));
    return Array.from(screens);
  }, [events]);

  return (
    <div className="space-y-8">
      {/* ─── Top Stats & Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase">Screen:</span>
          </div>
          <select
            data-ux-id="select_usage_screen"
            data-ux-label="Usage Screen Selector"
            data-ux-action="filter_change"
            value={selectedScreen}
            onChange={(e) => setSelectedScreen(e.target.value)}
            className="text-xs font-medium bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Examination Screens</option>
            {availableScreens.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 ml-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase">Window:</span>
          </div>
          <select
            data-ux-id="select_usage_timerange"
            data-ux-label="Usage Time Range Selector"
            data-ux-action="filter_change"
            value={timeRangeDays}
            onChange={(e) => setTimeRangeDays(Number(e.target.value))}
            className="text-xs font-medium bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days (Full Retention)</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Tenant Telemetry: {schoolName}</span>
        </div>
      </div>

      {/* ─── Metric Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
              Total Interactions
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <MousePointerClick className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {metrics.total}
            </span>
            <span className="text-xs text-gray-500 ml-2">measured actions</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
              Active Screen Target
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 truncate">
            <span className="text-lg font-bold text-gray-900 dark:text-white truncate block">
              {metrics.topScreen}
            </span>
            <span className="text-xs text-gray-500">highest interaction count</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
              Top Action Intensity
            </span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 truncate">
            <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
              {metrics.rankedElements[0]?.count || 0}
            </span>
            <span className="text-xs text-gray-500 ml-2 truncate">
              {metrics.rankedElements[0]?.label || "None"}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
              Privacy Standard
            </span>
            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              UX-R62 Compliant
            </span>
            <span className="text-xs text-emerald-600 block mt-0.5">Zero student PII</span>
          </div>
        </div>
      </div>

      {/* ─── Element-Intensity Heat Map Overlays ─────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Flame className="w-4 h-4" />
              <span>Element Intensity Heat Map (UX-R24 / UX-R25)</span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
              Component &amp; Button Interaction Density
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Visualizes observed frequency on instrumented screen controls. Red = highest intensity (&gt;30), Amber = moderate (10–30), Green = baseline (&lt;10).
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> High Intensity (&gt;30)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Mid Intensity (10-30)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Baseline (&lt;10)
            </span>
          </div>
        </div>

        {/* Heat Map Grid of Instrumented Elements */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.rankedElements.map((el) => {
            const intensityClass =
              el.count > 30
                ? "border-rose-500/50 bg-rose-500/5 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30"
                : el.count >= 10
                ? "border-amber-500/50 bg-amber-500/5 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30"
                : "border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30";

            const badgeBg =
              el.count > 30
                ? "bg-rose-500 text-white shadow-sm shadow-rose-200"
                : el.count >= 10
                ? "bg-amber-500 text-white shadow-sm shadow-amber-200"
                : "bg-emerald-500 text-white shadow-sm shadow-emerald-200";

            return (
              <div
                key={el.key}
                className={`p-4 rounded-xl border transition-all ${intensityClass}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 uppercase tracking-wider block w-fit">
                      {el.screen}
                    </span>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                      {el.label}
                    </h4>
                    <p className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                      ID: {el.elementId}
                    </p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${badgeBg}`}>
                    {el.count} hits
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px]">
                  <span className="text-gray-500">Actions: {el.actions.join(", ")}</span>
                  <span className="font-semibold">
                    {Math.round((el.count / (metrics.total || 1)) * 100)}% of traffic
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Frequency Ranking Table ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden">
        <h3 className="font-bold text-base text-gray-900 dark:text-white mb-4">
          Top-Interacted Element Frequency Ranking
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Element / Target Control</th>
                <th className="px-4 py-3">Screen Route</th>
                <th className="px-4 py-3 text-center">Interactions</th>
                <th className="px-4 py-3">Usage Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {metrics.rankedElements.slice(0, 15).map((item, idx) => {
                const percentage = Math.round((item.count / (metrics.total || 1)) * 100);
                return (
                  <tr key={item.key} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                    <td className="px-4 py-3 font-bold text-gray-700 dark:text-slate-300">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      <div>{item.label}</div>
                      <span className="font-mono text-[10px] text-gray-500">{item.elementId}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600 dark:text-slate-400">
                      {item.screen}
                    </td>
                    <td className="px-4 py-3 text-center font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                      {item.count}
                    </td>
                    <td className="px-4 py-3 w-48">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(5, percentage))}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-gray-500 w-8">{percentage}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
