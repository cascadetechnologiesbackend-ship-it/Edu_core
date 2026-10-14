import { redirect } from "next/navigation";

/**
 * Backward-compatible redirect per S8 Amendment 5:
 * /exams/[id] -> /exams/schedule?examId=[id]
 */
export default function ExamDetailRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/exams/schedule?examId=${params.id}`);
}
