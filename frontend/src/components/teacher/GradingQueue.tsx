"use client";

import React, { useState, useRef, useTransition, useEffect } from "react";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Save,
  Award,
  Clock,
  ShieldAlert,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  TeacherAssignmentItem,
  StudentSubmissionItem,
  saveAssignmentGrades,
} from "@/app/(teacher)/teacher/grading/gradingActions";

interface GradingQueueProps {
  assignments: TeacherAssignmentItem[];
  initialAssignmentId?: string | undefined;
  initialSubmissions?: StudentSubmissionItem[] | undefined;
  onAssignmentSelect?:
    | ((assignmentId: string) => Promise<{
        assignment: TeacherAssignmentItem;
        submissions: StudentSubmissionItem[];
      }>)
    | undefined;
}

export default function GradingQueue({
  assignments,
  initialAssignmentId,
  initialSubmissions = [],
  onAssignmentSelect,
}: GradingQueueProps) {
  const [selectedId, setSelectedId] = useState(
    initialAssignmentId || assignments[0]?.id || ""
  );
  const [currentAssignment, setCurrentAssignment] = useState<TeacherAssignmentItem | undefined>(
    assignments.find((a) => a.id === selectedId) || assignments[0]
  );
  const [submissions, setSubmissions] = useState<StudentSubmissionItem[]>(initialSubmissions);
  const [marksState, setMarksState] = useState<Record<string, string>>({});
  const [remarksState, setRemarksState] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);

  // References to input elements for Enter-key auto advance
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (initialSubmissions.length > 0) {
      setSubmissions(initialSubmissions);
      const initialMarks: Record<string, string> = {};
      const initialRemarks: Record<string, string> = {};
      for (const s of initialSubmissions) {
        if (s.marksAwarded !== null && s.marksAwarded !== undefined) {
          initialMarks[s.studentId] = s.marksAwarded.toString();
        }
        if (s.remarks) {
          initialRemarks[s.studentId] = s.remarks;
        }
      }
      setMarksState(initialMarks);
      setRemarksState(initialRemarks);
    }
  }, [initialSubmissions]);

  const handleSelectAssignment = async (id: string) => {
    setSelectedId(id);
    const found = assignments.find((a) => a.id === id);
    setCurrentAssignment(found);

    if (onAssignmentSelect) {
      setIsLoadingSubs(true);
      try {
        const res = await onAssignmentSelect(id);
        setCurrentAssignment(res.assignment);
        setSubmissions(res.submissions);
        const marks: Record<string, string> = {};
        const remarks: Record<string, string> = {};
        for (const s of res.submissions) {
          if (s.marksAwarded !== null && s.marksAwarded !== undefined) {
            marks[s.studentId] = s.marksAwarded.toString();
          }
          if (s.remarks) {
            remarks[s.studentId] = s.remarks;
          }
        }
        setMarksState(marks);
        setRemarksState(remarks);
      } catch (err: any) {
        toast.error("Failed to load assignment submissions.");
      } finally {
        setIsLoadingSubs(false);
      }
    }
  };

  const maxMarks = currentAssignment?.maxMarks || 100;

  // Calculate live grading progress (Emotional UX: Progress bar animating toward emerald)
  const gradedCount = Object.keys(marksState).filter(
    (k) => marksState[k] !== undefined && marksState[k] !== ""
  ).length;
  const totalCount = submissions.length;
  const progressPercent = totalCount > 0 ? Math.round((gradedCount / totalCount) * 100) : 0;
  const isFullyGraded = totalCount > 0 && gradedCount === totalCount;

  // Keyboard navigation: Enter key advances focus to next student row (AC-T7)
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentIndex: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const currentStudent = submissions[currentIndex];
      const currentVal = currentStudent ? marksState[currentStudent.studentId] : "";

      // Validate before advancing
      if (currentVal && currentVal !== "") {
        const num = parseFloat(currentVal);
        if (isNaN(num) || num < 0 || num > maxMarks) {
          toast.error(`Marks must be between 0 and ${maxMarks}`);
          return;
        }
      }

      const nextStudent = submissions[currentIndex + 1];
      if (nextStudent) {
        const nextInput = inputRefs.current[nextStudent.studentId];
        nextInput?.focus();
        nextInput?.select();
      } else {
        // At end of list, focus save button or hint save
        toast.info("Reached end of list. Click Save Grades to persist batch.");
      }
    }
  };

  const handleMarkChange = (studentId: string, val: string) => {
    setMarksState((prev) => ({ ...prev, [studentId]: val }));
  };

  // Bulk action: Award full marks to all ungraded students
  const handleBulkAwardFullMarks = () => {
    const updated = { ...marksState };
    let awardedCount = 0;
    for (const sub of submissions) {
      if (!updated[sub.studentId] || updated[sub.studentId] === "") {
        updated[sub.studentId] = maxMarks.toString();
        awardedCount++;
      }
    }
    setMarksState(updated);
    toast.success(`Awarded full marks (${maxMarks}) to ${awardedCount} student(s).`);
  };

  // Batch save grades
  const handleSaveBatch = () => {
    if (!currentAssignment) return;

    // Validate all entered marks
    for (const sub of submissions) {
      const val = marksState[sub.studentId];
      if (val !== undefined && val !== "") {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0 || num > maxMarks) {
          toast.error(
            `Invalid mark for ${sub.studentName}: must be between 0 and ${maxMarks}`
          );
          return;
        }
      }
    }

    startTransition(async () => {
      try {
        const gradesToSave = submissions.map((sub) => {
          const val = marksState[sub.studentId];
          const marksNum = val !== undefined && val !== "" ? parseFloat(val) : null;
          return {
            submissionId: sub.submissionId,
            studentId: sub.studentId,
            marksAwarded: marksNum,
            remarks: remarksState[sub.studentId] || undefined,
          };
        });

        const res = await saveAssignmentGrades(currentAssignment.id, gradesToSave);
        if (res.success) {
          toast.success(
            `${currentAssignment.className}-${currentAssignment.sectionName}: ${res.savedCount} submission(s) saved!`
          );
        } else {
          toast.error(res.message || "Failed to save grades.");
        }
      } catch (err: any) {
        toast.error(err.message || "Error saving grades.");
      }
    });
  };

  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
          <FileText className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">No Homework or Assignments Found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          You currently have no published assignments in your assigned sections to evaluate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Top Control Card ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 shadow-md backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Assignment Picker */}
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Select Assignment to Grade
            </label>
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => handleSelectAssignment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500 appearance-none pr-8"
              >
                {assignments.map((a) => (
                  <option key={a.id} value={a.id} className="bg-slate-900 text-white">
                    {a.title} ({a.className}-{a.sectionName} · {a.subjectName}) — {a.gradedCount}/
                    {a.totalSubmissions} Graded
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Quick Bulk Action */}
          <div className="flex items-center gap-2 sm:self-end">
            <button
              type="button"
              onClick={handleBulkAwardFullMarks}
              className="px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all flex items-center gap-1.5"
              title="Award full marks to all currently ungraded submissions"
            >
              <Award className="w-3.5 h-3.5" />
              Full Marks ({maxMarks})
            </button>

            <button
              type="button"
              onClick={handleSaveBatch}
              disabled={isPending}
              className="px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isPending ? "Saving..." : "Save Grades"}
            </button>
          </div>
        </div>

        {/* ─── Emotional UX Progress Strip ─────────────────────────────────── */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span>Evaluation Progress:</span>
              <span className="text-white font-mono font-bold">
                {gradedCount} / {totalCount}
              </span>
              <span className="text-slate-400 font-normal">submissions graded</span>
            </span>
            <span
              className={`font-black font-mono ${
                isFullyGraded ? "text-emerald-400" : "text-slate-300"
              }`}
            >
              {progressPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isFullyGraded
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
            <span className="flex items-center gap-1 text-slate-400">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
              Max: {maxMarks} marks
            </span>
            <span className="italic text-slate-400">
              Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono text-[10px]">Enter</kbd> to jump to next student
            </span>
          </div>
        </div>
      </div>

      {/* ─── Submissions Roster Grid ───────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-lg">
        <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-white tracking-wide uppercase">
            Student Submissions ({submissions.length})
          </span>
          {isFullyGraded && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All Graded
            </span>
          )}
        </div>

        {isLoadingSubs ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Loading student submissions...
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No students found for this assignment.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {submissions.map((sub, idx) => {
              const currentVal = marksState[sub.studentId] || "";
              const num = parseFloat(currentVal);
              const isInvalid = !isNaN(num) && (num < 0 || num > maxMarks);
              const isGraded = currentVal !== "";

              return (
                <div
                  key={sub.studentId}
                  className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    sub.plagiarismFlagged
                      ? "bg-rose-950/20 border-l-4 border-rose-500"
                      : isGraded
                      ? "bg-slate-900/40 hover:bg-slate-800/40"
                      : "bg-slate-900/80 hover:bg-slate-800/60"
                  }`}
                >
                  {/* Student Identity + Flags */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                      {sub.studentName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">
                          {sub.studentName}
                        </span>
                        {sub.isLate && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            Late
                          </span>
                        )}
                        {sub.plagiarismFlagged && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <ShieldAlert className="w-3 h-3" />
                            Plagiarism
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Adm: {sub.admissionNumber} {sub.rollNumber ? `· Roll: ${sub.rollNumber}` : ""}
                      </div>
                    </div>
                  </div>

                  {/* Marks & Remarks Input (Keyboard-First Flow) */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <div className="relative">
                      <input
                        ref={(el) => {
                          inputRefs.current[sub.studentId] = el;
                        }}
                        type="number"
                        min="0"
                        max={maxMarks}
                        step="0.5"
                        placeholder={`/ ${maxMarks}`}
                        value={currentVal}
                        onChange={(e) => handleMarkChange(sub.studentId, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        className={`w-24 px-3 py-1.5 rounded-xl text-center text-xs font-mono font-bold text-white bg-slate-950 border transition-colors focus:outline-none ${
                          isInvalid
                            ? "border-rose-500 focus:border-rose-400 bg-rose-950/20"
                            : isGraded
                            ? "border-emerald-500/50 focus:border-emerald-400"
                            : "border-slate-800 focus:border-slate-600"
                        }`}
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Remarks (optional)"
                      value={remarksState[sub.studentId] || ""}
                      onChange={(e) =>
                        setRemarksState((prev) => ({
                          ...prev,
                          [sub.studentId]: e.target.value,
                        }))
                      }
                      className="w-36 sm:w-48 px-2.5 py-1.5 rounded-xl text-xs text-white bg-slate-950 border border-slate-800 focus:outline-none focus:border-slate-600"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Save Bar */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {gradedCount} of {totalCount} students graded
          </span>
          <button
            type="button"
            onClick={handleSaveBatch}
            disabled={isPending || submissions.length === 0}
            className="px-5 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isPending ? "Saving Changes..." : "Save Batch"}
          </button>
        </div>
      </div>
    </div>
  );
}
