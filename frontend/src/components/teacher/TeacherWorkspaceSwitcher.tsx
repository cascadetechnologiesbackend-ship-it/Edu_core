"use client";

import React from "react";
import { useTeacherScope } from "./TeacherScopeContext";
import { GraduationCap, BookOpen, Sparkles, Check } from "lucide-react";

export default function TeacherWorkspaceSwitcher() {
  const {
    workspaceScope,
    activeWorkspace,
    setActiveWorkspace,
    selectedAllocation,
    setSelectedAllocation,
  } = useTeacherScope();

  if (!workspaceScope) return null;

  const hasHomeroom = !!workspaceScope.homeroomSection;

  return (
    <div className="space-y-3">
      {/* ─── Role / Workspace Switcher ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {hasHomeroom && (
            <button
              type="button"
              onClick={() => setActiveWorkspace("homeroom")}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeWorkspace === "homeroom"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <GraduationCap className="w-4 h-4 text-emerald-300" />
              <span>Homeroom ({workspaceScope.homeroomSection?.className}-{workspaceScope.homeroomSection?.sectionName})</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-200 text-[10px] font-black border border-emerald-500/30">
                Class Teacher
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveWorkspace("subject")}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeWorkspace === "subject" || !hasHomeroom
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-950/40"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-300" />
            <span>Subject Teacher Workspace</span>
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-900/80 text-indigo-200 text-[10px] font-black border border-indigo-500/30">
              {workspaceScope.subjectAllocations.length} Classes
            </span>
          </button>
        </div>

        {/* Status Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 text-[11px] text-slate-400 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            {activeWorkspace === "homeroom"
              ? "Full Homeroom Override Active"
              : "Instructional Subject Scoping Active"}
          </span>
        </div>
      </div>

      {/* ─── Subject Chips (Rendered in Subject Workspace) ─────────────────── */}
      {activeWorkspace === "subject" && workspaceScope.subjectAllocations.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 uppercase tracking-wider pl-1">
            Allocations:
          </span>
          {workspaceScope.subjectAllocations.map((alloc) => {
            const isSelected =
              selectedAllocation?.sectionId === alloc.sectionId &&
              selectedAllocation?.subjectId === alloc.subjectId;
            return (
              <button
                key={`${alloc.sectionId}-${alloc.subjectId}`}
                type="button"
                onClick={() => setSelectedAllocation(alloc)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-indigo-950/80 text-indigo-200 border-indigo-500/50 shadow-sm"
                    : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-indigo-400" />}
                <span className="font-bold text-white">
                  {alloc.className}-{alloc.sectionName}
                </span>
                <span className="text-slate-400">·</span>
                <span>{alloc.subjectName}</span>
                {alloc.isAlsoHomeroom && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black">
                    Homeroom
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
