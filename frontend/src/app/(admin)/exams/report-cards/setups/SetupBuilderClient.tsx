"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SlidersHorizontal,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import { createReportCardSetup } from "../../actions";

interface SetupBuilderClientProps {
  activeYear: { id: string; label: string };
  exams: Array<{ id: string; name: string }>;
  existingSetups: Array<{
    id: string;
    name: string;
    examWeightages: Array<{ examId: string; weightPercent: number }>;
    layout: any;
    isActive: boolean;
    createdAt: string;
  }>;
}

export function SetupBuilderClient({
  activeYear,
  exams,
  existingSetups,
}: SetupBuilderClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [weightages, setWeightages] = useState<
    Array<{ examId: string; weightPercent: number }>
  >(
    exams.length > 0
      ? [{ examId: exams[0]!.id, weightPercent: 100 }]
      : [],
  );
  const [template, setTemplate] = useState<
    "CBSE_STANDARD" | "CCE_HOLISTIC" | "ICSE_BOARD" | "CUSTOM"
  >("CBSE_STANDARD");
  const [showCoCurricular, setShowCoCurricular] = useState(true);
  const [remarksMode, setRemarksMode] = useState<"MANUAL" | "AUTO_FORMULA">(
    "MANUAL",
  );

  const totalWeightage = weightages.reduce((sum, w) => sum + w.weightPercent, 0);

  const addExamRow = () => {
    if (exams.length === 0) return;
    setWeightages((prev) => [
      ...prev,
      { examId: exams[0]!.id, weightPercent: 0 },
    ]);
  };

  const removeExamRow = (idx: number) => {
    setWeightages((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateExamRow = (
    idx: number,
    field: "examId" | "weightPercent",
    val: string | number,
  ) => {
    setWeightages((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        return {
          ...item,
          [field]: field === "weightPercent" ? Number(val) : val,
        };
      }),
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!name.trim()) {
      setFeedback({ text: "Please enter a setup name.", type: "error" });
      return;
    }

    if (weightages.length === 0) {
      setFeedback({
        text: "Please include at least one exam cycle in the report card.",
        type: "error",
      });
      return;
    }

    if (Math.abs(totalWeightage - 100) > 0.01) {
      setFeedback({
        text: `Total exam weightage must equal 100% (currently ${totalWeightage}%).`,
        type: "error",
      });
      return;
    }

    startTransition(async () => {
      const res = await createReportCardSetup({
        academicYearId: activeYear.id,
        name: name.trim(),
        examWeightages: weightages,
        layout: {
          template,
          showCoCurricular,
          remarksMode,
        },
      });

      if (res.success) {
        setFeedback({
          text: `✓ Report Card Setup "${name}" created successfully!`,
          type: "success",
        });
        setName("");
        router.refresh();
      } else {
        setFeedback({ text: "Failed to create setup.", type: "error" });
      }
    });
  };

  const getExamName = (id: string) => {
    return exams.find((e) => e.id === id)?.name || "Unknown Exam";
  };

  return (
    <div className="space-y-8">
      {/* ─── 1. Create New Setup Form ─────────────────────────────────────────── */}
      <form
        onSubmit={handleSave}
        className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm p-6 md:p-8 shadow-xl space-y-6"
      >
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <span className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <SlidersHorizontal className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Create Report Card Framework
            </h2>
            <p className="text-xs text-slate-400">
              Combine single or multiple term assessments with weighted contributions ({activeYear.label})
            </p>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Framework Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Setup Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. CBSE Cumulative Annual Assessment 2026-27"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Template Style */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Report Card Template Style
            </label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="CBSE_STANDARD">CBSE Standard Term Marksheet</option>
              <option value="CCE_HOLISTIC">CCE Holistic Progress Card (NEP 2020)</option>
              <option value="ICSE_BOARD">ICSE Assessment Format</option>
              <option value="CUSTOM">Custom State / Autonomous Grade Format</option>
            </select>
          </div>
        </div>

        {/* Exam Weightage Contribution Builder */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Examination Cycles &amp; Weightages
              </h3>
              <p className="text-[11px] text-slate-500">
                Configure contributing exams. Sum of percentages must equal 100%.
              </p>
            </div>
            <button
              type="button"
              onClick={addExamRow}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Exam Cycle</span>
            </button>
          </div>

          <div className="space-y-2">
            {weightages.map((row, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800"
              >
                <div className="flex-1">
                  <select
                    value={row.examId}
                    onChange={(e) => updateExamRow(idx, "examId", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-32 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={row.weightPercent}
                    onChange={(e) => updateExamRow(idx, "weightPercent", e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white text-center font-bold focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-xs text-slate-400 font-bold">%</span>
                </div>

                <button
                  type="button"
                  onClick={() => removeExamRow(idx)}
                  disabled={weightages.length <= 1}
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
            <span className="text-slate-400">Total Combined Weightage:</span>
            <span
              className={`font-black text-sm ${
                Math.abs(totalWeightage - 100) < 0.01
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {totalWeightage}% / 100%
            </span>
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={showCoCurricular}
              onChange={(e) => setShowCoCurricular(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-900 border-slate-700"
            />
            <div>
              <p className="text-xs font-semibold text-white">Include Co-Curricular Domains</p>
              <p className="text-[11px] text-slate-500">
                Display Work Ed, Art Education, Discipline &amp; Health grades
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={remarksMode === "AUTO_FORMULA"}
              onChange={(e) =>
                setRemarksMode(e.target.checked ? "AUTO_FORMULA" : "MANUAL")
              }
              className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-900 border-slate-700"
            />
            <div>
              <p className="text-xs font-semibold text-white">Automate Performance Remarks</p>
              <p className="text-[11px] text-slate-500">
                Generate descriptive narrative based on aggregate percentage
              </p>
            </div>
          </label>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending || Math.abs(totalWeightage - 100) > 0.01}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isPending ? "Creating Setup..." : "Save Setup Framework"}</span>
          </button>
        </div>
      </form>

      {/* ─── 2. Existing Setups List ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">
            Configured Report Card Frameworks
          </h3>
          <p className="text-xs text-slate-400">
            Active setups available for snapshot generation and official publication
          </p>
        </div>

        {existingSetups.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-500 text-xs">
            No report card setups created yet. Use the form above to build your first template framework.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {existingSetups.map((setup) => (
              <div
                key={setup.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-3 shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-white text-sm">
                      {setup.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Created on {new Date(setup.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase">
                    Active
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs">
                  <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                    Assessment Cycle Breakdown
                  </span>
                  <div className="space-y-1">
                    {setup.examWeightages.map((w, wIdx) => (
                      <div
                        key={wIdx}
                        className="flex items-center justify-between text-slate-300 text-xs"
                      >
                        <span>{getExamName(w.examId)}</span>
                        <span className="font-bold text-indigo-400">
                          {w.weightPercent}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>
                    Template: <strong className="text-slate-300">{setup.layout?.template || "CBSE Standard"}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push(`/exams/report-cards?setupId=${setup.id}`)}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                  >
                    View Snapshots &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
