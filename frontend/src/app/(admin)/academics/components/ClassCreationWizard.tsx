"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClassSetup } from "../actions/class-setup.actions";
import { saveSubject } from "../actions";
import {
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { AppModal } from "@/components/ui/AppModal";
import { Stepper } from "@/components/ui/Stepper";
import { mapGradeLevelToClassGroup, ClassGroup } from "@/lib/examBoardBlueprints";
import { getCanonicalSortOrder } from "@/lib/academicOrdering";
import { toast } from "sonner";

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

type ExistingClassroom = {
  id: string;
  gradeLevel: string;
  displayName: string;
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
  { value: "CLASS_11", label: "Class 11" },
  { value: "CLASS_12", label: "Class 12" },
];

const WIZARD_STEPS = [
  { label: "Class Info", description: "Grade & display name" },
  { label: "Sections", description: "Capacities & teachers" },
  { label: "Subjects", description: "Curriculum mapping" },
];

const SUBJECT_TYPE_LABELS: Record<string, string> = {
  THEORY: "Theory",
  LANGUAGE: "Languages",
  PRACTICAL: "Practicals & Lab",
  ACTIVITY: "Activities & Sports",
  CO_SCHOLASTIC: "Co-Scholastic & Arts",
};

// Default subject code patterns per class group for blueprint prechecking
const BLUEPRINT_KEYWORDS_BY_GROUP: Record<ClassGroup, string[]> = {
  NURSERY_UKG: ["eng", "math", "evs", "rhym", "art", "draw", "story", "lang"],
  CLASS_1_5: ["eng", "hin", "math", "evs", "sci", "sst", "comp", "ped", "pe", "art"],
  CLASS_6_8: ["eng", "hin", "skt", "math", "sci", "sst", "comp", "cs", "ped", "pe"],
  CLASS_9_10: ["eng", "hin", "math", "sci", "sst", "comp", "cs", "it", "ped", "pe"],
  CLASS_11_12: ["eng", "phy", "chem", "math", "bio", "cs", "acc", "bst", "eco", "hist", "pol", "pe"],
};

function matchesBlueprintForGroup(subject: Subject, group: ClassGroup): boolean {
  const keywords = BLUEPRINT_KEYWORDS_BY_GROUP[group] || [];
  const code = (subject.code || "").toLowerCase();
  const name = (subject.name || "").toLowerCase();
  return keywords.some((kw) => code.includes(kw) || name.includes(kw));
}

export default function ClassCreationWizard({
  isOpen,
  onClose,
  existingSubjects = [],
  teachers = [],
  existingClassrooms = [],
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  existingSubjects: Subject[];
  teachers: Teacher[];
  existingClassrooms?: ExistingClassroom[];
  onCreated?: (info: { classId: string; displayName: string }) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1: Class details
  const [gradeLevel, setGradeLevel] = useState("CLASS_6");
  const [displayName, setDisplayName] = useState("Class 6");
  const [sortOrder, setSortOrder] = useState(() => getCanonicalSortOrder("CLASS_6", "Class 6"));

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
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>(existingSubjects);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [hasManuallyModifiedSubjects, setHasManuallyModifiedSubjects] = useState(false);

  // Inline subject modal/inline creator
  const [showInlineSubject, setShowInlineSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectType, setNewSubjectType] = useState<
    "THEORY" | "PRACTICAL" | "CO_SCHOLASTIC" | "LANGUAGE" | "ACTIVITY"
  >("THEORY");
  const [isSavingSubject, setIsSavingSubject] = useState(false);

  // Sync available subjects if parent list updates
  useEffect(() => {
    setAvailableSubjects(existingSubjects);
  }, [existingSubjects]);

  // Pre-select subjects based on board blueprint when gradeLevel or subjects change
  useEffect(() => {
    if (!hasManuallyModifiedSubjects && availableSubjects.length > 0) {
      const group = mapGradeLevelToClassGroup(gradeLevel);
      const preselected = availableSubjects
        .filter((sub) => matchesBlueprintForGroup(sub, group))
        .map((s) => s.id);
      
      // Fallback: if blueprint matching yields empty, default to all available subjects
      setSelectedSubjectIds(preselected.length > 0 ? preselected : availableSubjects.map((s) => s.id));
    }
  }, [gradeLevel, availableSubjects, hasManuallyModifiedSubjects]);

  // Check for duplicate grade level
  const duplicateClass = existingClassrooms.find(
    (c) => c.gradeLevel.toUpperCase() === gradeLevel.toUpperCase()
  );

  const handleGradeLevelChange = (val: string) => {
    setGradeLevel(val);
    const found = GRADE_LEVELS.find((g) => g.value === val);
    const newName = found ? found.label : val;
    setDisplayName(newName);
    setSortOrder(getCanonicalSortOrder(val, newName));
    setHasManuallyModifiedSubjects(false); // Re-trigger blueprint precheck for new grade
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
    setHasManuallyModifiedSubjects(true);
    if (selectedSubjectIds.includes(id)) {
      setSelectedSubjectIds(selectedSubjectIds.filter((s) => s !== id));
    } else {
      setSelectedSubjectIds([...selectedSubjectIds, id]);
    }
  };

  const selectAllSubjects = () => {
    setHasManuallyModifiedSubjects(true);
    setSelectedSubjectIds(availableSubjects.map((s) => s.id));
  };

  const deselectAllSubjects = () => {
    setHasManuallyModifiedSubjects(true);
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

      const createdId = `temp-${Date.now()}`;
      const createdSubject: Subject = {
        id: createdId,
        name: newSubjectName.trim(),
        code: newSubjectCode.trim().toUpperCase(),
        subjectType: newSubjectType,
      };

      setAvailableSubjects((prev) => [...prev, createdSubject]);
      setSelectedSubjectIds((prev) => [...prev, createdId]);
      setHasManuallyModifiedSubjects(true);
      setNewSubjectName("");
      setNewSubjectCode("");
      setShowInlineSubject(false);
      toast.success(`Subject "${newSubjectName.trim()}" created and attached.`);
    } catch (err: any) {
      setError(err?.message || "Failed to create subject");
    } finally {
      setIsSavingSubject(false);
    }
  };

  // Step 1 Validation
  const canContinueStep1 = Boolean(
    displayName.trim() &&
    !duplicateClass
  );

  // Step 2 Validation: non-empty section names and unique within class
  const sectionNames = sectionsList.map((s) => s.name.trim().toUpperCase());
  const hasEmptySectionName = sectionNames.some((n) => !n);
  const hasDuplicateSectionNames = new Set(sectionNames).size !== sectionNames.length;
  const canContinueStep2 = !hasEmptySectionName && !hasDuplicateSectionNames;

  const handleFinalSubmit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          gradeLevel,
          displayName: displayName.trim(),
          sortOrder,
          sections: sectionsList.map((s) => ({
            name: s.name.trim(),
            capacity: s.capacity,
            classTeacherId: s.classTeacherId || null,
            roomNumber: s.roomNumber?.trim() || null,
          })),
          subjectIds: selectedSubjectIds.filter((id) => !id.startsWith("temp-")),
        };

        const result = await createClassSetup(payload);
        if (result.success && result.classId) {
          toast.success(`Class "${displayName.trim()}" created successfully!`);
          if (onCreated) {
            onCreated({ classId: result.classId, displayName: displayName.trim() });
          }
          onClose();
          router.push(`/academics/classes/${result.classId}?tab=subjects`);
          router.refresh();
        } else if (!result.success) {
          setError(result.error || "Failed to create class setup");
        }
      } catch (err: any) {
        setError(err?.message || "Failed to create class setup");
      }
    });
  };

  // Group available subjects by type for clean visual scanning in Step 3
  const subjectsByType: Record<string, Subject[]> = {};
  availableSubjects.forEach((sub) => {
    const t = sub.subjectType || "THEORY";
    if (!subjectsByType[t]) subjectsByType[t] = [];
    subjectsByType[t]!.push(sub);
  });

  const currentClassGroup = mapGradeLevelToClassGroup(gradeLevel);

  const renderFooter = () => (
    <div className="w-full flex items-center justify-between">
      <div>
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as any)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition flex items-center gap-1 min-h-[40px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition min-h-[40px]"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {step === 3 && (
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium mr-2">
            <strong className="text-gray-900 dark:text-white font-bold">{selectedSubjectIds.length}</strong> subjects selected
          </span>
        )}

        {step === 1 ? (
          <button
            type="button"
            disabled={!canContinueStep1}
            onClick={() => setStep(2)}
            className="bg-primary hover:bg-primary/95 text-white px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm min-h-[40px] disabled:opacity-50"
          >
            Continue <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : step === 2 ? (
          <button
            type="button"
            disabled={!canContinueStep2}
            onClick={() => setStep(3)}
            className="bg-primary hover:bg-primary/95 text-white px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm min-h-[40px] disabled:opacity-50"
          >
            Continue <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={handleFinalSubmit}
            className="bg-primary hover:bg-primary/95 text-white px-6 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md disabled:opacity-50 min-h-[40px]"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Creating Class & Hub...
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
  );

  return (
    <AppModal
      open={isOpen}
      onClose={onClose}
      size="xl"
      title="Create New Class"
      description={`Step ${step} of 3: ${
        step === 1
          ? "Class Information"
          : step === 2
          ? "Sections & Class Teachers"
          : "Curriculum & Subjects"
      }`}
      footer={renderFooter()}
    >
      <div className="space-y-4">
        {/* Horizontal Step Progress Bar */}
        <div className="border-b border-gray-100 dark:border-slate-800 pb-3">
          <Stepper
            steps={WIZARD_STEPS}
            currentStep={step}
            onStepClick={(s) => {
              if (s === 1) setStep(1);
              if (s === 2 && canContinueStep1) setStep(2);
              if (s === 3 && canContinueStep1 && canContinueStep2) setStep(3);
            }}
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: CLASS INFO */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            {duplicateClass && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  A class for <strong>{duplicateClass.displayName}</strong> ({gradeLevel}) already exists in this school. Please pick another standard.
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                Standard / Grade Level
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => handleGradeLevelChange(e.target.value)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
              >
                {GRADE_LEVELS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Class group: <span className="font-semibold text-gray-600 dark:text-gray-300">{currentClassGroup}</span> (used to auto-suggest board blueprint subjects)
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Class 6 or Grade 6"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                Sort Order
              </label>
              <input
                type="number"
                required
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 1)}
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Determines display sequence across reports and navigation (pre-computed by canonical grade ordering).
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: SECTIONS */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Configure initial sections for {displayName}. You can add more anytime.
              </p>
              <button
                type="button"
                onClick={addSection}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 min-h-[32px]"
              >
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            </div>

            {hasDuplicateSectionNames && (
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs">
                Section names must be unique within {displayName}.
              </div>
            )}

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
                      onChange={(e) => updateSection(idx, "name", e.target.value)}
                      placeholder="e.g. A"
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
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
                        updateSection(idx, "capacity", parseInt(e.target.value) || 40)
                      }
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
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
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
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
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="col-span-1 flex justify-center pt-4">
                    {sectionsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSection(idx)}
                        className="text-gray-400 hover:text-red-500 transition p-1 min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
                        title="Remove section"
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

        {/* STEP 3: SUBJECTS (Grouped by subjectType, prechecked from blueprint) */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Subjects pre-checked from standard curriculum for <strong>{displayName}</strong>. Uncheck any exceptions:
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllSubjects}
                  className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-gray-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={deselectAllSubjects}
                  className="text-[11px] font-medium text-gray-500 hover:underline cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setShowInlineSubject(true)}
                  className="ml-2 inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
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
                    <BookOpen className="w-3.5 h-3.5 text-primary" /> Quick Add Subject
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowInlineSubject(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Subject Name (e.g. Sanskrit)"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="text"
                    placeholder="Code (e.g. SKT01)"
                    value={newSubjectCode}
                    onChange={(e) => setNewSubjectCode(e.target.value)}
                    className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-2.5 py-1.5 text-xs uppercase focus:ring-1 focus:ring-primary"
                  />
                  <select
                    value={newSubjectType}
                    onChange={(e) => setNewSubjectType(e.target.value as any)}
                    className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
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
                    className="bg-primary hover:bg-primary/95 text-white px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                  >
                    {isSavingSubject && (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                    Save & Attach
                  </button>
                </div>
              </div>
            )}

            {/* Subject Grid Grouped By Subject Type */}
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {Object.keys(subjectsByType).length > 0 ? (
                Object.entries(subjectsByType).map(([typeKey, list]) => (
                  <div key={typeKey} className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                      {SUBJECT_TYPE_LABELS[typeKey] || typeKey} ({list.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {list.map((sub) => {
                        const isSelected = selectedSubjectIds.includes(sub.id);
                        return (
                          <div
                            key={sub.id}
                            onClick={() => toggleSubject(sub.id)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                              isSelected
                                ? "border-primary bg-primary/5 dark:bg-primary/10 text-gray-900 dark:text-white shadow-xs"
                                : "border-gray-200 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/30 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold text-xs truncate">
                                {sub.name}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono">
                                {sub.code}
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
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-400 text-xs">
                  No subjects in master catalog yet. Use "+ Create New" above to add your first subject.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppModal>
  );
}
