import { db } from "@/db";
import {
  reportCardSetups,
  academicYears,
  exams,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { SetupBuilderClient } from "./SetupBuilderClient";
import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";

export const metadata: Metadata = {
  title: "Report Card Framework Setups | SchoolMitra ERP",
  description: "Configure report card structures, assessment weightages, and grading templates",
};

const SETUP_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
] as const;

export default async function ReportCardSetupsPage() {
  const ctx = await requireAuth(SETUP_ADMIN_ROLES);
  const access = assertRouteAccess(ctx.role, "/exams/report-cards/setups", {
    id: ctx.userId,
    email: ctx.email,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = ctx.schoolId || "";

  const data = await withDataPhaseTiming("/exams/report-cards/setups", async () => {
    return assertQueryBudget(
      async () => {
        const activeYear = await db.query.academicYears.findFirst({
          where: and(
            eq(academicYears.schoolId, schoolId),
            eq(academicYears.isActive, true),
          ),
        });

        if (!activeYear) {
          return {
            activeYear: { id: "", label: "No Active Year" },
            examsList: [],
            existingSetups: [],
          };
        }

        const [examsList, rawSetups] = await Promise.all([
          db.query.exams.findMany({
            where: and(
              eq(exams.schoolId, schoolId),
              eq(exams.academicYearId, activeYear.id),
            ),
            orderBy: (t, { desc }) => [desc(t.startDate)],
          }),
          db.query.reportCardSetups.findMany({
            where: and(
              eq(reportCardSetups.schoolId, schoolId),
              eq(reportCardSetups.academicYearId, activeYear.id),
            ),
            orderBy: (t, { desc }) => [desc(t.createdAt)],
          }),
        ]);

        const formattedSetups = rawSetups.map((s) => ({
          id: s.id,
          name: s.name,
          examWeightages:
            (s.examWeightages as Array<{ examId: string; weightPercent: number }>) ||
            [],
          layout: s.layout,
          isActive: s.isActive,
          createdAt: s.createdAt.toISOString(),
        }));

        return {
          activeYear: { id: activeYear.id, label: activeYear.label },
          examsList: examsList.map((e) => ({ id: e.id, name: e.name })),
          existingSetups: formattedSetups,
        };
      },
      { maxQueries: 6 },
    );
  });

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
                <SlidersHorizontal className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Report Card Framework Setups
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Configure term combinations, weightage distributions, and holistic grading templates
            </p>
          </div>
        </div>
      </div>

      <SetupBuilderClient
        activeYear={data.activeYear}
        exams={data.examsList}
        existingSetups={data.existingSetups}
      />
    </div>
  );
}
