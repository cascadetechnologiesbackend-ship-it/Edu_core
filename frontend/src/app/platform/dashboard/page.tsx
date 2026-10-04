import { redirect } from "next/navigation";

export default function PlatformDashboardRedirect() {
  redirect("/super-admin/dashboard");
}
