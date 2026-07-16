"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveClassSubject } from "./actions";
import { Plus, RefreshCw } from "lucide-react";

type ClassSubject = {
  id: string;
  classId: string;
  subjectId: string;
  assignedTeacherId: string | null;
  periodsPerWeek: number;
  isElective: boolean;
  class: {
    displayName: string;
  };
  subject: {
    name: string;
    code: string;
  };
};

type Classroom = {
  id: string;
  displayName: string;
};

type Subject = {
  id: string;
  name: string;
  code: string;
};

type Teacher = {
  id: string;
  email: string;
};

export default function SubjectMappingTab({
  mappings,
  classrooms,
  subjects,
  teachers,
  isAdmin,
}: {
  mappings: ClassSubject[];
  classrooms: Classroom[];
  subjects: Subject[];
  teachers: Teacher[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    classId: "",
    subjectId: "",
    assignedTeacherId: "",
    periodsPerWeek: 5,
    isElective: false,
  });

  // Set default values when opening modal
  const handleOpenForm = () => {
    const firstClassId = classrooms[0]?.id;
    if (firstClassId) {
      setFormData((prev) => ({
        ...prev,
        classId: firstClassId,
      }));
    }
    const firstSubjectId = subjects[0]?.id;
    if (firstSubjectId) {
      setFormData((prev) => ({
        ...prev,
        subjectId: firstSubjectId,
      }));
    }
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveClassSubject({
        classId: formData.classId,
        subjectId: formData.subjectId,
        assignedTeacherId: formData.assignedTeacherId || null,
        periodsPerWeek: formData.periodsPerWeek,
        isElective: formData.isElective,
      });
      setShowForm(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Subject-Teacher Mapping</h2>
        {isAdmin && (
          <button
            onClick={handleOpenForm}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" /> Map Subject
          </button>
        )}
      </div>

      {/* Mapping Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Map Subject to Classroom</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Classroom</label>
              <select
                value={formData.classId}
                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Subject</label>
              <select
                value={formData.subjectId}
                onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Assigned Teacher</label>
              <select
                value={formData.assignedTeacherId}
                onChange={(e) => setFormData({ ...formData, assignedTeacherId: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Unassigned</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Periods Per Week</label>
              <input
                type="number"
                required
                value={formData.periodsPerWeek}
                onChange={(e) => setFormData({ ...formData, periodsPerWeek: parseInt(e.target.value) })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isElective"
                checked={formData.isElective}
                onChange={(e) => setFormData({ ...formData, isElective: e.target.checked })}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
              />
              <label htmlFor="isElective" className="text-sm font-semibold text-gray-700 dark:text-gray-300">Is Elective Subject?</label>
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
                {isPending && <RefreshCw className="w-4 h-4 animate-spin" />} Map Course
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mappings Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-gray-200 dark:border-slate-800 overflow-hidden">
        {mappings.length === 0 ? (
          <p className="text-center py-12 text-gray-500 italic text-sm">No mappings assigned yet.</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3.5">Classroom</th>
                <th className="px-6 py-3.5">Subject</th>
                <th className="px-6 py-3.5">Assigned Teacher</th>
                <th className="px-6 py-3.5 text-center">Periods / Week</th>
                <th className="px-6 py-3.5 text-center">Elective</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {mappings.map((m) => {
                const teacherEmail = teachers.find(t => t.id === m.assignedTeacherId)?.email || "Unassigned";
                return (
                  <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{m.class.displayName}</td>
                    <td className="px-6 py-4 font-medium text-gray-700 dark:text-gray-200">{m.subject.code} - {m.subject.name}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{teacherEmail}</td>
                    <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300">{m.periodsPerWeek}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${m.isElective ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                        {m.isElective ? "Elective" : "Core"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
