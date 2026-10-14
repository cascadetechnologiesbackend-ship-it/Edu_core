import { db } from "@/db";
import {
  exams,
  academicYears,
  examSchedules,
  examMarkDistributions,
  examComponents,
  classes,
  subjects,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Metadata } from "next";
import { requireAuth } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";
import { ScheduleClient } from "./ScheduleClient";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Datesheets & Schedules | SchoolMitra ERP",
  description: "Manage subject schedules, timings, and component marks distributions",
};

export default async function ExamSchedulePage({
  searchParams,
}: {
  searchParams: { examId?: string };
}) {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/exams", {
    id: ctx.userId,
    email: ctx.email,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = ctx.schoolId || "";

  const data = await withDataPhaseTiming("/exams/schedule", async () => {
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
            examsList: [],
            selectedExamId: "",
            classList: [],
            subjectList: [],
            componentsList: [],
            schedulesList: [],
            distributionsList: [],
          };
        }

        const examsList = await db.query.exams.findMany({
          where: and(
            eq(exams.schoolId, schoolId),
            eq(exams.academicYearId, activeYear.id),
          ),
          orderBy: (t, { desc }) => [desc(t.startDate)],
        });

        const selectedExamId =
          searchParams.examId && examsList.some((e) => e.id === searchParams.examId)
            ? searchParams.examId
            : examsList[0]?.id || "";

        const [classList, subjectList, componentsList, schedulesList, distributionsList] =
          await Promise.all([
            db.query.classes.findMany({
              where: and(
                eq(classes.schoolId, schoolId),
                eq(classes.isActive, true),
              ),
              orderBy: (t, { asc }) => [asc(t.sortOrder)],
            }),
            db.query.subjects.findMany({
              where: and(
                eq(subjects.schoolId, schoolId),
                eq(subjects.isActive, true),
              ),
              orderBy: (t, { asc }) => [asc(t.name)],
            }),
            selectedExamId
              ? db.query.examComponents.findMany({
                  where: and(
                    eq(examComponents.schoolId, schoolId),
                    eq(examComponents.examId, selectedExamId),
                  ),
                  orderBy: (t, { asc }) => [asc(t.sortOrder)],
                })
              : [],
            selectedExamId
              ? db.query.examSchedules.findMany({
                  where: and(
                    eq(examSchedules.schoolId, schoolId),
                    eq(examSchedules.examId, selectedExamId),
                  ),
                  with: {
                    class: true,
                    subject: true,
                  },
                  orderBy: (t, { asc }) => [asc(t.examDate), asc(t.startTime)],
                })
              : [],
            selectedExamId
              ? db.query.examMarkDistributions.findMany({
                  where: and(
                    eq(examMarkDistributions.schoolId, schoolId),
                    eq(examMarkDistributions.examId, selectedExamId),
                  ),
                })
              : [],
          ]);

        return {
          examsList: examsList.map((e) => ({ id: e.id, name: e.name })),
          selectedExamId,
          classList: classList.map((c) => ({ id: c.id, displayName: c.displayName })),
          subjectList: subjectList.map((s) => ({ id: s.id, name: s.name, code: s.code })),
          componentsList: componentsList.map((c) => ({
            id: c.id,
            displayName: c.displayName,
          })),
          schedulesList: schedulesList.map((s) => ({
            id: s.id,
            classId: s.classId,
            subjectId: s.subjectId,
            examDate: s.examDate,
            startTime: s.startTime,
            durationMinutes: s.durationMinutes,
            maxMarks: s.maxMarks,
            passingMarks: s.passingMarks,
            roomNumber: s.roomNumber,
            datesheetPublishedAt: s.datesheetPublishedAt,
            class: s.class ? { displayName: s.class.displayName } : null,
            subject: s.subject ? { name: s.subject.name, code: s.subject.code } : null,
          })),
          distributionsList: distributionsList.map((d) => ({
            id: d.id,
            classId: d.classId,
            subjectId: d.subjectId,
            componentId: d.componentId,
            maxMarks: d.maxMarks,
            passingMarks: d.passingMarks,
          })),
        };
      },
      { maxQueries: 6, label: "Exam Schedules Data" },
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
            <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Datesheets & Timetables</span>
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Stage 2: Configure subject examination dates, session timings, passing criteria, and sub-component distributions.
          </p>
        </div>
      </div>

      <ScheduleClient
        exams={data.examsList}
        selectedExamId={data.selectedExamId}
        classes={data.classList}
        subjects={data.subjectList}
        components={data.componentsList}
        schedules={data.schedulesList}
        distributions={data.distributionsList}
      />
    </div>
  );
}
