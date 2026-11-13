"use client";

import React from "react";
import { GraduationCap, BookOpen, School, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TeacherIdentityHeaderProps {
  teacherName: string;
  schoolName: string;
  sectionsTaught?: string[] | undefined;
  subjectsTaught?: string[] | undefined;
  isClassTeacher?: boolean | undefined;
  classTeacherSectionName?: string | undefined;
  locale?: string | undefined;
  className?: string | undefined;
}

export function TeacherIdentityHeader({
  teacherName,
  schoolName,
  sectionsTaught = [],
  subjectsTaught = [],
  isClassTeacher = false,
  classTeacherSectionName,
  locale = "en",
  className,
}: TeacherIdentityHeaderProps) {
  // Extract initials
  const initials = teacherName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");

  return (
    <div
      className={cn(
        "rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-slate-800 shadow-lg relative overflow-hidden backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Avatar & Teacher Identity */}
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-bold flex items-center justify-center text-base shadow-md shadow-emerald-900/30 border border-emerald-400/30">
              {initials || <GraduationCap className="w-6 h-6" />}
            </div>
            {isClassTeacher && (
              <span
                title="Class Teacher"
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 border-2 border-slate-900 flex items-center justify-center text-[10px] text-slate-950 font-bold"
              >
                ★
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                {teacherName}
              </h1>
              {isClassTeacher && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Sparkles className="w-2.5 h-2.5" />
                  {locale === "hi"
                    ? `कक्षा अध्यापक${classTeacherSectionName ? ` (${classTeacherSectionName})` : ""}`
                    : `Class Teacher${classTeacherSectionName ? ` (${classTeacherSectionName})` : ""}`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              <School className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate max-w-[240px] sm:max-w-xs">{schoolName}</span>
            </div>
          </div>
        </div>

        {/* Right: Allocation Chips */}
        <div className="flex flex-wrap items-center gap-1.5 self-stretch sm:self-auto justify-start sm:justify-end">
          {subjectsTaught.slice(0, 3).map((sub, idx) => (
            <span
              key={`sub-${idx}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
            >
              <BookOpen className="w-3 h-3 text-emerald-400" />
              {sub}
            </span>
          ))}

          {sectionsTaught.slice(0, 4).map((sec, idx) => (
            <span
              key={`sec-${idx}`}
              className="px-2 py-1 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700"
            >
              {sec}
            </span>
          ))}

          {sectionsTaught.length > 4 && (
            <span className="px-2 py-1 rounded-xl text-[11px] font-medium bg-slate-800/60 text-slate-400 border border-slate-700/60">
              +{sectionsTaught.length - 4} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeacherIdentityHeader;
