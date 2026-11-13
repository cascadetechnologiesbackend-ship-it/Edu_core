"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  ChevronRight,
  Compass,
  CheckCircle2,
} from "lucide-react";
import { TourStep } from "@/lib/tours/types";

export interface ModuleProgressTrailItem {
  id: string;
  title: string;
  status: "done" | "current" | "not_visited";
}

interface CoachMarkCardProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  moduleTitle: string;
  targetElement: HTMLElement | null;
  onNext: () => void;
  onBack: () => void;
  onSkipModule: () => void;
  onSkipTour: () => void;
  onActionCTA?: () => void;
  trail?: ModuleProgressTrailItem[];
}

export function CoachMarkCard({
  step,
  stepIndex,
  totalSteps,
  moduleTitle,
  targetElement,
  onNext,
  onBack,
  onSkipModule,
  onSkipTour,
  onActionCTA,
  trail = [],
}: CoachMarkCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom" | "left" | "right">("bottom");

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const mobile = window.innerWidth < 640;
    setIsMobile(mobile);
    if (mobile || !targetElement || !cardRef.current) {
      setCoords(null);
      return;
    }

    const targetRect = targetElement.getBoundingClientRect();
    const cardRect = cardRef.current.getBoundingClientRect();
    const margin = 12;

    const cardWidth = cardRect.width || 340;
    const cardHeight = cardRect.height || 220;

    // Check available vertical space
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;

    let computedTop = targetRect.bottom + margin;
    let computedLeft = targetRect.left + (targetRect.width - cardWidth) / 2;
    let chosenPlacement: "top" | "bottom" | "left" | "right" = "bottom";

    if (spaceBelow < cardHeight + margin && spaceAbove > cardHeight + margin) {
      // Position above
      computedTop = targetRect.top - cardHeight - margin;
      chosenPlacement = "top";
    }

    // Clamp horizontally to stay inside viewport with at least 16px padding
    const minLeft = 16;
    const maxLeft = window.innerWidth - cardWidth - 16;
    computedLeft = Math.max(minLeft, Math.min(maxLeft, computedLeft));

    // Clamp vertically
    const minTop = 16;
    const maxTop = window.innerHeight - cardHeight - 16;
    computedTop = Math.max(minTop, Math.min(maxTop, computedTop));

    setPlacement(chosenPlacement);
    setCoords({ top: computedTop, left: computedLeft });
  }, [targetElement]);

  useEffect(() => {
    updatePosition();
    // Auto-focus next button for rapid keyboard traversal
    nextBtnRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkipModule();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft" && stepIndex > 0) {
        e.preventDefault();
        onBack();
      }
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, { passive: true, capture: true });

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, { capture: true });
    };
  }, [updatePosition, onNext, onBack, onSkipModule, stepIndex]);

  const isLastStep = stepIndex === totalSteps - 1;

  // Mobile Bottom-Sheet vs Desktop Positioned Popover
  const containerStyle: React.CSSProperties = isMobile
    ? {}
    : coords
    ? {
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }
    : { position: "fixed", bottom: "24px", right: "24px" };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-mark-title"
      data-testid="coach-mark-card"
      style={containerStyle}
      className={
        isMobile
          ? "fixed inset-x-3 bottom-3 z-[9995] rounded-3xl bg-slate-900 border border-indigo-500/30 p-5 shadow-2xl text-slate-100 animate-in slide-in-from-bottom-6 duration-200"
          : "z-[9995] w-96 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-indigo-500/30 p-5 shadow-2xl text-slate-100 transition-all duration-200 animate-in fade-in-50"
      }
    >
      {/* ─── Header: Module Name, Step Counter, Close ────────────────────── */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
          <span className="text-xs font-bold text-indigo-300 truncate">
            {moduleTitle}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <button
            type="button"
            onClick={onSkipModule}
            aria-label="Close tour step"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Level Progression Strip (Game-style trail) ────────────────────── */}
      {trail.length > 0 && (
        <div className="pt-2 pb-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {trail.map((t, idx) => (
            <div
              key={t.id || idx}
              title={t.title}
              className={`h-1.5 rounded-full transition-all ${
                t.status === "done"
                  ? "w-4 bg-emerald-400"
                  : t.status === "current"
                  ? "w-6 bg-indigo-400 animate-pulse"
                  : "w-2 bg-slate-800"
              }`}
            />
          ))}
        </div>
      )}

      {/* ─── Step Content ──────────────────────────────────────────────────── */}
      <div className="py-3 space-y-1.5">
        <h3
          id="coach-mark-title"
          className="text-sm font-bold text-white flex items-center gap-2"
        >
          <span>{step.title}</span>
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          {step.line}
        </p>
      </div>

      {/* ─── Action CTA (if control is actionable) ─────────────────────────── */}
      {step.ctaLabel && (
        <div className="pb-3">
          <button
            type="button"
            onClick={() => {
              if (onActionCTA) onActionCTA();
              onNext();
            }}
            className="w-full py-1.5 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white font-semibold text-xs transition flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{step.ctaLabel}</span>
          </button>
        </div>
      )}

      {/* ─── Navigation Footer ─────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
        {/* Skip controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="coach-mark-skip-module"
            onClick={onSkipModule}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-200 transition"
          >
            Skip Module
          </button>
          <span className="text-slate-700 text-xs">•</span>
          <button
            type="button"
            data-testid="coach-mark-skip-tour"
            onClick={onSkipTour}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-300 transition"
          >
            Skip Tour
          </button>
        </div>

        {/* Back and Next */}
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              type="button"
              data-testid="coach-mark-back"
              onClick={onBack}
              className="px-2.5 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}

          <button
            ref={nextBtnRef}
            type="button"
            data-testid="coach-mark-next"
            onClick={onNext}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition flex items-center gap-1"
          >
            <span>{isLastStep ? "Finish Module" : "Next"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

