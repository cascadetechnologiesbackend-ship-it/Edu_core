"use client";

import React, { useState } from "react";
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
  const activeSchoolName = impersonationData?.schoolName || explicitSchoolName;
  const isDemoSchool = activeSchoolName?.includes("DEMO") ?? false;

  return (
    <div className="flex flex-1 overflow-hidden min-h-0 relative">
      {/* Sidebar with mobile drawer support and desktop inline mode */}
      <Sidebar
        userRole={effectiveRole as any}
        currentUser={currentUser}
        schoolName={activeSchoolName}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {isDemoSchool && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-200 flex items-center justify-between font-medium shrink-0">
            <span className="flex items-center gap-2">
              <span className="bg-amber-500 text-black font-extrabold px-1.5 py-0.5 rounded text-[10px] tracking-wide">
                [DEMO DATA]
              </span>
              <span>This school tenant is running on synthetic demonstration data. All student, staff, and financial records are simulated.</span>
            </span>
            <span className="text-[10px] text-amber-300/70 hidden md:inline font-mono">DPA-DEMO</span>
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
