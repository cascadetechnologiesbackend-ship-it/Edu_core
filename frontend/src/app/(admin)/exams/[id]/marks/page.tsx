import { redirect } from "next/navigation";

/**
 * Backward-compatible redirect per S8 Amendment 5:
 * /exams/[id]/marks -> /exams/marks?examId=[id]
 */
export default function ExamMarksRedirectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { classId?: string; subjectId?: string };
}) {
  const query = new URLSearchParams({ examId: params.id });
  if (searchParams.classId) query.set("classId", searchParams.classId);
  if (searchParams.subjectId) query.set("subjectId", searchParams.subjectId);
  redirect(`/exams/marks?${query.toString()}`);
}
