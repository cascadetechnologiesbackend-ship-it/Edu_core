// ─── Examination Usage Analytics & Element Heat Map (Sprint S10 Layer 5) ──────
// Route: /exams/usage
// RBAC: Accessible to SUPER_ADMIN, SCHOOL_ADMIN, and PRINCIPAL with exam.usage.view.
// Renders element-intensity heat maps (UX-R24/UX-R25) based on first-party interaction telemetry.

import { db } from "@/db";
import { usageEvents, schools } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { hasExamPermission } from "@/lib/examPermissions";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { UsageAnalyticsClient, type SerializedUsageEvent } from "./UsageAnalyticsClient";
import Link from "next/link";
import { ArrowLeft, Activity, Flame, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Examination Telemetry & Heat Map | SchoolMitra ERP",
  description: "First-party element-level heat map analytics and frequency metrics for the examination subsystem",
};

const USAGE_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
] as const;

export default async function ExamsUsagePage() {
  const ctx = await requireAuth(USAGE_ADMIN_ROLES);
  const access = assertRouteAccess(ctx.role, "/exams/usage", {
    id: ctx.userId,
    email: ctx.email,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  // Permission verification
  if (!hasExamPermission(ctx.role, "exam.usage.view")) {
    redirect("/exams/dashboard?error=UnauthorizedUsageAnalytics");
  }

  const schoolId = ctx.schoolId || "";

  const data = await withDataPhaseTiming("/exams/usage", async () => {
    return assertQueryBudget(
      async () => {
        const [eventsList, schoolRow] = await Promise.all([
          db.query.usageEvents.findMany({
            where: eq(usageEvents.schoolId, schoolId),
            orderBy: (t, { desc }) => [desc(t.createdAt)],
            limit: 1000,
          }),
          db.query.schools.findFirst({
            where: eq(schools.id, schoolId),
            columns: { name: true },
          }),
        ]);

        const serialized: SerializedUsageEvent[] = eventsList.map((e) => ({
          id: e.id,
          screen: e.screen,
          elementId: e.elementId,
          elementLabel: e.elementLabel,
          action: e.action,
          role: e.role,
          createdAt: e.createdAt.toISOString(),
        }));

        return {
          events: serialized,
          schoolName: schoolRow?.name || "School Instance",
        };
      },
      { maxQueries: 3, label: "Exams Usage Telemetry" },
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ─── Breadcrumb & Navigation ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-slate-400">
        <Link
          href="/exams/dashboard"
          className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Examinations Dashboard</span>
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white">Interaction Telemetry &amp; Heat Map</span>
      </div>

      {/* ─── Page Title Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
            <Activity className="w-4 h-4" />
            <span>First-Party Telemetry (UX-R62)</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Examination Telemetry &amp; Element Heat Map
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Measured usage density and interaction frequency guiding ergonomic positioning across examination workflows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/exams/analytics"
            className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 px-4 py-2.5 rounded-lg font-medium text-sm transition-all"
          >
            <span>Cohort Performance</span>
          </Link>
          <Link
            href="/exams/dashboard"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            <span>Operations Center</span>
          </Link>
        </div>
      </div>

      {/* ─── Client Interactive Telemetry Dashboard ─────────────────────────── */}
      <UsageAnalyticsClient
        events={data.events}
        schoolName={data.schoolName}
      />
    </div>
  );
}
