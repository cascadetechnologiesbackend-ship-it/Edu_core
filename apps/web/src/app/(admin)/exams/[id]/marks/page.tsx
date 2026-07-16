import { db } from "@/db";
import { exams, markEntries, classes, students, subjects } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";
import { MarkEntryGrid } from "./MarkEntryGrid";
import { decryptData } from "@/lib/encryption";

export const metadata: Metadata = {
  title: "Mark Entry | SchoolMitra ERP",
};

export default async function MarkEntryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { classId?: string };
}) {
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, params.id),
    with: { examType: true, academicYear: true },
  });

  if (!exam) notFound();

  const allClasses = await db.query.classes.findMany({
    where: eq(classes.academicYearId, exam.academicYearId),
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  });

  const selectedClassId = searchParams.classId ?? allClasses[0]?.id;

  let classStudents: Array<{ id: string; admissionNumber: string; name: string }> = [];
  let classSubjectsData: Array<{ id: string; name: string; maxMarks: number }> = [];
  let existingMarks: typeof markEntries.$inferSelect[] = [];

  if (selectedClassId) {
    const rawStudents = await db.query.students.findMany({
      where: and(
        eq(students.currentClassId, selectedClassId),
        eq(students.isActive, true),
      ),
      orderBy: (t, { asc }) => [asc(t.admissionNumber)],
    });

    classStudents = rawStudents.map((s) => ({
      id: s.id,
      admissionNumber: s.admissionNumber,
      name: `${decryptData(s.firstNameEncrypted)} ${decryptData(s.lastNameEncrypted)}`,
    }));


    // Get subjects directly if classSubjects join is empty
    const allSubjectsData = await db.query.subjects.findMany({
      where: eq(subjects.isActive, true),
      orderBy: (t, { asc }) => [asc(t.name)],
    });

    classSubjectsData = allSubjectsData.slice(0, 8).map((s) => ({
      id: s.id,
      name: s.name,
      maxMarks: s.maxMarks,
    }));

    if (classStudents.length > 0 && classSubjectsData.length > 0) {
      existingMarks = await db.query.markEntries.findMany({
        where: and(
          eq(markEntries.examId, params.id),
          inArray(
            markEntries.studentId,
            classStudents.map((s) => s.id),
          ),
        ),
      });
    }
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <Link href={`/exams/${params.id}`} className="text-sm text-indigo-600 hover:underline">
              ← {exam.name}
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-2">Mark Entry</h1>
          {exam.isLocked && (
            <div className="mt-2 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-md text-sm inline-flex items-center gap-2">
              🔒 This exam is locked. Contact the Principal to unlock.
            </div>
          )}
        </div>
      </div>

      {/* Class Filter */}
      <div className="flex gap-2 flex-wrap">
        {allClasses.map((cls) => (
          <Link
            key={cls.id}
            href={`/exams/${params.id}/marks?classId=${cls.id}`}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              selectedClassId === cls.id
                ? "bg-indigo-600 text-white"
                : "bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
            }`}
          >
            {cls.displayName}
          </Link>
        ))}
      </div>

      {selectedClassId && (
        <MarkEntryGrid
          examId={params.id}
          students={classStudents}
          subjects={classSubjectsData}
          existingMarks={existingMarks.map((m) => ({
            id: m.id,
            studentId: m.studentId,
            subjectId: m.subjectId,
            marksObtained: m.marksObtained ? parseFloat(m.marksObtained) : null,
            maxMarks: parseFloat(m.maxMarks),
            isAbsent: m.isAbsent,
            isMedicalExempt: m.isMedicalExempt,
            grade: m.grade,
            status: m.status,
          }))}
          isLocked={exam.isLocked}
        />
      )}
    </div>
  );
}
