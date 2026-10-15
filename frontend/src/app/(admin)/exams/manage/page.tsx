import { db } from "@/db";
import {
  exams,
  academicYears,
  examTypes,
  classes,
  cocurricularAreas,
  gradeRules,
  schools,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { ExamManageClient } from "./ExamManageClient";
import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";

export const metadata: Metadata = {
  title: "Exam Setup & Configurations | SchoolMitra ERP",
  description: "Configure examinations, components, cocurricular areas, and grading rules",
};

export default async function ExamManagePage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/exams", {
    id: ctx.userId,
    email: ctx.email,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = ctx.schoolId || "";

  const data = await withDataPhaseTiming("/exams/manage", async () => {
    return assertQueryBudget(
      async () => {
        const activeYear = await db.query.academicYears.findFirst({
          where: and(
            eq(academicYears.schoolId, schoolId),
            eq(academicYears.isActive, true),
          ),
        });

        const [classList, examTypeList, examsList, cocurricularList, rulesList, schoolRow] =
          await Promise.all([
            db.query.classes.findMany({
              where: and(
                eq(classes.schoolId, schoolId),
                eq(classes.isActive, true),
              ),
              orderBy: (t, { asc }) => [asc(t.sortOrder)],
            }),
            db.query.examTypes.findMany({
              where: and(
                eq(examTypes.schoolId, schoolId),
                eq(examTypes.isActive, true),
              ),
              orderBy: (t, { asc }) => [asc(t.name)],
            }),
            activeYear
              ? db.query.exams.findMany({
                  where: and(
                    eq(exams.schoolId, schoolId),
                    eq(exams.academicYearId, activeYear.id),
                  ),
                  with: {
                    examType: true,
                    components: true,
                  },
                  orderBy: (t, { desc }) => [desc(t.startDate)],
                })
              : [],
            db.query.cocurricularAreas.findMany({
              where: eq(cocurricularAreas.schoolId, schoolId),
              orderBy: (t, { asc }) => [asc(t.name)],
            }),
            db.query.gradeRules.findMany({
              where: eq(gradeRules.schoolId, schoolId),
              orderBy: (t, { desc }) => [desc(t.minPercent)],
            }),
            db.query.schools.findFirst({
              where: eq(schools.id, schoolId),
            }),
          ]);

        return {
          activeYear,
          board: schoolRow?.board || "CBSE",
          classes: classList.map((c) => ({
            id: c.id,
            displayName: c.displayName,
            gradeLevel: c.gradeLevel ?? null,
          })),
          examTypes: examTypeList.map((et) => ({
            id: et.id,
            name: et.name,
            code: et.code,
            applicableClassGroups: (et.applicableClassGroups as string[] | null) || null,
          })),
          exams: examsList.map((ex) => ({
            id: ex.id,
            name: ex.name,
            startDate: new Date(ex.startDate).toISOString(),
            endDate: new Date(ex.endDate).toISOString(),
            examType: ex.examType ? { name: ex.examType.name } : null,
            components: ex.components?.map((cmp) => ({
              id: cmp.id,
              displayName: cmp.displayName,
              weightPercent: cmp.weightPercent,
              showOnReportCard: cmp.showOnReportCard,
            })),
          })),
          cocurricularAreas: cocurricularList.map((ca) => ({
            id: ca.id,
            name: ca.name,
            description: ca.description,
            isActive: ca.isActive,
          })),
          gradeRules: rulesList.map((gr) => ({
            id: gr.id,
            classGroup: gr.classGroup,
            minPercent: gr.minPercent,
            maxPercent: gr.maxPercent,
            grade: gr.grade,
            gradePoint: gr.gradePoint,
            description: gr.description,
          })),
        };
      },
      { maxQueries: 10, label: "Exam Manage Data" },
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-5">
        <div className="space-y-1">
          <Link
            href="/exams/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Examination Setup & Standards</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Define exam terms, weightages, sub-components, co-curricular metrics, and grading brackets.
          </p>
        </div>
      </div>

      <ExamManageClient
        schoolId={schoolId}
        activeYearId={data.activeYear?.id || ""}
        board={data.board}
        classes={data.classes}
        examTypes={data.examTypes}
        exams={data.exams}
        cocurricularAreas={data.cocurricularAreas}
        gradeRules={data.gradeRules}
      />
    </div>
  );
}
