import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: {
    default: "Platform Admin",
    template: "%s | Platform | SchoolMitra ERP",
  },
};

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard"); // Send non-super-admins back to regular tenant dashboard
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Platform Sidebar */}
      <aside className="w-64 border-r bg-muted/20 flex flex-col h-full">
        <div className="p-4 border-b font-bold text-lg">SchoolMitra Platform</div>
        <nav className="flex-1 p-4 space-y-2">
          <a href="/platform/dashboard" className="block px-3 py-2 rounded-md hover:bg-accent text-sm font-medium">
            Dashboard
          </a>
          <a href="/platform/schools" className="block px-3 py-2 rounded-md hover:bg-accent text-sm font-medium">
            Tenant Schools
          </a>
          <a href="/platform/audit" className="block px-3 py-2 rounded-md hover:bg-accent text-sm font-medium">
            Platform Audit Logs
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header breadcrumbs={[{ label: "Platform Admin", href: "/platform/dashboard" }]} />

        <main
          className="flex-1 overflow-y-auto"
          id="main-content"
          role="main"
        >
          <div className="p-6 max-w-screen-2xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
