import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getBellSchedule } from "../../actions/timetable.actions";
import BellScheduleClient from "./BellScheduleClient";

export const metadata: Metadata = {
  title: "Bell Schedule",
  description: "Configure daily periods, timing, assembly, and breaks.",
};

export default async function BellSchedulePage() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.schoolId) {
    redirect("/login");
  }

  const role = session.user.role;
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(role);

  const periods = await getBellSchedule().catch(() => []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <BellScheduleClient initialPeriods={periods as any} isAdmin={isAdmin} />
    </div>
  );
}
