import { redirect } from "next/navigation";

/**
 * Backward-compatible redirect per S8 Amendment 5:
 * /exams -> /exams/dashboard
 */
export default function ExamsRedirectPage() {
  redirect("/exams/dashboard");
}
