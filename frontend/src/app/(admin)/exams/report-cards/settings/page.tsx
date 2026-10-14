import { db } from "@/db";
import { reportCardSetups, resultSettings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import {
  ResultSettingsClient,
  type ResultSettingsData,
} from "./ResultSettingsClient";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Result Release Gate & Policies | SchoolMitra ERP",
  description: "Configure scheduled release times, fee defaulter locks, and public portal visibility",
};

const SETTINGS_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
] as const;

export default async function ResultSettingsPage({
  searchParams,
}: {
  searchParams: { setupId?: string };
}) {
  const ctx = await requireAuth(SETTINGS_ADMIN_ROLES);
  const access = assertRouteAccess(ctx.role, "/exams/report-cards/settings", {
    id: ctx.userId,
    email: ctx.email,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = ctx.schoolId || "";

  const data = await withDataPhaseTiming(
    "/exams/report-cards/settings",
    async () => {
      return assertQueryBudget(
        async () => {
          const setupsList = await db.query.reportCardSetups.findMany({
            where: eq(reportCardSetups.schoolId, schoolId),
            orderBy: (t, { desc }) => [desc(t.createdAt)],
          });

          const selectedSetupId =
            searchParams.setupId &&
            setupsList.some((s) => s.id === searchParams.setupId)
              ? searchParams.setupId
              : setupsList[0]?.id || "";

          let settingsData: ResultSettingsData | null = null;

          if (selectedSetupId) {
            const row = await db.query.resultSettings.findFirst({
              where: and(
                eq(resultSettings.schoolId, schoolId),
                eq(resultSettings.setupId, selectedSetupId),
              ),
            });

            if (row) {
              settingsData = {
                setupId: row.setupId,
                withholdAll: row.withholdAll,
                releaseAt: row.releaseAt ? row.releaseAt.toISOString() : null,
                feeLockMode: row.feeLockMode as "OFF" | "SOFT" | "HARD",
                feeLockThresholdAmount: parseFloat(
                  row.feeLockThresholdAmount || "0",
                ),
                publicLookupEnabled: row.publicLookupEnabled,
                publicToppersEnabled: row.publicToppersEnabled,
              };
            }
          }

          return {
            setups: setupsList.map((s) => ({ id: s.id, name: s.name })),
            selectedSetupId,
            settings: settingsData,
          };
        },
        { maxQueries: 6 },
      );
    },
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/exams/report-cards"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Result Release Gate &amp; Visibility Policies
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Configure scheduled publication, emergency withhold, fee defaulter locks, and public lookup
            </p>
          </div>
        </div>
      </div>

      <ResultSettingsClient
        setups={data.setups}
        selectedSetupId={data.selectedSetupId}
        initialSettings={data.settings}
      />
    </div>
  );
}
