export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getDayOneReadiness,
  emitDayOneJourneyFinishedIfReady,
  type ReadinessCheckItem,
} from "@/lib/dayOneReadiness";
import {
  OnboardingMetricBadge,
  OnboardingMetricServerBadge,
} from "@/components/telemetry/OnboardingMetricBadge";
import { getNorthStarMetricsSummary } from "@/lib/northStarTelemetry";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Calendar,
  Layers,
  BookOpen,
  IndianRupee,
  UserCheck,
  GraduationCap,
  CalendarClock,
  KeyRound,
  Compass,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Open the school for Day One — Day One Cockpit",
  description: "Operational readiness cockpit and onboarding journey completion for Day One operations.",
};

const CHECK_ICONS: Record<string, React.ElementType> = {
  academic_year: Calendar,
  classes_sections: Layers,
  subjects: BookOpen,
  fees: IndianRupee,
  staff: UserCheck,
  students: GraduationCap,
  timetable: CalendarClock,
  parent_claims: KeyRound,
};

export default async function DayOneCockpitPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ welcome?: string; schoolId?: string }>
    | { welcome?: string; schoolId?: string };
}) {
  const resolvedSearchParams = await searchParams;
  const isWelcome = resolvedSearchParams?.welcome === "true";

  // 1. Auth & Route Guard
  const ctx = await requireAuth();
  const access = assertRouteAccess(
    ctx.role,
    "/admin/day-one",
    ctx.schoolId
      ? { id: ctx.userId, email: ctx.email, schoolId: ctx.schoolId }
      : { id: ctx.userId, email: ctx.email }
  );

  if (!access.allowed) {
    redirect(access.redirectUrl || "/dashboard");
  }

  // 2. Resolve School
  let schoolId = ctx.schoolId || "";
  if (resolvedSearchParams?.schoolId && ctx.role === "SUPER_ADMIN") {
    schoolId = resolvedSearchParams.schoolId;
  } else if (!schoolId && ctx.role === "SUPER_ADMIN") {
    const activeSchool = await db.query.schools.findFirst({
      where: eq(schools.isActive, true),
      columns: { id: true },
    });
    schoolId = activeSchool?.id || "";
  }

  if (!schoolId) {
    redirect("/dashboard");
  }

  // 3. Database Truth: Compute the 8 Day One Readiness Checks
  const readiness = await getDayOneReadiness(schoolId);

  // 4. North Star Metric Summary Readout
  const northStarSummary = await getNorthStarMetricsSummary(schoolId).catch(() => null);

  // 5. Emit J10 Journey Finished Telemetry if all checks pass and not already emitted
  if (readiness.isReadyForDayOne) {
    await emitDayOneJourneyFinishedIfReady({
      schoolId,
      userId: ctx.userId,
      ...(ctx.role ? { role: ctx.role } : {}),
      report: readiness,
    }).catch(() => null);
  }

  const completionPercent = Math.round(
    (readiness.readyChecksCount / readiness.totalChecks) * 100
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Welcome Banner (if coming straight from wizard completion) ──────── */}
      {isWelcome && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border border-emerald-500/25 flex items-start gap-3 shadow-level-1">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              Welcome to the Day One Cockpit!
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Your school tenant has been created. The empty-dashboard dead end is eliminated:
              follow the 8 truthful readiness checks below to bring your school to live Day One operations.
            </p>
          </div>
        </div>
      )}

      {/* ── Header: Mandatory Law F1 (H1 names the job) ────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
              Journey J10 · School Onboarding
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {readiness.schoolName}
            </span>
          </div>
          <h1
            data-testid="day-one-h1"
            className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1.5"
          >
            Open the school for Day One
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            One single journey surface for tenant readiness. Every check is computed from database records;
            zero claimed booleans, zero fake spinners.
          </p>
        </div>

        {/* Readout: Onboarding North Star Metric Badge (Law: A metric without a readout is a lie) */}
        <div className="shrink-0">
          <OnboardingMetricBadge
            summary={northStarSummary?.onboardingDays}
            variant="card"
          />
        </div>
      </div>

      {/* ── Progress Strip ─────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-3 shadow-level-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-white">Readiness Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-blue-400 text-sm">
              {readiness.readyChecksCount} / {readiness.totalChecks}
            </span>
            <span className="text-slate-400">checks ready ({completionPercent}%)</span>
          </div>
        </div>

        <div className="w-full bg-slate-950/80 rounded-full h-2.5 overflow-hidden border border-white/10">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              readiness.isReadyForDayOne
                ? "bg-emerald-500"
                : "bg-blue-600"
            }`}
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>

      {/* ── Prominent Finished State Card (When all 8 checks are green) ──────── */}
      {readiness.isReadyForDayOne && (
        <div
          data-testid="day-one-finished-state"
          className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-950 border border-emerald-500/40 shadow-level-2 space-y-5"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block">
                  Finished State · Day One Certified
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5">
                  {readiness.finishedStateMessage}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  All 8 readiness invariants verified. The school is fully primed for live operations.
                </p>
              </div>
            </div>

            <Link
              data-testid="mark-first-attendance-btn"
              href="/attendance"
              className="px-6 py-3 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold text-xs inline-flex items-center gap-2 shadow-level-1 transition shrink-0"
            >
              <span>Mark the first attendance</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ── Eight Day One Readiness Checks ─────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Day One Readiness Checks ({readiness.readyChecksCount} of {readiness.totalChecks} Ready)
        </h3>

        <div className="grid grid-cols-1 gap-3">
          {readiness.checks.map((check) => (
            <ReadinessCheckCard key={check.id} check={check} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReadinessCheckCard({ check }: { check: ReadinessCheckItem }) {
  const Icon = CHECK_ICONS[check.id] || Compass;

  return (
    <div
      data-testid={`readiness-check-${check.id}`}
      data-status={check.status}
      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        check.status === "READY"
          ? "bg-slate-900/60 backdrop-blur-xl border-emerald-500/30 hover:border-emerald-500/50 shadow-level-0"
          : check.status === "IN_PROGRESS"
          ? "bg-slate-900/70 backdrop-blur-xl border-amber-500/30 hover:border-amber-500/50 shadow-level-0"
          : check.status === "UNKNOWN"
          ? "bg-purple-950/20 backdrop-blur-xl border-purple-500/30 hover:border-purple-500/50 shadow-level-0"
          : "bg-slate-900/40 backdrop-blur-xl border-white/[0.08] hover:border-white/20 shadow-level-0"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Icon & Title & Description */}
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-xl border shrink-0 mt-0.5 ${
              check.status === "READY"
                ? "bg-emerald-950/50 text-emerald-400 border-emerald-800/50"
                : check.status === "IN_PROGRESS"
                ? "bg-amber-950/50 text-amber-400 border-amber-800/50"
                : check.status === "UNKNOWN"
                ? "bg-purple-950/50 text-purple-400 border-purple-800/50"
                : "bg-slate-800/60 text-slate-400 border-slate-700/50"
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-slate-400">
                #{check.order}
              </span>
              <h4 className="text-sm font-bold text-white">{check.title}</h4>
              <StatusBadge status={check.status} />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {check.description}
            </p>

            <div className="pt-1">
              <span
                className={`text-xs font-semibold ${
                  check.status === "READY"
                    ? "text-emerald-400"
                    : check.status === "IN_PROGRESS"
                    ? "text-amber-300"
                    : check.status === "UNKNOWN"
                    ? "text-purple-300 font-mono"
                    : "text-slate-400"
                }`}
              >
                {check.statusLabel}
              </span>
            </div>

            {/* Unknown Reason Box if UNKNOWN */}
            {check.status === "UNKNOWN" && check.unknownReason && (
              <div className="mt-2 p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/50 text-[11px] text-purple-200 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>{check.unknownReason}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: One-Tap Next Action Deep-Link */}
        <div className="sm:text-right shrink-0">
          {check.status !== "READY" ? (
            <Link
              href={check.deepLink.href}
              className="px-4 py-2 min-h-[38px] sm:min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-level-1 transition"
            >
              <span>{check.deepLink.label}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Link
              href={check.deepLink.href}
              className="px-3.5 py-2 min-h-[38px] sm:min-h-[44px] rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white text-xs font-medium inline-flex items-center gap-1.5 border border-white/10 transition active:scale-[0.98]"
            >
              <span>View details</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReadinessCheckItem["status"] }) {
  if (status === "READY") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        <span>Ready</span>
      </span>
    );
  }

  if (status === "IN_PROGRESS") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
        <Clock className="w-3 h-3 text-amber-400" />
        <span>In Progress</span>
      </span>
    );
  }

  if (status === "UNKNOWN") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/25">
        <AlertTriangle className="w-3 h-3 text-purple-400" />
        <span>Unknown</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.06] text-slate-400 border border-white/10">
      <AlertCircle className="w-3 h-3 text-slate-400" />
      <span>Not Started</span>
    </span>
  );
}
