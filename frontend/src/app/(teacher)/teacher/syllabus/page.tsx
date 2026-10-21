import { Metadata } from "next";
import { Suspense } from "react";
import { TeacherSyllabusClient } from "./TeacherSyllabusClient";
import { getTeacherSyllabusData } from "./syllabusActions";

export const metadata: Metadata = {
  title: "Syllabus Tracker | Educator PWA",
  description: "Track NCERT and curriculum coverage, units, chapters, and syllabus pacing.",
};

export default async function TeacherSyllabusPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ classSubjectId?: string; locale?: string }>
    | { classSubjectId?: string; locale?: string };
}) {
  const resolvedParams =
    searchParams instanceof Promise ? await searchParams : searchParams || {};

  let syllabusData: any = {
    subjects: [],
    selectedSubject: null,
    units: [],
    overallProgress: {
      totalUnits: 0,
      totalChapters: 0,
      totalTopics: 0,
      taughtTopics: 0,
      progressPercent: 0,
    },
    paceInsight: {
      status: "ON_TRACK",
      progressPercent: 0,
      expectedPercent: 50,
      message: "No syllabus configured.",
      messageHi: "कोई पाठ्यक्रम कॉन्फ़िगर नहीं है।",
    },
  };

  try {
    syllabusData = await getTeacherSyllabusData(resolvedParams.classSubjectId);
  } catch (err) {
    console.error("[TeacherSyllabusPage] Error fetching syllabus data:", err);
  }

  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading syllabus tracker...</div>}>
      <TeacherSyllabusClient
        initialData={syllabusData}
        locale={resolvedParams.locale || "en"}
      />
    </Suspense>
  );
}
