export const dynamic = "force-dynamic";

import React from "react";
import { getStudentAttendanceAction } from "./attendanceActions";
import { StudentAttendanceClient } from "@/components/student/attendance/StudentAttendanceClient";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Attendance & Leaves | Student Companion",
  description: "View daily attendance status, monthly logs, authentic session percentage, and leave application records.",
};

export default async function StudentAttendancePage({
  searchParams,
}: {
  searchParams?: { studentId?: string };
}) {
  const result = await getStudentAttendanceAction(searchParams?.studentId);

  if (!result.success) {
    return (
      <div className="py-8">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 text-center space-y-2">
          <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto" />
          <h2 className="text-base font-bold text-amber-200">Attendance Records Unavailable</h2>
          <p className="text-xs text-amber-300/80 max-w-sm mx-auto">
            {result.error || "Unable to retrieve student attendance records at this time."}
          </p>
        </div>
      </div>
    );
  }

  return <StudentAttendanceClient data={result} />;
}
