export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/serverAuth";
import { redirect } from "next/navigation";

export default async function AccountantDashboardPage() {
  await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const);
  redirect("/school/fees-dashboard");
}
