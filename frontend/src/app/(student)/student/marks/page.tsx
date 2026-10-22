export const dynamic = "force-dynamic";

import React from "react";
import { getStudentMarksAction } from "./marksActions";
import { StudentMarksClient } from "@/components/student/marks/StudentMarksClient";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Marks & Results | Student Companion",
  description: "Examination datesheets, admit card clearance, published term marks, and official report cards.",
};

export default async function StudentMarksPage({
  searchParams,
}: {
  searchParams?: { studentId?: string };
}) {
  const result = await getStudentMarksAction(searchParams?.studentId);

  if (!result.success) {
    return (
      <div className="py-8">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 text-center space-y-2">
          <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto" />
          <h2 className="text-base font-bold text-amber-200">Examination Records Unavailable</h2>
          <p className="text-xs text-amber-300/80 max-w-sm mx-auto">
            {result.error || "Unable to retrieve student examination marks at this time."}
          </p>
        </div>
      </div>
    );
  }

  return <StudentMarksClient data={result} />;
}
