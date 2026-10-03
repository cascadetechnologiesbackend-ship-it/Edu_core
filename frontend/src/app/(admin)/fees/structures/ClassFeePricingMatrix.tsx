"use client";

import React, { useState, useTransition, useMemo } from "react";
import {
  ArrowDownCircle,
  Copy,
  Save,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  Sparkles,
  X,
  TrendingUp,
} from "lucide-react";
import {
  savePricingMatrix,
  cloneCohortFeeStructures,
  MatrixEntryPayload,
} from "./actions";

interface ClassItem {
  id: string;
  displayName: string;
  gradeLevel: string;
  sortOrder: number;
}

interface FeeHeadItem {
  id: string;
  name: string;
  code: string | null;
  priority: number;
  category: string;
  headType: string;
}

interface ExistingStructureItem {
  id: string;
  classId: string;
  feeHeadId: string;
  term: "ANNUAL" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ONE_TIME";
  amount: string;
  dueDate: string | Date;
}

interface AcademicYearItem {
  id: string;
  label: string;
  isActive: boolean;
}

interface ClassFeePricingMatrixProps {
  activeYear: AcademicYearItem;
  allAcademicYears: AcademicYearItem[];
  classes: ClassItem[];
  feeHeads: FeeHeadItem[];
  existingStructures: ExistingStructureItem[];
}

export function ClassFeePricingMatrix({
  activeYear,
  allAcademicYears,
  classes,
  feeHeads,
  existingStructures,
}: ClassFeePricingMatrixProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sort classes by sortOrder
  const sortedClasses = useMemo(
    () => [...classes].sort((a, b) => a.sortOrder - b.sortOrder),
    [classes]
  );

  // Sort fee heads by priority
  const sortedHeads = useMemo(
    () => [...feeHeads].sort((a, b) => a.priority - b.priority),
    [feeHeads]
  );

  // Matrix state: values[classId][feeHeadId] = amount string
  const [matrixValues, setMatrixValues] = useState<Record<string, Record<string, string>>>(() => {
    const initial: Record<string, Record<string, string>> = {};
    for (const c of sortedClasses) {
      const row: Record<string, string> = {};
      for (const h of sortedHeads) {
        // Look up existing structure
        const match = existingStructures.find(
          (s) => s.classId === c.id && s.feeHeadId === h.id
        );
        row[h.id] = match ? String(parseFloat(match.amount)) : "0";
      }
      initial[c.id] = row;
    }
    return initial;
  });

  // Column header configurations: frequency terms and due dates per fee head
  const [columnConfigs, setColumnConfigs] = useState<
    Record<string, { term: "ANNUAL" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ONE_TIME"; dueDate: string }>
  >(() => {
    const initial: Record<
      string,
      { term: "ANNUAL" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ONE_TIME"; dueDate: string }
    > = {};

    // Default due date: 10th of next month
    const defaultDate = new Date();
    defaultDate.setDate(10);
    const dateStr = defaultDate.toISOString().split("T")[0] || "";

    for (const h of sortedHeads) {
      // Find any existing term for this head
      const match = existingStructures.find((s) => s.feeHeadId === h.id);
      const initialTerm: "ANNUAL" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ONE_TIME" = match
        ? match.term
        : h.category === "ONE_TIME"
        ? "ONE_TIME"
        : "ANNUAL";

      const initialDueDate = match?.dueDate
        ? new Date(match.dueDate).toISOString().split("T")[0] || dateStr
        : dateStr;

      initial[h.id] = {
        term: initialTerm,
        dueDate: initialDueDate,
      };
    }
    return initial;
  });

  // Clone Modal State
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [targetYearId, setTargetYearId] = useState<string>("");
  const [percentageUplift, setPercentageUplift] = useState<number>(8);

  // Cell Value Change Handler
  const handleCellChange = (classId: string, headId: string, val: string) => {
    // Only allow numbers
    const cleanVal = val.replace(/[^0-9.]/g, "");
    setMatrixValues((prev) => {
      const row = prev[classId] || {};
      return {
        ...prev,
        [classId]: {
          ...row,
          [headId]: cleanVal,
        },
      };
    });
  };

  // Auto-Fill Downward Action: Propagates row 0's value to all classes below
  const handleAutoFillDownward = (headId: string) => {
    if (sortedClasses.length === 0 || !sortedClasses[0]) return;
    const topClassId = sortedClasses[0].id;
    const topValue = matrixValues[topClassId]?.[headId] || "0";

    setMatrixValues((prev) => {
      const updated = { ...prev };
      for (const c of sortedClasses) {
        const row = updated[c.id] || {};
        updated[c.id] = {
          ...row,
          [headId]: topValue,
        };
      }
      return updated;
    });

    setFeedback({
      type: "success",
      message: `Auto-filled ₹ ${topValue} downward for all ${sortedClasses.length} classes.`,
    });
  };

  // Batch Save Pricing Matrix
  const handleSaveMatrix = () => {
    startTransition(async () => {
      setFeedback(null);
      const entries: MatrixEntryPayload[] = [];

      for (const c of sortedClasses) {
        for (const h of sortedHeads) {
          const amount = matrixValues[c.id]?.[h.id] || "0";
          const fallbackDate = new Date().toISOString().split("T")[0] || "";
          const colConfig = columnConfigs[h.id] || {
            term: "ANNUAL" as const,
            dueDate: fallbackDate,
          };

          entries.push({
            classId: c.id,
            feeHeadId: h.id,
            term: colConfig.term,
            amount,
            dueDate: colConfig.dueDate || fallbackDate,
          });
        }
      }

      const res = await savePricingMatrix({
        academicYearId: activeYear.id,
        entries,
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: res.message || "Fee pricing matrix saved successfully!",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.message || "Failed to save fee pricing matrix.",
        });
      }
    });
  };

  // Clone to Other Cohort Action
  const handleCloneCohort = () => {
    if (!targetYearId) {
      alert("Please select a target academic year to clone to.");
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const res = await cloneCohortFeeStructures({
        sourceYearId: activeYear.id,
        targetYearId,
        percentageUplift: Number(percentageUplift) || 0,
      });

      if (res.success) {
        setIsCloneModalOpen(false);
        setFeedback({
          type: "success",
          message: res.message || "Cohort cloned successfully!",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.message || "Failed to clone cohort.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Card: Title, Badge, Description, and Clone Button */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Class-Wise Fee Pricing Matrix
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
              Active Cohort: {activeYear.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set annual fees per grade, auto-fill columns downward, and assign billing frequency schedules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const otherYears = allAcademicYears.filter((y) => y.id !== activeYear.id);
              const firstOther = otherYears[0];
              if (firstOther) {
                setTargetYearId(firstOther.id);
              }
              setIsCloneModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-950 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg shadow-sm border border-slate-700/60 transition-colors"
          >
            <Copy className="w-4 h-4" />
            Clone to Other Cohorts (% Uplift)
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between animate-fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            )}
            {feedback.message}
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {sortedClasses.length === 0 || sortedHeads.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Sparkles className="w-8 h-8 text-blue-500/60 mx-auto mb-2" />
            <p className="font-semibold text-gray-700 dark:text-gray-300">
              {sortedClasses.length === 0
                ? "No classes found in Academic Management for this cohort."
                : "No fee heads configured. Switch to Tab 1 to initialize fee heads."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              {/* Dark Styled Header matching Screenshot 1 */}
              <thead>
                <tr className="bg-slate-900 dark:bg-slate-950 text-white border-b border-slate-800">
                  {/* Class Column Header */}
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider min-w-[140px] border-r border-slate-800 sticky left-0 bg-slate-900 dark:bg-slate-950 z-10">
                    Class / Grade
                  </th>

                  {/* Fee Head Column Headers */}
                  {sortedHeads.map((head) => (
                    <th
                      key={head.id}
                      className="py-3 px-3 min-w-[170px] border-r border-slate-800 align-top"
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className="font-bold text-xs text-white truncate" title={head.name}>
                          {head.name}
                        </div>
                        {/* Auto-Fill Downward Button */}
                        <button
                          type="button"
                          onClick={() => handleAutoFillDownward(head.id)}
                          title="Auto-fill column downward using top row value"
                          className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
                        >
                          <ArrowDownCircle className="w-4 h-4 text-blue-400 hover:text-blue-300" />
                        </button>
                      </div>

                      <div className="text-[11px] font-mono text-slate-400 mb-2">
                        [{head.code || head.name.slice(0, 3).toUpperCase()}] · Pri #{head.priority}
                      </div>

                      {/* Frequency Dropdown & Due Date in Column Header */}
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
                        <select
                          value={columnConfigs[head.id]?.term || "ANNUAL"}
                          onChange={(e) => {
                            const newTerm = e.target.value as "ANNUAL" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ONE_TIME";
                            setColumnConfigs((prev) => {
                              const curr = prev[head.id] || { term: "ANNUAL", dueDate: "" };
                              return {
                                ...prev,
                                [head.id]: {
                                  term: newTerm,
                                  dueDate: curr.dueDate,
                                },
                              };
                            });
                          }}
                          className="w-full bg-slate-800 text-slate-200 text-[11px] rounded px-2 py-1 border border-slate-700 focus:outline-none focus:border-blue-500"
                        >
                          <option value="ANNUAL">Annual</option>
                          <option value="QUARTERLY">Quarterly</option>
                          <option value="MONTHLY">Monthly</option>
                          <option value="HALF_YEARLY">Half-Yearly</option>
                          <option value="ONE_TIME">One-Time</option>
                        </select>

                        <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <input
                            type="date"
                            value={columnConfigs[head.id]?.dueDate || ""}
                            onChange={(e) => {
                              const newDueDate = e.target.value;
                              setColumnConfigs((prev) => {
                                const curr = prev[head.id] || { term: "ANNUAL", dueDate: "" };
                                return {
                                  ...prev,
                                  [head.id]: {
                                    term: curr.term,
                                    dueDate: newDueDate,
                                  },
                                };
                              });
                            }}
                            className="w-full bg-transparent text-[11px] text-slate-200 focus:outline-none"
                            title="Schedule Due Date"
                          />
                        </div>
                      </div>
                    </th>
                  ))}

                  {/* Total Annual Fee Header */}
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-right min-w-[130px] bg-slate-900 dark:bg-slate-950">
                    Grade Total
                  </th>
                </tr>
              </thead>

              {/* Table Rows (Classes) */}
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {sortedClasses.map((cls, idx) => {
                  // Compute row total
                  const rowTotal = sortedHeads.reduce((acc, h) => {
                    const val = parseFloat(matrixValues[cls.id]?.[h.id] || "0");
                    return acc + (isNaN(val) ? 0 : val);
                  }, 0);

                  return (
                    <tr
                      key={cls.id}
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Class Label */}
                      <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-900 z-10">
                        <div className="flex items-center justify-between gap-2">
                          <span>{cls.displayName}</span>
                          <span className="text-xs font-normal text-gray-400">
                            #{idx + 1}
                          </span>
                        </div>
                      </td>

                      {/* Fee Head Amounts */}
                      {sortedHeads.map((head) => (
                        <td
                          key={head.id}
                          className="py-2.5 px-3 border-r border-gray-200 dark:border-slate-800"
                        >
                          <div className="relative flex items-center">
                            <span className="absolute left-2.5 text-xs text-gray-400 font-medium select-none">
                              ₹
                            </span>
                            <input
                              type="text"
                              value={matrixValues[cls.id]?.[head.id] ?? "0"}
                              onChange={(e) =>
                                handleCellChange(cls.id, head.id, e.target.value)
                              }
                              className="w-full pl-6 pr-2 py-1.5 text-xs font-mono font-medium rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-right"
                            />
                          </div>
                        </td>
                      ))}

                      {/* Row Total */}
                      <td className="py-3 px-4 font-mono font-bold text-xs text-right text-gray-900 dark:text-white">
                        ₹ {rowTotal.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Save Bar */}
        <div className="p-4 bg-gray-50 dark:bg-slate-800/60 border-t border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {sortedClasses.length} Classes · {sortedHeads.length} Fee Heads ·{" "}
            {sortedClasses.length * sortedHeads.length} Matrix Slots
          </div>

          <button
            type="button"
            onClick={handleSaveMatrix}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
            {isPending ? "Saving Matrix..." : "Save Pricing Matrix"}
          </button>
        </div>
      </div>

      {/* Clone to Other Cohorts Modal */}
      {isCloneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Copy className="w-5 h-5 text-blue-500" />
                Clone to Other Cohort
              </h3>
              <button
                type="button"
                onClick={() => setIsCloneModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Source Cohort (Current)
                </label>
                <input
                  type="text"
                  disabled
                  value={activeYear.label}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Target Academic Year *
                </label>
                <select
                  value={targetYearId}
                  onChange={(e) => setTargetYearId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select target academic year...</option>
                  {allAcademicYears
                    .filter((y) => y.id !== activeYear.id)
                    .map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.label}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>Annual Fee Hike / Percentage Uplift (%)</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">
                    +{percentageUplift}%
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={percentageUplift}
                    onChange={(e) => setPercentageUplift(parseInt(e.target.value) || 0)}
                    className="w-full accent-blue-600"
                  />
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={percentageUplift}
                    onChange={(e) => setPercentageUplift(parseInt(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-sm font-mono text-center rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  E.g. A ₹20,000 tuition fee will clone as ₹
                  {(20000 * (1 + percentageUplift / 100)).toFixed(0)} to the new cohort.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCloneModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCloneCohort}
                  disabled={isPending || !targetYearId}
                  className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isPending ? "Cloning..." : "Clone & Apply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
