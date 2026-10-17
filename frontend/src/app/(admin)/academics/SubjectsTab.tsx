"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSubject } from "./actions";
import { Plus, RefreshCw, BookOpen } from "lucide-react";
import { AppModal } from "@/components/ui/AppModal";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";

type Subject = {
  id: string;
  code: string;
  name: string;
  nameHindi: string | null;
  subjectType:
    "THEORY" | "PRACTICAL" | "CO_SCHOLASTIC" | "LANGUAGE" | "ACTIVITY";
  maxMarks: number;
  passingMarks: number;
};

export default function SubjectsTab({
  subjects,
  isAdmin,
}: {
  subjects: Subject[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [subjectData, setSubjectData] = useState({
    code: "",
    name: "",
    nameHindi: "",
    subjectType: "THEORY",
    maxMarks: 100,
    passingMarks: 33,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await saveSubject({
          code: subjectData.code.trim().toUpperCase(),
          name: subjectData.name.trim(),
          nameHindi: subjectData.nameHindi.trim() || null,
          type: subjectData.subjectType as any,
          maxMarks: subjectData.maxMarks,
          passingMarks: subjectData.passingMarks,
        });
        setShowForm(false);
        router.refresh();
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to save subject.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            Subjects Catalog
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Maintain school-wide course definitions, syllabus codes, and grading thresholds.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setErrorMsg(null);
              setSubjectData({
                code: "",
                name: "",
                nameHindi: "",
                subjectType: "THEORY",
                maxMarks: 100,
                passingMarks: 33,
              });
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm min-h-[40px]"
          >
            <Plus className="w-4 h-4" /> Add Subject
          </button>
        )}
      </div>

      {/* Subject Form AppModal */}
      <AppModal
        open={showForm}
        onClose={() => setShowForm(false)}
        size="md"
        title="Create New Subject"
        description="Add a subject definition to the school's master academic catalog."
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending || !subjectData.code || !subjectData.name}
              onClick={handleSubmit}
              className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-60 flex items-center gap-1.5 min-h-[40px] shadow-sm"
            >
              {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Subject</span>
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-xl">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Subject Code (e.g. MATH101)
            </label>
            <input
              type="text"
              required
              value={subjectData.code}
              onChange={(e) =>
                setSubjectData({ ...subjectData, code: e.target.value })
              }
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Subject Name
            </label>
            <input
              type="text"
              required
              value={subjectData.name}
              onChange={(e) =>
                setSubjectData({ ...subjectData, name: e.target.value })
              }
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Name in Hindi (Optional)
            </label>
            <input
              type="text"
              value={subjectData.nameHindi}
              onChange={(e) =>
                setSubjectData({ ...subjectData, nameHindi: e.target.value })
              }
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Subject Type
            </label>
            <select
              value={subjectData.subjectType}
              onChange={(e) =>
                setSubjectData({
                  ...subjectData,
                  subjectType: e.target.value,
                })
              }
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {[
                "THEORY",
                "PRACTICAL",
                "CO_SCHOLASTIC",
                "LANGUAGE",
                "ACTIVITY",
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Max Marks
              </label>
              <input
                type="number"
                required
                value={subjectData.maxMarks}
                onChange={(e) =>
                  setSubjectData({
                    ...subjectData,
                    maxMarks: parseInt(e.target.value) || 100,
                  })
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Passing Marks
              </label>
              <input
                type="number"
                required
                value={subjectData.passingMarks}
                onChange={(e) =>
                  setSubjectData({
                    ...subjectData,
                    passingMarks: parseInt(e.target.value) || 33,
                  })
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </form>
      </AppModal>

      {/* Subjects list */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xs border border-gray-200 dark:border-slate-800 overflow-hidden">
        {subjects.length === 0 ? (
          <EmptyStateCTA
            icon={BookOpen}
            title="No subjects cataloged"
            hint="Define your curriculum subjects with codes, types, and passing marks."
            ctaLabel={isAdmin ? "Add First Subject" : undefined}
            onCta={
              isAdmin
                ? () => {
                    setErrorMsg(null);
                    setShowForm(true);
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-400 text-[11px] font-bold uppercase tracking-wider border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Code</th>
                  <th className="px-6 py-3.5">Name</th>
                  <th className="px-6 py-3.5">Name in Hindi</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5 text-right tabular-nums">Max Marks</th>
                  <th className="px-6 py-3.5 text-right tabular-nums">Passing Marks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {subjects.map((sub) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-gray-900 dark:text-white">
                      {sub.code}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-800 dark:text-gray-200">
                      {sub.name}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {sub.nameHindi || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
                        {sub.subjectType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums font-semibold text-gray-700 dark:text-gray-300">
                      {sub.maxMarks}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums font-semibold text-gray-700 dark:text-gray-300">
                      {sub.passingMarks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
