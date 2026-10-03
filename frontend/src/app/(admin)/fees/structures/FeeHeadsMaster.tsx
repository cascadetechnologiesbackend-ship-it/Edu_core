"use client";

import React, { useState, useTransition } from "react";
import {
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  X,
} from "lucide-react";
import {
  seedStarterPackFeeHeads,
  saveFeeHead,
  deleteFeeHead,
  SaveFeeHeadPayload,
} from "./actions";

interface FeeHead {
  id: string;
  name: string;
  code: string | null;
  priority: number;
  description: string | null;
  category: string;
  headType: string;
  discountEligible: boolean;
  lateFineEligible: boolean;
  isRefundable: boolean;
  isTaxable: boolean;
  gstPercentage: string | null;
  isActive: boolean;
}

interface FeeHeadsMasterProps {
  feeHeads: FeeHead[];
}

export function FeeHeadsMaster({ feeHeads }: FeeHeadsMasterProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHead, setEditingHead] = useState<FeeHead | null>(null);

  // Form State
  const [formData, setFormData] = useState<SaveFeeHeadPayload>({
    name: "",
    code: "",
    priority: 1,
    description: "",
    category: "RECURRING",
    headType: "TUITION",
    discountEligible: true,
    lateFineEligible: true,
    isRefundable: false,
    isTaxable: false,
    gstPercentage: "0",
  });

  const handleOpenAdd = () => {
    setEditingHead(null);
    setFormData({
      name: "",
      code: "",
      priority: (feeHeads.length ? Math.max(...feeHeads.map((h) => h.priority)) + 1 : 1),
      description: "",
      category: "RECURRING",
      headType: "TUITION",
      discountEligible: true,
      lateFineEligible: true,
      isRefundable: false,
      isTaxable: false,
      gstPercentage: "0",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (head: FeeHead) => {
    setEditingHead(head);
    setFormData({
      id: head.id,
      name: head.name,
      code: head.code || head.name.slice(0, 3).toUpperCase(),
      priority: head.priority,
      description: head.description || "",
      category: (head.category as any) || "RECURRING",
      headType: head.headType,
      discountEligible: head.discountEligible,
      lateFineEligible: head.lateFineEligible,
      isRefundable: head.isRefundable,
      isTaxable: head.isTaxable,
      gstPercentage: head.gstPercentage || "0",
    });
    setIsModalOpen(true);
  };

  const handleResetStarterPack = () => {
    if (!confirm("This will load or reset the standard 8 starter-pack fee heads (Tuition, Admission, Annual Dev, Labs, Library, Transport, Caution Deposit, Arrears). Continue?")) {
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const res = await seedStarterPackFeeHeads();
      if (res.success) {
        setFeedback({ type: "success", message: res.message || "Starter Pack loaded!" });
      } else {
        setFeedback({ type: "error", message: res.message || "Failed to load starter pack." });
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate fee head "${name}"?`)) return;

    startTransition(async () => {
      setFeedback(null);
      const res = await deleteFeeHead(id);
      if (res.success) {
        setFeedback({ type: "success", message: `Fee head "${name}" deactivated.` });
      } else {
        setFeedback({ type: "error", message: res.message || "Failed to delete fee head." });
      }
    });
  };

  const handleSubmitModal = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setFeedback(null);
      const res = await saveFeeHead(formData);
      if (res.success) {
        setIsModalOpen(false);
        setFeedback({
          type: "success",
          message: editingHead ? "Fee head updated successfully." : "Fee head created successfully.",
        });
      } else {
        setFeedback({ type: "error", message: res.message || "Failed to save fee head." });
      }
    });
  };

  // Sort heads by priority ascending
  const sortedHeads = [...feeHeads].sort((a, b) => a.priority - b.priority);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header section */}
      <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Fee Heads Master & Allocation Priorities
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Priority rank (1 to 99) strictly governs partial collection settlement order.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetStarterPack}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/80 transition-colors shadow-sm disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
            Reset to Starter Pack
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            + Add Fee Head
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 border-b flex items-center justify-between ${
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-slate-800">
            <tr>
              <th className="py-3.5 px-4 w-20 text-center">Priority</th>
              <th className="py-3.5 px-4 min-w-[260px]">Head Particulars</th>
              <th className="py-3.5 px-4 w-24">Code</th>
              <th className="py-3.5 px-4 w-32">Nature / Category</th>
              <th className="py-3.5 px-4 w-32 text-center">Discount Eligible</th>
              <th className="py-3.5 px-4 w-32 text-center">Late Fine Eligible</th>
              <th className="py-3.5 px-4 w-32 text-center">Refundable</th>
              <th className="py-3.5 px-4 w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {sortedHeads.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Sparkles className="w-8 h-8 text-blue-500/60 mb-1" />
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      No fee heads configured yet.
                    </p>
                    <p className="text-xs text-gray-400">
                      Click &quot;Reset to Starter Pack&quot; to initialize with standard school fee categories.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedHeads.map((head) => (
                <tr
                  key={head.id}
                  className="hover:bg-gray-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Priority Circle Badge */}
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs shadow-sm">
                      {head.priority}
                    </span>
                  </td>

                  {/* Head Particulars */}
                  <td className="py-4 px-4">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {head.name}
                    </div>
                    {head.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                        {head.description}
                      </div>
                    )}
                  </td>

                  {/* Code */}
                  <td className="py-4 px-4">
                    <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700">
                      {head.code || head.name.slice(0, 3).toUpperCase()}
                    </span>
                  </td>

                  {/* Nature / Category */}
                  <td className="py-4 px-4">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {head.category === "ONE_TIME"
                        ? "One Time"
                        : head.category === "REFUNDABLE"
                        ? "Refundable"
                        : "Recurring"}
                    </span>
                  </td>

                  {/* Discount Eligible */}
                  <td className="py-4 px-4 text-center">
                    {head.discountEligible ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400">
                        No
                      </span>
                    )}
                  </td>

                  {/* Late Fine Eligible */}
                  <td className="py-4 px-4 text-center">
                    {head.lateFineEligible ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400">
                        No
                      </span>
                    )}
                  </td>

                  {/* Refundable */}
                  <td className="py-4 px-4 text-center">
                    {head.isRefundable ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-400">
                        Refundable
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400">
                        No
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(head)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                        title="Edit Fee Head"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(head.id, head.name)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                        title="Deactivate Fee Head"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xl w-full max-w-xl overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingHead ? "Edit Fee Head" : "Create New Fee Head"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Head Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        name: val,
                        code: formData.code || val.slice(0, 3).toUpperCase(),
                      });
                    }}
                    placeholder="e.g. Tuition Fee"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Code (3-letter) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="TUI"
                    className="w-full font-mono uppercase px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Priority Rank (1-99)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    required
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Nature / Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="RECURRING">Recurring</option>
                    <option value="ONE_TIME">One Time</option>
                    <option value="REFUNDABLE">Refundable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    System Head Type
                  </label>
                  <select
                    value={formData.headType}
                    onChange={(e) => setFormData({ ...formData, headType: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="TUITION">TUITION</option>
                    <option value="ADMISSION">ADMISSION</option>
                    <option value="TRANSPORT">TRANSPORT</option>
                    <option value="LAB">LAB</option>
                    <option value="LIBRARY">LIBRARY</option>
                    <option value="HOSTEL">HOSTEL</option>
                    <option value="ACTIVITY">ACTIVITY</option>
                    <option value="MISCELLANEOUS">MISCELLANEOUS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description / Particulars Subtitle
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Core curriculum tuition and pedagogical instruction"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.discountEligible}
                    onChange={(e) => setFormData({ ...formData, discountEligible: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Discount Eligible
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.lateFineEligible}
                    onChange={(e) => setFormData({ ...formData, lateFineEligible: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Late Fine Eligible
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.isRefundable}
                    onChange={(e) => setFormData({ ...formData, isRefundable: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Is Refundable
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isPending ? "Saving..." : editingHead ? "Save Changes" : "Create Fee Head"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
