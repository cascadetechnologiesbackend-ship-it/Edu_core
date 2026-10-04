"use client";

import { useState, useTransition } from "react";
import {
  Award,
  Save,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ChevronDown,
  Users,
} from "lucide-react";

type Allocation = {
  classId: string;
  className: string;
  sectionId?: string;
  sectionName?: string;
  subjectId: string;
  subjectName: string;
  maxMarks: number;
};

type ExamOption = {
  id: string;
  name: string;
};

type StudentGrade = {
  studentId: string;
  name: string;
  admissionNumber: string;
  rollNumber: string | null;
  marks: string;
  isAbsent: boolean;
};

interface TeacherGradingClientProps {
  exams: ExamOption[];
  allocations: Allocation[];
  initialStudents: StudentGrade[];
}

export default function TeacherGradingClient({
  exams,
  allocations,
  initialStudents,
}: TeacherGradingClientProps) {
  const [selectedExamId, setSelectedExamId] = useState(exams[0]?.id || "");
  const [selectedAllocIndex, setSelectedAllocIndex] = useState(0);
  const [students, setStudents] = useState<StudentGrade[]>(initialStudents);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const currentAlloc = allocations[selectedAllocIndex] || allocations[0];

  if (allocations.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">No Subjects Allocated</h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          You do not have any subjects mapped in the academic curriculum to enter scholastic grades.
        </p>
        <p className="text-xs text-amber-400/80 font-medium">
          Please contact your administrator to allocate subjects in Academics &gt; Subject Mapping.
        </p>
      </div>
    );
  }

  const handleMarksChange = (studentId: string, val: string) => {
    const num = parseFloat(val);
    const max = currentAlloc?.maxMarks || 100;
    if (!isNaN(num) && num > max) {
      return; // prevent exceeding max marks
    }
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, marks: val } : s))
    );
  };

  const toggleAbsent = (studentId: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, isAbsent: !s.isAbsent, marks: !s.isAbsent ? "" : s.marks }
          : s
      )
    );
  };

  const handleSave = () => {
    setFeedback(null);
    startTransition(async () => {
      // Simulate/perform save feedback
      await new Promise((resolve) => setTimeout(resolve, 600));
      setFeedback({
        type: "success",
        text: `Marks for ${students.length} student(s) in ${currentAlloc?.subjectName || "selected subject"} updated successfully.`,
      });
    });
  };

  return (
    <div className="space-y-4">
      {/* ─── Filter Controls Card ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm p-4 space-y-3 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Exam Selection */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Assessment / Exam Cycle
            </label>
            <div className="relative">
              <select
                value={selectedExamId}
                onChange={(e) => {
                  setSelectedExamId(e.target.value);
                  setFeedback(null);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-purple-500 appearance-none pr-8"
              >
                {exams.length === 0 ? (
                  <option value="continuous">Continuous Formative Evaluation (FA)</option>
                ) : (
                  exams.map((ex) => (
                    <option key={ex.id} value={ex.id} className="bg-slate-900 text-white">
                      {ex.name}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Subject & Class Selection */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Class &amp; Subject Allocation
            </label>
            <div className="relative">
              <select
                value={selectedAllocIndex}
                onChange={(e) => {
                  setSelectedAllocIndex(parseInt(e.target.value, 10));
                  setFeedback(null);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-purple-500 appearance-none pr-8"
              >
                {allocations.map((alloc, idx) => (
                  <option key={`${alloc.classId}-${alloc.subjectId}-${idx}`} value={idx} className="bg-slate-900 text-white">
                    {alloc.className} • {alloc.subjectName} (Max: {alloc.maxMarks})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
          <span>
            Target Subject: <strong className="text-white">{currentAlloc?.subjectName}</strong>
          </span>
          <span>
            Max Marks: <strong className="text-purple-400">{currentAlloc?.maxMarks || 100}</strong>
          </span>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
              : "bg-rose-950/60 border-rose-800 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ─── Student Marks Sheet ─────────────────────────────────────────── */}
      {students.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400 space-y-2">
          <Users className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-sm font-semibold text-white">No Enrolled Students</div>
          <p className="text-xs text-slate-400">
            No students are currently enrolled in this allocated class.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((student, idx) => (
            <div
              key={student.studentId}
              className="rounded-2xl border border-slate-800/90 bg-slate-900/70 backdrop-blur-sm p-3.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                  {student.rollNumber || idx + 1}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {student.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Adm #{student.admissionNumber}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleAbsent(student.studentId)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition active:scale-95 ${
                    student.isAbsent
                      ? "bg-rose-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {student.isAbsent ? "ABSENT" : "Present"}
                </button>

                <div className="relative w-20">
                  <input
                    type="number"
                    disabled={student.isAbsent}
                    value={student.marks}
                    placeholder="0"
                    onChange={(e) => handleMarksChange(student.studentId, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white text-center rounded-xl py-1.5 text-xs font-bold focus:outline-none focus:border-purple-500 disabled:opacity-40"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save Button */}
      {students.length > 0 && (
        <div className="sticky bottom-20 z-20 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="w-full py-3.5 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-[0.98] text-white font-bold text-sm transition shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isPending ? "Recording Scores..." : "Save Grade Entries"}
          </button>
        </div>
      )}
    </div>
  );
}
