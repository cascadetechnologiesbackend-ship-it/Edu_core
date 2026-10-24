"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveClassroom, saveSection } from "./actions";
import { Plus, Edit2, Check, RefreshCw, AlertTriangle } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import { ALL_GRADE_LEVELS } from "@/lib/gradeConstants";

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
  name?: string;
  displayName?: string;
  employeeCode?: string;
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
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const [classData, setClassData] = useState({
    gradeLevel: "CLASS_1",
    displayName: "Class 1",
    sortOrder: 1,
  });
  const [sectionData, setSectionData] = useState({
    name: "A",
    capacity: 30,
    classTeacherId: "",
    roomNumber: "",
  });

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
        ...(editingSectionId ? { id: editingSectionId } : {}),
        classId: selectedClassId,
        name: sectionData.name,
        capacity: sectionData.capacity,
        classTeacherId: sectionData.classTeacherId || null,
        roomNumber: sectionData.roomNumber || null,
      });
      setShowSectionForm(false);
      setEditingSectionId(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
          Classes & Sections Management
        </h2>
        {isAdmin && (
          <button
            onClick={() => setShowClassForm(true)}
            className="flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition min-h-[44px] active:scale-95 w-full sm:w-auto shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Class
          </button>
        )}
      </div>

      {/* Class Form Modal */}
      <AppModal
        open={showClassForm}
        onClose={() => setShowClassForm(false)}
        title="Create New Classroom"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowClassForm(false)}
              className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="classroom-form"
              disabled={isPending}
              className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
            >
              {isPending && <RefreshCw className="w-4 h-4 animate-spin" />}{" "}
              Save Class
            </button>
          </>
        }
      >
        <form
          id="classroom-form"
          onSubmit={handleClassSubmit}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Grade Level
            </label>
            <select
              value={classData.gradeLevel}
              onChange={(e) => {
                const opt = ALL_GRADE_LEVELS.find((g) => g.value === e.target.value);
                setClassData({
                  ...classData,
                  gradeLevel: e.target.value,
                  displayName: opt ? opt.label : classData.displayName,
                });
              }}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white"
            >
              {ALL_GRADE_LEVELS.map((g) => (
                <option key={g.value} value={g.value} className="text-gray-900 dark:text-white bg-white dark:bg-slate-900">
                  {g.label} ({g.value})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={classData.displayName}
              onChange={(e) =>
                setClassData({ ...classData, displayName: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Sort Order
            </label>
            <input
              type="number"
              required
              value={classData.sortOrder}
              onChange={(e) =>
                setClassData({
                  ...classData,
                  sortOrder: parseInt(e.target.value),
                })
              }
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </form>
      </AppModal>

      {/* Section Form Modal */}
      <AppModal
        open={showSectionForm}
        onClose={() => {
          setShowSectionForm(false);
          setEditingSectionId(null);
        }}
        title={editingSectionId ? "Edit Section & Class Teacher" : "Create New Section"}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowSectionForm(false);
                setEditingSectionId(null);
              }}
              className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="section-form"
              disabled={isPending}
              className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 flex items-center gap-1"
            >
              {isPending && <RefreshCw className="w-4 h-4 animate-spin" />}{" "}
              {editingSectionId ? "Update Section" : "Save Section"}
            </button>
          </>
        }
      >
        <form
          id="section-form"
          onSubmit={handleSectionSubmit}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Section Name (e.g. A, B)
            </label>
            <input
              type="text"
              required
              value={sectionData.name}
              onChange={(e) =>
                setSectionData({ ...sectionData, name: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Capacity
            </label>
            <input
              type="number"
              required
              value={sectionData.capacity}
              onChange={(e) =>
                setSectionData({
                  ...sectionData,
                  capacity: parseInt(e.target.value),
                })
              }
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Class Teacher
            </label>
            {teachers.length === 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  No teaching staff found
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Teachers must be classified with teaching designations in HR.
                </p>
                <Link
                  href="/hr?tab=designations"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline mt-1"
                >
                  Configure in HR Designations &rarr;
                </Link>
              </div>
            ) : (
              <select
                value={sectionData.classTeacherId}
                onChange={(e) =>
                  setSectionData({
                    ...sectionData,
                    classTeacherId: e.target.value,
                  })
                }
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white"
              >
                <option value="" className="text-gray-900 dark:text-white bg-white dark:bg-slate-900">Select Class Teacher (Unassigned)</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id} className="text-gray-900 dark:text-white bg-white dark:bg-slate-900">
                    {t.displayName || (t.name ? `${t.name} (${t.employeeCode || t.email})` : t.email)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Room Number
            </label>
            <input
              type="text"
              value={sectionData.roomNumber}
              onChange={(e) =>
                setSectionData({ ...sectionData, roomNumber: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </form>
      </AppModal>

      {/* Classroom List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {classrooms.map((cls) => (
          <div
            key={cls.id}
            className="bg-white dark:bg-slate-900 rounded-xl shadow border border-gray-200 dark:border-slate-800 p-6 space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {cls.displayName}
                </h3>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  {cls.gradeLevel}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setSelectedClassId(cls.id);
                    setEditingSectionId(null);
                    setSectionData({
                      name: String.fromCharCode(65 + cls.sections.length),
                      capacity: 30,
                      classTeacherId: "",
                      roomNumber: "",
                    });
                    setShowSectionForm(true);
                  }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Section
                </button>
              )}
            </div>

            {/* Sections list */}
            {cls.sections.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                No sections created yet.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Sections
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {cls.sections.map((sec) => {
                    const assignedTeacher = teachers.find(
                      (t) => t.id === sec.classTeacherId
                    );
                    const teacherDisplay = assignedTeacher
                      ? (assignedTeacher.displayName || assignedTeacher.name || assignedTeacher.email)
                      : "Unassigned";

                    return (
                      <div
                        key={sec.id}
                        className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-sm p-3.5 bg-gray-50 dark:bg-slate-800/40 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900 dark:text-white">
                              Section {sec.name}
                            </p>
                            {sec.roomNumber && (
                              <span className="text-[11px] font-medium bg-gray-200/60 dark:bg-slate-700/60 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md">
                                Room {sec.roomNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gray-600 dark:text-gray-300">
                              Class Teacher:
                            </span>
                            {assignedTeacher ? (
                              <span className="font-semibold text-primary">
                                {teacherDisplay}
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-medium italic">
                                Unassigned
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <p className="text-xs text-gray-500 font-medium">
                            Cap: {sec.capacity}
                          </p>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedClassId(cls.id);
                                setEditingSectionId(sec.id);
                                setSectionData({
                                  name: sec.name,
                                  capacity: sec.capacity,
                                  classTeacherId: sec.classTeacherId || "",
                                  roomNumber: sec.roomNumber || "",
                                });
                                setShowSectionForm(true);
                              }}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 font-bold transition shadow-2xs cursor-pointer min-h-[32px]"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-primary" /> Edit Section
                            </button>
                          )}
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
