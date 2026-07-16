"use client";

import { useState, useEffect, useTransition } from "react";
import { getLessonPlans, saveLessonPlan } from "./actions";
import { Plus, RefreshCw, Layers, CheckSquare } from "lucide-react";

type LessonPlan = {
  id: string;
  title: string;
  chapterName: string;
  ncertReference: string | null;
  objectives: string | null;
  plannedDate: Date | null;
  completedDate: Date | null;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
};

type ClassSubject = {
  id: string;
  subject: {
    name: string;
    code: string;
  };
};

export default function LessonPlansTab({
  mappings,
  role,
}: {
  mappings: ClassSubject[];
  role: string;
}) {
  const [selectedSubjectMapping, setSelectedSubjectMapping] = useState("");
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const [planData, setPlanData] = useState({
    title: "",
    chapterName: "",
    ncertReference: "",
    objectives: "",
    plannedDate: new Date().toISOString().split("T")[0] || "",
    status: "PLANNED" as any,
  });

  const isTeacher = role === "TEACHER";
  const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(role);

  useEffect(() => {
    if (mappings.length > 0) {
      setSelectedSubjectMapping(mappings[0]?.id || "");
    }
  }, [mappings]);

  const loadPlans = () => {
    if (!selectedSubjectMapping) return;
    setLoading(true);
    getLessonPlans(selectedSubjectMapping)
      .then((data) => {
        setPlans(data as any);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPlans();
  }, [selectedSubjectMapping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveLessonPlan({
        classSubjectId: selectedSubjectMapping,
        title: planData.title,
        chapterName: planData.chapterName,
        ncertReference: planData.ncertReference || null,
        objectives: planData.objectives || null,
        plannedDate: planData.plannedDate || null,
        status: planData.status,
      });
      setShowForm(false);
      loadPlans();
    });
  };

  const handleMarkCompleted = (plan: LessonPlan) => {
    startTransition(async () => {
      await saveLessonPlan({
        ...plan,
        plannedDate: plan.plannedDate ? plan.plannedDate.toISOString() : null,
        completedDate: new Date().toISOString(),
        status: "COMPLETED",
      } as any);
      loadPlans();
    });
  };

  const completionPercentage = plans.length
    ? Math.round((plans.filter((p) => p.status === "COMPLETED").length / plans.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Syllabus & Lesson Plans</h2>
          <p className="text-xs text-gray-500">Track chapter completion progress and teaching objectives.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Select Course Mapping:</label>
            <select
              value={selectedSubjectMapping}
              onChange={(e) => setSelectedSubjectMapping(e.target.value)}
              className="rounded border border-gray-300 dark:border-slate-600 bg-transparent px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {mappings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.subject.name} ({m.subject.code})
                </option>
              ))}
            </select>
          </div>
          {(isTeacher || isAdmin) && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 bg-primary hover:bg-primary/95 text-white px-3 py-1.5 rounded text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" /> Plan Lesson
            </button>
          )}
        </div>
      </div>

      {/* Completion progress bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-gray-200 dark:border-slate-800 p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="relative flex-shrink-0 w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center border-4 border-primary">
          <span className="text-xl font-bold text-primary">{completionPercentage}%</span>
        </div>
        <div className="flex-1 text-center md:text-left space-y-1">
          <h3 className="font-bold text-gray-900 dark:text-white">Syllabus Coverage</h3>
          <p className="text-sm text-gray-500">
            {plans.filter((p) => p.status === "COMPLETED").length} of {plans.length} chapters completed. Keep up the great pace!
          </p>
        </div>
      </div>

      {/* Plans List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-gray-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20 text-gray-500 space-y-2">
            <Layers className="w-10 h-10 mx-auto text-gray-300" />
            <p className="font-medium text-sm">No chapters planned for this course mapping.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3.5">Chapter</th>
                <th className="px-6 py-3.5">Objectives</th>
                <th className="px-6 py-3.5">NCERT Reference</th>
                <th className="px-6 py-3.5">Planned Date</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900 dark:text-white">{p.chapterName}</p>
                    <p className="text-xs text-gray-500">{p.title}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{p.objectives || "—"}</td>
                  <td className="px-6 py-4 text-gray-500">{p.ncertReference || "—"}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {p.plannedDate ? new Date(p.plannedDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${p.status === "COMPLETED" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : p.status === "IN_PROGRESS" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-400"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {p.status !== "COMPLETED" && (isTeacher || isAdmin) && (
                      <button
                        onClick={() => handleMarkCompleted(p)}
                        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-semibold"
                      >
                        <CheckSquare className="w-3.5 h-3.5" /> Mark Completed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Plan Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Plan Chapter Lesson</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Chapter Name (e.g. Chapter 1: Introduction)</label>
              <input
                type="text"
                required
                value={planData.chapterName}
                onChange={(e) => setPlanData({ ...planData, chapterName: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Lesson Title</label>
              <input
                type="text"
                required
                value={planData.title}
                onChange={(e) => setPlanData({ ...planData, title: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">NCERT Book Chapter Reference</label>
              <input
                type="text"
                value={planData.ncertReference}
                onChange={(e) => setPlanData({ ...planData, ncertReference: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Objectives</label>
              <textarea
                value={planData.objectives}
                onChange={(e) => setPlanData({ ...planData, objectives: e.target.value })}
                rows={2}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Planned Date</label>
                <input
                  type="date"
                  required
                  value={planData.plannedDate}
                  onChange={(e) => setPlanData({ ...planData, plannedDate: e.target.value })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
                <select
                  value={planData.status}
                  onChange={(e) => setPlanData({ ...planData, status: e.target.value as any })}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="PLANNED">PLANNED</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
              >
                {isPending && <RefreshCw className="w-4 h-4 animate-spin" />} Save Plan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
