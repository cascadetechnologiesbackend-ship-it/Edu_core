"use client";

import React, { useState } from "react";
import {
  useOnboarding,
  CLASS_GROUP_INFO,
  getDefaultClassesForBoard,
} from "../onboardContext";
import {
  ClassGroup,
  ALL_CLASS_GROUPS,
  mapGradeLevelToClassGroup,
} from "@/lib/examBoardBlueprints";
import { Plus, X, Layers, Sparkles } from "lucide-react";

export function Step3Classes() {
  const {
    board,
    classesList,
    setClassesList,
    addClass,
    removeClass,
    toggleSectionForClass,
  } = useOnboarding();

  const [customClassName, setCustomClassName] = useState("");
  const availableSections = ["A", "B", "C", "D"];

  const handleAddClass = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customClassName.trim()) return;
    addClass(customClassName.trim(), "");
    setCustomClassName("");
  };

  const resetToBoardPreset = (preset: "K10" | "K12" | "PRIMARY" | "SECONDARY") => {
    const base = getDefaultClassesForBoard(board);
    if (preset === "K10") {
      setClassesList(base.filter((c) => !["CLASS_11", "CLASS_12"].includes(c.gradeLevel)));
    } else if (preset === "K12") {
      const has11 = base.some((c) => c.gradeLevel === "CLASS_11");
      if (has11) {
        setClassesList(base);
      } else {
        setClassesList([
          ...base,
          { gradeLevel: "CLASS_11", displayName: "Class 11", sections: ["A"] },
          { gradeLevel: "CLASS_12", displayName: "Class 12", sections: ["A"] },
        ]);
      }
    } else if (preset === "PRIMARY") {
      setClassesList(
        base.filter((c) =>
          ["NURSERY", "LKG", "UKG", "CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4", "CLASS_5"].includes(
            c.gradeLevel,
          ),
        ),
      );
    } else if (preset === "SECONDARY") {
      setClassesList(
        base.filter((c) =>
          ["CLASS_6", "CLASS_7", "CLASS_8", "CLASS_9", "CLASS_10"].includes(c.gradeLevel),
        ),
      );
    }
  };

  // Group classes by classGroup
  const groupedClasses: Record<ClassGroup, typeof classesList> = {
    NURSERY_UKG: [],
    CLASS_1_5: [],
    CLASS_6_8: [],
    CLASS_9_10: [],
    CLASS_11_12: [],
  };

  classesList.forEach((cls) => {
    const grp = mapGradeLevelToClassGroup(cls.gradeLevel || cls.displayName);
    groupedClasses[grp].push(cls);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Step 3: Class Architecture & Sections
          </span>
          <h2 className="text-2xl font-black text-white mt-1">
            Classes Configured for {board}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Classes are organized into canonical academic wings. Click on a section pill to toggle section
            provisioning, or add custom classes.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          <span className="text-[11px] font-bold text-slate-500 mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => resetToBoardPreset("K10")}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            K-10
          </button>
          <button
            type="button"
            onClick={() => resetToBoardPreset("K12")}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            K-12
          </button>
          <button
            type="button"
            onClick={() => resetToBoardPreset("PRIMARY")}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
          >
            Primary Only
          </button>
        </div>
      </div>

      {/* Class Groups Display */}
      <div className="space-y-4">
        {ALL_CLASS_GROUPS.map((grp) => {
          const classesInGroup = groupedClasses[grp];
          if (classesInGroup.length === 0) return null;
          const info = CLASS_GROUP_INFO[grp];

          return (
            <div
              key={grp}
              className={`rounded-2xl border p-4 bg-slate-900/50 ${info.borderClass}`}
            >
              {/* Group Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-black uppercase tracking-wider ${info.colorClass}`}
                  >
                    {info.label}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    ({info.gradeRange})
                  </span>
                </div>
                <span className="text-[11px] font-bold text-slate-400">
                  {classesInGroup.length} class{classesInGroup.length === 1 ? "" : "es"}
                </span>
              </div>

              {/* Class Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {classesInGroup.map((cls) => {
                  const globalIdx = classesList.findIndex(
                    (c) => c.displayName === cls.displayName && c.gradeLevel === cls.gradeLevel,
                  );

                  return (
                    <div
                      key={cls.displayName}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">
                          {cls.displayName}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeClass(globalIdx)}
                          className="text-slate-500 hover:text-rose-400 transition p-1"
                          title="Remove class"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Sections Toggle */}
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Sections ({cls.sections.join(", ")})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {availableSections.map((sec) => {
                            const isIncluded = cls.sections.includes(sec);
                            return (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => toggleSectionForClass(globalIdx, sec)}
                                className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                                  isIncluded
                                    ? "bg-primary text-white shadow-xs"
                                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                                }`}
                              >
                                {sec}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Custom Class Row */}
      <form
        onSubmit={handleAddClass}
        className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3"
      >
        <div className="flex-1 w-full">
          <input
            type="text"
            value={customClassName}
            onChange={(e) => setCustomClassName(e.target.value)}
            placeholder="Add custom class (e.g. Pre-Nursery, Playgroup, Class 13)..."
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-primary min-h-[38px]"
          />
        </div>
        <button
          type="button"
          onClick={handleAddClass}
          className="w-full sm:w-auto px-4 py-2 bg-primary hover:bg-primary/95 text-white font-bold text-xs rounded-xl inline-flex items-center justify-center gap-1.5 transition shadow-xs min-h-[38px] shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Class</span>
        </button>
      </form>
    </div>
  );
}
