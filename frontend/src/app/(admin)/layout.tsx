export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { getCachedSession } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ImpersonationBanner } from "@/components/platform/ImpersonationBanner";
import { SessionProvider } from "next-auth/react";
import { verifyImpersonationToken } from "@/lib/impersonation";
import { FpsOverlay } from "@/components/dev/FpsOverlay";

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
  // React cache() memoized session guarantees single fetch across RSC layout and child pages
  const session = await getCachedSession();

  if (!session?.user) {
    redirect("/login?error=AccountDeactivated");
  }

  // Check if superadmin is impersonating a school (cryptographically verified)
  const cookieStore = cookies();
  const impCookie = cookieStore.get("sm_impersonation");
  const verifiedImpersonation = session.user.role === "SUPER_ADMIN"
    ? verifyImpersonationToken(impCookie?.value)
    : null;

  const impersonationData = verifiedImpersonation
    ? {
        schoolId: verifiedImpersonation.schoolId,
        schoolName: verifiedImpersonation.schoolName,
        role: "School Administrator",
        expiresInMinutes: Math.max(
          1,
          Math.round((verifiedImpersonation.exp - Date.now()) / (60 * 1000)),
        ),
      }
    : null;

  // Enforce layout-level security: parents/students belong in the /portal route group
  if (session.user.role === "PARENT" || session.user.role === "STUDENT") {
    const { assertRouteAccess } = await import("@/lib/routeGuards");
    const access = assertRouteAccess(session.user.role, "/admin", {
      id: session.user.id,
      email: session.user.email ?? undefined,
      schoolId: session.user.schoolId ?? undefined,
    });
    redirect(access.redirectUrl || "/portal");
  }

  // Drivers belong in the driver hub
  if (session.user.role === "DRIVER") {
    const { assertRouteAccess } = await import("@/lib/routeGuards");
    const access = assertRouteAccess(session.user.role, "/admin", {
      id: session.user.id,
      email: session.user.email ?? undefined,
      schoolId: session.user.schoolId ?? undefined,
    });
    redirect(access.redirectUrl || "/driver/dashboard");
  }

  // Teachers belong in the educator PWA workspace
  if (session.user.role === "TEACHER") {
    const { assertRouteAccess } = await import("@/lib/routeGuards");
    const access = assertRouteAccess(session.user.role, "/admin", {
      id: session.user.id,
      email: session.user.email ?? undefined,
      schoolId: session.user.schoolId ?? undefined,
    });
    redirect(access.redirectUrl || "/teacher/dashboard");
  }

  // Super admins belong in the platform management group, UNLESS currently impersonating a school!
  if (session.user.role === "SUPER_ADMIN" && !impersonationData?.schoolId) {
    redirect("/super-admin/dashboard");
  }

  // Effective role for sidebar and navigation
  const effectiveRole = impersonationData ? "SCHOOL_ADMIN" : session.user.role;

  const currentUser = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    role: effectiveRole,
    image: session.user.image ?? null,
  };

  return (
    <SessionProvider session={session}>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {/* Impersonation Banner at top of School Admin Portal */}
        {impersonationData && (
          <ImpersonationBanner
            schoolName={impersonationData.schoolName ?? "School Instance"}
            impersonatingRole={impersonationData.role ?? "School Administrator"}
            expiresInMinutes={impersonationData.expiresInMinutes ?? 60}
          />
        )}

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sidebar */}
          <Sidebar
            userRole={effectiveRole as any}
            currentUser={currentUser}
            schoolName={impersonationData?.schoolName}
          />

          {/* Main content */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <Header
              currentUser={currentUser}
              breadcrumbs={[
                {
                  label: impersonationData?.schoolName ? `${impersonationData.schoolName} Admin` : "Admin",
                  href: "/dashboard",
                },
              ]}
            />

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
        <FpsOverlay />
      </div>
    </SessionProvider>
  );
}
