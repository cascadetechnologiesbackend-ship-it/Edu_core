"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, type SidebarCurrentUser } from "./Sidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";

interface AdminShellProps {
  children: React.ReactNode;
  currentUser: SidebarCurrentUser;
  effectiveRole: string;
  impersonationData: {
    schoolName?: string | undefined;
    role?: string | undefined;
    expiresInMinutes?: number | undefined;
  } | null;
  schoolName?: string | undefined;
}

export function AdminShell({
  children,
  currentUser,
  effectiveRole,
  impersonationData,
  schoolName: explicitSchoolName,
}: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const activeSchoolName = impersonationData?.schoolName || explicitSchoolName;
  const isDemoSchool = activeSchoolName?.includes("DEMO") ?? false;

  // Release any lingering body scroll lock and reset scroll position when navigating between modules
  useEffect(() => {
    setMobileMenuOpen(false);
    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
      document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [pathname]);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden relative">
      {/* Sidebar with mobile drawer support and desktop fixed inline mode */}
      <Sidebar
        userRole={effectiveRole as any}
        currentUser={currentUser}
        schoolName={activeSchoolName}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {isDemoSchool && (
          <div className="bg-semantic-attention/10 border-b border-semantic-attention/20 px-4 py-1.5 text-xs text-semantic-attention flex items-center justify-between font-medium shrink-0">
            <span className="flex items-center gap-2">
              <span className="bg-semantic-attention text-black font-bold px-1.5 py-0.5 rounded-md text-[10px] tracking-wide">
                [DEMO DATA]
              </span>
              <span>This school tenant is running on synthetic demonstration data. All student, staff, and financial records are simulated.</span>
            </span>
            <span className="text-[10px] text-semantic-attention/80 hidden md:inline font-mono">DPA-DEMO</span>
          </div>
        )}

        <Header
          currentUser={currentUser}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          breadcrumbs={[
            {
              label: activeSchoolName
                ? `${activeSchoolName} Admin`
                : "Admin",
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
          {/* Responsive page padding: compact on mobile, thumb-friendly safe-area bottom offset for MobileBottomNav */}
          <div className="p-3 sm:p-4 md:p-6 pb-24 md:pb-6 max-w-screen-2xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Fixed Mobile Bottom Navigation Bar (UX-R16) */}
      <MobileBottomNav
        isMenuOpen={mobileMenuOpen}
        onOpenMenu={() => setMobileMenuOpen((prev) => !prev)}
      />
    </div>
  );
}
