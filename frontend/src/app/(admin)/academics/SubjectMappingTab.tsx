"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Plus,
  RefreshCw,
  BookOpen,
  Layers,
  AlertTriangle,
  SlidersHorizontal,
  X,
  Sparkles,
  ArrowRight,
  Info,
  Calendar,
} from "lucide-react";
import { batchUpdateClassSubjectMappings, assignSectionTeacher } from "./actions";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { NextBestAction } from "@/components/ui/NextBestAction";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";
import { mapGradeLevelToClassGroup, ClassGroup } from "@/lib/examBoardBlueprints";
import { getCanonicalSortOrder } from "@/lib/academicOrdering";
import { toast } from "sonner";

export type SectionOverride = {
  id?: string | undefined;
  sectionId: string;
  teacherId: string;
  sectionName?: string | undefined;
  teacherEmail?: string | undefined;
};

export type ClassSubject = {
  id: string;
  classId: string;
  subjectId: string;
  assignedTeacherId: string | null;
  periodsPerWeek: number;
  isElective: boolean;
  class?: {
    displayName: string;
  };
  subject?: {
    name: string;
    code: string;
  };
  sectionSubjectTeachers?: Array<{
    id: string;
    sectionId: string;
    teacherId: string;
    isActive: boolean;
    effectiveTo: string | null;
    teacher?: { id: string; email: string };
    section?: { id: string; name: string };
  }>;
};

export type Classroom = {
  id: string;
  gradeLevel: string;
  displayName: string;
  sortOrder?: number;
  sections?: Array<{
    id: string;
    name: string;
    capacity?: number;
    classTeacherId?: string | null;
    roomNumber?: string | null;
  }>;
};

export type Subject = {
  id: string;
  name: string;
  code: string;
  subjectType?: string;
};

export type Teacher = {
  id: string;
  email: string;
  name?: string;
  displayName?: string;
};

// Blueprint keyword matching for hierarchy guards
const BLUEPRINT_KEYWORDS_BY_GROUP: Record<ClassGroup, string[]> = {
  NURSERY_UKG: ["eng", "math", "evs", "rhym", "art", "draw", "story", "lang"],
  CLASS_1_5: ["eng", "hin", "math", "evs", "sci", "sst", "comp", "ped", "pe", "art"],
  CLASS_6_8: ["eng", "hin", "skt", "math", "sci", "sst", "comp", "cs", "ped", "pe"],
  CLASS_9_10: ["eng", "hin", "math", "sci", "sst", "comp", "cs", "it", "ped", "pe"],
  CLASS_11_12: ["eng", "phy", "chem", "math", "bio", "cs", "acc", "bst", "eco", "hist", "pol", "pe"],
};

function isSubjectInBlueprintForGroup(subject: Subject, group: ClassGroup): boolean {
  const keywords = BLUEPRINT_KEYWORDS_BY_GROUP[group] || [];
  const code = (subject.code || "").toLowerCase();
  const name = (subject.name || "").toLowerCase();
  return keywords.some((kw) => code.includes(kw) || name.includes(kw));
}

export default function SubjectMappingTab({
  mappings: initialMappings,
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

  // Canonical sort classrooms
  const sortedClassrooms = useMemo(() => {
    return [...classrooms].sort((a, b) => {
      const orderA = getCanonicalSortOrder(a.gradeLevel, a.displayName);
      const orderB = getCanonicalSortOrder(b.gradeLevel, b.displayName);
      if (orderA !== orderB) return orderA - orderB;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }, [classrooms]);

  // Sort subjects by type then name
  const sortedSubjects = useMemo(() => {
    return [...subjects].sort((a, b) => {
      const typeA = a.subjectType || "THEORY";
      const typeB = b.subjectType || "THEORY";
      if (typeA !== typeB) return typeA.localeCompare(typeB);
      return a.name.localeCompare(b.name);
    });
  }, [subjects]);

  // Current live mapping lookup: key = `${classId}:${subjectId}`
  type CellState = {
    classSubjectId?: string;
    isOffered: boolean;
    isElective: boolean;
    periodsPerWeek: number;
    assignedTeacherId: string | null;
    isDirty?: boolean;
    originalState?: boolean;
    sectionOverrides?: SectionOverride[];
  };

  const initialCellMap = useMemo(() => {
    const map = new Map<string, CellState>();
    initialMappings.forEach((m) => {
      const key = `${m.classId}:${m.subjectId}`;
      const sectionOverrides: SectionOverride[] = (m.sectionSubjectTeachers || [])
        .filter((st) => st.isActive && !st.effectiveTo)
        .map((st) => ({
          id: st.id,
          sectionId: st.sectionId,
          teacherId: st.teacherId,
          sectionName: st.section?.name,
          teacherEmail: st.teacher?.email,
        }));

      map.set(key, {
        classSubjectId: m.id,
        isOffered: true,
        isElective: m.isElective,
        periodsPerWeek: m.periodsPerWeek || 5,
        assignedTeacherId: m.assignedTeacherId || null,
        originalState: true,
        sectionOverrides,
      });
    });
    return map;
  }, [initialMappings]);

  const [cellMap, setCellMap] = useState<Map<string, CellState>>(() => new Map(initialCellMap));
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());

  // OD3: Active beforeunload navigation guard for staged matrix edits
  useEffect(() => {
    if (dirtyKeys.size === 0) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have unsaved curriculum matrix changes that will be lost. Click 'Save All' to persist.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyKeys.size]);

  // Slide-over Teacher & Details Drawer state
  const [activeDrawerCell, setActiveDrawerCell] = useState<{
    classId: string;
    subjectId: string;
    classroom: Classroom;
    subject: Subject;
    cell: CellState;
  } | null>(null);

  // Multi-cell bulk selection for BulkActionBar
  const [selectedCellKeys, setSelectedCellKeys] = useState<Set<string>>(new Set());

  // Post action strip
  const [postActionStrip, setPostActionStrip] = useState<{
    outcome: string;
    suggestion: { label: string; href?: string; action?: () => void; primary?: boolean };
    alternates?: Array<{ label: string; href?: string; action?: () => void }>;
  } | null>(null);

  // Toggle cell offered status (optimistic)
  const handleCellClick = (cls: Classroom, sub: Subject) => {
    if (!isAdmin) return;
    const key = `${cls.id}:${sub.id}`;
    const current = cellMap.get(key) || {
      isOffered: false,
      isElective: false,
      periodsPerWeek: 5,
      assignedTeacherId: null,
      originalState: false,
    };

    // If already offered, open drawer to view/edit details; or toggle
    // Law: 1st click = toggle on; if already on, click again or double click = drawer
    if (current.isOffered) {
      setActiveDrawerCell({
        classId: cls.id,
        subjectId: sub.id,
        classroom: cls,
        subject: sub,
        cell: current,
      });
      return;
    }

    // Toggle from off to on
    const nextOffered = true;
    const newCell: CellState = {
      ...current,
      isOffered: nextOffered,
      isDirty: true,
    };

    setCellMap((prev) => new Map(prev).set(key, newCell));
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      const isOriginal = (current.originalState ?? false) === nextOffered;
      if (isOriginal) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Bulk column select (whole class)
  const handleToggleClassColumn = (cls: Classroom) => {
    if (!isAdmin) return;
    const newMap = new Map(cellMap);
    const newDirty = new Set(dirtyKeys);

    // If all subjects for this class are offered, toggle all off; otherwise toggle all on
    const allOffered = sortedSubjects.every((sub) => {
      const k = `${cls.id}:${sub.id}`;
      return newMap.get(k)?.isOffered;
    });

    const targetOffered = !allOffered;

    sortedSubjects.forEach((sub) => {
      const key = `${cls.id}:${sub.id}`;
      const existing = newMap.get(key) || {
        isOffered: false,
        isElective: false,
        periodsPerWeek: 5,
        assignedTeacherId: null,
        originalState: false,
      };

      newMap.set(key, {
        ...existing,
        isOffered: targetOffered,
        isDirty: true,
      });

      if ((existing.originalState ?? false) === targetOffered) {
        newDirty.delete(key);
      } else {
        newDirty.add(key);
      }
    });

    setCellMap(newMap);
    setDirtyKeys(newDirty);
  };

  // Bulk row select (subject across all classes)
  const handleToggleSubjectRow = (sub: Subject) => {
    if (!isAdmin) return;
    const newMap = new Map(cellMap);
    const newDirty = new Set(dirtyKeys);

    const allOffered = sortedClassrooms.every((cls) => {
      const k = `${cls.id}:${sub.id}`;
      return newMap.get(k)?.isOffered;
    });

    const targetOffered = !allOffered;

    sortedClassrooms.forEach((cls) => {
      const key = `${cls.id}:${sub.id}`;
      const existing = newMap.get(key) || {
        isOffered: false,
        isElective: false,
        periodsPerWeek: 5,
        assignedTeacherId: null,
        originalState: false,
      };

      newMap.set(key, {
        ...existing,
        isOffered: targetOffered,
        isDirty: true,
      });

      if ((existing.originalState ?? false) === targetOffered) {
        newDirty.delete(key);
      } else {
        newDirty.add(key);
      }
    });

    setCellMap(newMap);
    setDirtyKeys(newDirty);
  };

  // Drawer update save (single cell parameters)
  const handleSaveDrawerCell = (updatedCell: CellState) => {
    if (!activeDrawerCell) return;
    const key = `${activeDrawerCell.classId}:${activeDrawerCell.subjectId}`;
    setCellMap((prev) => new Map(prev).set(key, { ...updatedCell, isDirty: true }));
    setDirtyKeys((prev) => new Set(prev).add(key));
    setActiveDrawerCell(null);
  };

  // Discard all uncommitted changes
  const handleDiscardChanges = () => {
    setCellMap(new Map(initialCellMap));
    setDirtyKeys(new Set());
    toast.info("Unsaved matrix changes discarded.");
  };

  // Batch Save All changes
  const handleSaveAllChanges = () => {
    if (dirtyKeys.size === 0) return;

    startTransition(async () => {
      try {
        const toAdd: Array<{
          classId: string;
          subjectId: string;
          isElective?: boolean;
          periodsPerWeek?: number;
          assignedTeacherId?: string | null;
        }> = [];
        const toRemove: Array<{ classId: string; subjectId: string }> = [];
        const toUpdate: Array<{
          id: string;
          isElective?: boolean;
          periodsPerWeek?: number;
          assignedTeacherId?: string | null;
        }> = [];

        dirtyKeys.forEach((key) => {
          const [classId, subjectId] = key.split(":");
          if (!classId || !subjectId) return;
          const cell = cellMap.get(key);
          if (!cell) return;

          if (cell.isOffered && !cell.originalState) {
            // New attachment
            toAdd.push({
              classId,
              subjectId,
              isElective: cell.isElective,
              periodsPerWeek: cell.periodsPerWeek,
              assignedTeacherId: cell.assignedTeacherId,
            });
          } else if (!cell.isOffered && cell.originalState) {
            // Detachment
            toRemove.push({ classId, subjectId });
          } else if (cell.isOffered && cell.originalState && cell.classSubjectId) {
            // Updated existing
            toUpdate.push({
              id: cell.classSubjectId,
              isElective: cell.isElective,
              periodsPerWeek: cell.periodsPerWeek,
              assignedTeacherId: cell.assignedTeacherId,
            });
          }
        });

        const totalChanges = toAdd.length + toRemove.length + toUpdate.length;
        const res = await batchUpdateClassSubjectMappings({
          toAdd,
          toRemove,
          toUpdate,
        });

        if (res.success) {
          toast.success(`${totalChanges} subject mapping${totalChanges === 1 ? "" : "s"} updated.`);
          setDirtyKeys(new Set());
          setPostActionStrip({
            outcome: `${totalChanges} subject mappings were updated across your academic classes.`,
            suggestion: {
              label: "Build timetables for classes",
              href: "/academics",
              primary: true,
            },
            alternates: [
              {
                label: "Open Academics Hub",
                href: "/academics",
              },
            ],
          });
          router.refresh();
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to batch save mappings");
      }
    });
  };

  // Bulk actions from bottom bar
  const handleBulkDetachSelected = () => {
    const newMap = new Map(cellMap);
    const newDirty = new Set(dirtyKeys);

    selectedCellKeys.forEach((key) => {
      const cell = newMap.get(key);
      if (cell && cell.isOffered) {
        newMap.set(key, { ...cell, isOffered: false, isDirty: true });
        newDirty.add(key);
      }
    });

    setCellMap(newMap);
    setDirtyKeys(newDirty);
    setSelectedCellKeys(new Set());
    toast.info("Selected subjects detached. Click 'Save All' to persist.");
  };

  const handleBulkAttachSelected = () => {
    const newMap = new Map(cellMap);
    const newDirty = new Set(dirtyKeys);

    selectedCellKeys.forEach((key) => {
      const cell = newMap.get(key) || {
        isOffered: false,
        isElective: false,
        periodsPerWeek: 5,
        assignedTeacherId: null,
        originalState: false,
      };
      if (!cell.isOffered) {
        newMap.set(key, { ...cell, isOffered: true, isDirty: true });
        newDirty.add(key);
      }
    });

    setCellMap(newMap);
    setDirtyKeys(newDirty);
    setSelectedCellKeys(new Set());
    toast.info("Selected subjects attached. Click 'Save All' to persist.");
  };

  if (sortedClassrooms.length === 0 || sortedSubjects.length === 0) {
    return (
      <EmptyStateCTA
        icon={BookOpen}
        title="Classroom & Subject Master Required"
        hint="Create at least one classroom and one subject to open the curriculum mapping matrix."
        ctaLabel={isAdmin ? "Go to Academics Hub" : undefined}
        ctaHref={isAdmin ? "/academics" : undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── 1. Header Toolbar & Legend (Surface 4 Spec) ────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Curriculum Subject Matrix
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Click cells to toggle subject offering. Click offered cells to assign teachers & periods.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 px-3.5 py-1.5 rounded-xl self-start sm:self-auto">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Legend:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-primary text-white flex items-center justify-center text-[9px] font-bold">
              C
            </span>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Core</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-amber-500 text-white flex items-center justify-center text-[9px] font-bold">
              E
            </span>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Elective</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
            <span className="text-gray-500">Not Offered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-gray-400 text-[11px]">Non-blueprint</span>
          </div>
        </div>
      </div>

      {/* ─── 2. Post-Action / Next Best Action Strip ─────────────────────────── */}
      {postActionStrip && (
        <NextBestAction
          outcome={postActionStrip.outcome}
          suggestion={postActionStrip.suggestion}
          alternates={postActionStrip.alternates}
          onDismiss={() => setPostActionStrip(null)}
        />
      )}

      {/* ─── 3. Unsaved Changes Sticky Review Bar (AC11 & Batching Spec) ────── */}
      {dirtyKeys.size > 0 && (
        <div className="sticky top-4 z-20 bg-primary/95 text-white backdrop-blur-md rounded-2xl p-4 shadow-xl border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-xs font-bold block">
                {dirtyKeys.size} Unsaved Matrix Change{dirtyKeys.size === 1 ? "" : "s"}
              </span>
              <span className="text-[11px] text-white/80">
                Changes are staged locally. Click Save All to apply to academic records.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscardChanges}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition min-h-[38px] cursor-pointer"
            >
              Discard Changes
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveAllChanges}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-white text-primary hover:bg-white/95 transition shadow-sm flex items-center gap-1.5 min-h-[38px] disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving All...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Save All ({dirtyKeys.size})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── 4. Class x Subject Matrix Workbench (Surface 4 Matrix) ─────────── */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full border-collapse text-left text-xs">
            {/* Table Header: Canonically ordered classes */}
            <thead className="bg-gray-50/90 dark:bg-slate-800/90 sticky top-0 z-10 backdrop-blur-xs border-b border-gray-200 dark:border-slate-800">
              <tr>
                {/* Sticky Left Subject Column */}
                <th className="sticky left-0 z-20 bg-gray-100 dark:bg-slate-800 p-3 min-w-[220px] max-w-[260px] font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider text-[11px] border-r border-gray-200 dark:border-slate-700 shadow-sm">
                  Subject Catalog ({sortedSubjects.length})
                </th>

                {sortedClassrooms.map((cls) => (
                  <th
                    key={cls.id}
                    onClick={() => handleToggleClassColumn(cls)}
                    title={`Click to bulk toggle all subjects for ${cls.displayName}`}
                    className="p-3 min-w-[120px] font-bold text-gray-900 dark:text-white text-center cursor-pointer hover:bg-primary/10 transition select-none border-r border-gray-100 dark:border-slate-800"
                  >
                    <div className="font-bold text-xs truncate">{cls.displayName}</div>
                    <div className="text-[10px] text-gray-400 font-mono font-normal">
                      {cls.gradeLevel}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body: Rows = subjects, Cells = interactive toggle chips */}
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {sortedSubjects.map((sub) => (
                <tr
                  key={sub.id}
                  className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition group"
                >
                  {/* Sticky Subject Header Cell */}
                  <th
                    onClick={() => handleToggleSubjectRow(sub)}
                    title={`Click to bulk toggle ${sub.name} across all classes`}
                    className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-gray-50 dark:group-hover:bg-slate-800/60 p-3 font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-slate-800 cursor-pointer select-none"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="min-w-0">
                        <span className="truncate block font-bold text-xs text-gray-800 dark:text-gray-100">
                          {sub.name}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono block">
                          {sub.code} · {sub.subjectType || "THEORY"}
                        </span>
                      </div>
                      <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition shrink-0">
                        Toggle
                      </span>
                    </div>
                  </th>

                  {/* Class Columns */}
                  {sortedClassrooms.map((cls) => {
                    const key = `${cls.id}:${sub.id}`;
                    const cell = cellMap.get(key) || {
                      isOffered: false,
                      isElective: false,
                      periodsPerWeek: 5,
                      assignedTeacherId: null,
                      originalState: false,
                    };

                    const classGroup = mapGradeLevelToClassGroup(cls.gradeLevel);
                    const inBlueprint = isSubjectInBlueprintForGroup(sub, classGroup);

                    const teacherName = teachers.find(
                      (t) => t.id === cell.assignedTeacherId
                    )?.displayName || teachers.find((t) => t.id === cell.assignedTeacherId)?.email;

                    return (
                      <td
                        key={key}
                        onClick={() => handleCellClick(cls, sub)}
                        className={`p-2.5 text-center border-r border-gray-100 dark:border-slate-800 cursor-pointer transition select-none relative ${
                          cell.isOffered
                            ? cell.isElective
                              ? "bg-amber-50/40 dark:bg-amber-950/20"
                              : "bg-blue-50/40 dark:bg-blue-950/20"
                            : "hover:bg-gray-100/60 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        {/* Hierarchy Guard: amber corner marker if not in board blueprint */}
                        {!inBlueprint && (
                          <div
                            title={`Not in default blueprint for ${classGroup}`}
                            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 z-10"
                          />
                        )}

                        {cell.isOffered ? (
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-2xs ${
                                cell.isElective
                                  ? "bg-amber-500 text-white"
                                  : "bg-primary text-white"
                              }`}
                            >
                              <Check className="w-3 h-3 stroke-[2.5]" />
                              <span>{cell.isElective ? "Elective" : "Core"}</span>
                            </span>

                            <div className="flex items-center justify-center gap-1 max-w-[110px] mt-0.5">
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                {teacherName ? teacherName.split(" ")[0] : `${cell.periodsPerWeek}p/w`}
                              </span>
                              {cell.sectionOverrides && cell.sectionOverrides.length > 0 && (
                                <span
                                  title={`Section Overrides: ${cell.sectionOverrides
                                    .map((o) => {
                                      const t = teachers.find((tc) => tc.id === o.teacherId);
                                      return `${o.sectionName || "Sec"}: ${t?.displayName || t?.email || "Assigned"}`;
                                    })
                                    .join(", ")}`}
                                  className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 shrink-0"
                                >
                                  Override ({cell.sectionOverrides.length})
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="py-2 flex items-center justify-center">
                            <span className="w-5 h-5 rounded-md border border-dashed border-gray-300 dark:border-slate-700 text-gray-300 dark:text-slate-600 flex items-center justify-center text-xs opacity-60 hover:opacity-100 hover:border-primary hover:text-primary transition">
                              +
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 5. Teachers & Mapping Slide-Over Drawer (Surface 4 Teachers Drawer) ── */}
      {activeDrawerCell && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fade-in">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setActiveDrawerCell(null)}
          />

          {/* Slide-over Panel */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-2xl z-10 animate-slide-in-left overflow-y-auto max-h-screen">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-gray-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-primary tracking-wider block">
                    Curriculum Mapping Details
                  </span>
                  <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">
                    {activeDrawerCell.subject.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Class: <strong className="text-gray-800 dark:text-gray-200 font-semibold">{activeDrawerCell.classroom.displayName}</strong> ({activeDrawerCell.classroom.gradeLevel})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrawerCell(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Fields */}
              <div className="space-y-4">
                {/* Offering Status Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40">
                  <div>
                    <label className="text-xs font-bold text-gray-900 dark:text-white block">
                      Curriculum Status
                    </label>
                    <span className="text-[11px] text-gray-500">
                      Include this subject in {activeDrawerCell.classroom.displayName}&apos;s curriculum
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDrawerCell({
                        ...activeDrawerCell,
                        cell: {
                          ...activeDrawerCell.cell,
                          isOffered: !activeDrawerCell.cell.isOffered,
                        },
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      activeDrawerCell.cell.isOffered
                        ? "bg-primary text-white"
                        : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {activeDrawerCell.cell.isOffered ? "Offered" : "Not Offered"}
                  </button>
                </div>

                {/* Elective Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40">
                  <div>
                    <label className="text-xs font-bold text-gray-900 dark:text-white block">
                      Elective Subject
                    </label>
                    <span className="text-[11px] text-gray-500">
                      Optional/elective choice chosen by students
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveDrawerCell({
                        ...activeDrawerCell,
                        cell: {
                          ...activeDrawerCell.cell,
                          isElective: !activeDrawerCell.cell.isElective,
                        },
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      activeDrawerCell.cell.isElective
                        ? "bg-amber-500 text-white"
                        : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {activeDrawerCell.cell.isElective ? "Elective" : "Core Subject"}
                  </button>
                </div>

                {/* Assigned Teacher Select */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                    Lead / Assigned Teacher
                  </label>
                  {teachers.length === 0 ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        No active teaching staff found
                      </div>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Teachers must be classified with teaching designations in HR to appear here.
                      </p>
                      <Link
                        href="/hr?tab=designations"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline mt-1"
                      >
                        Go to HR Designations <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ) : (
                    <select
                      value={activeDrawerCell.cell.assignedTeacherId || ""}
                      onChange={(e) =>
                        setActiveDrawerCell({
                          ...activeDrawerCell,
                          cell: {
                            ...activeDrawerCell.cell,
                            assignedTeacherId: e.target.value || null,
                          },
                        })
                      }
                      className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-primary/40 font-medium"
                    >
                      <option value="">None / Unassigned</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.displayName || t.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Periods Per Week Stepper */}
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                    Periods Per Week (1 – 12)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveDrawerCell({
                          ...activeDrawerCell,
                          cell: {
                            ...activeDrawerCell.cell,
                            periodsPerWeek: Math.max(1, activeDrawerCell.cell.periodsPerWeek - 1),
                          },
                        })
                      }
                      className="w-10 h-10 rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-white font-bold text-base flex items-center justify-center hover:bg-gray-100 transition cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-extrabold text-base text-gray-900 dark:text-white min-w-[32px] text-center">
                      {activeDrawerCell.cell.periodsPerWeek}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveDrawerCell({
                          ...activeDrawerCell,
                          cell: {
                            ...activeDrawerCell.cell,
                            periodsPerWeek: Math.min(12, activeDrawerCell.cell.periodsPerWeek + 1),
                          },
                        })
                      }
                      className="w-10 h-10 rounded-xl border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-white font-bold text-base flex items-center justify-center hover:bg-gray-100 transition cursor-pointer"
                    >
                      +
                    </button>
                    <span className="text-xs text-gray-400">Weekly timetable budget</span>
                  </div>
                </div>

                {/* Section-Level Teacher Overrides (OD2 / S14-F03) */}
                {activeDrawerCell.cell.isOffered && (
                  <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                          Section-Level Teacher Overrides
                        </label>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                          Assign specific faculty per section (overrides class lead)
                        </span>
                      </div>
                    </div>

                    {!activeDrawerCell.cell.classSubjectId ? (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                        <span className="font-bold">Newly Staged Subject:</span> Please click &quot;Save All&quot; in the matrix bar to persist this subject before setting per-section teacher overrides.
                      </div>
                    ) : !activeDrawerCell.classroom.sections || activeDrawerCell.classroom.sections.length === 0 ? (
                      <div className="p-3 bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-500">
                        No active sections found for this class. Add sections in the Classes tab.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeDrawerCell.classroom.sections.map((sec) => {
                          const currentOverride = (
                            activeDrawerCell.cell.sectionOverrides || []
                          ).find((o) => o.sectionId === sec.id);
                          const currentTeacherId = currentOverride ? currentOverride.teacherId : "";

                          return (
                            <div
                              key={sec.id}
                              className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-xs text-gray-900 dark:text-white block">
                                  Section {sec.name}
                                </span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 block">
                                  {currentOverride ? (
                                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                      Section Override
                                    </span>
                                  ) : (
                                    "Inherits Class Lead"
                                  )}
                                </span>
                              </div>

                              <div className="w-[180px] shrink-0">
                                <select
                                  value={currentTeacherId}
                                  disabled={isPending}
                                  onChange={async (e) => {
                                    const newTeacherId = e.target.value;
                                    const classSubjectId = activeDrawerCell.cell.classSubjectId!;

                                    // Optimistic update of local state
                                    const nextOverrides = (
                                      activeDrawerCell.cell.sectionOverrides || []
                                    ).filter((o) => o.sectionId !== sec.id);

                                    if (newTeacherId) {
                                      const tObj = teachers.find((t) => t.id === newTeacherId);
                                      nextOverrides.push({
                                        sectionId: sec.id,
                                        teacherId: newTeacherId,
                                        sectionName: sec.name,
                                        teacherEmail: tObj?.email,
                                      });
                                    }

                                    const updatedCell = {
                                      ...activeDrawerCell.cell,
                                      sectionOverrides: nextOverrides,
                                    };

                                    setActiveDrawerCell({
                                      ...activeDrawerCell,
                                      cell: updatedCell,
                                    });

                                    const key = `${activeDrawerCell.classId}:${activeDrawerCell.subjectId}`;
                                    setCellMap((prev) => new Map(prev).set(key, updatedCell));

                                    startTransition(async () => {
                                      try {
                                        await assignSectionTeacher({
                                          classSubjectId,
                                          sectionId: sec.id,
                                          teacherId: newTeacherId || null,
                                          effectiveFrom: new Date().toISOString().split("T")[0],
                                        });
                                        const teacherLabel =
                                          teachers.find((t) => t.id === newTeacherId)?.displayName ||
                                          teachers.find((t) => t.id === newTeacherId)?.email;
                                        toast.success(
                                          newTeacherId
                                            ? `Assigned Section ${sec.name} to ${teacherLabel}`
                                            : `Reverted Section ${sec.name} to class lead teacher`
                                        );
                                        router.refresh();
                                      } catch (err: any) {
                                        toast.error(err?.message || "Failed to assign section teacher");
                                      }
                                    });
                                  }}
                                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary font-medium"
                                >
                                  <option value="">Inherit Lead Teacher</option>
                                  {teachers.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.displayName || t.email}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveDrawerCell(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition min-h-[38px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveDrawerCell(activeDrawerCell.cell)}
                className="bg-primary hover:bg-primary/95 text-white px-5 py-2 rounded-xl text-xs font-bold transition shadow-sm min-h-[38px] cursor-pointer"
              >
                Stage in Matrix (Save All to persist)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. Bulk Action Bar (when rows/columns or multiple items selected) ─── */}
      <BulkActionBar
        selectedCount={selectedCellKeys.size}
        onClearSelection={() => setSelectedCellKeys(new Set())}
      >
        <button
          type="button"
          onClick={handleBulkAttachSelected}
          className="bg-primary hover:bg-primary/95 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Attach to Class
        </button>
        <button
          type="button"
          onClick={handleBulkDetachSelected}
          className="border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 px-4 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer"
        >
          Detach Selected
        </button>
      </BulkActionBar>
    </div>
  );
}
