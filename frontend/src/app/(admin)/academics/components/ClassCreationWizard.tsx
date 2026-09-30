"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClassSetup } from "../actions/class-setup.actions";
import { saveSubject } from "../actions";
import {
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Loader2,
  BookOpen,
  Users,
  Layers,
} from "lucide-react";

type Teacher = {
  id: string;
  email: string;
};

type Subject = {
  id: string;
  name: string;
  code: string;
  subjectType: string;
};

const GRADE_LEVELS = [
  { value: "NURSERY", label: "Nursery" },
  { value: "LKG", label: "LKG" },
  { value: "UKG", label: "UKG" },
  { value: "CLASS_1", label: "Class 1" },
  { value: "CLASS_2", label: "Class 2" },
  { value: "CLASS_3", label: "Class 3" },
  { value: "CLASS_4", label: "Class 4" },
  { value: "CLASS_5", label: "Class 5" },
  { value: "CLASS_6", label: "Class 6" },
  { value: "CLASS_7", label: "Class 7" },
  { value: "CLASS_8", label: "Class 8" },
  { value: "CLASS_9", label: "Class 9" },
  { value: "CLASS_10", label: "Class 10" },
];

export default function ClassCreationWizard({
  isOpen,
  onClose,
  existingSubjects = [],
  teachers = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  existingSubjects: Subject[];
  teachers: Teacher[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1: Class details
  const [gradeLevel, setGradeLevel] = useState("CLASS_6");
  const [displayName, setDisplayName] = useState("Class 6");
  const [sortOrder, setSortOrder] = useState(6);

  // Step 2: Sections
  const [sectionsList, setSectionsList] = useState<
    Array<{
      name: string;
      capacity: number;
      classTeacherId: string;
      roomNumber: string;
    }>
  >([
    { name: "A", capacity: 40, classTeacherId: "", roomNumber: "" },
    { name: "B", capacity: 40, classTeacherId: "", roomNumber: "" },
  ]);

  // Step 3: Subjects
  const [availableSubjects, setAvailableSubjects] =
    useState<Subject[]>(existingSubjects);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  // Inline subject modal/inline creator
  const [showInlineSubject, setShowInlineSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectType, setNewSubjectType] = useState<
    "THEORY" | "PRACTICAL" | "CO_SCHOLASTIC" | "LANGUAGE" | "ACTIVITY"
  >("THEORY");
  const [isSavingSubject, setIsSavingSubject] = useState(false);

  if (!isOpen) return null;

  const handleGradeLevelChange = (val: string) => {
    setGradeLevel(val);
    const found = GRADE_LEVELS.find((g) => g.value === val);
    if (found) {
      setDisplayName(found.label);
      const match = val.match(/\d+/);
      if (match) setSortOrder(parseInt(match[0], 10));
    }
  };

  const addSection = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nextLetter = letters[sectionsList.length] || `S${sectionsList.length + 1}`;
    setSectionsList([
      ...sectionsList,
      { name: nextLetter, capacity: 40, classTeacherId: "", roomNumber: "" },
    ]);
  };

  const removeSection = (idx: number) => {
    if (sectionsList.length <= 1) return;
    setSectionsList(sectionsList.filter((_, i) => i !== idx));
  };

  const updateSection = (
    idx: number,
    field: "name" | "capacity" | "classTeacherId" | "roomNumber",
    value: any,
  ) => {
    const updated = [...sectionsList];
    const current = updated[idx];
    if (!current) return;
    updated[idx] = { ...current, [field]: value };
    setSectionsList(updated);
  };

  const toggleSubject = (id: string) => {
    if (selectedSubjectIds.includes(id)) {
      setSelectedSubjectIds(selectedSubjectIds.filter((s) => s !== id));
    } else {
      setSelectedSubjectIds([...selectedSubjectIds, id]);
    }
  };

  const selectAllSubjects = () => {
    setSelectedSubjectIds(availableSubjects.map((s) => s.id));
  };

  const deselectAllSubjects = () => {
    setSelectedSubjectIds([]);
  };

  const handleCreateInlineSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim() || !newSubjectCode.trim()) return;

    setIsSavingSubject(true);
    setError(null);
    try {
      await saveSubject({
        name: newSubjectName.trim(),
        code: newSubjectCode.trim().toUpperCase(),
        type: newSubjectType,
      });

      // Construct optimistic subject item
      const createdId = `temp-${Date.now()}`;
      const createdSubject: Subject = {
        id: createdId,
        name: newSubjectName.trim(),
        code: newSubjectCode.trim().toUpperCase(),
        subjectType: newSubjectType,
      };

      setAvailableSubjects((prev) => [...prev, createdSubject]);
      setSelectedSubjectIds((prev) => [...prev, createdId]);
      setNewSubjectName("");
      setNewSubjectCode("");
      setShowInlineSubject(false);
    } catch (err: any) {
      setError(err?.message || "Failed to create subject");
    } finally {
      setIsSavingSubject(false);
    }
  };

  const handleFinalSubmit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          gradeLevel,
          displayName,
          sortOrder,
          sections: sectionsList.map((s) => ({
            name: s.name.trim(),
            capacity: s.capacity,
            classTeacherId: s.classTeacherId || null,
            roomNumber: s.roomNumber.trim() || null,
          })),
          subjectIds: selectedSubjectIds.filter((id) => !id.startsWith("temp-")),
        };

        const result = await createClassSetup(payload);
        if (result.success && result.classId) {
          onClose();
          router.push(`/academics/classes/${result.classId}`);
          router.refresh();
        }
      } catch (err: any) {
        setError(err?.message || "Failed to create class setup");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Wizard Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/40">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Create New Class
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Step {step} of 3:{" "}
              {step === 1 && "Class Information"}
              {step === 2 && "Sections & Class Teachers"}
              {step === 3 && "Curriculum & Subjects"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Tracker */}
        <div className="grid grid-cols-3 border-b border-gray-100 dark:border-slate-800 text-xs font-semibold">
          <div
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition ${
              step >= 1
                ? "border-primary text-primary"
                : "border-transparent text-gray-400"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px]">
              1
            </span>
            <span className="truncate">Class Info</span>
          </div>
          <div
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition ${
              step >= 2
                ? "border-primary text-primary"
                : "border-transparent text-gray-400"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px]">
              2
            </span>
            <span className="truncate">Sections</span>
          </div>
          <div
            className={`py-3 px-4 flex items-center gap-2 border-b-2 transition ${
              step === 3
                ? "border-primary text-primary"
                : "border-transparent text-gray-400"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px]">
              3
            </span>
            <span className="truncate">Subjects</span>
          </div>
        </div>

        {/* Wizard Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* STEP 1: CLASS INFO */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Standard / Grade Level
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => handleGradeLevelChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
                >
                  {GRADE_LEVELS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Class 6 or Grade 6"
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 mb-1.5">
                  Sort Order
                </label>
                <input
                  type="number"
                  required
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value) || 1)}
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Determines display sequence across reports and navigation.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: SECTIONS */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Configure initial sections for {displayName}. You can add more
                  anytime.
                </p>
                <button
                  type="button"
                  onClick={addSection}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Section
                </button>
              </div>

              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {sectionsList.map((sec, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 grid grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="col-span-3">
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                        Section
                      </label>
                      <input
                        type="text"
                        required
                        value={sec.name}
                        onChange={(e) =>
                          updateSection(idx, "name", e.target.value)
                        }
                        placeholder="e.g. A"
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                        Cap.
                      </label>
                      <input
                        type="number"
                        value={sec.capacity}
                        onChange={(e) =>
                          updateSection(
                            idx,
                            "capacity",
                            parseInt(e.target.value) || 40,
                          )
                        }
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="col-span-4">
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                        Class Teacher
                      </label>
                      <select
                        value={sec.classTeacherId}
                        onChange={(e) =>
                          updateSection(idx, "classTeacherId", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">None / Unassigned</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                        Room
                      </label>
                      <input
                        type="text"
                        value={sec.roomNumber}
                        onChange={(e) =>
                          updateSection(idx, "roomNumber", e.target.value)
                        }
                        placeholder="101"
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="col-span-1 flex justify-center pt-4">
                      {sectionsList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(idx)}
                          className="text-gray-400 hover:text-red-500 transition p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: SUBJECTS */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">
                    Select subjects taught in {displayName}:
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllSubjects}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAllSubjects}
                    className="text-[11px] font-medium text-gray-500 hover:underline"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInlineSubject(true)}
                    className="ml-2 inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 px-2.5 py-1 rounded-lg transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary" /> Create New
                  </button>
                </div>
              </div>

              {/* Inline Create Subject Form */}
              {showInlineSubject && (
                <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-primary" /> Quick Add
                      Subject
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowInlineSubject(false)}
                      className="text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Subject Name (e.g. Sanskrit)"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="text"
                      placeholder="Code (e.g. SKT01)"
                      value={newSubjectCode}
                      onChange={(e) => setNewSubjectCode(e.target.value)}
                      className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs uppercase focus:ring-1 focus:ring-primary"
                    />
                    <select
                      value={newSubjectType}
                      onChange={(e) => setNewSubjectType(e.target.value as any)}
                      className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                    >
                      <option value="THEORY">Theory</option>
                      <option value="PRACTICAL">Practical</option>
                      <option value="CO_SCHOLASTIC">Co-Scholastic</option>
                      <option value="LANGUAGE">Language</option>
                      <option value="ACTIVITY">Activity</option>
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={
                        isSavingSubject ||
                        !newSubjectName.trim() ||
                        !newSubjectCode.trim()
                      }
                      onClick={handleCreateInlineSubject}
                      className="bg-primary hover:bg-primary/95 text-white px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                    >
                      {isSavingSubject && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      Save & Attach
                    </button>
                  </div>
                </div>
              )}

              {/* Subject Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                {availableSubjects.map((sub) => {
                  const isSelected = selectedSubjectIds.includes(sub.id);
                  return (
                    <div
                      key={sub.id}
                      onClick={() => toggleSubject(sub.id)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? "border-primary bg-primary/5 dark:bg-primary/10 text-gray-900 dark:text-white"
                          : "border-gray-200 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/30 text-gray-600 dark:text-gray-300 hover:border-gray-300"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-xs truncate">
                          {sub.name}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {sub.code} · {sub.subjectType}
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition shrink-0 ${
                          isSelected
                            ? "bg-primary border-primary text-white"
                            : "border-gray-300 dark:border-slate-600"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {availableSubjects.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-xs">
                  No subjects in master catalog yet. Use "+ Create New" above to
                  add your first subject.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/40">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
            )}
          </div>

          <div>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as any)}
                className="bg-primary hover:bg-primary/95 text-white px-5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
              >
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={handleFinalSubmit}
                className="bg-primary hover:bg-primary/95 text-white px-6 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating Class
                    Hub...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Create Class & Open Hub
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
