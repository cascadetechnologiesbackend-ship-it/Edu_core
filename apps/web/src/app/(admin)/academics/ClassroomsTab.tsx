"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveClassroom, saveSection } from "./actions";
import { Plus, Edit2, Check, RefreshCw } from "lucide-react";

type Section = {
  id: string;
  name: string;
  capacity: number;
  classTeacherId: string | null;
  roomNumber: string | null;
};

type Classroom = {
  id: string;
  gradeLevel: string;
  displayName: string;
  sortOrder: number;
  sections: Section[];
};

type Teacher = {
  id: string;
  email: string;
};

export default function ClassroomsTab({
  classrooms,
  teachers,
  isAdmin,
}: {
  classrooms: Classroom[];
  teachers: Teacher[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showClassForm, setShowClassForm] = useState(false);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");

  const [classData, setClassData] = useState({ gradeLevel: "CLASS_1", displayName: "Class 1", sortOrder: 1 });
  const [sectionData, setSectionData] = useState({ name: "A", capacity: 30, classTeacherId: "", roomNumber: "" });

  const handleClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveClassroom(classData as any);
      setShowClassForm(false);
      router.refresh();
    });
  };

  const handleSectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveSection({
        classId: selectedClassId,
        name: sectionData.name,
        capacity: sectionData.capacity,
        classTeacherId: sectionData.classTeacherId || null,
        roomNumber: sectionData.roomNumber || null,
      });
      setShowSectionForm(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Classes & Sections Management</h2>
        {isAdmin && (
          <button
            onClick={() => setShowClassForm(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" /> Add Class
          </button>
        )}
      </div>

      {/* Class Form Modal */}
      {showClassForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleClassSubmit} className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create New Classroom</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Grade Level</label>
              <select
                value={classData.gradeLevel}
                onChange={(e) => setClassData({ ...classData, gradeLevel: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {["NURSERY", "LKG", "UKG", "CLASS_1", "CLASS_2", "CLASS_3", "CLASS_4", "CLASS_5", "CLASS_6", "CLASS_7", "CLASS_8", "CLASS_9", "CLASS_10"].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Display Name</label>
              <input
                type="text"
                required
                value={classData.displayName}
                onChange={(e) => setClassData({ ...classData, displayName: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Sort Order</label>
              <input
                type="number"
                required
                value={classData.sortOrder}
                onChange={(e) => setClassData({ ...classData, sortOrder: parseInt(e.target.value) })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClassForm(false)}
                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
              >
                {isPending && <RefreshCw className="w-4 h-4 animate-spin" />} Save Class
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Section Form Modal */}
      {showSectionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSectionSubmit} className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create New Section</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Section Name (e.g. A, B)</label>
              <input
                type="text"
                required
                value={sectionData.name}
                onChange={(e) => setSectionData({ ...sectionData, name: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Capacity</label>
              <input
                type="number"
                required
                value={sectionData.capacity}
                onChange={(e) => setSectionData({ ...sectionData, capacity: parseInt(e.target.value) })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Class Teacher</label>
              <select
                value={sectionData.classTeacherId}
                onChange={(e) => setSectionData({ ...sectionData, classTeacherId: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select Class Teacher</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Room Number</label>
              <input
                type="text"
                value={sectionData.roomNumber}
                onChange={(e) => setSectionData({ ...sectionData, roomNumber: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSectionForm(false)}
                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
              >
                {isPending && <RefreshCw className="w-4 h-4 animate-spin" />} Save Section
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Classroom List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {classrooms.map((cls) => (
          <div key={cls.id} className="bg-white dark:bg-slate-900 rounded-xl shadow border border-gray-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{cls.displayName}</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wider">{cls.gradeLevel}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setSelectedClassId(cls.id);
                    setShowSectionForm(true);
                  }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Section
                </button>
              )}
            </div>

            {/* Sections list */}
            {cls.sections.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No sections created yet.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sections</p>
                <div className="grid grid-cols-1 gap-2">
                  {cls.sections.map((sec) => {
                    const teacherEmail = teachers.find(t => t.id === sec.classTeacherId)?.email || "Unassigned";
                    return (
                      <div key={sec.id} className="flex justify-between items-center text-sm p-3 bg-gray-50 dark:bg-slate-800/40 rounded-lg border border-gray-100 dark:border-slate-800">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">Section {sec.name}</p>
                          <p className="text-xs text-gray-500">Teacher: {teacherEmail}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Cap: {sec.capacity}</p>
                          {sec.roomNumber && <p className="text-xs text-gray-500">Room: {sec.roomNumber}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
