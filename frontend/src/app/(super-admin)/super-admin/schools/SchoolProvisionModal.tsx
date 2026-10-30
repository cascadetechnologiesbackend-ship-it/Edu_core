"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Layers,
  GraduationCap,
  BookOpen,
  Wallet,
  Building,
  Calendar,
  Users,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  dryRunProvisionSchoolAction,
  provisionSchoolAction,
  type DryRunPreviewResult,
} from "./actions";
import {
  getAllCanonicalBlueprints,
  type CanonicalBlueprint,
} from "@/lib/canonicalBlueprints";
import { SchoolItem } from "./SchoolManagementClient";

interface SchoolProvisionModalProps {
  school: SchoolItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SchoolProvisionModal({
  school,
  isOpen,
  onClose,
  onSuccess,
}: SchoolProvisionModalProps) {
  const blueprints: CanonicalBlueprint[] = getAllCanonicalBlueprints();

  // Pick default blueprint matching board if possible
  const matchingBlueprint =
    blueprints.find((b: CanonicalBlueprint) => b.board === school.board) || blueprints[0];

  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>(
    matchingBlueprint?.id || "cbse-secondary-v1"
  );
  const [dryRunResult, setDryRunResult] = useState<DryRunPreviewResult | null>(null);
  const [notes, setNotes] = useState("");
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionSuccess, setProvisionSuccess] = useState(false);
  const [resultCounts, setResultCounts] = useState<Record<string, number> | null>(null);

  if (!isOpen) return null;

  const handleDryRun = async () => {
    setIsDryRunning(true);
    try {
      const res = await dryRunProvisionSchoolAction(school.id, selectedBlueprintId);
      if (res.canProvision) {
        setDryRunResult(res);
        toast.info("Dry run analysis complete. Review prospective entity additions.");
      } else {
        toast.error(res.error || "Dry run analysis failed.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Dry run preview error.");
    } finally {
      setIsDryRunning(false);
    }
  };

  const handleExecute = async () => {
    setIsProvisioning(true);
    try {
      const res = await provisionSchoolAction(
        school.id,
        selectedBlueprintId,
        notes || undefined
      );

      if (res.success) {
        setProvisionSuccess(true);
        setResultCounts(res.entityCounts ?? null);
        toast.success(res.message);
        onSuccess?.();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Provisioning transaction failed.");
    } finally {
      setIsProvisioning(false);
    }
  };

  const selectedBlueprint = blueprints.find((b: CanonicalBlueprint) => b.id === selectedBlueprintId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Provision School Digital Twin
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {school.name}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Idempotently configure classes, curriculum, fee heads, HR defaults, and calendar.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {provisionSuccess ? (
            /* Success State */
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-100">
                  School Provisioned Successfully!
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {school.name} is now primed with the digital twin configuration from{" "}
                  <strong className="text-slate-200">{selectedBlueprint?.displayName}</strong>.
                </p>
              </div>

              {resultCounts && (
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-left max-w-lg mx-auto">
                  <div>
                    <span className="text-[10px] text-slate-500">Classes Created</span>
                    <p className="font-bold text-slate-200">{resultCounts.classes}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Sections Created</span>
                    <p className="font-bold text-slate-200">{resultCounts.sections}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Subjects Created</span>
                    <p className="font-bold text-slate-200">{resultCounts.subjects}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Fee Heads Created</span>
                    <p className="font-bold text-slate-200">{resultCounts.feeHeads}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Departments Created</span>
                    <p className="font-bold text-slate-200">{resultCounts.departments}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Holidays Scheduled</span>
                    <p className="font-bold text-slate-200">{resultCounts.holidays}</p>
                  </div>
                  {resultCounts.bellSchedulePeriods !== undefined && (
                    <div>
                      <span className="text-[10px] text-slate-500">Bell Periods</span>
                      <p className="font-bold text-slate-200">{resultCounts.bellSchedulePeriods}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Wizard Steps */
            <>
              {/* Step 1: Blueprint Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-200">
                  Select Canonical Blueprint Pack
                </label>
                <select
                  value={selectedBlueprintId}
                  onChange={(e) => {
                    setSelectedBlueprintId(e.target.value);
                    setDryRunResult(null); // Reset preview
                  }}
                  className="w-full min-h-[42px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
                >
                  {blueprints.map((b: CanonicalBlueprint) => (
                    <option key={b.id} value={b.id}>
                      {b.displayName} ({b.board} • {b.classes.length} Classes • {b.subjects.length} Subjects)
                    </option>
                  ))}
                </select>
                {selectedBlueprint && (
                  <p className="text-[11px] text-slate-400">
                    {selectedBlueprint.description}
                  </p>
                )}
              </div>

              {/* Invariant Safety Banner */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5 text-emerald-300">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <div className="space-y-0.5 text-[11px]">
                  <strong className="font-semibold text-emerald-200">
                    Production Data Integrity Protected
                  </strong>
                  <p className="text-emerald-400/90 leading-relaxed">
                    Existing classes, fee payments, student records, and customisations are strictly preserved using additive idempotent upserts (<code className="font-mono">ON CONFLICT DO NOTHING</code>).
                  </p>
                </div>
              </div>

              {/* Step 2: Dry Run Preview Section */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Prospective Impact Analysis</span>
                  <button
                    type="button"
                    onClick={handleDryRun}
                    disabled={isDryRunning}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-medium transition text-xs disabled:opacity-50"
                  >
                    {isDryRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Layers className="w-3.5 h-3.5" />
                    )}
                    <span>{dryRunResult ? "Re-run Dry Run" : "Dry-Run Preview"}</span>
                  </button>
                </div>

                {dryRunResult ? (
                  <div className="space-y-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                        <span className="text-[10px] text-slate-500">Classes to Add</span>
                        <p className="text-xs font-bold text-slate-200">
                          +{dryRunResult.prospectiveCounts?.classes ?? 0}
                        </p>
                      </div>
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                        <span className="text-[10px] text-slate-500">Subjects to Add</span>
                        <p className="text-xs font-bold text-slate-200">
                          +{dryRunResult.prospectiveCounts?.subjects ?? 0}
                        </p>
                      </div>
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                        <span className="text-[10px] text-slate-500">Fee Heads to Add</span>
                        <p className="text-xs font-bold text-slate-200">
                          +{dryRunResult.prospectiveCounts?.feeHeads ?? 0}
                        </p>
                      </div>
                      <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                        <span className="text-[10px] text-slate-500">Bell Periods</span>
                        <p className="text-xs font-bold text-slate-200">
                          +{dryRunResult.prospectiveCounts?.bellSchedulePeriods ?? 0}
                        </p>
                      </div>
                    </div>

                    {dryRunResult.preview && (
                      <div className="text-[11px] text-slate-400 space-y-1">
                        <div>
                          <strong className="text-slate-300">Sample Classes:</strong>{" "}
                          {dryRunResult.preview.classes.slice(0, 5).join(", ")}...
                        </div>
                        <div>
                          <strong className="text-slate-300">Sample Subjects:</strong>{" "}
                          {dryRunResult.preview.subjects.slice(0, 5).join(", ")}...
                        </div>
                        <div>
                          <strong className="text-slate-300">Fee Heads:</strong>{" "}
                          {dryRunResult.preview.feeHeads.join(", ")}
                        </div>
                        {dryRunResult.preview.bellSchedule && (
                          <div>
                            <strong className="text-slate-300">Bell Schedule:</strong>{" "}
                            {dryRunResult.preview.bellSchedule.slice(0, 4).join(", ")}...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Click "Dry-Run Preview" to inspect prospective entity additions before committing changes.
                  </p>
                )}
              </div>

              {/* Step 3: Notes / Operator Reason */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300">
                  Provisioning Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Standard onboarding for Academic Year 2026-27"
                  className="w-full min-h-[40px] px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProvisioning}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={isProvisioning || isDryRunning}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProvisioning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Execute Provisioning</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
