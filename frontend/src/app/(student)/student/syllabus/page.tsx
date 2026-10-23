export const dynamic = "force-dynamic";

import React from "react";
import { getStudentSyllabusAction } from "./syllabusActions";
import { StudentSyllabusClient } from "@/components/student/syllabus/StudentSyllabusClient";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Syllabus Progress & Tracker | Student Companion",
  description: "View taught units, chapters, and upcoming topics for enrolled subjects.",
};

export default async function StudentSyllabusPage({
  searchParams,
}: {
  searchParams?: { subjectId?: string; studentId?: string };
}) {
  const subjectIdParam = searchParams?.subjectId;
  const studentIdParam = searchParams?.studentId;

  const res = await getStudentSyllabusAction(subjectIdParam, studentIdParam);

  if (!res.success && res.error) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
        <p className="text-xs text-amber-200">{res.error}</p>
      </div>
    );
  }

  return (
    <StudentSyllabusClient
      subjects={res.subjects}
      selectedSubjectId={res.selectedSubjectId}
      selectedSubjectName={res.selectedSubjectName}
      units={res.units}
      progress={res.progress}
      studentName={res.studentName}
      className={res.className}
      sectionName={res.sectionName}
      studentIdParam={studentIdParam}
    />
  );
}
