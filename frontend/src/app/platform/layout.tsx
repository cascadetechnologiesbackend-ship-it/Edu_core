export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  redirect(basePath ? `${basePath}/super-admin/dashboard` : "/super-admin/dashboard");
}
