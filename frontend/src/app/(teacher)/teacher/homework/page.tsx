import { Metadata } from "next";
import { Suspense } from "react";
import { TeacherHomeworkClient } from "./TeacherHomeworkClient";
import { getTeacherHomeworkData } from "./homeworkActions";

export const metadata: Metadata = {
  title: "Homework & Assignments | Educator PWA",
  description: "Create, assign, grade, and monitor section homework and assignments.",
};

export default async function TeacherHomeworkPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ sectionId?: string; classSubjectId?: string; locale?: string }>
    | { sectionId?: string; classSubjectId?: string; locale?: string };
}) {
  const resolvedParams =
    searchParams instanceof Promise ? await searchParams : searchParams || {};

  let homeworkList: any[] = [];
  let allocations: any[] = [];
  let syllabusTopics: any[] = [];

  try {
    const data = await getTeacherHomeworkData({
      ...(resolvedParams.sectionId ? { sectionId: resolvedParams.sectionId } : {}),
      ...(resolvedParams.classSubjectId ? { classSubjectId: resolvedParams.classSubjectId } : {}),
    });
    homeworkList = data.homeworkList;
    allocations = data.allocations;
    syllabusTopics = data.syllabusTopics;
  } catch (err) {
    console.error("[TeacherHomeworkPage] Error fetching homework data:", err);
  }

  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading homework...</div>}>
      <TeacherHomeworkClient
        initialHomeworkList={homeworkList}
        allocations={allocations}
        syllabusTopics={syllabusTopics}
        locale={resolvedParams.locale || "en"}
      />
    </Suspense>
  );
}
