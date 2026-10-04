"use client";

import { useState, useTransition } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Save,
  Users,
  Calendar,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { markSectionAttendance, getSectionStudents } from "@/app/(admin)/attendance/actions";

type Section = {
  id: string;
  name: string;
  class: {
    displayName: string;
  };
};

type StudentRecord = {
  studentId: string;
  rollNumber: string | null;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  attendanceStatus:
    | "PRESENT"
    | "ABSENT"
    | "LATE"
    | "HALF_DAY"
    | "LEAVE"
    | "HOLIDAY"
    | null;
  remarks: string;
};

interface TeacherAttendanceClientProps {
  sections: Section[];
  initialStudents: StudentRecord[];
  initialSectionId: string;
  initialDate: string;
}

export default function TeacherAttendanceClient({
  sections,
  initialStudents,
  initialSectionId,
  initialDate,
}: TeacherAttendanceClientProps) {
  const [selectedSectionId, setSelectedSectionId] = useState(initialSectionId);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [students, setStudents] = useState<StudentRecord[]>(initialStudents);
  const [isPending, startTransition] = useTransition();
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // If no sections assigned to teacher
  if (sections.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">No Classrooms Allocated</h2>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          You are not currently assigned as a <strong>Class Teacher</strong> or allocated to any active classroom sections. Roll call can only be submitted for assigned classes.
        </p>
        <p className="text-xs text-amber-400/80 font-medium">
          Please contact your Academic Administrator to assign your section.
        </p>
      </div>
    );
  }

  // Handle section switch
  const handleSectionChange = async (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setFeedback(null);
    setLoadingStudents(true);
    try {
      const data = await getSectionStudents(sectionId, selectedDate);
      setStudents(data as any);
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to load students." });
    } finally {
      setLoadingStudents(false);
    }
  };

  // Handle date change
  const handleDateChange = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setFeedback(null);
    if (!selectedSectionId) return;
    setLoadingStudents(true);
    try {
      const data = await getSectionStudents(selectedSectionId, dateStr);
      setStudents(data as any);
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to load students." });
    } finally {
      setLoadingStudents(false);
    }
  };

  // Quick action: Mark all present
  const markAll = (status: "PRESENT" | "ABSENT") => {
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        attendanceStatus: status,
      }))
    );
  };

  // Toggle individual student status
  const updateStatus = (
    studentId: string,
    status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE"
  ) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, attendanceStatus: status } : s))
    );
  };

  // Save attendance
  const handleSubmit = () => {
    if (!selectedSectionId) return;
    setFeedback(null);

    const payload = students.map((s) => ({
      studentId: s.studentId,
      status: (s.attendanceStatus || "PRESENT") as any,
      remarks: s.remarks || "",
    }));

    startTransition(async () => {
      try {
        await markSectionAttendance(selectedSectionId, selectedDate, payload);
        setFeedback({
          type: "success",
          text: `Daily roll call for ${payload.length} student(s) submitted successfully.`,
        });
      } catch (err: any) {
        setFeedback({
          type: "error",
          text: err.message || "Failed to save attendance.",
        });
      }
    });
  };

  const total = students.length;
  const presentCount = students.filter((s) => s.attendanceStatus === "PRESENT").length;
  const absentCount = students.filter((s) => s.attendanceStatus === "ABSENT").length;
  const lateCount = students.filter((s) => s.attendanceStatus === "LATE").length;

  return (
    <div className="space-y-4">
      {/* ─── Top Filter & Controls Card ────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm p-4 space-y-3 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Section Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Class &amp; Section
            </label>
            <div className="relative">
              <select
                value={selectedSectionId}
                onChange={(e) => handleSectionChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 appearance-none pr-8"
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id} className="bg-slate-900 text-white">
                    {sec.class?.displayName || "Class"} — Section {sec.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Attendance Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Attendance Summary Counter Bar */}
        <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-800/80">
          <div className="bg-slate-950/80 border border-slate-800/60 rounded-xl p-2 text-center">
            <div className="text-[10px] text-slate-400 font-medium">Enrolled</div>
            <div className="text-sm font-bold text-white">{total}</div>
          </div>
          <div className="bg-emerald-950/40 border border-emerald-900/40 rounded-xl p-2 text-center">
            <div className="text-[10px] text-emerald-400 font-medium">Present</div>
            <div className="text-sm font-bold text-emerald-300">{presentCount}</div>
          </div>
          <div className="bg-rose-950/40 border border-rose-900/40 rounded-xl p-2 text-center">
            <div className="text-[10px] text-rose-400 font-medium">Absent</div>
            <div className="text-sm font-bold text-rose-300">{absentCount}</div>
          </div>
          <div className="bg-amber-950/40 border border-amber-900/40 rounded-xl p-2 text-center">
            <div className="text-[10px] text-amber-400 font-medium">Late</div>
            <div className="text-sm font-bold text-amber-300">{lateCount}</div>
          </div>
        </div>

        {/* Quick Batch Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => markAll("PRESENT")}
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition active:scale-95 flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Mark All Present
          </button>
          <button
            type="button"
            onClick={() => markAll("ABSENT")}
            className="flex-1 py-2 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition active:scale-95 flex items-center justify-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            Mark All Absent
          </button>
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

      {/* ─── Student Roster Attendance Sheet ─────────────────────────────────── */}
      {loadingStudents ? (
        <div className="p-8 text-center text-slate-400 text-xs">
          Loading student roll roster...
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400 space-y-2">
          <Users className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-sm font-semibold text-white">No Students Found</div>
          <p className="text-xs text-slate-400">
            No active student enrollments exist in this section.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((student, idx) => {
            const status = student.attendanceStatus || "PRESENT";

            return (
              <div
                key={student.studentId}
                className="rounded-2xl border border-slate-800/90 bg-slate-900/70 backdrop-blur-sm p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-slate-700"
              >
                {/* Student Info */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                    {student.rollNumber || idx + 1}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      {student.firstName} {student.lastName}
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({student.admissionNumber})
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Roll #{student.rollNumber || idx + 1}
                    </div>
                  </div>
                </div>

                {/* Status Toggle Buttons */}
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => updateStatus(student.studentId, "PRESENT")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                      status === "PRESENT"
                        ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/40"
                        : "bg-slate-800/80 text-slate-400 hover:text-white"
                    }`}
                  >
                    P
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(student.studentId, "ABSENT")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                      status === "ABSENT"
                        ? "bg-rose-600 text-white shadow-sm shadow-rose-600/40"
                        : "bg-slate-800/80 text-slate-400 hover:text-white"
                    }`}
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(student.studentId, "LATE")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                      status === "LATE"
                        ? "bg-amber-600 text-white shadow-sm shadow-amber-600/40"
                        : "bg-slate-800/80 text-slate-400 hover:text-white"
                    }`}
                  >
                    L
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(student.studentId, "LEAVE")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                      status === "LEAVE"
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/40"
                        : "bg-slate-800/80 text-slate-400 hover:text-white"
                    }`}
                  >
                    LV
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Submit Action Bar ──────────────────────────────────────────────── */}
      {students.length > 0 && (
        <div className="sticky bottom-20 z-20 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-sm transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isPending ? "Submitting Roll Call..." : "Submit Attendance Register"}
          </button>
        </div>
      )}
    </div>
  );
}
