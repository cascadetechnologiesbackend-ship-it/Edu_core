"use client";

import React from "react";
import { useOnboarding, BOARD_DISPLAY_DATA, BoardType } from "../onboardContext";
import { GraduationCap, Award, BookOpen, Globe2, Compass, CheckCircle2 } from "lucide-react";

const BOARD_ICONS: Record<BoardType, React.ReactNode> = {
  CBSE: <GraduationCap className="w-6 h-6 text-semantic-interactive" />,
  ICSE: <Award className="w-6 h-6 text-purple-400" />,
  STATE_BOARD: <BookOpen className="w-6 h-6 text-semantic-attention" />,
  IGCSE: <Globe2 className="w-6 h-6 text-semantic-money-in" />,
  IB: <Compass className="w-6 h-6 text-cyan-400" />,
};

export function Step1Board() {
  const { board, handleBoardSelect } = useOnboarding();
  const boards: BoardType[] = ["CBSE", "ICSE", "STATE_BOARD", "IGCSE", "IB"];

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-semantic-interactive">
          Step 1: Board-First Provisioning
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-foreground mt-1">
          Select Your Educational Board
        </h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
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
                  ? "bg-card border-semantic-interactive ring-2 ring-semantic-interactive/30 shadow-xs"
                  : "bg-card/50 border-border/40 hover:border-semantic-interactive/40 hover:bg-card/90 shadow-xs"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-muted border border-border/40 group-hover:scale-105 transition-transform">
                    {BOARD_ICONS[b]}
                  </div>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-semantic-interactive/12 text-semantic-interactive border border-semantic-interactive/25">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Selected
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-foreground text-base leading-snug">
                  {info.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  {info.subtitle}
                </p>
              </div>

              <div className="mt-4 pt-3.5 border-t border-border/30 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="text-muted-foreground">
                  Assessment:{" "}
                  <strong className="text-foreground">{info.examSystem}</strong>
                </div>
                <span className="px-2 py-0.5 rounded bg-muted font-mono text-muted-foreground border border-border/40">
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
