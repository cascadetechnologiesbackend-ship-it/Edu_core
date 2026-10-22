export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getCachedSession } from "@/lib/serverAuth";
import { redirect } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import PwaHeader from "@/components/layout/PwaHeader";
import { GraduationCap, ShieldAlert } from "lucide-react";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SessionProvider } from "next-auth/react";
import { resolveStudentScope } from "@/lib/studentEventEngine/scopeResolver";

export const metadata: Metadata = {
  title: {
    default: "Student Learning Companion",
    template: "%s | Student | SchoolMitra ERP",
  },
  description: "My timetable, homework assignments, report cards, fees & syllabus.",
};

const STUDENT_NAV_ITEMS = [
  { label: "Home", href: "/student/dashboard", icon: "LayoutDashboard" },
  { label: "Homework", href: "/student/homework", icon: "BookOpen" },
  { label: "Timetable", href: "/student/timetable", icon: "Calendar" },
  { label: "More", href: "/student/more", icon: "MoreHorizontal" },
];

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedSession();

  if (!session?.user) {
    redirect("/login");
  }

  // Ensure role is student or administrator previewing student portal
  const allowed = ["STUDENT", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];
  if (!allowed.includes(session.user.role)) {
    const { assertRouteAccess } = await import("@/lib/routeGuards");
    const access = assertRouteAccess(session.user.role, "/student", {
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

  // Check if student user account is disabled (BR9)
  let isAccountDisabled = false;
  if (session.user.role === "STUDENT" && session.user.schoolId) {
    try {
      const scope = await resolveStudentScope(session.user.id, {
        schoolId: session.user.schoolId,
        role: "STUDENT",
      });
      isAccountDisabled = scope.isAccountDisabled;
    } catch {
      // Scope resolution errors handled individually on pages
    }
  }

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-20 md:pb-6">
        {/* Mobile-First Student PWA Top Bar */}
        <PwaHeader
          role="STUDENT"
          roleLabel="Student Companion"
          accentColor="indigo"
          schoolName={schoolName}
          icon={<GraduationCap className="w-4 h-4 text-indigo-400" />}
          userSession={session}
        />

        {/* Disabled Account Notice Banner (BR9) */}
        {isAccountDisabled && (
          <div className="max-w-3xl w-full mx-auto p-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-amber-200">Account Access Suspended</h2>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Your student portal login has been temporarily disabled by the school office. Your academic and attendance records remain preserved. Please contact your class teacher or administration.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area (Max-w-3xl for optimal mobile/tablet reading) */}
        <main className="flex-1 max-w-3xl w-full mx-auto p-4">{children}</main>

        {/* Bottom Thumb-Zone Navigation */}
        <BottomNav items={STUDENT_NAV_ITEMS} />
      </div>
    </SessionProvider>
  );
}
