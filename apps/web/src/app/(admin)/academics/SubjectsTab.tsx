"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSubject } from "./actions";
import { Plus, RefreshCw } from "lucide-react";

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
    startTransition(async () => {
      await saveSubject(subjectData as any);
      setShowForm(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          Subject Master Directory
        </h2>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" /> Add Subject
          </button>
        )}
      </div>

      {/* Subject Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-slate-800 space-y-4"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Create New Subject
            </h3>
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
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                      maxMarks: parseInt(e.target.value),
                    })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                      passingMarks: parseInt(e.target.value),
                    })
                  }
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
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
                {isPending && <RefreshCw className="w-4 h-4 animate-spin" />}{" "}
                Save Subject
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subjects list */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-gray-200 dark:border-slate-800 overflow-hidden">
        {subjects.length === 0 ? (
          <p className="text-center py-12 text-gray-500 italic text-sm">
            No subjects found in the directory.
          </p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3.5">Code</th>
                <th className="px-6 py-3.5">Name</th>
                <th className="px-6 py-3.5">Name in Hindi</th>
                <th className="px-6 py-3.5">Type</th>
                <th className="px-6 py-3.5 text-center">Max Marks</th>
                <th className="px-6 py-3.5 text-center">Passing Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {subjects.map((sub) => (
                <tr
                  key={sub.id}
                  className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition"
                >
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                    {sub.code}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-200">
                    {sub.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {sub.nameHindi || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">
                      {sub.subjectType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300">
                    {sub.maxMarks}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300">
                    {sub.passingMarks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
