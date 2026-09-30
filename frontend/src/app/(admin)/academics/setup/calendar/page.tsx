import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getActiveAcademicYear } from "../../actions/auth-helper";
import {
  getAcademicTerms,
  getCalendarEvents,
} from "../../actions/calendar.actions";
import CalendarClient from "./CalendarClient";

export const metadata: Metadata = {
  title: "Academic Calendar & Terms",
  description: "Manage academic terms, vacations, holidays, exam dates, and events.",
};

export default async function AcademicCalendarPage() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.schoolId) {
    redirect("/login");
  }

  const role = session.user.role;
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(role);

  const activeYear = await getActiveAcademicYear(session.user.schoolId).catch(
    () => null,
  );

  const [terms, events] = await Promise.all([
    getAcademicTerms(activeYear?.id).catch(() => []),
    getCalendarEvents(activeYear?.id).catch(() => []),
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <CalendarClient
        initialTerms={terms as any}
        initialEvents={events as any}
        activeYearName={activeYear?.label || "Active Session"}
        isAdmin={isAdmin}
      />
    </div>
  );
}
