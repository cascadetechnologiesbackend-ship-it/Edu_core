import React from "react";
import { Clock, CheckCircle2, AlertTriangle, Hourglass } from "lucide-react";
import type { MetricReadout } from "@/lib/northStarTelemetry";
import { getNorthStarMetricsSummary } from "@/lib/northStarTelemetry";

export interface OnboardingMetricBadgeProps {
  summary?: MetricReadout | null | undefined;
  schoolId?: string | undefined;
  variant?: "badge" | "card" | "banner" | undefined;
  className?: string | undefined;
}

/**
 * OnboardingMetricBadge / Card Readout Component
 *
 * Truthful, unvarnished readout for North Star Metric: onboarding_days (Target: <= 1 working day).
 * Displays metric status: 'met' | 'breached' | 'no_data'.
 * Designed for safe usage in both Server Components and Client Components.
 */
export function OnboardingMetricBadge({
  summary: propSummary,
  variant = "card",
  className = "",
}: OnboardingMetricBadgeProps) {
  // Fallback defaults
  const metric = propSummary || {
    current: 0,
    target: 1,
    unit: "days",
    status: "no_data" as const,
    sampleCount: 0,
  };

  const status = metric.status; // 'met' | 'breached' | 'no_data'

  // Variant 1: Compact Badge
  if (variant === "badge") {
    if (status === "met") {
      return (
        <span
          data-testid="onboarding-metric-badge"
          data-status="met"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 ${className}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Onboarding: {metric.current}d (Target: ≤{metric.target}d — Met)</span>
        </span>
      );
    }

    if (status === "breached") {
      return (
        <span
          data-testid="onboarding-metric-badge"
          data-status="breached"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 ${className}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          <span>Onboarding: {metric.current}d (Target: ≤{metric.target}d — Breached)</span>
        </span>
      );
    }

    return (
      <span
        data-testid="onboarding-metric-badge"
        data-status="no_data"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 ${className}`}
      >
        <Hourglass className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 animate-pulse" />
        <span>Onboarding: In Progress (Target: ≤{metric.target}d)</span>
      </span>
    );
  }

  // Variant 2: Banner (prominent on dashboard or cockpit top)
  if (variant === "banner") {
    if (status === "met") {
      return (
        <div
          data-testid="onboarding-metric-banner"
          data-status="met"
          className={`rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 shadow-sm flex items-center justify-between gap-4 ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                  North-Star Onboarding Clock: {metric.current} Working Day{metric.current === 1 ? "" : "s"}
                </p>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  Target Met (≤{metric.target}d)
                </span>
              </div>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                First live classroom attendance was successfully marked within the 1-working-day target.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (status === "breached") {
      return (
        <div
          data-testid="onboarding-metric-banner"
          data-status="breached"
          className={`rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 p-4 shadow-sm flex items-center justify-between gap-4 ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                  North-Star Onboarding Clock: {metric.current} Working Days
                </p>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Target Breached (&gt;{metric.target}d)
                </span>
              </div>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Elapsed duration from tenant provisioning to first attendance exceeded the 1-working-day target.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // no_data: clock is ticking
    return (
      <div
        data-testid="onboarding-metric-banner"
        data-status="no_data"
        className={`rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-950/20 p-4 shadow-sm flex items-center justify-between gap-4 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-200">
                North-Star Onboarding Clock: In Progress
              </p>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-200 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                Clock Running (Target: ≤{metric.target}d)
              </span>
            </div>
            <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 mt-0.5">
              The onboarding clock stops when the school records its first live classroom attendance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Variant 3: Card (standard metric card in grid)
  const isMet = status === "met";
  const isBreached = status === "breached";

  return (
    <div
      data-testid="onboarding-metric-card"
      data-status={status}
      className={`relative overflow-hidden bg-card border border-border p-4 sm:p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">Onboarding Clock</p>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isMet
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : isBreached
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                  : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
              }`}
            >
              {isMet ? "Met" : isBreached ? "Breached" : "In Progress"}
            </span>
          </div>

          <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 tracking-tight truncate">
            {status === "no_data" ? "Active" : `${metric.current} ${metric.unit}`}
          </p>

          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {status === "no_data"
              ? `Target: ≤ ${metric.target} working day (awaiting 1st attendance)`
              : `Target: ≤ ${metric.target} working day`}
          </p>
        </div>

        <div
          className={`p-2.5 sm:p-3 rounded-xl flex-shrink-0 ml-3 ${
            isMet
              ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
              : isBreached
              ? "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400"
              : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"
          }`}
        >
          {isMet ? (
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : isBreached ? (
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Server Component wrapper that queries getNorthStarMetricsSummary(schoolId)
 * and renders OnboardingMetricBadge.
 */
export async function OnboardingMetricServerBadge({
  schoolId,
  variant = "card",
  className = "",
}: {
  schoolId: string;
  variant?: "badge" | "card" | "banner";
  className?: string;
}) {
  const summary = await getNorthStarMetricsSummary(schoolId).catch(() => null);
  return (
    <OnboardingMetricBadge
      summary={summary?.onboardingDays}
      variant={variant}
      className={className}
    />
  );
}

