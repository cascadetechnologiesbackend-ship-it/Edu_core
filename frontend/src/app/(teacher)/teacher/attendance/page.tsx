import { Metadata } from "next";
import TeacherAttendanceClient from "./TeacherAttendanceClient";
import { getAssignedSections, getSectionStudents } from "@/app/(admin)/attendance/actions";

export const metadata: Metadata = {
  title: "Class Attendance Register | Educator PWA",
  description: "Mark daily student attendance for assigned classrooms.",
};

export default async function TeacherAttendancePage() {
  const todayStr = new Date().toISOString().split("T")[0] || "";
  let initialSections: any[] = [];
  let initialStudents: any[] = [];

  try {
    initialSections = await getAssignedSections();
    if (initialSections.length > 0 && initialSections[0]?.id) {
      initialStudents = await getSectionStudents(initialSections[0].id, todayStr);
    }
  } catch (e) {
    // If not authenticated or error, client handles gracefully
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
          Class Attendance Register
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Mark and submit morning roll call for your assigned sections.
        </p>
      </div>

      <TeacherAttendanceClient
        sections={initialSections}
        initialStudents={initialStudents}
        initialSectionId={initialSections[0]?.id || ""}
        initialDate={todayStr}
      />
    </div>
  );
}
