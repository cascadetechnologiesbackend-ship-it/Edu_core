"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { UserRole } from "@schoolmitra/validators/roleConfig";
import {
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Sparkles,
  RotateCcw,
  Compass,
  Layers,
  ExternalLink,
} from "lucide-react";
import { getTourDeckForRole } from "@/lib/tours/decks";
import { SCHOOL_ADMIN_DECK } from "@/lib/tours/adminTour";
import {
  getSavedTourState,
  saveTourState,
  clearTourState,
} from "@/lib/tours/storage";
import { recordTourUsageAction } from "@/app/actions/tourTelemetry";
import { TourModule, TourSubModule } from "@/lib/tours/types";

export interface FeatureTutorialFlashCardsProps {
  role?: UserRole | string;
  initialOpen?: boolean;
  className?: string;
}

export function FeatureTutorialFlashCards({
  role = "SCHOOL_ADMIN",
  initialOpen = true,
  className = "",
}: FeatureTutorialFlashCardsProps) {
  const deck = getTourDeckForRole(role);
  const totalModules = deck.modules.length;

  const [isVisible, setIsVisible] = useState<boolean | null>(null);
  const [level, setLevel] = useState<1 | 2>(1);
  const [moduleIndex, setModuleIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Initialize state from localStorage per role
  useEffect(() => {
    const saved = getSavedTourState(role);
    if (saved) {
      if (saved.status === "dismissed") {
        setIsVisible(false);
      } else if (saved.status === "completed") {
        setIsVisible(false);
        setIsCompleted(true);
      } else {
        setIsVisible(initialOpen);
        setLevel(saved.level || 1);
        setModuleIndex(Math.min(saved.moduleIndex || 0, totalModules - 1));
        setSubIndex(saved.subIndex || 0);
      }
    } else {
      setIsVisible(initialOpen);
      // Emit tour_started upon fresh start
      if (initialOpen) {
        startTransition(() => {
          recordTourUsageAction("tour_started", role);
        });
      }
    }

    const handleOpenTour = (event: Event) => {
      const customEvent = event as CustomEvent<{ role?: string; restart?: boolean }>;
      if (customEvent.detail?.role && customEvent.detail.role.toUpperCase() !== String(role).toUpperCase()) {
        return; // Event designated for a different role
      }

      setIsVisible(true);
      if (customEvent.detail?.restart) {
        setLevel(1);
        setModuleIndex(0);
        setSubIndex(0);
        setIsCompleted(false);
        saveTourState(role, { status: "in_progress", level: 1, moduleIndex: 0, subIndex: 0 });
      } else {
        const resumeState = getSavedTourState(role);
        if (resumeState && resumeState.status !== "completed") {
          setLevel(resumeState.level || 1);
          setModuleIndex(Math.min(resumeState.moduleIndex || 0, totalModules - 1));
          setSubIndex(resumeState.subIndex || 0);
          setIsCompleted(false);
        } else {
          setLevel(1);
          setModuleIndex(0);
          setSubIndex(0);
          setIsCompleted(false);
        }
      }
    };

    window.addEventListener("open-tutorial-flashcards", handleOpenTour);
    return () => {
      window.removeEventListener("open-tutorial-flashcards", handleOpenTour);
    };
  }, [role, initialOpen, totalModules]);

  if (isVisible === null || !isVisible) {
    return null;
  }

  const currentModule: TourModule = deck.modules[moduleIndex] ?? deck.modules[0]!;
  const subModules: TourSubModule[] = currentModule.subModules ?? [];
  const currentSubModule: TourSubModule | undefined = subModules[subIndex] ?? subModules[0];
  const IconComponent = currentModule.icon || Compass;

  // Persist progress update
  const persistProgress = (newLevel: 1 | 2, newModIdx: number, newSubIdx: number) => {
    setLevel(newLevel);
    setModuleIndex(newModIdx);
    setSubIndex(newSubIdx);
    saveTourState(role, {
      status: "in_progress",
      level: newLevel,
      moduleIndex: newModIdx,
      subIndex: newSubIdx,
    });
  };

  // Skip actions
  const handleSkipTour = () => {
    saveTourState(role, { status: "dismissed" });
    setIsVisible(false);
    startTransition(() => {
      recordTourUsageAction("tour_skipped", role);
    });
  };

  const handleSkipModule = () => {
    if (moduleIndex < totalModules - 1) {
      persistProgress(1, moduleIndex + 1, 0);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setIsCompleted(true);
    saveTourState(role, { status: "completed", level: 1, moduleIndex: totalModules - 1, subIndex: 0 });
    startTransition(() => {
      recordTourUsageAction("tour_completed", role);
    });
  };

  const handleRestartTour = () => {
    setIsCompleted(false);
    persistProgress(1, 0, 0);
    startTransition(() => {
      recordTourUsageAction("tour_started", role);
    });
  };

  // Level 1 Navigation
  const handleNextModule = () => {
    if (moduleIndex < totalModules - 1) {
      persistProgress(1, moduleIndex + 1, 0);
    } else {
      handleComplete();
    }
  };

  const handlePrevModule = () => {
    if (moduleIndex > 0) {
      persistProgress(1, moduleIndex - 1, 0);
    }
  };

  // Level 2 Navigation
  const handleEnterSubModules = () => {
    if (subModules.length > 0) {
      persistProgress(2, moduleIndex, 0);
    }
  };

  const handleBackToModules = () => {
    persistProgress(1, moduleIndex, 0);
  };

  const handleNextSubModule = () => {
    if (subIndex < subModules.length - 1) {
      persistProgress(2, moduleIndex, subIndex + 1);
    } else if (moduleIndex < totalModules - 1) {
      // Advance to next module at level 1
      persistProgress(1, moduleIndex + 1, 0);
    } else {
      handleComplete();
    }
  };

  const handlePrevSubModule = () => {
    if (subIndex > 0) {
      persistProgress(2, moduleIndex, subIndex - 1);
    } else {
      // Return to module overview
      persistProgress(1, moduleIndex, 0);
    }
  };

  // ── Render Completion Card ──────────────────────────────────────────────
  if (isCompleted) {
    return (
      <section
        data-testid="feature-tutorial-flashcards"
        aria-label="Tour Completion"
        className={`relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-950/90 to-slate-950 backdrop-blur-xl p-6 sm:p-8 shadow-xl text-center space-y-5 ${className}`}
      >
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1.5 max-w-lg mx-auto">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            {deck.roleDisplayName} Tour Complete
          </span>
          <h2 className="text-2xl font-black text-white">
            {deck.completionTitle || "You're All Set!"}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            {deck.completionMessage ||
              "You now know where your key modules and daily tools live. Revisit any time from the Quick Tutorial button."}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleSkipTour}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition active:scale-95"
          >
            <span>Got it, Close Tour</span>
          </button>
          <button
            type="button"
            onClick={handleRestartTour}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs inline-flex items-center justify-center gap-2 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart Tour</span>
          </button>
        </div>
      </section>
    );
  }

  // ── Render Level 2: Sub-Module Drill-Down Card ───────────────────────────
  if (level === 2 && currentSubModule) {
    return (
      <section
        data-testid="feature-tutorial-flashcards"
        aria-label="Sub-Module Tour"
        className={`relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br ${currentModule.bgGradient || "from-indigo-600/20 via-slate-900/40 to-transparent"} bg-slate-950/90 backdrop-blur-xl p-5 sm:p-7 shadow-xl transition-all duration-300 ${className}`}
      >
        {/* Breadcrumb Navigation & Skip Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-5">
          <button
            type="button"
            onClick={handleBackToModules}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>← Back to {currentModule.title}</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400">
              Sub-module {subIndex + 1} of {subModules.length}
            </span>
            <button
              type="button"
              onClick={handleSkipTour}
              aria-label="Skip Tour"
              className="text-xs font-semibold text-slate-400 hover:text-rose-400 transition"
            >
              Skip tour
            </button>
          </div>
        </div>

        {/* Sub-module Content */}
        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {currentModule.title} Drill-down
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {currentSubModule.title}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            {currentSubModule.summary}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href={currentSubModule.ctaHref}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-orange-600/25 transition active:scale-95"
            >
              <span>Open {currentSubModule.title}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Sub-module Navigation Controls */}
        <div className="flex items-center justify-between gap-3 pt-5 mt-5 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handlePrevSubModule}
            className="px-3.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{subIndex === 0 ? "Module Overview" : "Previous"}</span>
          </button>

          <div className="flex items-center gap-1.5">
            {subModules.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => persistProgress(2, moduleIndex, idx)}
                aria-label={`Jump to sub-module ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === subIndex ? "w-6 bg-indigo-500" : "w-2 bg-slate-700 hover:bg-slate-500"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleNextSubModule}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1 transition shadow-xs"
          >
            <span>{subIndex === subModules.length - 1 ? (moduleIndex === totalModules - 1 ? "Finish Tour" : "Next Module") : "Next Sub-module"}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    );
  }

  // ── Render Level 1: Module Level Card ────────────────────────────────────
  return (
    <section
      data-testid="feature-tutorial-flashcards"
      aria-label="Role Feature Tour"
      className={`relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br ${currentModule.bgGradient || "from-blue-600/20 via-indigo-600/10 to-transparent"} bg-slate-950/90 backdrop-blur-xl p-5 sm:p-7 shadow-xl transition-all duration-300 ${className}`}
    >
      {/* Background Subtle Pattern */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-white/[0.04] to-transparent pointer-events-none rounded-full blur-2xl" />

      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {deck.roleDisplayName} Tour
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentModule.tagColor || "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                {currentModule.tag}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Module {moduleIndex + 1} of {totalModules} · Explore daily surfaces and jump directly to work
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSkipModule}
            className="hidden sm:inline-block text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            Skip module
          </button>
          <button
            type="button"
            onClick={handleSkipTour}
            aria-label="Dismiss Tutorial"
            className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Skip tour</span>
          </button>
        </div>
      </div>

      {/* Main Flash Card Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Visual Icon, Title, and Actions */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700/80 ${currentModule.iconColor || "text-blue-400"} flex items-center justify-center shadow-lg shadow-black/40`}>
              <IconComponent className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                Module #{moduleIndex + 1}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {currentModule.title}
              </h3>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            {currentModule.summary}
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            <Link
              href={currentModule.ctaHref}
              className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-orange-600/25 transition active:scale-95"
            >
              <span>Open {currentModule.title}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {subModules.length > 0 && (
              <button
                type="button"
                onClick={handleEnterSubModules}
                className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>See What's Inside ({subModules.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: "What It Is" & "Why It Matters" Explanation Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-left space-y-2">
            <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>What it is</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {currentModule.whatItIs}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-left space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Why it matters</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {currentModule.whyItMatters}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Navigation & Step Dots */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-5 border-t border-slate-800/80">
        {/* Step Dots */}
        <div className="flex items-center gap-1.5">
          {deck.modules.map((mod, idx) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => persistProgress(1, idx, 0)}
              aria-label={`Jump to module ${idx + 1}: ${mod.title}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === moduleIndex ? "w-7 bg-orange-500" : "w-2 bg-slate-700 hover:bg-slate-500"
              }`}
            />
          ))}
        </div>

        {/* Next / Previous Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={moduleIndex === 0}
            onClick={handlePrevModule}
            className="px-3.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1 transition disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            onClick={handleNextModule}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1 transition shadow-xs"
          >
            <span>{moduleIndex === totalModules - 1 ? "Finish Tour" : "Next"}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

// Backward compatibility export
export const TUTORIAL_FLASH_CARDS = SCHOOL_ADMIN_DECK.modules;
