import { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/serverAuth";
import { assertRouteAccess } from "@/lib/routeGuards";
import AttendanceManager from "./AttendanceManager";
import { getAssignedSections, getSectionStudents } from "./actions";
import { withDataPhaseTiming } from "@/lib/serverTiming";
import { assertQueryBudget } from "@schoolmitra/database";

export const metadata: Metadata = {
  title: "Student Attendance",
  description: "Mark and view student attendance.",
};

export default async function AttendancePage() {
  const ctx = await requireAuth();
  const access = assertRouteAccess(ctx.role, "/attendance", { id: ctx.userId, email: ctx.email });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const todayStr = new Date().toISOString().split("T")[0] || "";

  const { initialSections, initialStudents } = await withDataPhaseTiming("/attendance", async () => {
    return assertQueryBudget(
      async () => {
        let sectionsRes: any[] = [];
        let studentsRes: any[] = [];
        try {
          sectionsRes = await getAssignedSections();
          if (sectionsRes.length > 0 && sectionsRes[0]?.id) {
            studentsRes = await getSectionStudents(sectionsRes[0].id, todayStr);
          }
        } catch (e) {
          // Gracefully fallback
        }
        return { initialSections: sectionsRes, initialStudents: studentsRes };
      },
      { maxQueries: 6, label: "Student Attendance Page" }
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Student Attendance
        </h1>
        <p className="text-gray-500 mt-1">
          Select section and date to mark or update student attendance.
        </p>
      </div>

      <AttendanceManager
        initialSections={initialSections}
        initialStudents={initialStudents}
        initialSelectedSection={initialSections[0]?.id || ""}
        initialSelectedDate={todayStr}
      />
    </div>
  );
}

