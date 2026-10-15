"use client";

import React, { useState, useTransition } from "react";
import {
  generateDistributionsAction,
  previewDistributionsAction,
} from "../actions/distributionActions";
import type {
  DistributionProposal,
  GenerateDistributionsResult,
} from "@/lib/distributionAutomation";
import {
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  X,
  Loader2,
  ChevronRight,
  Filter,
} from "lucide-react";

interface DistributionsAutomationModalProps {
  examId: string;
  examName: string;
  classes: Array<{ id: string; displayName: string }>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DistributionsAutomationModal({
  examId,
  examName,
  classes,
  isOpen,
  onClose,
  onSuccess,
}: DistributionsAutomationModalProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [previewResult, setPreviewResult] =
    useState<GenerateDistributionsResult | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [step, setStep] = useState<"configure" | "preview">("configure");

  if (!isOpen) return null;

  const handleSelectAllClasses = () => {
    if (selectedClassIds.length === classes.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(classes.map((c) => c.id));
    }
  };

  const handleToggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId],
    );
  };

  const handlePreview = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await previewDistributionsAction({
          examId,
          classIds: selectedClassIds.length > 0 ? selectedClassIds : undefined,
        });

        if (res.success) {
          setPreviewResult(res);
          setStep("preview");
        } else {
          setMessage({
            text: res.message || "Failed to generate distribution preview",
            type: "error",
          });
        }
      } catch (err: any) {
        setMessage({
          text: err.message || "An unexpected error occurred during preview",
          type: "error",
        });
      }
    });
  };

  const handleCommit = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await generateDistributionsAction({
          examId,
          classIds: selectedClassIds.length > 0 ? selectedClassIds : undefined,
          previewOnly: false,
        });

        if (res.success) {
          setMessage({
            text: `✓ ${res.createdCount} mark distribution rows generated (${res.preservedCount} preserved, ${res.protectedCount} protected).`,
            type: "success",
          });
          if (onSuccess) {
            onSuccess();
          }
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setMessage({
            text: res.message || "Failed to commit mark distributions",
            type: "error",
          });
        }
      } catch (err: any) {
        setMessage({
          text: err.message || "An unexpected error occurred",
          type: "error",
        });
      }
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 dark:from-indigo-950/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Automate Mark Distributions
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Exam: <span className="font-semibold text-gray-700 dark:text-slate-200">{examName}</span> • Ensure-Semantics & Immutability Guarded
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Feedback Banner */}
        {message && (
          <div
            className={`p-4 mx-6 mt-4 rounded-xl text-sm font-medium flex items-center gap-2 ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {step === "configure" ? (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 space-y-2">
                <div className="font-semibold flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>How Distribution Automation Works</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                  <li>
                    <strong>Mandatory Subjects:</strong> Included automatically for all selected classes.
                  </li>
                  <li>
                    <strong>Elective Subjects:</strong> Only generated if at least one student is enrolled.
                  </li>
                  <li>
                    <strong>Ensure Semantics:</strong> Existing configured rows are never overwritten.
                  </li>
                  <li>
                    <strong>Immutability Guard:</strong> Any subject with existing student marks is completely protected.
                  </li>
                </ul>
              </div>

              {/* Class Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-500" />
                    Target Classes
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllClasses}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {selectedClassIds.length === classes.length
                      ? "Deselect All"
                      : "Select All Classes"}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1 border border-gray-100 dark:border-slate-800 rounded-xl bg-gray-50/50 dark:bg-slate-900/50">
                  {classes.map((cls) => {
                    const isSelected = selectedClassIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => handleToggleClass(cls.id)}
                        className={`p-2.5 rounded-lg text-xs font-semibold border transition text-left flex items-center justify-between ${
                          isSelected
                            ? "bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-200"
                            : "bg-white border-gray-200 text-gray-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 hover:border-gray-300"
                        }`}
                      >
                        <span className="truncate">{cls.displayName}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {selectedClassIds.length === 0
                    ? "No specific classes selected — will evaluate all classes in exam scope."
                    : `${selectedClassIds.length} class(es) selected.`}
                </p>
              </div>
            </div>
          ) : (
            /* Preview Step */
            <div className="space-y-5">
              {/* Stat Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    To Create
                  </div>
                  <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1">
                    {previewResult?.createdCount ?? 0}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    New blueprint distributions
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    Preserved
                  </div>
                  <div className="text-2xl font-black text-blue-900 dark:text-blue-200 mt-1">
                    {previewResult?.preservedCount ?? 0}
                  </div>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                    Existing custom rows
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Protected
                  </div>
                  <div className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-1">
                    {previewResult?.protectedCount ?? 0}
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                    Marks entered (locked)
                  </div>
                </div>
              </div>

              {/* Proposals Table */}
              <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-slate-800/80 sticky top-0 text-gray-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-gray-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Class</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Component</th>
                        <th className="py-2.5 px-3 text-right">Max</th>
                        <th className="py-2.5 px-3 text-right">Pass</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {previewResult?.proposals.map((p, idx) => (
                        <tr
                          key={`${p.classId}-${p.subjectId}-${p.componentId ?? "none"}-${idx}`}
                          className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-slate-200">
                            {p.className}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <span>{p.subjectName}</span>
                              <span className="text-[10px] text-gray-400">
                                ({p.subjectCode})
                              </span>
                              {p.isElective && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 font-semibold">
                                  Elective
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-gray-600 dark:text-slate-400">
                            {p.componentName ? (
                              <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                                {p.componentName}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">Whole Paper</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-gray-800 dark:text-slate-200">
                            {p.maxMarks}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-gray-600 dark:text-slate-400">
                            {p.passingMarks}
                          </td>
                          <td className="py-2.5 px-3">
                            {p.action === "CREATE" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <Sparkles className="w-3 h-3" />
                                Create
                              </span>
                            )}
                            {p.action === "PRESERVE_EXISTING" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                <Layers className="w-3 h-3" />
                                Preserved
                              </span>
                            )}
                            {p.action === "PROTECTED_HAS_MARKS" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                <ShieldAlert className="w-3 h-3" />
                                Protected
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
          {step === "preview" ? (
            <button
              type="button"
              onClick={() => setStep("configure")}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 transition"
            >
              ← Back to Selection
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 transition"
            >
              Cancel
            </button>
          )}

          {step === "configure" ? (
            <button
              type="button"
              onClick={handlePreview}
              disabled={isPending}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Evaluating Blueprint...</span>
                </>
              ) : (
                <>
                  <span>Preview Proposed Distributions</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCommit}
              disabled={isPending || (previewResult?.createdCount ?? 0) === 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Distributions...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    Commit {previewResult?.createdCount ?? 0} Distribution Rows
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
