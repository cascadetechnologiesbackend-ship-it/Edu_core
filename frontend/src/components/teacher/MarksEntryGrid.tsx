"use client";

import React, { useState, useRef, useTransition, useEffect } from "react";
import {
  Lock,
  Save,
  AlertCircle,
  BarChart2,
  ChevronDown,
  UserX,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  ExamOptionItem,
  ExamAllocationItem,
  StudentExamMarkItem,
  saveExamMarks,
} from "@/app/(teacher)/teacher/grading/gradingActions";

interface MarksEntryGridProps {
  exams: ExamOptionItem[];
  allocations: ExamAllocationItem[];
  initialExamId?: string | undefined;
  initialAllocIndex?: number | undefined;
  initialStudents?: StudentExamMarkItem[] | undefined;
  initialIsLocked?: boolean | undefined;
  initialLockReason?: string | undefined;
  onSelectAllocation?:
    | ((
        examId: string,
        alloc: ExamAllocationItem
      ) => Promise<{
        students: StudentExamMarkItem[];
        isLocked: boolean;
        lockReason?: string | undefined;
        maxMarks: number;
      }>)
    | undefined;
}

export default function MarksEntryGrid({
  exams,
  allocations,
  initialExamId,
  initialAllocIndex = 0,
  initialStudents = [],
  initialIsLocked = false,
  initialLockReason,
  onSelectAllocation,
}: MarksEntryGridProps) {
  const [selectedExamId, setSelectedExamId] = useState(
    initialExamId || exams[0]?.id || ""
  );
  const [selectedAllocIndex, setSelectedAllocIndex] = useState(initialAllocIndex);
  const [students, setStudents] = useState<StudentExamMarkItem[]>(initialStudents);
  const [isLocked, setIsLocked] = useState(initialIsLocked);
  const [lockReason, setLockReason] = useState<string | undefined>(initialLockReason);
  const [maxMarks, setMaxMarks] = useState<number>(
    allocations[selectedAllocIndex]?.maxMarks || 100
  );
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const currentExam = exams.find((e) => e.id === selectedExamId) || exams[0];
  const currentAlloc = allocations[selectedAllocIndex] || allocations[0];

  useEffect(() => {
    if (initialStudents.length > 0) {
      setStudents(initialStudents);
      setIsLocked(initialIsLocked);
      setLockReason(initialLockReason);
    }
  }, [initialStudents, initialIsLocked, initialLockReason]);

  const loadRoster = async (examId: string, allocIndex: number) => {
    const alloc = allocations[allocIndex];
    if (!alloc || !onSelectAllocation) return;

    setIsLoading(true);
    try {
      const res = await onSelectAllocation(examId, alloc);
      setStudents(res.students);
      setIsLocked(res.isLocked);
      setLockReason(res.lockReason);
      setMaxMarks(res.maxMarks);
    } catch (err: any) {
      toast.error("Failed to load marks roster.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExamChange = (newExamId: string) => {
    setSelectedExamId(newExamId);
    loadRoster(newExamId, selectedAllocIndex);
  };

  const handleAllocChange = (newIndex: number) => {
    setSelectedAllocIndex(newIndex);
    setMaxMarks(allocations[newIndex]?.maxMarks || 100);
    loadRoster(selectedExamId, newIndex);
  };

  // Keyboard navigation: Enter advances to next student input (AC-T7)
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentIndex: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const currentStudent = students[currentIndex];
      if (currentStudent && currentStudent.marksObtained !== null) {
        if (
          currentStudent.marksObtained < 0 ||
          currentStudent.marksObtained > maxMarks
        ) {
          toast.error(`Marks cannot exceed ${maxMarks}`);
          return;
        }
      }

      const nextStudent = students[currentIndex + 1];
      if (nextStudent) {
        const nextInput = inputRefs.current[nextStudent.studentId];
        nextInput?.focus();
        nextInput?.select();
      } else {
        toast.info("Reached end of student roster. Click Save Marks to persist.");
      }
    }
  };

  const handleMarkChange = (studentId: string, val: string) => {
    if (isLocked) return;
    const num = val === "" ? null : parseFloat(val);
    if (num !== null && (isNaN(num) || num < 0 || num > maxMarks)) {
      return; // prevent exceeding max marks
    }

    setStudents((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, marksObtained: num, isAbsent: false }
          : s
      )
    );
  };

  const toggleAbsent = (studentId: string) => {
    if (isLocked) return;
    setStudents((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? {
              ...s,
              isAbsent: !s.isAbsent,
              marksObtained: !s.isAbsent ? null : s.marksObtained,
            }
          : s
      )
    );
  };

  // Real-time Class Performance Distribution Histogram
  const evaluatedStudents = students.filter(
    (s) => !s.isAbsent && s.marksObtained !== null
  );
  const absentCount = students.filter((s) => s.isAbsent).length;
  const pendingCount = students.filter(
    (s) => !s.isAbsent && s.marksObtained === null
  ).length;

  let distinctionCount = 0; // >= 75%
  let firstClassCount = 0; // 60% - 74%
  let secondClassCount = 0; // 40% - 59%
  let needsSupportCount = 0; // < 40%

  for (const s of evaluatedStudents) {
    if (s.marksObtained !== null) {
      const pct = (s.marksObtained / maxMarks) * 100;
      if (pct >= 75) distinctionCount++;
      else if (pct >= 60) firstClassCount++;
      else if (pct >= 40) secondClassCount++;
      else needsSupportCount++;
    }
  }

  const handleSaveMarks = () => {
    if (isLocked) {
      toast.error("Marks entry is locked for this examination.");
      return;
    }
    if (!currentAlloc || !selectedExamId) return;

    // Validate entries
    for (const s of students) {
      if (!s.isAbsent && s.marksObtained !== null) {
        if (s.marksObtained < 0 || s.marksObtained > maxMarks) {
          toast.error(
            `Mark for ${s.name} (${s.marksObtained}) exceeds max allowed marks (${maxMarks}).`
          );
          return;
        }
      }
    }

    startTransition(async () => {
      try {
        const payload = {
          examId: selectedExamId,
          classId: currentAlloc.classId,
          subjectId: currentAlloc.subjectId,
          sectionId: currentAlloc.sectionId,
          entries: students.map((s) => ({
            studentId: s.studentId,
            marksObtained: s.marksObtained,
            isAbsent: s.isAbsent,
            remarks: s.remarks || undefined,
          })),
        };

        const res = await saveExamMarks(payload);
        if (res.success) {
          toast.success(
            `${currentAlloc.className} · ${currentAlloc.subjectName}: Marks saved for ${res.count} student(s)!`
          );
        } else {
          toast.error(res.message || "Failed to save marks.");
        }
      } catch (err: any) {
        toast.error(err.message || "Error saving marks.");
      }
    });
  };

  if (allocations.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">No Subjects Allocated</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          You do not have any teaching allocations mapped for scholastic evaluation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Control Header Card ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 shadow-md backdrop-blur-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Exam Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Examination Cycle
            </label>
            <div className="relative">
              <select
                value={selectedExamId}
                onChange={(e) => handleExamChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 appearance-none pr-8"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id} className="bg-slate-900 text-white">
                    {ex.name} {ex.isLocked ? "· (Locked)" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Allocation Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Class &amp; Subject Allocation
            </label>
            <div className="relative">
              <select
                value={selectedAllocIndex}
                onChange={(e) => handleAllocChange(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 appearance-none pr-8"
              >
                {allocations.map((alloc, idx) => (
                  <option
                    key={`${alloc.classId}-${alloc.subjectId}-${idx}`}
                    value={idx}
                    className="bg-slate-900 text-white"
                  >
                    {alloc.className} • {alloc.subjectName} (Max: {alloc.maxMarks})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ─── Lock State Banner (AC-T6) ─────────────────────────────────── */}
        {isLocked && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">
              {lockReason ||
                "Marks Entry Locked: This examination window is closed or finalized by Administration. Read-only view."}
            </span>
          </div>
        )}

        {/* ─── Real-Time Distribution Histogram ──────────────────────────── */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
              Class Performance Distribution ({evaluatedStudents.length} entered, {absentCount} absent)
            </span>
            <span className="text-slate-400 text-[11px]">
              Max Marks: <strong className="text-white">{maxMarks}</strong>
            </span>
          </div>

          {/* Color-Coded Distribution Bar */}
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
            {evaluatedStudents.length > 0 ? (
              <>
                <div
                  title={`Distinction (≥75%): ${distinctionCount}`}
                  style={{ width: `${(distinctionCount / evaluatedStudents.length) * 100}%` }}
                  className="bg-emerald-500 transition-all duration-300"
                />
                <div
                  title={`First Class (60-74%): ${firstClassCount}`}
                  style={{ width: `${(firstClassCount / evaluatedStudents.length) * 100}%` }}
                  className="bg-teal-500 transition-all duration-300"
                />
                <div
                  title={`Second Class (40-59%): ${secondClassCount}`}
                  style={{ width: `${(secondClassCount / evaluatedStudents.length) * 100}%` }}
                  className="bg-amber-500 transition-all duration-300"
                />
                <div
                  title={`Needs Support (<40%): ${needsSupportCount}`}
                  style={{ width: `${(needsSupportCount / evaluatedStudents.length) * 100}%` }}
                  className="bg-rose-500 transition-all duration-300"
                />
              </>
            ) : (
              <div className="w-full bg-slate-800 text-[10px] text-slate-500 text-center font-semibold">
                No marks entered yet
              </div>
            )}
          </div>

          {/* Legend Badges */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              ≥75% ({distinctionCount})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              60-74% ({firstClassCount})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              40-59% ({secondClassCount})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              &lt;40% ({needsSupportCount})
            </span>
            {absentCount > 0 && (
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                Absent ({absentCount})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Students Roster & Keyboard-First Input ────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-lg">
        <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-white tracking-wide uppercase">
            Roster ({students.length} Students)
          </span>
          <span className="text-xs text-slate-400">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-mono text-[10px]">Enter</kbd> to advance
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading student roster...</div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {students.map((st, idx) => {
              const currentMarks = st.marksObtained !== null ? st.marksObtained.toString() : "";
              const num = parseFloat(currentMarks);
              const isInvalid = !isNaN(num) && (num < 0 || num > maxMarks);

              return (
                <div
                  key={st.studentId}
                  className={`px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                    st.isAbsent
                      ? "bg-slate-950/60 opacity-70"
                      : "hover:bg-slate-800/40 bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                      {st.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{st.name}</div>
                      <div className="text-[11px] text-slate-400">
                        Adm: {st.admissionNumber} {st.rollNumber ? `· Roll: ${st.rollNumber}` : ""}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Marks Input */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => toggleAbsent(st.studentId)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                        st.isAbsent
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                      }`}
                    >
                      {st.isAbsent ? "ABSENT" : "Mark Absent"}
                    </button>

                    <input
                      ref={(el) => {
                        inputRefs.current[st.studentId] = el;
                      }}
                      type="number"
                      min="0"
                      max={maxMarks}
                      step="0.5"
                      disabled={isLocked || st.isAbsent}
                      placeholder={st.isAbsent ? "ABS" : `0-${maxMarks}`}
                      value={st.isAbsent ? "" : currentMarks}
                      onChange={(e) => handleMarkChange(st.studentId, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      className={`w-20 px-2.5 py-1.5 rounded-xl text-center text-xs font-mono font-bold text-white bg-slate-950 border transition-colors focus:outline-none ${
                        isLocked
                          ? "opacity-50 cursor-not-allowed border-slate-800"
                          : isInvalid
                          ? "border-rose-500 bg-rose-950/20"
                          : st.isAbsent
                          ? "border-slate-800 bg-slate-900"
                          : currentMarks !== ""
                          ? "border-indigo-500/60 focus:border-indigo-400"
                          : "border-slate-800 focus:border-slate-600"
                      }`}
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
            {evaluatedStudents.length} of {students.length} students recorded
          </span>
          <button
            type="button"
            onClick={handleSaveMarks}
            disabled={isPending || isLocked || students.length === 0}
            className="px-5 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isPending ? "Saving..." : isLocked ? "Locked (Read-Only)" : "Save Marks"}
          </button>
        </div>
      </div>
    </div>
  );
}
