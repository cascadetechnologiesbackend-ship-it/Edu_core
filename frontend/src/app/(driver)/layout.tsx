export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import PwaHeader from "@/components/layout/PwaHeader";
import { Bus } from "lucide-react";
import { db } from "@/db";
import { schools } from "@/db/schema";
import { eq } from "drizzle-orm";

import { SessionProvider } from "next-auth/react";

const DRIVER_NAV_ITEMS = [
  { label: "My Route", href: "/driver/dashboard", icon: "Map" },
  { label: "GPS Broadcast", href: "/driver/dashboard?tab=gps", icon: "Navigation" },
  { label: "My Profile", href: "/driver/profile", icon: "User" },
];

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Ensure role is driver or administrator previewing driver portal
  const allowed = ["DRIVER", "SUPER_ADMIN", "SCHOOL_ADMIN", "TRANSPORT_MANAGER"];
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
    <SessionProvider session={session}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-20 md:pb-6">
        {/* Mobile-First PWA Top Bar */}
        <PwaHeader
          role="DRIVER"
          roleLabel="Transit Driver"
          accentColor="amber"
          schoolName={schoolName}
          icon={<Bus className="w-4 h-4 text-amber-400" />}
          userSession={session}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-3xl w-full mx-auto p-4">{children}</main>

        {/* Mobile-First Bottom Nav (Thumb Comfort Zone) */}
        <BottomNav items={DRIVER_NAV_ITEMS} />
      </div>
    </SessionProvider>
  );
}
