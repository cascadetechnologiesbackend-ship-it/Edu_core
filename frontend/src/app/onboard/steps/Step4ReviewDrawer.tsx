"use client";

import React, { useMemo, useState } from "react";
import {
  useOnboarding,
  CLASS_GROUP_INFO,
  MatrixSubjectItem,
} from "../onboardContext";
import {
  ALL_CLASS_GROUPS,
  ClassGroup,
  previewBoardTermPlan,
} from "@/lib/examBoardBlueprints";
import {
  BookOpen,
  Award,
  Calendar,
  CheckCircle2,
  Sparkles,
  Plus,
  HelpCircle,
  Clock,
} from "lucide-react";

export function Step4ReviewDrawer() {
  const {
    board,
    startDate,
    endDate,
    classesList,
    subjectMatrix,
    toggleMatrixCell,
    addCustomSubject,
    activeClassGroups,
  } = useOnboarding();

  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customSubjectCode, setCustomSubjectCode] = useState("");
  const [customSubjectType, setCustomSubjectType] =
    useState<MatrixSubjectItem["subjectType"]>("THEORY");

  // Format dates for display
  const formatDateSnippet = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
    } catch {
      return "";
    }
  };

  // Compute Term Plan Preview using pure helper
  const termPlanItems = useMemo(() => {
    const formattedClasses = classesList.map((c, idx) => ({
      id: `cls-${idx}`,
      displayName: c.displayName,
      gradeLevel: c.gradeLevel,
    }));
    return previewBoardTermPlan(board, startDate, endDate, formattedClasses);
  }, [board, startDate, endDate, classesList]);

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSubjectName.trim()) return;
    addCustomSubject(
      customSubjectName.trim(),
      customSubjectCode.trim(),
      customSubjectType,
      [...activeClassGroups],
    );
    setCustomSubjectName("");
    setCustomSubjectCode("");
  };

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          Step 4: Blueprint Review Drawer
        </span>
        <h2 className="text-2xl font-black text-white mt-1">
          Curriculum & Examination Blueprint Review
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Pre-seeded according to the official {board} academic blueprint. Each chip indicates that the subject
          is offered for that academic wing. Tap any chip to toggle. Zero clicks needed if defaults match your school.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Main Column: Class-Group Rows x Subject Chips Matrix (8 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>Wing-Wise Subject Curriculum</span>
            </div>
            <span className="text-[11px] text-slate-500">
              {subjectMatrix.length} subjects in catalog
            </span>
          </div>

          <div className="space-y-3.5">
            {ALL_CLASS_GROUPS.map((grp) => {
              if (!activeClassGroups.includes(grp)) return null;
              const info = CLASS_GROUP_INFO[grp];

              // Count offered subjects for this wing
              const offeredCount = subjectMatrix.filter(
                (sub) => Boolean(sub.isOfferedByGroup[grp]),
              ).length;

              return (
                <div
                  key={grp}
                  className={`rounded-2xl border p-4 bg-slate-900/60 ${info.borderClass}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black uppercase tracking-wider ${info.colorClass}`}>
                        {info.label}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        ({info.gradeRange})
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">
                      {offeredCount} offered
                    </span>
                  </div>

                  {/* Subject Chips Grid for this group */}
                  <div className="flex flex-wrap gap-2">
                    {subjectMatrix.map((sub) => {
                      const isOffered = Boolean(sub.isOfferedByGroup[grp]);
                      return (
                        <button
                          key={sub.code}
                          type="button"
                          onClick={() => toggleMatrixCell(sub.code, grp)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 select-none ${
                            isOffered
                              ? "bg-primary text-white shadow-xs"
                              : "bg-slate-950 border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOffered ? "bg-white" : "bg-slate-600"
                            }`}
                          />
                          <span>{sub.name}</span>
                          <span className="font-mono text-[10px] opacity-75">
                            [{sub.code}]
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Add Custom Subject */}
          <form
            onSubmit={handleAddCustom}
            className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Add Custom Subject to Blueprint
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={customSubjectName}
                onChange={(e) => setCustomSubjectName(e.target.value)}
                placeholder="Subject name (e.g. French)"
                className="px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
              />
              <input
                type="text"
                value={customSubjectCode}
                onChange={(e) => setCustomSubjectCode(e.target.value.toUpperCase())}
                placeholder="Code (e.g. FRN)"
                className="px-3 py-2 text-xs font-mono rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
              />
              <button
                type="button"
                onClick={handleAddCustom}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl inline-flex items-center justify-center gap-1.5 transition min-h-[38px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subject</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Derived Exam Blueprint Summary (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
              <Award className="w-3.5 h-3.5 text-primary" />
              <span>Derived Exam Blueprint</span>
            </div>
            <span className="text-[11px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
              {board} Plan
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Automatic statutory evaluation terms and assessment windows computed for session{" "}
            <strong className="text-white">{startDate.slice(0, 4)} – {endDate.slice(0, 4)}</strong>.
          </p>

          <div className="space-y-3">
            {termPlanItems.map((term, idx) => (
              <div
                key={term.examTypeCode + idx}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-extrabold text-xs text-white">
                    {term.name}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/50">
                    {term.examTypeCode}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>
                    Est. Window: {formatDateSnippet(term.startDate)} – {formatDateSnippet(term.endDate)}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400">
                  Applicable Classes:{" "}
                  <strong className="text-slate-200">
                    {term.scopedClassNames.join(", ") || `${term.scopedClassCount} classes`}
                  </strong>
                </div>

                {term.components.length > 0 && (
                  <div className="pt-2 border-t border-slate-900 flex flex-wrap gap-1.5">
                    {term.components.map((c) => (
                      <span
                        key={c.name}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400"
                      >
                        {c.name} ({c.weightPercent}%)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              All exam types, grading scales, and report card templates will be seeded automatically.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
