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
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          Step 1: Board-First Provisioning
        </span>
        <h2 className="text-2xl font-black text-white mt-1">
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
              className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left group shadow-sm ${
                isSelected
                  ? "bg-slate-900 border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/10"
                  : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/60 group-hover:scale-105 transition-transform">
                    {BOARD_ICONS[b]}
                  </div>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-primary/20 text-blue-400 border border-primary/40">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Selected
                    </span>
                  )}
                </div>

                <h3 className="font-extrabold text-white text-base leading-snug">
                  {info.name}
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {info.subtitle}
                </p>
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="text-slate-400">
                  Assessment:{" "}
                  <strong className="text-slate-200">{info.examSystem}</strong>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-slate-300 border border-slate-700">
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
