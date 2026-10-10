export const dynamic = "force-dynamic";

import { getCachedSession } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import PwaHeader from "@/components/layout/PwaHeader";
import { BookOpen } from "lucide-react";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { eq } from "drizzle-orm";

import { SessionProvider } from "next-auth/react";

const TEACHER_NAV_ITEMS = [
  { label: "My Hub", href: "/teacher/dashboard", icon: "LayoutDashboard" },
  { label: "Attendance", href: "/teacher/attendance", icon: "CalendarCheck" },
  { label: "Gradebook", href: "/teacher/grading", icon: "FileSpreadsheet" },
  { label: "My Classes", href: "/teacher/classes", icon: "BookOpen" },
  { label: "Payroll", href: "/teacher/payroll", icon: "Receipt" },
];

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedSession();

  if (!session?.user) {
    redirect("/login");
  }

  // Ensure role is teacher or administrator previewing teacher portal
  const allowed = ["TEACHER", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];
  if (!allowed.includes(session.user.role)) {
    const { assertRouteAccess } = await import("@/lib/routeGuards");
    const access = assertRouteAccess(session.user.role, "/teacher", {
      id: session.user.id,
      email: session.user.email ?? undefined,
      schoolId: session.user.schoolId ?? undefined,
    });
    redirect(access.redirectUrl || "/dashboard");
  }

  // Fetch school name if available
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-20 md:pb-6">
        {/* Mobile-First PWA Header */}
        <PwaHeader
          role="TEACHER"
          roleLabel="Educator Workspace"
          accentColor="emerald"
          schoolName={schoolName}
          icon={<BookOpen className="w-4 h-4 text-emerald-400" />}
          userSession={session}
        />

        {/* Main Content Area (Optimized for Mobile & Tablet Thumb Zone) */}
        <main className="flex-1 max-w-3xl w-full mx-auto p-4">{children}</main>

        {/* Persistent Bottom Navigation */}
        <BottomNav items={TEACHER_NAV_ITEMS} />
      </div>
    </SessionProvider>
  );
}
