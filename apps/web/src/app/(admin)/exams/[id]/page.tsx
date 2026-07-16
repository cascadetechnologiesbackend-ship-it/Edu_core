import { db } from "@/db";
import { exams, examSchedules, classes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Lock, Unlock, ClipboardList } from "lucide-react";
import { lockExam, unlockExam } from "../actions";
import { Metadata } from "next";
import { ScheduleManager } from "./ScheduleManager";

export const metadata: Metadata = {
  title: "Exam Detail | SchoolMitra ERP",
};

export default async function ExamDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, params.id),
    with: { examType: true, academicYear: true },
  });

  if (!exam) notFound();

  const schedules = await db.query.examSchedules.findMany({
    where: eq(examSchedules.examId, params.id),
    with: { subject: true, class: true, invigilator: true },
    orderBy: (t, { asc }) => [asc(t.examDate), asc(t.startTime)],
  });

  const allClasses = await db.query.classes.findMany({
    where: eq(classes.academicYearId, exam.academicYearId),
  });

  const allSubjects = await db.query.subjects.findMany();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/exams" className="text-sm text-indigo-600 hover:underline">
              ← Exams
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            {exam.name}
          </h1>
          <div className="flex gap-3 mt-2">
            <span className="text-sm text-gray-500">
              {new Date(exam.startDate).toLocaleDateString()} →{" "}
              {new Date(exam.endDate).toLocaleDateString()}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                exam.isLocked
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {exam.isLocked ? "🔒 Locked" : "Open for Marks"}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/exams/${exam.id}/marks`}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            Enter Marks
          </Link>
          {!exam.isLocked ? (
            <form action={lockExam.bind(null, exam.id)}>
              <button
                type="submit"
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <Lock className="w-4 h-4" />
                Lock Exam
              </button>
            </form>
          ) : (
            <form action={unlockExam.bind(null, exam.id)}>
              <button
                type="submit"
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <Unlock className="w-4 h-4" />
                Unlock Exam
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Exam Scheduling Section */}
      <ScheduleManager
        examId={exam.id}
        classes={allClasses}
        subjects={allSubjects}
        schedules={schedules}
        isLocked={exam.isLocked}
      />
    </div>
  );
}
