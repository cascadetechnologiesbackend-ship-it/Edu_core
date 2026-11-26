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
import type { UserRole } from "@/lib/roleConfig";

export const metadata: Metadata = {
  title: {
    default: "Accountant Desk",
    template: "%s | Accountant | SchoolMitra ERP",
  },
};

export default async function AccountantLayout({
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

  const allowed = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"];
  if (!allowed.includes(session.user.role)) {
    const { assertRouteAccess } = await import("@/lib/routeGuards");
    const access = assertRouteAccess(session.user.role, "/accountant/dashboard", {
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

  const authBasePath = process.env.NEXT_PUBLIC_BASE_PATH
    ? `${process.env.NEXT_PUBLIC_BASE_PATH}/api/auth`
    : "/api/auth";

  const effectiveRole: UserRole =
    session.user.role === "ACCOUNTANT"
      ? "ACCOUNTANT"
      : (session.user.role as UserRole);

  return (
    <SessionProvider session={session} basePath={authBasePath}>
      <AdminShell
        currentUser={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
        }}
        effectiveRole={effectiveRole}
        impersonationData={{
          schoolName,
          role: session.user.role === "ACCOUNTANT" ? "Accountant" : session.user.role,
        }}
      >
        {children}
      </AdminShell>
    </SessionProvider>
  );
}
