"use client";

import React, { useState, useTransition } from "react";
import {
  createExam,
  createExamComponent,
  createCocurricularArea,
  saveClassSpecificGradeRule,
  loadBoardDefaultsForSchool,
} from "../actions/setupActions";
import { mapGradeLevelToClassGroup } from "@/lib/examBoardBlueprints";
import {
  BookOpen,
  PlusCircle,
  SlidersHorizontal,
  Award,
  Layers,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Palette,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface ExamManageClientProps {
  schoolId: string;
  activeYearId: string;
  board?: string;
  classes: Array<{ id: string; displayName: string; gradeLevel?: string | null }>;
  examTypes: Array<{
    id: string;
    name: string;
    code?: string;
    applicableClassGroups?: string[] | null;
  }>;
  exams: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    examType?: { name: string } | null;
    components?: Array<{
      id: string;
      displayName: string;
      weightPercent: string | null;
      showOnReportCard: boolean;
    }>;
  }>;
  cocurricularAreas: Array<{
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
  }>;
  gradeRules: Array<{
    id: string;
    classGroup: string;
    minPercent: string;
    maxPercent: string;
    grade: string;
    gradePoint: string;
    description: string | null;
  }>;
}

export function ExamManageClient({
  schoolId,
  activeYearId,
  board,
  classes,
  examTypes,
  exams,
  cocurricularAreas,
  gradeRules,
}: ExamManageClientProps) {
  const [activeTab, setActiveTab] = useState<"wizard" | "cocurricular" | "rules">("wizard");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [examName, setExamName] = useState("");
  const [selectedExamTypeId, setSelectedExamTypeId] = useState(examTypes[0]?.id || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [createdExamId, setCreatedExamId] = useState<string | null>(null);

  // Component setup state
  const [componentName, setComponentName] = useState("");
  const [componentWeight, setComponentWeight] = useState("100");
  const [showOnReport, setShowOnReport] = useState(true);

  // Cocurricular state
  const [cocurricularName, setCocurricularName] = useState("");
  const [cocurricularDesc, setCocurricularDesc] = useState("");

  // Grade scale state
  const [ruleGroup, setRuleGroup] = useState<
    "NURSERY_UKG" | "CLASS_1_5" | "CLASS_6_8" | "CLASS_9_10" | "CLASS_11_12"
  >("CLASS_1_5");
  const [ruleGrade, setRuleGrade] = useState("A1");
  const [ruleMin, setRuleMin] = useState("91");
  const [ruleMax, setRuleMax] = useState("100");
  const [rulePoint, setRulePoint] = useState("10.0");

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName || !selectedExamTypeId || !startDate || !endDate) {
      setMessage({ text: "Please complete all mandatory exam details.", type: "error" });
      return;
    }
    setMessage(null);

    // Setup Wizard Preselection (Sprint S9 Layer 6)
    // Auto-preselect classes matching selected exam type's applicableClassGroups
    const selectedEt = examTypes.find((et) => et.id === selectedExamTypeId);
    if (selectedEt && selectedEt.applicableClassGroups && selectedEt.applicableClassGroups.length > 0) {
      const matchingClassIds = classes
        .filter((c) => {
          const group = mapGradeLevelToClassGroup(c.gradeLevel || c.displayName);
          return selectedEt.applicableClassGroups!.includes(group);
        })
        .map((c) => c.id);
      setSelectedClassIds(matchingClassIds.length > 0 ? matchingClassIds : classes.map((c) => c.id));
    } else {
      setSelectedClassIds(classes.map((c) => c.id));
    }

    setStep(2);
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClassIds.length === 0) {
      setMessage({ text: "Please select at least one class scope for this examination.", type: "error" });
      return;
    }

    startTransition(async () => {
      setMessage(null);
      const res = await createExam({
        name: examName,
        examTypeId: selectedExamTypeId,
        startDate,
        endDate,
        classIds: selectedClassIds,
      });

      if (res.success && res.examId) {
        setCreatedExamId(res.examId);
        setStep(3);
        setMessage({ text: "✓ Examination created successfully! Now configure assessment components.", type: "success" });
      } else {
        setMessage({ text: "Failed to create examination. Please verify input.", type: "error" });
      }
    });
  };

  const handleAddComponent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdExamId || !componentName) return;

    startTransition(async () => {
      setMessage(null);
      const parsedWeight = parseFloat(componentWeight);
      const res = await createExamComponent({
        examId: createdExamId,
        examTypeId: selectedExamTypeId,
        name: componentName,
        ...(Number.isFinite(parsedWeight) ? { weightagePercent: parsedWeight } : {}),
        showOnReportCard: showOnReport,
      });

      if (res.success) {
        setMessage({ text: `✓ Added component '${componentName}'!`, type: "success" });
        setComponentName("");
        setComponentWeight("100");
      } else {
        setMessage({ text: "Failed to add component", type: "error" });
      }
    });
  };

  const handleAddCocurricular = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cocurricularName.trim()) return;

    startTransition(async () => {
      setMessage(null);
      const res = await createCocurricularArea({
        name: cocurricularName.trim(),
        ...(cocurricularDesc.trim() ? { description: cocurricularDesc.trim() } : {}),
      });

      if (res.success) {
        setMessage({ text: `✓ Cocurricular area '${cocurricularName}' added!`, type: "success" });
        setCocurricularName("");
        setCocurricularDesc("");
      } else {
        setMessage({ text: "Failed to add cocurricular area", type: "error" });
      }
    });
  };

  const handleAddGradeRule = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setMessage(null);
      const res = await saveClassSpecificGradeRule({
        classGroup: ruleGroup,
        minPercent: parseFloat(ruleMin),
        maxPercent: parseFloat(ruleMax),
        grade: ruleGrade.trim().toUpperCase(),
        gradePoint: parseFloat(rulePoint),
      });

      if (res.success) {
        setMessage({ text: `✓ Grade rule ${ruleGrade} (${ruleMin}%-${ruleMax}%) configured!`, type: "success" });
      } else {
        setMessage({ text: "Failed to save grade rule", type: "error" });
      }
    });
  };

  const toggleClassSelect = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId],
    );
  };

  const selectAllClasses = () => {
    if (selectedClassIds.length === classes.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(classes.map((c) => c.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Board Blueprint Banner / Status Badge */}
      {examTypes.length === 0 && gradeRules.length === 0 ? (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                Blank Slate Detected
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 font-semibold">
                {board || "CBSE"} Affiliation
              </span>
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Pre-seed {board || "CBSE"} Examination Standards & Blueprint
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xl">
              Automatically provision board-compliant assessment types, 0–100% contiguous grade rules across class categories, and cocurricular rubrics in one click.
            </p>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                setMessage(null);
                const res = await loadBoardDefaultsForSchool();
                if (res.success) {
                  setMessage({ text: res.message, type: "success" });
                } else {
                  setMessage({ text: res.message || "Failed to load board defaults", type: "error" });
                }
              });
            }}
            className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-md shadow-orange-600/20 transition flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isPending ? "Loading Defaults..." : "Load Board Defaults"}</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{board || "CBSE"} Blueprint Defaults Active</span>
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-400 hidden sm:inline">
              ({examTypes.length} exam types, {gradeRules.length} grade rules, {cocurricularAreas.length} cocurricular areas)
            </span>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                setMessage(null);
                const res = await loadBoardDefaultsForSchool();
                if (res.success) {
                  setMessage({ text: res.message, type: "success" });
                } else {
                  setMessage({ text: res.message || "Failed to re-sync board defaults", type: "error" });
                }
              });
            }}
            className="text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white transition flex items-center gap-1.5"
            title="Ensures all board defaults exist without altering custom modifications"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
            <span>Re-sync Defaults</span>
          </button>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("wizard")}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "wizard"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Exam Setup Wizard</span>
        </button>

        <button
          onClick={() => setActiveTab("cocurricular")}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "cocurricular"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Co-Curricular Areas ({cocurricularAreas.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "rules"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Grading Rules ({gradeRules.length})</span>
        </button>
      </div>

      {/* Global Status Message */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-3 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* TAB 1: EXAM SETUP WIZARD */}
      {activeTab === "wizard" && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          {/* Wizard Step Progress */}
          <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                  step === 1
                    ? "bg-indigo-600 text-white"
                    : step > 1
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-500 dark:bg-slate-800"
                }`}
              >
                1
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                1. Basic Info
              </span>
            </div>

            <div className="h-0.5 w-12 sm:w-20 bg-gray-200 dark:bg-slate-800" />

            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                  step === 2
                    ? "bg-indigo-600 text-white"
                    : step > 2
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-100 text-gray-500 dark:bg-slate-800"
                }`}
              >
                2
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                2. Class Scopes
              </span>
            </div>

            <div className="h-0.5 w-12 sm:w-20 bg-gray-200 dark:bg-slate-800" />

            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                  step === 3
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-500 dark:bg-slate-800"
                }`}
              >
                3
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
                3. Components
              </span>
            </div>
          </div>

          {/* STEP 1: Basic Info */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="max-w-xl mx-auto space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                  Exam Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mid-Term Assessment 2025"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                  Assessment Type *
                </label>
                <select
                  required
                  value={selectedExamTypeId}
                  onChange={(e) => setSelectedExamTypeId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                >
                  {examTypes.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm"
                >
                  Proceed to Class Scopes →
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Class Scopes */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit} className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Select Classes Included in Exam
                  </h3>
                  <p className="text-xs text-gray-500">
                    Students belonging to checked classes will participate in this examination.
                  </p>
                  {(() => {
                    const selectedEt = examTypes.find((et) => et.id === selectedExamTypeId);
                    if (selectedEt && selectedEt.applicableClassGroups && selectedEt.applicableClassGroups.length > 0) {
                      return (
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-1">
                          ✓ Auto-scoped to classes matching &quot;{selectedEt.name}&quot; blueprint groups ({selectedClassIds.length} preselected, editable).
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
                <button
                  type="button"
                  onClick={selectAllClasses}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {selectedClassIds.length === classes.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-1">
                {classes.map((cls) => {
                  const isChecked = selectedClassIds.includes(cls.id);
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => toggleClassSelect(cls.id)}
                      className={`p-3 rounded-xl border text-left text-sm transition-all flex items-center justify-between ${
                        isChecked
                          ? "bg-indigo-50/80 border-indigo-400 text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-600 dark:text-indigo-200"
                          : "border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="font-semibold">{cls.displayName}</span>
                      {isChecked && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:text-slate-300"
                >
                  ← Back to Basic Info
                </button>

                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Save Exam & Configure Components →"}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Assessment Components */}
          {step === 3 && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-sm">
                Exam created! You can now attach sub-components (e.g. Theory 70%, Practical 20%, Internal Assessment 10%).
              </div>

              <form onSubmit={handleAddComponent} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Component Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Theory or Practical"
                    value={componentName}
                    onChange={(e) => setComponentName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Weight %
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={componentWeight}
                    onChange={(e) => setComponentWeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
                >
                  Add Component
                </button>
              </form>

              <div className="flex justify-end pt-6 border-t border-gray-100 dark:border-slate-800">
                <a
                  href="/exams/dashboard"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-all shadow-sm"
                >
                  ✓ Finish Setup & View Dashboard
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CO-CURRICULAR AREAS */}
      {activeTab === "cocurricular" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm h-fit">
            <h3 className="font-bold text-base text-gray-900 dark:text-white mb-1">
              Add Co-Curricular Area
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Add non-scholastic assessment subjects like Art, Work Education, or Physical Training.
            </p>

            <form onSubmit={handleAddCocurricular} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Area Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Visual Arts & Craft"
                  value={cocurricularName}
                  onChange={(e) => setCocurricularName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Description / Guidelines
                </label>
                <textarea
                  rows={2}
                  placeholder="Evaluated on 5-point scale (A to E)"
                  value={cocurricularDesc}
                  onChange={(e) => setCocurricularDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-all"
              >
                Save Co-Curricular Area
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-base text-gray-900 dark:text-white mb-3">
              Registered Co-Curricular Areas
            </h3>

            {cocurricularAreas.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                No co-curricular areas defined yet.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {cocurricularAreas.map((area) => (
                  <div key={area.id} className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                        {area.name}
                      </h4>
                      {area.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{area.description}</p>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CLASS-SPECIFIC GRADE SCALES */}
      {activeTab === "rules" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm h-fit">
            <h3 className="font-bold text-base text-gray-900 dark:text-white mb-1">
              Add / Update Grade Rule
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Map percentage brackets to letter grades and grade points.
            </p>

            <form onSubmit={handleAddGradeRule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Class Group *
                </label>
                <select
                  value={ruleGroup}
                  onChange={(e) => setRuleGroup(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                >
                  <option value="NURSERY_UKG">Nursery - UKG (Foundation)</option>
                  <option value="CLASS_1_5">Class 1 to 5 (Primary)</option>
                  <option value="CLASS_6_8">Class 6 to 8 (Middle)</option>
                  <option value="CLASS_9_10">Class 9 & 10 (Secondary)</option>
                  <option value="CLASS_11_12">Class 11 & 12 (Senior Sec)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Grade Letter *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A1"
                    value={ruleGrade}
                    onChange={(e) => setRuleGrade(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Grade Point *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={rulePoint}
                    onChange={(e) => setRulePoint(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Min % *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={ruleMin}
                    onChange={(e) => setRuleMin(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Max % *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={ruleMax}
                    onChange={(e) => setRuleMax(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-all"
              >
                Save Grade Scale
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden">
            <h3 className="font-bold text-base text-gray-900 dark:text-white mb-3">
              Configured Grade Scales
            </h3>

            {gradeRules.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                Using default CBSE 9-point grading scale (A1 to E).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2.5">Class Group</th>
                      <th className="px-4 py-2.5">Grade</th>
                      <th className="px-4 py-2.5">Range</th>
                      <th className="px-4 py-2.5">Grade Point</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {gradeRules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="px-4 py-2.5 font-medium">{rule.classGroup}</td>
                        <td className="px-4 py-2.5 font-bold text-indigo-600 dark:text-indigo-400">
                          {rule.grade}
                        </td>
                        <td className="px-4 py-2.5">
                          {rule.minPercent}% – {rule.maxPercent}%
                        </td>
                        <td className="px-4 py-2.5">{rule.gradePoint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
