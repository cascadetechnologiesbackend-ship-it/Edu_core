export const dynamic = "force-dynamic";

import React from "react";
import { getStudentTimetableAction } from "./timetableActions";
import { StudentTimetableClient } from "@/components/student/timetable/StudentTimetableClient";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "My Timetable | Student Companion",
  description: "View daily class schedules, period timings, classrooms, and teacher substitutions.",
};

export default async function StudentTimetablePage({
  searchParams,
}: {
  searchParams?: { studentId?: string };
}) {
  const result = await getStudentTimetableAction(searchParams?.studentId);

  if (!result.success) {
    return (
      <div className="py-8">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 text-center space-y-2">
          <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto" />
          <h2 className="text-base font-bold text-amber-200">Timetable Unavailable</h2>
          <p className="text-xs text-amber-300/80 max-w-sm mx-auto">
            {result.error || "Unable to retrieve student class timetable at this time."}
          </p>
        </div>
      </div>
    );
  }

  return <StudentTimetableClient data={result} />;
}
