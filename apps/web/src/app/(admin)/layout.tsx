import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getActiveTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: {
    default: "Admin Portal",
    template: "%s | Admin | SchoolMitra ERP",
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Validate active subdomain tenant
  await getActiveTenant();

  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Enforce layout-level security: parents/students belong in the /portal route group
  if (session.user.role === "PARENT" || session.user.role === "STUDENT") {
    redirect("/portal");
  }

  // Super admins belong in the platform management group
  if (session.user.role === "SUPER_ADMIN") {
    redirect("/platform/dashboard");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header breadcrumbs={[{ label: "Admin", href: "/dashboard" }]} />

        <main
          className="flex-1 overflow-y-auto"
          id="main-content"
          role="main"
          aria-label="Main content"
        >
          <div className="p-6 max-w-screen-2xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
