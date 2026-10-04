import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PlatformSidebar } from "@/components/platform/PlatformSidebar";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { ImpersonationBanner } from "@/components/platform/ImpersonationBanner";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: {
    default: "Super Admin Platform Console",
    template: "%s | Super Admin | SchoolMitra ERP",
  },
  description: "Enterprise SaaS platform command center for multi-tenant school governance.",
};

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/super-admin/dashboard");
  }

  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  // Check if impersonation session cookie exists
  const cookieStore = cookies();
  const impersonationCookie = cookieStore.get("sm_impersonation");
  let impersonationData = null;
  if (impersonationCookie?.value) {
    try {
      impersonationData = JSON.parse(impersonationCookie.value);
    } catch {}
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#090d16] text-slate-100 font-sans antialiased">
      {/* Platform Sidebar */}
      <PlatformSidebar
        userEmail={session.user.email ?? "operator@schoolmitra.in"}
        userName={session.user.name ?? "Platform Super Admin"}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Global Platform Header */}
        <PlatformHeader />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto" id="platform-main">
          <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
