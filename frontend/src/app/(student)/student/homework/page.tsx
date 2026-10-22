export const dynamic = "force-dynamic";

import React, { Suspense } from "react";
import type { Metadata } from "next";
import { getStudentHomeworkAction } from "./homeworkActions";
import { HomeworkCenterClient } from "@/components/student/homework/HomeworkCenterClient";
import { ShieldAlert, BookOpen, AlertCircle } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Homework Center | Student Companion",
  description: "View homework due, submit assignments online, and check teacher feedback.",
};

export default async function StudentHomeworkPage({
  searchParams,
}: {
  searchParams?: { studentId?: string; id?: string; action?: string };
}) {
  const previewStudentId = searchParams?.studentId;
  const homeworkData = await getStudentHomeworkAction(previewStudentId);

  // If student portal account is suspended/disabled (BR9)
  if (homeworkData.disabled) {
    return (
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 text-center max-w-md mx-auto my-12">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-white mb-1">
          Account Access Suspended
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          {homeworkData.error ||
            "Your student access is currently disabled by the school office. Please contact administration."}
        </p>
      </div>
    );
  }

  // If not found or scope error
  if (!homeworkData.success) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center max-w-md mx-auto my-12">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-white mb-1">
          Homework Unavailable
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          {homeworkData.error || "Unable to load student homework at this time."}
        </p>
        <Link
          href="/student/dashboard"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition"
        >
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-slate-900 rounded-2xl border border-slate-800" />
          <div className="h-48 bg-slate-900 rounded-2xl border border-slate-800" />
        </div>
      }
    >
      <HomeworkCenterClient initialData={homeworkData} />
    </Suspense>
  );
}
