export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  redirect("/super-admin/dashboard");
}
