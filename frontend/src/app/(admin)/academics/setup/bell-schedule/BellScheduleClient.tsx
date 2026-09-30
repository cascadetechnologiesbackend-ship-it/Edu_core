"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  X,
  Loader2,
  Layers,
  AlertCircle,
} from "lucide-react";
import { saveBellSchedulePeriod, deleteBellSchedulePeriod } from "../../actions/timetable.actions";

type BellPeriod = {
  id: string;
  periodNumber: number;
  name: string;
  startTime: string;
  endTime: string;
  periodType:
    | "REGULAR"
    | "ASSEMBLY"
    | "BREAK"
    | "LUNCH"
    | "LAB"
    | "PT"
    | "LIBRARY"
    | "FREE";
  isActive: boolean;
};

const DEFAULT_PERIOD_META = {
  label: "Regular Class",
  badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
};

const PERIOD_TYPE_LABELS: Record<string, { label: string; badge: string }> = {
  REGULAR: DEFAULT_PERIOD_META,
  ASSEMBLY: {
    label: "Morning Assembly",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  BREAK: {
    label: "Short Break",
    badge: "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 border-gray-200 dark:border-slate-700",
  },
  LUNCH: {
    label: "Lunch Break",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  LAB: {
    label: "Practical Lab",
    badge: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  },
  PT: {
    label: "Physical Training",
    badge: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  },
  LIBRARY: {
    label: "Library Period",
    badge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  },
  FREE: {
    label: "Free / Study Period",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  },
};

export default function BellScheduleClient({
  initialPeriods,
  isAdmin,
}: {
  initialPeriods: BellPeriod[];
  isAdmin: boolean;
}) {
  const [periods, setPeriods] = useState<BellPeriod[]>(initialPeriods);
  const [isPending, startTransition] = useTransition();

  const [showModal, setShowModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<BellPeriod | null>(null);
  const [formData, setFormData] = useState({
    periodNumber: 1,
    name: "Period 1",
    startTime: "08:30",
    endTime: "09:15",
    periodType: "REGULAR" as BellPeriod["periodType"],
  });

  const handleOpenAdd = () => {
    setEditingPeriod(null);
    const nextNum = periods.length + 1;
    setFormData({
      periodNumber: nextNum,
      name: `Period ${nextNum}`,
      startTime: "08:30",
      endTime: "09:15",
      periodType: "REGULAR",
    });
    setShowModal(true);
  };

  const handleOpenEdit = (p: BellPeriod) => {
    setEditingPeriod(p);
    setFormData({
      periodNumber: p.periodNumber,
      name: p.name,
      startTime: p.startTime,
      endTime: p.endTime,
      periodType: p.periodType,
    });
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await saveBellSchedulePeriod({
          ...(editingPeriod ? { id: editingPeriod.id } : {}),
          periodNumber: formData.periodNumber,
          name: formData.name,
          startTime: formData.startTime,
          endTime: formData.endTime,
          periodType: formData.periodType,
        });

        if (editingPeriod) {
          setPeriods((prev) =>
            prev.map((p) =>
              p.id === editingPeriod.id ? { ...p, ...formData } : p,
            ),
          );
        } else {
          setPeriods((prev) => [
            ...prev,
            {
              id: `p-${Date.now()}`,
              ...formData,
              isActive: true,
            },
          ]);
        }
        setShowModal(false);
      } catch (err: any) {
        alert(err?.message || "Failed to save period");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to deactivate this period?")) return;
    startTransition(async () => {
      await deleteBellSchedulePeriod(id);
      setPeriods((prev) => prev.filter((p) => p.id !== id));
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb & Top Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link
              href="/academics"
              className="hover:text-primary transition flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Academics Hub
            </Link>
            <span>/</span>
            <span>Setup</span>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">
              Bell Schedule
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Configurable Bell Schedule
          </h1>
          <p className="text-xs text-gray-500">
            Define daily periods, assembly, lunch, and breaks. Used dynamically
            across all class timetables.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/95 text-white transition shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Period
          </button>
        )}
      </div>

      {/* ─── Periods Table Card ───────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 dark:bg-slate-800/40 text-[11px] uppercase tracking-wider font-bold text-gray-400 border-b border-gray-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 w-16">#</th>
                <th className="py-3 px-4">Period Name</th>
                <th className="py-3 px-4">Time Slot</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
              {periods.map((p) => {
                const typeMeta =
                  PERIOD_TYPE_LABELS[p.periodType] ?? DEFAULT_PERIOD_META;
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                      {p.periodNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-800 dark:text-gray-200">
                      {p.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {p.startTime} – {p.endTime}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${typeMeta.badge}`}
                      >
                        {typeMeta.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-slate-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {periods.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-xs">
            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            No periods configured yet. Click "+ Add Period" to create the school's
            bell schedule.
          </div>
        )}
      </div>

      {/* ─── Period Form Modal ────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editingPeriod ? "Edit Period" : "Add Bell Schedule Period"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Period #
                </label>
                <input
                  type="number"
                  required
                  value={formData.periodNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      periodNumber: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Period 1, Assembly"
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Start Time (HH:MM)
                </label>
                <input
                  type="time"
                  required
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  End Time (HH:MM)
                </label>
                <input
                  type="time"
                  required
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Period Type
              </label>
              <select
                value={formData.periodType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    periodType: e.target.value as any,
                  })
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              >
                <option value="REGULAR">Regular Class</option>
                <option value="ASSEMBLY">Morning Assembly</option>
                <option value="BREAK">Short Break</option>
                <option value="LUNCH">Lunch Break</option>
                <option value="LAB">Practical Lab</option>
                <option value="PT">Physical Training</option>
                <option value="LIBRARY">Library Period</option>
                <option value="FREE">Free Period</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50 flex items-center gap-1"
              >
                {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                Save Period
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
