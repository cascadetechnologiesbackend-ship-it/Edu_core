export const dynamic = "force-dynamic";

import React from "react";
import type { Metadata } from "next";
import { AdminShell } from "@/components/layout/AdminShell";
import { getCachedSession } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: {
    default: "Principal Workspace",
    template: "%s | Principal | SchoolMitra ERP",
  },
};

export default async function PrincipalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedSession();

  if (!session?.user) {
    redirect("/login?error=SessionExpired");
  }

  if (session.user.isActive === false) {
    redirect("/login?error=AccountDeactivated");
  }

  const allowed = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];
  if (!allowed.includes(session.user.role)) {
    const { assertRouteAccess } = await import("@/lib/routeGuards");
    const access = assertRouteAccess(session.user.role, "/principal/dashboard", {
      id: session.user.id,
      email: session.user.email ?? undefined,
      schoolId: session.user.schoolId ?? undefined,
    });
    redirect(access.redirectUrl || "/dashboard");
  }

  let schoolName = "SchoolMitra ERP";
  if (session.user.schoolId) {
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, session.user.schoolId),
      columns: { name: true },
    });
    if (school?.name) {
      schoolName = school.name;
    }
  }

  return (
    <SessionProvider session={session}>
      <AdminShell
        currentUser={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
        }}
        effectiveRole="PRINCIPAL"
        impersonationData={{
          schoolName,
          role: "Principal",
        }}
      >
        {children}
      </AdminShell>
    </SessionProvider>
  );
}
