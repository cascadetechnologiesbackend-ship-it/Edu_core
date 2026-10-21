import { Metadata } from "next";
import { AttendanceWorkbench } from "@/components/teacher/AttendanceWorkbench";
import { TeacherLeaveQueue } from "./TeacherLeaveQueue";

export const metadata: Metadata = {
  title: "Class Attendance Register | Educator PWA",
  description: "Mark daily student attendance for assigned classrooms with exceptions-first workflow.",
};

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams?: { sectionId?: string; date?: string; tab?: string };
}) {
  const initialSectionId = searchParams?.sectionId;
  const initialDate = searchParams?.date;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
          Class Attendance Register
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Mark and submit morning roll call for your assigned sections with exceptions-first workflow.
        </p>
      </div>

      {/* Surface p7: Teacher Leave Approval Queue (P10 Landed Foundation) */}
      <TeacherLeaveQueue />

      {/* Surface t1: Exceptions-First Attendance Workbench (Phase T4) */}
      <AttendanceWorkbench
        initialSectionId={initialSectionId}
        initialDate={initialDate}
        isModal={false}
      />
    </div>
  );
}
