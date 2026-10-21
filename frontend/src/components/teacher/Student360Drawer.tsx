"use client";

import React from "react";
import {
  X,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Award,
  FileText,
  AlertCircle,
  Lock,
} from "lucide-react";
import type { Student360Data } from "@/app/(teacher)/teacher/classes/classesActions";

interface Student360DrawerProps {
  data: Student360Data | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function Student360Drawer({
  data,
  isOpen,
  onClose,
}: Student360DrawerProps) {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop tap to close */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-sm flex items-center justify-center shadow-md">
              {data.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">{data.name}</h2>
              <div className="text-[11px] text-slate-400">
                {data.className} · Section {data.sectionName} · Adm: {data.admissionNumber}{" "}
                {data.rollNumber ? `· Roll: ${data.rollNumber}` : ""}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ─── Fee Status Badge & DPDP Notice (AC-T2) ────────────────── */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                School Dues Status
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                  data.feeStatus === "PAID"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : data.feeStatus === "DUE"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                }`}
              >
                {data.feeStatus === "PAID"
                  ? "Cleared (Paid)"
                  : data.feeStatus === "DUE"
                  ? "Payment Due"
                  : "Overdue"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
              <Lock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>
                DPDP Act 2023 Statutory Shield: Fee ledger amounts and family financials are restricted to Finance Administration.
              </span>
            </div>
          </div>

          {/* ─── 30-Day Attendance Snapshot ────────────────────────────── */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                30-Day Attendance
              </span>
              <span
                className={`text-xs font-mono font-bold ${
                  data.attendanceSummary.attendancePercent >= 85
                    ? "text-emerald-400"
                    : data.attendanceSummary.attendancePercent >= 75
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                {data.attendanceSummary.attendancePercent}% (
                {data.attendanceSummary.presentDays} of {data.attendanceSummary.totalDays} days present)
              </span>
            </div>

            {/* Attendance Mini Calendar Grid */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-1">
              {data.attendanceCalendar.slice(0, 15).map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.status}`}
                  className={`w-5 h-7 rounded text-[9px] font-bold flex items-center justify-center font-mono ${
                    d.status === "PRESENT"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : d.status === "ABSENT"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : d.status === "LATE"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  }`}
                >
                  {d.status.charAt(0)}
                </div>
              ))}
            </div>
          </div>

          {/* ─── Homework & Assignment Evaluation History ──────────────── */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Recent Homework Evaluations
            </span>

            {data.assignmentHistory.length === 0 ? (
              <p className="text-[11px] text-slate-400">No recent submissions recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {data.assignmentHistory.map((asg) => (
                  <div
                    key={asg.assignmentId}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white truncate max-w-[200px]">
                        {asg.title}
                      </div>
                      <div className="text-[10px] text-slate-400">Due: {asg.dueDate}</div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-white">
                        {asg.marksAwarded !== null ? `${asg.marksAwarded} / ${asg.maxMarks}` : "Pending"}
                      </span>
                      {asg.isLate && (
                        <div className="text-[10px] font-bold text-amber-400">Late</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── Scholastic Examination Marks ──────────────────────────── */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-teal-400" />
              Examination Records
            </span>

            {data.examMarksHistory.length === 0 ? (
              <p className="text-[11px] text-slate-400">No published examination scores.</p>
            ) : (
              <div className="space-y-1.5">
                {data.examMarksHistory.map((ex, idx) => (
                  <div
                    key={`${ex.examName}-${idx}`}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">{ex.examName}</div>
                      <div className="text-[10px] text-slate-400">{ex.subjectName}</div>
                    </div>

                    <span className="font-mono font-black text-emerald-400">
                      {ex.isAbsent ? "ABSENT" : ex.marksObtained !== null ? `${ex.marksObtained}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
