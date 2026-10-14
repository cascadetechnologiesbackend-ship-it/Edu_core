import { redirect } from "next/navigation";

/**
 * Backward-compatible redirect per S8:
 * /exams/results -> /exams/report-cards
 */
export default function ExamResultsRedirectPage({
  searchParams,
}: {
  searchParams: { setupId?: string; classId?: string };
}) {
  const query = new URLSearchParams();
  if (searchParams.setupId) query.set("setupId", searchParams.setupId);
  if (searchParams.classId) query.set("classId", searchParams.classId);
  const qStr = query.toString();
  redirect(qStr ? `/exams/report-cards?${qStr}` : "/exams/report-cards");
}
