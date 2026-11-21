"use client";

import React from "react";
import { useOnboarding, BOARD_DISPLAY_DATA, BoardType } from "../onboardContext";
import { GraduationCap, Award, BookOpen, Globe2, Compass, CheckCircle2 } from "lucide-react";

const BOARD_ICONS: Record<BoardType, React.ReactNode> = {
  CBSE: <GraduationCap className="w-6 h-6 text-blue-400" />,
  ICSE: <Award className="w-6 h-6 text-purple-400" />,
  STATE_BOARD: <BookOpen className="w-6 h-6 text-amber-400" />,
  IGCSE: <Globe2 className="w-6 h-6 text-emerald-400" />,
  IB: <Compass className="w-6 h-6 text-cyan-400" />,
};

export function Step1Board() {
  const { board, handleBoardSelect } = useOnboarding();
  const boards: BoardType[] = ["CBSE", "ICSE", "STATE_BOARD", "IGCSE", "IB"];

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
          Step 1: Board-First Provisioning
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
          Select Your Educational Board
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
          The selected board establishes the canonical class hierarchy, statutory subject curriculum,
          assessment schedules, and grading rules. Everything downstream is automatically pre-configured.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {boards.map((b) => {
          const isSelected = board === b;
          const info = BOARD_DISPLAY_DATA[b];

          return (
            <div
              key={b}
              onClick={() => handleBoardSelect(b)}
              className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left group min-h-[160px] active:scale-[0.99] ${
                isSelected
                  ? "bg-slate-900/90 border-blue-500 ring-2 ring-blue-500/30 shadow-level-1"
                  : "bg-slate-900/40 border-white/[0.08] hover:border-blue-500/30 hover:bg-slate-900/70 shadow-level-0"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/10 group-hover:scale-105 transition-transform">
                    {BOARD_ICONS[b]}
                  </div>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/25">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Selected
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-white text-base leading-snug">
                  {info.name}
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {info.subtitle}
                </p>
              </div>

              <div className="mt-4 pt-3.5 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="text-slate-400">
                  Assessment:{" "}
                  <strong className="text-slate-200">{info.examSystem}</strong>
                </div>
                <span className="px-2 py-0.5 rounded bg-white/[0.06] font-mono text-slate-300 border border-white/10">
                  {info.defaultGrading.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
