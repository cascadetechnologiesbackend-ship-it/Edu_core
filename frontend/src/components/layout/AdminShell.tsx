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
    schoolName?: string;
    role?: string;
    expiresInMinutes?: number;
  } | null;
}

export function AdminShell({
  children,
  currentUser,
  effectiveRole,
  impersonationData,
}: AdminShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-1 overflow-hidden min-h-0 relative">
      {/* Sidebar with mobile drawer support and desktop inline mode */}
      <Sidebar
        userRole={effectiveRole as any}
        currentUser={currentUser}
        schoolName={impersonationData?.schoolName}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          currentUser={currentUser}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          breadcrumbs={[
            {
              label: impersonationData?.schoolName
                ? `${impersonationData.schoolName} Admin`
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
