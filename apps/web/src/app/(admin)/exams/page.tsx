import { db } from "@/db";
import { exams, academicYears } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { PlusCircle, ClipboardList, BookOpen } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Examinations | SchoolMitra ERP",
  description: "Manage exams, mark entry, and report cards",
};

export default async function ExamsPage() {
  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });

  const allExams = activeYear
    ? await db.query.exams.findMany({
        where: eq(exams.academicYearId, activeYear.id),
        with: { examType: true },
        orderBy: (t, { desc }) => [desc(t.startDate)],
      })
    : [];

  const allExamTypes = await db.query.examTypes.findMany();

  const statusBadge = (locked: boolean) =>
    locked
      ? "bg-green-100 text-green-800"
      : "bg-yellow-100 text-yellow-800";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Examinations
          </h1>
          <p className="text-sm text-gray-500">
            Manage exam schedules, mark entry, and report card generation.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/exams/new"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            New Exam
          </Link>
        </div>
      </div>

      {/* Exam Type Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {allExamTypes.slice(0, 4).map((et) => {
          const count = allExams.filter((e) => e.examTypeId === et.id).length;
          return (
            <div
              key={et.id}
              className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm"
            >
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {et.name}
              </p>
              <p className="text-3xl font-bold mt-2">{count}</p>
              <p className="text-xs text-gray-400 mt-1">Scheduled</p>
            </div>
          );
        })}
      </div>

      {/* Exams List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {activeYear ? `Exams — ${activeYear.label}` : "No Active Academic Year"}
          </h2>
        </div>

        {allExams.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No exams scheduled yet.</p>
            <Link
              href="/exams/new"
              className="mt-4 inline-block text-indigo-600 hover:underline text-sm"
            >
              Create your first exam →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {allExams.map((exam) => (
              <div
                key={exam.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {exam.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(exam.isLocked)}`}
                    >
                      {exam.isLocked ? "Locked" : "Open"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {(exam as any).examType?.name ?? "—"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(exam.startDate).toLocaleDateString()} →{" "}
                    {new Date(exam.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/exams/${exam.id}`}
                    className="text-sm text-indigo-600 hover:underline px-3 py-1"
                  >
                    Schedule
                  </Link>
                  <Link
                    href={`/exams/${exam.id}/marks`}
                    className="text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 px-3 py-1 rounded-md flex items-center gap-1"
                  >
                    <ClipboardList className="w-3 h-3" />
                    Marks
                  </Link>
                  <Link
                    href={`/exams/report-cards?examId=${exam.id}`}
                    className="text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1 rounded-md"
                  >
                    Report Cards
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
