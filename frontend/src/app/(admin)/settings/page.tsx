import Link from "next/link";
import {
  Settings,
  Award,
  Percent,
  Building2,
  ShieldCheck,
  Layers,
  GraduationCap,
  Wallet,
  Building,
  ArrowUpRight,
} from "lucide-react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import { getSchoolConfigurationHealthAction } from "./school-setup/actions";

export const metadata: Metadata = {
  title: "Settings Dashboard | SchoolMitra ERP",
};

const SETTINGS_CARDS = [
  {
    title: "Setup Hub & Digital Twin",
    description:
      "Inspect configuration completeness, review provisioned blueprint packs, and run universal data imports.",
    href: "/settings/school-setup",
    icon: Layers,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
  },
  {
    title: "School Profile Setup",
    description:
      "Manage school name, address, logo, principal credentials, and basic details.",
    href: "/settings/school-setup",
    icon: Building2,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Curriculum & Classrooms",
    description:
      "Manage grade hierarchy, section divisions, curriculum subjects, and period allocations.",
    href: "/academics",
    icon: GraduationCap,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "Fee Structures & Heads",
    description:
      "Configure institutional fee heads, frequency rules, pricing matrix, and ledger accounts.",
    href: "/school/fee-structures",
    icon: Wallet,
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
  },
  {
    title: "HR Salary Templates",
    description:
      "Configure employment designations, salary components, HRA/DA allowances, and PF rates.",
    href: "/hr",
    icon: Building,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
  },
  {
    title: "Role & Access Management",
    description:
      "Configure tenant roles, staff role memberships, account status, and credentials.",
    href: "/settings/roles",
    icon: ShieldCheck,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  {
    title: "Exam Types & Weightages",
    description:
      "Define exam types (Unit Tests, Half-Yearly, Board Exams) and weightages.",
    href: "/settings/exam-types",
    icon: Award,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "Grading Configuration",
    description:
      "Setup percentages boundaries, letter grades, GPAs, and class group mappings.",
    href: "/settings/grading",
    icon: Percent,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
] as const;

export default async function SettingsDashboardPage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/settings", { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  // Load health telemetry for Dual-Score Dashboard Banner (F14)
  let healthStats = null;
  try {
    healthStats = await getSchoolConfigurationHealthAction();
  } catch (e) {
    console.error("Failed to load health stats for settings dashboard:", e);
  }

  const configurationScore = healthStats?.configurationScore ?? healthStats?.overallScore ?? 0;
  const operationalScore = healthStats?.operationalScore ?? 0;
  const isOperationallyReady = healthStats?.isOperationallyReady ?? (operationalScore === 100);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          Settings Dashboard
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Configure core school setups, parameters, and operational readiness gates.
        </p>
      </div>

      {/* Dual-Score Overview Header Banner (Requirement R4) */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Institution Readiness Overview
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Continuous validation of core blueprint configuration and Day-One operational execution gates.
            </p>
          </div>
          <Link
            href="/settings/school-setup"
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 min-h-[38px] px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 shrink-0 self-start sm:self-auto transition"
          >
            Setup Hub & Operational Gates <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Configuration Completeness Meter */}
          <div className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Configuration Completeness
              </span>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {configurationScore}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${configurationScore}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              Academic calendar, classes, subjects, fee heads, salary templates, and holidays.
            </p>
          </div>

          {/* Operational Readiness Meter */}
          <div className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Operational Readiness
              </span>
              <span
                className={`text-xs font-mono font-bold ${
                  isOperationallyReady
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {operationalScore}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  operationalScore === 100 ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${operationalScore}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              {isOperationallyReady
                ? "All 5 Day-One operational milestones verified green."
                : "Bell schedule, timetable coverage, fee pricing, allocations, or enrollment pending."}
            </p>
          </div>
        </div>
      </div>

      {/* Primary Category Settings Cards */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_CARDS.map((card) => (
          <Link key={card.title} href={card.href as any} className="block group">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm hover:border-indigo-500/50 hover:shadow-md transition-all h-full flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {card.title}
                </h3>
                <div className={`p-2 rounded-xl ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {card.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
