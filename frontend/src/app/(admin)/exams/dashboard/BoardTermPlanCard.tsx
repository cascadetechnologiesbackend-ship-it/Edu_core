"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBoardTermPlan,
  getBoardTermPlanPreview,
} from "../actions/setupActions";
import {
  Calendar,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Clock,
  BookOpen,
  RefreshCw,
  PlusCircle,
} from "lucide-react";

interface TermPreviewItem {
  name: string;
  examTypeCode: string;
  startDate: string;
  endDate: string;
  scopedClassCount: number;
  scopedClassNames: string[];
  components: Array<{ name: string; weightPercent: number; examTypeCode?: string | undefined }>;
}

interface BoardTermPlanCardProps {
  board: string;
  hasExams: boolean;
  hasBoardDefaults: boolean;
  activeYearLabel?: string | undefined;
}

export function BoardTermPlanCard({
  board,
  hasExams,
  hasBoardDefaults,
  activeYearLabel,
}: BoardTermPlanCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewTerms, setPreviewTerms] = useState<TermPreviewItem[] | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleOpenDrawer = async () => {
    setIsDrawerOpen(true);
    setMessage(null);
    if (!previewTerms) {
      setIsLoadingPreview(true);
      try {
        const res = await getBoardTermPlanPreview();
        if (res.success && res.terms) {
          setPreviewTerms(res.terms);
        } else {
          setMessage({ text: res.message || "Failed to load term plan preview.", type: "error" });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error loading preview";
        setMessage({ text: msg, type: "error" });
      } finally {
        setIsLoadingPreview(false);
      }
    }
  };

  const handleConfirmProvision = () => {
    startTransition(async () => {
      setMessage(null);
      try {
        const res = await createBoardTermPlan();
        if (res.success) {
          setMessage({
            text: `✓ Successfully provisioned ${res.createdExams?.length || 0} examination shells! (${res.skippedExams?.length || 0} skipped).`,
            type: "success",
          });
          router.refresh();
        } else {
          setMessage({ text: res.message || "Failed to provision term plan.", type: "error" });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error provisioning term plan";
        setMessage({ text: msg, type: "error" });
      }
    });
  };

  if (!hasBoardDefaults) {
    return null;
  }

  return (
    <>
      {/* UX-P10: First-Run Progressive Onboarding Card (Primary when 0 exams exist) */}
      {!hasExams ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 border border-indigo-700/40 shadow-xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-xs font-semibold text-indigo-300">
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>First-Run Recommended Action • {board} Board Blueprint</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Create your {board} examination term plan
              </h2>

              <p className="text-sm text-indigo-200/90 leading-relaxed">
                Your school has {board} blueprint examination defaults loaded. Provision your entire yearly assessment lifecycle shells (Periodic Tests, Half-Yearly, Annual) in one click with proportional dates and automatic class scopes.
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-indigo-300 pt-1">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Proportionally derived dates
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Auto-intersected class scopes
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Theory & Internal components
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={handleOpenDrawer}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white text-indigo-900 font-bold text-sm hover:bg-indigo-50 transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-[0.99]"
              >
                <span>Review & Create {board} Term Plan</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Demoted Secondary Card when exam shells already exist */
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                {board} Board Term Plan Provisioning
              </h4>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Sync or add missing term shells for session {activeYearLabel || "active"} without duplicating existing exams
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenDrawer}
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Generate / Sync Term Shells</span>
          </button>
        </div>
      )}

      {/* UX-P09: Term Plan Confirmation Drawer (Slide-Over Panel) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end transition-opacity">
          <div
            className="w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full border-l border-gray-200 dark:border-slate-800 animate-in slide-in-from-right duration-300"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{board} Examination Blueprint</span>
                </div>
                <h3 id="drawer-title" className="text-xl font-extrabold text-gray-900 dark:text-white">
                  Confirm Board Term Plan Creation
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Session: {activeYearLabel || "Active Academic Year"} • Idempotent & non-destructive
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {message && (
                <div
                  className={`p-4 rounded-xl flex items-start gap-3 text-sm ${
                    message.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-emerald-900 dark:text-emerald-200"
                      : "bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-rose-900 dark:text-rose-200"
                  }`}
                >
                  {message.type === "success" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{message.text}</p>
                  </div>
                </div>
              )}

              {isLoadingPreview ? (
                <div className="p-12 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">
                    Calculating proportional dates and active class scopes...
                  </p>
                </div>
              ) : previewTerms && previewTerms.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Term Shells to be Provisioned ({previewTerms.length})
                  </div>

                  {previewTerms.map((term, idx) => {
                    const startStr = new Date(term.startDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });
                    const endStr = new Date(term.endDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                              {term.name}
                            </h4>
                          </div>

                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-gray-200/80 dark:bg-slate-700 text-gray-700 dark:text-slate-300">
                            {term.examTypeCode}
                          </span>
                        </div>

                        {/* Date Window */}
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Placeholder Window:</span>
                          <span className="font-semibold">{startStr} – {endStr}</span>
                          <span className="text-gray-400">(proportional)</span>
                        </div>

                        {/* Class Scope */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Scoped Classes ({term.scopedClassCount}):</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {term.scopedClassNames.length > 0 ? (
                              term.scopedClassNames.map((clsName, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-600"
                                >
                                  {clsName}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-amber-600 italic">
                                No active school classes match this term&apos;s educational categories
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Components */}
                        <div className="space-y-1 pt-1 border-t border-gray-200/70 dark:border-slate-700/60">
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300">
                            <Layers className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Components:</span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {term.components.map((cmp, cmpIdx) => (
                              <span
                                key={cmpIdx}
                                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center gap-1.5"
                              >
                                <span>{cmp.name}</span>
                                <span className="text-indigo-500">({cmp.weightPercent}%)</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      Idempotent Provisioning
                    </p>
                    <p>
                      Any exams with identical names for the current academic session will be skipped automatically without duplicating or modifying existing datesheets and marks.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Drawer Footer */}
            <div className="p-5 border-t border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 font-semibold text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isPending || isLoadingPreview}
                onClick={handleConfirmProvision}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Provisioning Shells...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm &amp; Provision {board} Term Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
