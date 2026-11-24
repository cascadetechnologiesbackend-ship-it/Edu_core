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
        <span className="text-xs font-bold uppercase tracking-wider text-semantic-interactive">
          Step 4: Blueprint Review Drawer
        </span>
        <h2 className="text-2xl font-black text-foreground mt-1">
          Curriculum & Examination Blueprint Review
        </h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-3xl leading-relaxed">
          Pre-seeded according to the official {board} academic blueprint. Each chip indicates that the subject
          is offered for that academic wing. Tap any chip to toggle. Zero clicks needed if defaults match your school.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Main Column: Class-Group Rows x Subject Chips Matrix (8 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5 text-semantic-interactive" />
              <span>Wing-Wise Subject Curriculum</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
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
                  className="rounded-2xl border border-border/40 p-4 bg-card shadow-xs"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">
                        {info.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        ({info.gradeRange})
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground">
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
                              ? "bg-semantic-interactive text-white shadow-xs"
                              : "bg-muted/40 border border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOffered ? "bg-white" : "bg-muted-foreground"
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
            className="bg-card border border-border/40 rounded-2xl p-4 space-y-3 shadow-xs"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Add Custom Subject to Blueprint
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={customSubjectName}
                onChange={(e) => setCustomSubjectName(e.target.value)}
                placeholder="Subject name (e.g. French)"
                className="px-3 py-2 text-xs rounded-xl bg-muted/40 border border-border/40 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-semantic-interactive min-h-[38px]"
              />
              <input
                type="text"
                value={customSubjectCode}
                onChange={(e) => setCustomSubjectCode(e.target.value.toUpperCase())}
                placeholder="Code (e.g. FRN)"
                className="px-3 py-2 text-xs font-mono rounded-xl bg-muted/40 border border-border/40 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-semantic-interactive min-h-[38px]"
              />
              <button
                type="button"
                onClick={handleAddCustom}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl inline-flex items-center justify-center gap-1.5 transition min-h-[38px] border border-border/40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subject</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Derived Exam Blueprint Summary (5 cols) */}
        <div className="lg:col-span-5 bg-card border border-border/40 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
              <Award className="w-3.5 h-3.5 text-semantic-interactive" />
              <span>Derived Exam Blueprint</span>
            </div>
            <span className="text-[11px] font-bold text-semantic-interactive px-2 py-0.5 rounded-full bg-semantic-interactive/10 border border-semantic-interactive/20">
              {board} Plan
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Automatic statutory evaluation terms and assessment windows computed for session{" "}
            <strong className="text-foreground">{startDate.slice(0, 4)} – {endDate.slice(0, 4)}</strong>.
          </p>

          <div className="space-y-3">
            {termPlanItems.map((term, idx) => (
              <div
                key={term.examTypeCode + idx}
                className="p-3.5 rounded-xl bg-muted/20 border border-border/30 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-extrabold text-xs text-foreground">
                    {term.name}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-semantic-interactive/10 text-semantic-interactive border border-semantic-interactive/20 font-semibold">
                    {term.examTypeCode}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  <span>
                    Est. Window: {formatDateSnippet(term.startDate)} – {formatDateSnippet(term.endDate)}
                  </span>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Applicable Classes:{" "}
                  <strong className="text-foreground">
                    {term.scopedClassNames.join(", ") || `${term.scopedClassCount} classes`}
                  </strong>
                </div>

                {term.components.length > 0 && (
                  <div className="pt-2 border-t border-border/30 flex flex-wrap gap-1.5">
                    {term.components.map((c) => (
                      <span
                        key={c.name}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/40 border border-border/40 text-muted-foreground"
                      >
                        {c.name} ({c.weightPercent}%)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-border/40 flex items-center gap-2 text-[11px] text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-semantic-money-in shrink-0" />
            <span>
              All exam types, grading scales, and report card templates will be seeded automatically.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
