"use client";

import React, { useState, useTransition } from "react";
import {
  Users,
  Calendar,
  FileText,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import Student360Drawer from "./Student360Drawer";
import type {
  TeacherSectionSummary,
  StudentRosterRow,
  Student360Data,
} from "@/app/(teacher)/teacher/classes/classesActions";
import { getTeacherStudent360Drawer } from "@/app/(teacher)/teacher/classes/classesActions";

interface SectionRostersProps {
  sections: TeacherSectionSummary[];
  initialSelectedSectionId?: string | undefined;
  initialStudents: StudentRosterRow[];
  onSelectSection?:
    | ((sectionId: string) => Promise<{
        selectedSectionId: string;
        students: StudentRosterRow[];
      }>)
    | undefined;
}

export default function SectionRosters({
  sections,
  initialSelectedSectionId,
  initialStudents,
  onSelectSection,
}: SectionRostersProps) {
  const [selectedSectionId, setSelectedSectionId] = useState(
    initialSelectedSectionId || sections[0]?.id || ""
  );
  const [students, setStudents] = useState<StudentRosterRow[]>(initialStudents);
  const [selectedStudent360, setSelectedStudent360] = useState<Student360Data | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoading360, setIsLoading360] = useState(false);

  const currentSection = sections.find((s) => s.id === selectedSectionId) || sections[0];

  const handleSectionSwitch = async (secId: string) => {
    setSelectedSectionId(secId);
    if (onSelectSection) {
      setIsLoadingStudents(true);
      try {
        const res = await onSelectSection(secId);
        setStudents(res.students);
      } catch (err: any) {
        toast.error("Failed to load section roster.");
      } finally {
        setIsLoadingStudents(false);
      }
    }
  };

  const handleRowClick = async (studentId: string) => {
    setIsLoading360(true);
    try {
      const data = await getTeacherStudent360Drawer(studentId);
      setSelectedStudent360(data);
      setIsDrawerOpen(true);
    } catch (err: any) {
      toast.error("Could not load Student 360 profile.");
    } finally {
      setIsLoading360(false);
    }
  };

  if (sections.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
          <Users className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">No Sections Allocated</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          You are not currently assigned as a class teacher or subject teacher for any classroom sections.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Section Segmented Pill Switcher ──────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {sections.map((sec) => {
          const isSelected = sec.id === selectedSectionId;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => handleSectionSwitch(sec.id)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                isSelected
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/30"
                  : "bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
              }`}
            >
              <span>
                {sec.className}-{sec.name}
              </span>
              {sec.isClassTeacher && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  Class Teacher
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Roster Summary & DPDP Statutory Shield Card ──────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
        <div>
          <div className="text-xs font-bold text-white flex items-center gap-2">
            <span>
              {currentSection?.className} · Section {currentSection?.name} Roster
            </span>
            <span className="text-slate-400 font-normal">
              ({students.length} students)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Room: {currentSection?.roomNumber || "Main Wing"} · Capacity: {currentSection?.capacity}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Fee badges projected under DPDP Act · Tap any row for Student 360</span>
        </div>
      </div>

      {/* ─── Student Roster Grid ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-lg">
        <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wide">
          <span>Student</span>
          <div className="hidden sm:flex items-center gap-8 text-[11px]">
            <span>30d Attendance</span>
            <span>Fee Status</span>
            <span>Latest Homework</span>
          </div>
        </div>

        {isLoadingStudents ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading section roster...</div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No enrolled students in this section.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {students.map((st) => (
              <div
                key={st.studentId}
                onClick={() => handleRowClick(st.studentId)}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-800/40 cursor-pointer transition-colors group"
              >
                {/* Identity */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs shrink-0 group-hover:border-emerald-500/50 transition-colors">
                    {st.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                      {st.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Adm: {st.admissionNumber} {st.rollNumber ? `· Roll: ${st.rollNumber}` : ""}
                    </div>
                  </div>
                </div>

                {/* Badges & Metrics */}
                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                  {/* Attendance Chip */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                      st.attendanceStatusChip === "EXCELLENT"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : st.attendanceStatusChip === "AVERAGE"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {st.attendanceRate30d}% Att.
                  </span>

                  {/* Fee Status Badge ONLY (No amount, AC-T2) */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      st.feeStatus === "PAID"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : st.feeStatus === "DUE"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {st.feeStatus}
                  </span>

                  {/* Latest Homework submission */}
                  {st.latestSubmission && (
                    <span
                      className={`hidden md:inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        st.latestSubmission.status === "GRADED"
                          ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                          : st.latestSubmission.status === "LATE"
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                          : st.latestSubmission.status === "SUBMITTED"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {st.latestSubmission.status === "GRADED"
                        ? `${st.latestSubmission.marksAwarded}/${st.latestSubmission.maxMarks}`
                        : st.latestSubmission.status}
                    </span>
                  )}

                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Student 360 Drawer ─────────────────────────────────────────── */}
      <Student360Drawer
        data={selectedStudent360}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
