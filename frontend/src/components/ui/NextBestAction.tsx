"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionItem {
  label: string;
  href?: string | undefined;
  onClick?: (() => void) | undefined;
  primary?: boolean | undefined;
}

export interface ReadinessData {
  classId?: string | undefined;
  className?: string | undefined;
  hasSections?: boolean | undefined;
  hasSubjects?: boolean | undefined;
  hasTeachers?: boolean | undefined;
  hasTimetable?: boolean | undefined;
  hasRoster?: boolean | undefined;
}

export interface NextBestActionProps {
  outcome?: string | undefined;
  suggestion?: ActionItem | undefined;
  alternates?: ActionItem[] | undefined;
  isCelebration?: boolean | undefined;
  onDismiss?: (() => void) | undefined;
  readiness?: ReadinessData | undefined;
  className?: string | undefined;
}

export function NextBestAction({
  outcome,
  suggestion: propSuggestion,
  alternates: propAlternates = [],
  isCelebration: propIsCelebration,
  onDismiss,
  readiness,
  className,
}: NextBestActionProps) {
  // Derive automated action from readiness if provided
  let derivedOutcome = outcome;
  let derivedSuggestion = propSuggestion;
  let derivedAlternates = [...propAlternates];
  let isCelebration = propIsCelebration;

  if (readiness) {
    const {
      classId,
      className: name = "Class",
      hasSections,
      hasSubjects,
      hasTeachers,
      hasTimetable,
      hasRoster,
    } = readiness;

    if (hasSections && hasSubjects && hasTeachers && hasTimetable) {
      isCelebration = true;
      derivedOutcome = derivedOutcome || `${name} is fully set up. Ready for the first bell!`;
      if (!derivedSuggestion && classId) {
        derivedSuggestion = {
          label: "View Class Hub Overview",
          href: `/academics/classes/${classId}?tab=overview`,
          primary: true,
        };
      }
      if (derivedAlternates.length === 0 && classId) {
        derivedAlternates.push({
          label: "Open Student Roster",
          href: `/academics/classes/${classId}?tab=roster`,
        });
      }
    } else if (hasSections === false && classId) {
      derivedOutcome = derivedOutcome || `${name} needs sections configured.`;
      derivedSuggestion = derivedSuggestion || {
        label: "Add Sections",
        href: `/academics/classes/${classId}?tab=sections`,
        primary: true,
      };
    } else if (hasSubjects === false && classId) {
      derivedOutcome = derivedOutcome || `${name} has sections. Next, attach subjects.`;
      derivedSuggestion = derivedSuggestion || {
        label: "Attach Subjects",
        href: `/academics/classes/${classId}?tab=subjects`,
        primary: true,
      };
    } else if (hasTeachers === false) {
      derivedOutcome = derivedOutcome || `Subjects attached. Next, assign teachers.`;
      derivedSuggestion = derivedSuggestion || {
        label: "Assign Teachers",
        href: `/academics/mapping`,
        primary: true,
      };
    } else if (hasTimetable === false && classId) {
      derivedOutcome = derivedOutcome || `Teachers assigned. Next, build timetable.`;
      derivedSuggestion = derivedSuggestion || {
        label: "Build Timetable",
        href: `/academics/classes/${classId}?tab=timetable`,
        primary: true,
      };
    } else if (hasRoster === false && classId) {
      derivedOutcome = derivedOutcome || `Timetable configured. Next, enroll students.`;
      derivedSuggestion = derivedSuggestion || {
        label: "Enroll Students",
        href: `/students?classId=${classId}`,
        primary: true,
      };
    }
  }

  if (!derivedOutcome && !derivedSuggestion) {
    return null;
  }

  const renderAction = (action: ActionItem, isPrimary: boolean) => {
    const content = (
      <>
        <span>{action.label}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </>
    );

    const baseClasses = cn(
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition min-h-[32px] focus:outline-none focus:ring-2 whitespace-nowrap",
      isPrimary
        ? isCelebration
          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs focus:ring-emerald-400/30"
          : "bg-primary hover:bg-primary/95 text-white shadow-xs focus:ring-primary/30"
        : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/80 border border-gray-200/80 dark:border-slate-700/80"
    );

    if (action.href) {
      return (
        <Link key={action.label} href={action.href} className={baseClasses}>
          {content}
        </Link>
      );
    }

    return (
      <button
        key={action.label}
        type="button"
        onClick={action.onClick}
        className={baseClasses}
      >
        {content}
      </button>
    );
  };

  return (
    <div
      className={cn(
        "w-full rounded-xl px-4 py-2.5 transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1",
        isCelebration
          ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 shadow-xs shadow-emerald-500/10 text-emerald-950 dark:text-emerald-100"
          : "bg-blue-50/80 dark:bg-slate-800/80 border border-blue-200/70 dark:border-slate-700/80 text-gray-900 dark:text-gray-100",
        className
      )}
    >
      {/* Left: icon + outcome sentence */}
      <div className="flex items-center gap-2.5 min-w-0 pr-2">
        {isCelebration ? (
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        )}
        <span className="font-semibold truncate leading-tight">
          {derivedOutcome}
        </span>
      </div>

      {/* Right: Suggested primary + alternate actions */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
        {derivedSuggestion && renderAction(derivedSuggestion, true)}
        {derivedAlternates.slice(0, 2).map((alt) => renderAction(alt, false))}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition ml-1"
            title="Dismiss suggestion"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default NextBestAction;
