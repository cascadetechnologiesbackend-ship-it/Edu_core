export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PlatformSidebar } from "@/components/platform/PlatformSidebar";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { ImpersonationBanner } from "@/components/platform/ImpersonationBanner";
import { cookies } from "next/headers";

import { verifyImpersonationToken } from "@/lib/impersonation";

export const metadata: Metadata = {
  title: {
    default: "Super Admin Platform Console",
    template: "%s | Super Admin | SchoolMitra ERP",
  },
  description: "Enterprise SaaS platform command center for multi-tenant school governance.",
};

import { SuperAdminBottomNav } from "@/components/platform/SuperAdminBottomNav";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  if (!session?.user) {
    redirect(`${basePath}/login?callbackUrl=${encodeURIComponent(`${basePath}/super-admin/dashboard`)}`);
  }

  if (session.user.role !== "SUPER_ADMIN") {
    const { assertRouteAccess } = await import("@/lib/routeGuards");
    const access = assertRouteAccess(session.user.role, "/super-admin/dashboard", {
      id: session.user.id,
      email: session.user.email ?? undefined,
      schoolId: session.user.schoolId ?? undefined,
    });
    const defaultDash = access.redirectUrl || "/dashboard";
    const targetDash = basePath && !defaultDash.startsWith(basePath) ? `${basePath}${defaultDash}` : defaultDash;
    redirect(targetDash);
  }

  // Check if impersonation session cookie exists (cryptographically verified)
  const cookieStore = cookies();
  const impersonationCookie = cookieStore.get("sm_impersonation");
  const impersonationData = verifyImpersonationToken(impersonationCookie?.value);

  const userEmail = session.user.email ?? "operator@schoolmitra.in";
  const userName = session.user.name ?? "Platform Super Admin";

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans antialiased">
      {/* Platform Sidebar - Desktop */}
      <PlatformSidebar userEmail={userEmail} userName={userName} />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Global Platform Header */}
        <PlatformHeader userEmail={userEmail} userName={userName} />

        {/* Impersonation Banner if active */}
        {impersonationData && (
          <ImpersonationBanner
            schoolName={impersonationData.schoolName}
            impersonatingRole="School Administrator"
            expiresInMinutes={Math.max(
              1,
              Math.round((impersonationData.exp - Date.now()) / (60 * 1000)),
            )}
          />
        )}

        {/* Scrollable Viewport with extra bottom padding for mobile bottom bar */}
        <main className="flex-1 overflow-y-auto" id="platform-main">
          <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-24 md:pb-8 animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Thumb Zone) */}
      <SuperAdminBottomNav />
    </div>
  );
}
