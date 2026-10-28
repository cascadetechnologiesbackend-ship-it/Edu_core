import { Metadata } from "next";
import { Suspense } from "react";
import TeacherGradingClient from "./TeacherGradingClient";
import { requireAuth } from "@/lib/serverAuth";
import {
  getTeacherGradingAssignments,
  getAssignmentSubmissionsForGrading,
  getTeacherExamsAndAllocations,
  getExamMarksRoster,
  TeacherAssignmentItem,
  StudentSubmissionItem,
  ExamOptionItem,
  ExamAllocationItem,
  StudentExamMarkItem,
} from "./gradingActions";

export const metadata: Metadata = {
  title: "Gradebook & Marks Entry | Educator PWA",
  description: "Evaluate homework assignments and record scholastic examination marks.",
};

export default async function TeacherGradingPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{
        tab?: string;
        assignmentId?: string;
        examId?: string;
        classId?: string;
        subjectId?: string;
      }>
    | {
        tab?: string;
        assignmentId?: string;
        examId?: string;
        classId?: string;
        subjectId?: string;
      };
}) {
  const resolvedParams =
    searchParams instanceof Promise ? await searchParams : searchParams || {};

  await requireAuth();

  const activeTab = (resolvedParams.tab as "assignments" | "exams") || "assignments";

  // 1. Fetch Assignments for Grading Queue
  let assignments: TeacherAssignmentItem[] = [];
  let initialSubmissions: StudentSubmissionItem[] = [];
  let targetAssignmentId = resolvedParams.assignmentId;

  try {
    assignments = await getTeacherGradingAssignments();
    if (assignments.length > 0) {
      if (!targetAssignmentId) {
        targetAssignmentId = assignments[0]?.id;
      }
      if (targetAssignmentId) {
        const subData = await getAssignmentSubmissionsForGrading(targetAssignmentId);
        initialSubmissions = subData.submissions;
      }
    }
  } catch (err) {
    console.error("[TeacherGradingPage] Error fetching assignments:", err);
  }

  // 2. Fetch Exams & Allocations for Marks Entry Grid
  let exams: ExamOptionItem[] = [];
  let allocations: ExamAllocationItem[] = [];
  let locksMap: Record<string, boolean> = {};
  let initialStudents: StudentExamMarkItem[] = [];
  let targetExamId = resolvedParams.examId;
  let targetAllocIndex = 0;
  let isLocked = false;
  let lockReason: string | undefined = undefined;

  try {
    const examData = await getTeacherExamsAndAllocations();
    exams = examData.exams;
    allocations = examData.allocations;
    locksMap = examData.locksMap;

    if (exams.length > 0 && allocations.length > 0) {
      if (!targetExamId) {
        targetExamId = exams[0]?.id;
      }

      if (resolvedParams.classId && resolvedParams.subjectId) {
        const idx = allocations.findIndex(
          (a) =>
            a.classId === resolvedParams.classId &&
            a.subjectId === resolvedParams.subjectId
        );
        if (idx !== -1) targetAllocIndex = idx;
      }

      const currentAlloc = allocations[targetAllocIndex];
      if (targetExamId && currentAlloc) {
        const rosterData = await getExamMarksRoster(
          targetExamId,
          currentAlloc.classId,
          currentAlloc.subjectId,
          currentAlloc.sectionId
        );
        initialStudents = rosterData.students;
        isLocked = rosterData.isLocked;
        lockReason = rosterData.lockReason;
      }
    }
  } catch (err) {
    console.error("[TeacherGradingPage] Error fetching exam allocations:", err);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
          Gradebook &amp; Marks Entry
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Fast keyboard-driven evaluation for homework submissions and examination marks.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="p-8 text-center text-xs text-slate-400">
            Loading gradebook workspace...
          </div>
        }
      >
        <TeacherGradingClient
          initialTab={activeTab}
          assignments={assignments}
          initialAssignmentId={targetAssignmentId}
          initialSubmissions={initialSubmissions}
          exams={exams}
          allocations={allocations}
          initialExamId={targetExamId}
          initialAllocIndex={targetAllocIndex}
          initialStudents={initialStudents}
          initialIsLocked={isLocked}
          initialLockReason={lockReason}
        />
      </Suspense>
    </div>
  );
}
