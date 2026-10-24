import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function HRManagerDashboardRedirect() {
  redirect("/hr?tab=overview");
}
