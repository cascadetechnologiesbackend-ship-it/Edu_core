"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Award } from "lucide-react";
import GradingQueue from "@/components/teacher/GradingQueue";
import MarksEntryGrid from "@/components/teacher/MarksEntryGrid";
import {
  TeacherAssignmentItem,
  StudentSubmissionItem,
  ExamOptionItem,
  ExamAllocationItem,
  StudentExamMarkItem,
  getAssignmentSubmissionsForGrading,
  getExamMarksRoster,
} from "./gradingActions";

interface TeacherGradingClientProps {
  initialTab?: "assignments" | "exams" | undefined;
  assignments: TeacherAssignmentItem[];
  initialAssignmentId?: string | undefined;
  initialSubmissions?: StudentSubmissionItem[] | undefined;
  exams: ExamOptionItem[];
  allocations: ExamAllocationItem[];
  initialExamId?: string | undefined;
  initialAllocIndex?: number | undefined;
  initialStudents?: StudentExamMarkItem[] | undefined;
  initialIsLocked?: boolean | undefined;
  initialLockReason?: string | undefined;
}

export default function TeacherGradingClient({
  initialTab = "assignments",
  assignments,
  initialAssignmentId,
  initialSubmissions = [],
  exams,
  allocations,
  initialExamId,
  initialAllocIndex = 0,
  initialStudents = [],
  initialIsLocked = false,
  initialLockReason,
}: TeacherGradingClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("tab") as "assignments" | "exams") || initialTab;
  const [activeTab, setActiveTab] = useState<"assignments" | "exams">(currentTab);

  const handleTabSwitch = (tab: "assignments" | "exams") => {
    setActiveTab(tab);
    router.replace(`/teacher/grading?tab=${tab}`);
  };

  return (
    <div className="space-y-4">
      {/* ─── Segmented Tab Picker ────────────────────────────────────────── */}
      <div className="flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800 w-full sm:w-auto self-start shadow-sm">
        <button
          type="button"
          onClick={() => handleTabSwitch("assignments")}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "assignments"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Assignments &amp; Homework ({assignments.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabSwitch("exams")}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "exams"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          Scholastic Examinations ({exams.length})
        </button>
      </div>

      {/* ─── Tab Content ─────────────────────────────────────────────────── */}
      {activeTab === "assignments" ? (
        <GradingQueue
          assignments={assignments}
          initialAssignmentId={initialAssignmentId}
          initialSubmissions={initialSubmissions}
          onAssignmentSelect={async (id) => {
            return await getAssignmentSubmissionsForGrading(id);
          }}
        />
      ) : (
        <MarksEntryGrid
          exams={exams}
          allocations={allocations}
          initialExamId={initialExamId}
          initialAllocIndex={initialAllocIndex}
          initialStudents={initialStudents}
          initialIsLocked={initialIsLocked}
          initialLockReason={initialLockReason}
          onSelectAllocation={async (examId, alloc) => {
            return await getExamMarksRoster(
              examId,
              alloc.classId,
              alloc.subjectId,
              alloc.sectionId
            );
          }}
        />
      )}
    </div>
  );
}
