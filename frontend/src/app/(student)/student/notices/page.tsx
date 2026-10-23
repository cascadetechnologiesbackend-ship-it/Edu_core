export const dynamic = "force-dynamic";

import React from "react";
import { getStudentNoticesAction } from "./noticesActions";
import { StudentNoticesClient } from "@/components/student/notices/StudentNoticesClient";
import { ShieldAlert } from "lucide-react";

export const metadata = {
  title: "School Notices & Circulars | Student Companion",
  description: "View important school announcements, circulars, and acknowledge receipts.",
};

export default async function StudentNoticesPage({
  searchParams,
}: {
  searchParams?: { studentId?: string };
}) {
  const studentIdParam = searchParams?.studentId;
  const res = await getStudentNoticesAction(studentIdParam);

  if (!res.success && res.error) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
        <p className="text-xs text-amber-200">{res.error}</p>
      </div>
    );
  }

  return (
    <StudentNoticesClient
      initialNotices={res.notices}
      studentName={res.studentName}
      className={res.className}
      sectionName={res.sectionName}
      studentIdParam={studentIdParam}
    />
  );
}
