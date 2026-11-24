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
      <div className="w-full max-w-2xl bg-card border border-border/40 text-card-foreground rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border/30 flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-semantic-interactive/12 border border-semantic-interactive/25 flex items-center justify-center text-semantic-interactive">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                Provision School Digital Twin
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
                  {school.name}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Idempotently configure classes, curriculum, fee heads, HR defaults, and calendar.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-foreground/80">
          {provisionSuccess ? (
            /* Success State */
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-semantic-money-in/12 border border-semantic-money-in/25 flex items-center justify-center text-semantic-money-in mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-foreground">
                  School Provisioned Successfully!
                </h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  {school.name} is now primed with the digital twin configuration from{" "}
                  <strong className="text-foreground">{selectedBlueprint?.displayName}</strong>.
                </p>
              </div>

              {resultCounts && (
                <div className="p-4 bg-muted/40 border border-border/40 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-left max-w-lg mx-auto">
                  <div>
                    <span className="text-[10px] text-muted-foreground">Classes Created</span>
                    <p className="font-bold text-foreground font-mono tabular-nums">{resultCounts.classes}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Sections Created</span>
                    <p className="font-bold text-foreground font-mono tabular-nums">{resultCounts.sections}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Subjects Created</span>
                    <p className="font-bold text-foreground font-mono tabular-nums">{resultCounts.subjects}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Fee Heads Created</span>
                    <p className="font-bold text-foreground font-mono tabular-nums">{resultCounts.feeHeads}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Departments Created</span>
                    <p className="font-bold text-foreground font-mono tabular-nums">{resultCounts.departments}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Holidays Scheduled</span>
                    <p className="font-bold text-foreground font-mono tabular-nums">{resultCounts.holidays}</p>
                  </div>
                  {resultCounts.bellSchedulePeriods !== undefined && (
                    <div>
                      <span className="text-[10px] text-muted-foreground">Bell Periods</span>
                      <p className="font-bold text-foreground font-mono tabular-nums">{resultCounts.bellSchedulePeriods}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 text-white font-semibold text-xs transition shadow-xs"
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
                <label className="block text-xs font-semibold text-foreground">
                  Select Canonical Blueprint Pack
                </label>
                <select
                  value={selectedBlueprintId}
                  onChange={(e) => {
                    setSelectedBlueprintId(e.target.value);
                    setDryRunResult(null); // Reset preview
                  }}
                  className="w-full min-h-[42px] px-3 py-2 bg-muted/40 border border-border/40 rounded-xl text-foreground focus:outline-none focus:border-semantic-interactive text-xs"
                >
                  {blueprints.map((b: CanonicalBlueprint) => (
                    <option key={b.id} value={b.id}>
                      {b.displayName} ({b.board} • {b.classes.length} Classes • {b.subjects.length} Subjects)
                    </option>
                  ))}
                </select>
                {selectedBlueprint && (
                  <p className="text-[11px] text-muted-foreground">
                    {selectedBlueprint.description}
                  </p>
                )}
              </div>

              {/* Invariant Safety Banner */}
              <div className="p-3 bg-semantic-money-in/10 border border-semantic-money-in/20 rounded-xl flex items-start gap-2.5 text-semantic-money-in">
                <ShieldCheck className="w-4 h-4 shrink-0 text-semantic-money-in mt-0.5" />
                <div className="space-y-0.5 text-[11px]">
                  <strong className="font-semibold text-foreground">
                    Production Data Integrity Protected
                  </strong>
                  <p className="text-muted-foreground leading-relaxed">
                    Existing classes, fee payments, student records, and customisations are strictly preserved using additive idempotent upserts (<code className="font-mono">ON CONFLICT DO NOTHING</code>).
                  </p>
                </div>
              </div>

              {/* Step 2: Dry Run Preview Section */}
              <div className="space-y-3 pt-2 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Prospective Impact Analysis</span>
                  <button
                    type="button"
                    onClick={handleDryRun}
                    disabled={isDryRunning}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 bg-muted hover:bg-muted/80 text-foreground font-medium transition text-xs disabled:opacity-50"
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
                  <div className="space-y-3 bg-muted/40 border border-border/40 rounded-xl p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2 bg-card border border-border/40 rounded-lg">
                        <span className="text-[10px] text-muted-foreground">Classes to Add</span>
                        <p className="text-xs font-bold text-foreground font-mono tabular-nums">
                          +{dryRunResult.prospectiveCounts?.classes ?? 0}
                        </p>
                      </div>
                      <div className="p-2 bg-card border border-border/40 rounded-lg">
                        <span className="text-[10px] text-muted-foreground">Subjects to Add</span>
                        <p className="text-xs font-bold text-foreground font-mono tabular-nums">
                          +{dryRunResult.prospectiveCounts?.subjects ?? 0}
                        </p>
                      </div>
                      <div className="p-2 bg-card border border-border/40 rounded-lg">
                        <span className="text-[10px] text-muted-foreground">Fee Heads to Add</span>
                        <p className="text-xs font-bold text-foreground font-mono tabular-nums">
                          +{dryRunResult.prospectiveCounts?.feeHeads ?? 0}
                        </p>
                      </div>
                      <div className="p-2 bg-card border border-border/40 rounded-lg">
                        <span className="text-[10px] text-muted-foreground">Bell Periods</span>
                        <p className="text-xs font-bold text-foreground font-mono tabular-nums">
                          +{dryRunResult.prospectiveCounts?.bellSchedulePeriods ?? 0}
                        </p>
                      </div>
                    </div>

                    {dryRunResult.preview && (
                      <div className="text-[11px] text-muted-foreground space-y-1">
                        <div>
                          <strong className="text-foreground">Sample Classes:</strong>{" "}
                          {dryRunResult.preview.classes.slice(0, 5).join(", ")}...
                        </div>
                        <div>
                          <strong className="text-foreground">Sample Subjects:</strong>{" "}
                          {dryRunResult.preview.subjects.slice(0, 5).join(", ")}...
                        </div>
                        <div>
                          <strong className="text-foreground">Fee Heads:</strong>{" "}
                          {dryRunResult.preview.feeHeads.join(", ")}
                        </div>
                        {dryRunResult.preview.bellSchedule && (
                          <div>
                            <strong className="text-foreground">Bell Schedule:</strong>{" "}
                            {dryRunResult.preview.bellSchedule.slice(0, 4).join(", ")}...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    Click "Dry-Run Preview" to inspect prospective entity additions before committing changes.
                  </p>
                )}
              </div>

              {/* Step 3: Notes / Operator Reason */}
              <div className="space-y-1.5 pt-2 border-t border-border/30">
                <label className="block text-xs font-semibold text-foreground">
                  Provisioning Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Standard onboarding for Academic Year 2026-27"
                  className="w-full min-h-[40px] px-3 py-2 bg-muted/40 border border-border/40 rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive text-xs"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/30">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isProvisioning}
                  className="px-4 py-2 rounded-xl border border-border/40 bg-muted hover:bg-muted/80 text-foreground text-xs transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={isProvisioning || isDryRunning}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 text-white font-semibold text-xs transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
