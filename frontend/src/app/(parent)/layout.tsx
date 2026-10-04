export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import PwaHeader from "@/components/layout/PwaHeader";
import { Users } from "lucide-react";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: {
    default: "Parent Portal",
    template: "%s | Parent | SchoolMitra ERP",
  },
};

const PARENT_NAV_ITEMS = [
  { label: "Overview", href: "/parent/dashboard", icon: "LayoutDashboard" },
  { label: "Attendance", href: "/parent/dashboard?tab=attendance", icon: "CalendarCheck" },
  { label: "Fee Portal", href: "/parent/dashboard?tab=fees", icon: "Receipt" },
  { label: "Bus Tracker", href: "/parent/dashboard?tab=bus", icon: "Bus" },
];

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Ensure role is parent or school administrator previewing parent portal
  const allowed = ["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];
  if (!allowed.includes(session.user.role)) {
    redirect("/dashboard");
  }

  // Fetch school name if available
  let schoolName = "SchoolMitra ERP";
  if (session.user.schoolId) {
    const school = await db.query.schools.findFirst({
      where: eq(schools.id, session.user.schoolId),
    });
    if (school?.name) {
      schoolName = school.name;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-20 md:pb-6">
      {/* Mobile-First Parent PWA Top Bar */}
      <PwaHeader
        role="PARENT"
        roleLabel="Parent Companion"
        accentColor="indigo"
        schoolName={schoolName}
        icon={<Users className="w-4 h-4 text-indigo-400" />}
      />

      {/* Main Content Area (Max-w-3xl for optimal mobile/tablet reading) */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4">{children}</main>

      {/* Bottom Thumb-Zone Navigation */}
      <BottomNav items={PARENT_NAV_ITEMS} />
    </div>
  );
}
