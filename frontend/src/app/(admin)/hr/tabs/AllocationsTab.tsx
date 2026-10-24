"use client";

import React, { useState, useMemo, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  BookOpen,
  UserCheck,
  AlertTriangle,
  ChevronDown,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { AppModal } from "@/components/ui/AppModal";
import {
  hrAssignClassTeacher,
  hrAssignSubjectTeacher,
  getStaffAllocationOverview,
} from "../actions";
import { getTeachersList } from "@/app/(admin)/academics/actions";

interface AllocationsTabProps {
  teacherAllocSummary: Record<string, { classTeacherOf: string[]; subjectCount: number }>;
  isAuthorizedHR: boolean;
  schoolId: string;
}

type SubTab = "classTeachers" | "subjects";

interface ConflictInfo {
  type: "teacher_already_assigned" | "section_has_teacher";
  message: string;
  existingSectionId?: string;
  existingSectionName?: string;
  existingClassName?: string;
  existingTeacherId?: string;
}

interface PendingAssignment {
  type: "class_teacher";
  sectionId: string;
  sectionName: string;
  className: string;
  teacherId: string | null;
  teacherName: string;
  conflict?: ConflictInfo;
}

export function AllocationsTab({
  teacherAllocSummary,
  isAuthorizedHR,
  schoolId,
}: AllocationsTabProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [subTab, setSubTab] = useState<SubTab>("classTeachers");
  const [loadingState, setLoadingState] = useState<"idle" | "loading" | "loaded" | "error">("idle");

  // Allocation data loaded on mount
  const [sections, setSections] = useState<any[]>([]);
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [ctaRows, setCtaRows] = useState<any[]>([]);
  const [sstRows, setSstRows] = useState<any[]>([]);

  // Conflict confirmation modal
  const [conflictModal, setConflictModal] = useState<{
    open: boolean;
    conflict: ConflictInfo | null;
    pending: PendingAssignment | null;
  }>({ open: false, conflict: null, pending: null });

  const loadData = useCallback(async () => {
    setLoadingState("loading");
    try {
      const [allocRes, teacherRes] = await Promise.all([
        getStaffAllocationOverview(),
        getTeachersList(),
      ]);
      if (allocRes.success) {
        setSections(allocRes.sectionList || []);
        setSstRows(allocRes.sstRows || []);
        setCtaRows(allocRes.ctaRows || []);
      }
      setTeachers(teacherRes || []);
      setLoadingState("loaded");
    } catch {
      setLoadingState("error");
    }
  }, []);

  // Load on first render
  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Build section → class teacher map from live CTA rows
  const sectionCTMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const row of ctaRows) {
      map[row.sectionId] = row.teacherId;
    }
    return map;
  }, [ctaRows]);

  // Build classSubject → lead teacher map from SST rows
  const cstLeadMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const row of sstRows) {
      if (row.isPrimary && !map[row.classSubjectId]) {
        map[row.classSubjectId] = row.teacherId;
      }
    }
    return map;
  }, [sstRows]);

  // Derive unique class-subjects from SST rows (or from loaded data)
  const uniqueClassSubjects = useMemo(() => {
    const seen = new Set<string>();
    const result: any[] = [];
    for (const row of sstRows) {
      if (!seen.has(row.classSubjectId)) {
        seen.add(row.classSubjectId);
        result.push(row.classSubject || { id: row.classSubjectId });
      }
    }
    return result;
  }, [sstRows]);

  const teacherMap = useMemo(
    () => Object.fromEntries(teachers.map((t) => [t.id, t])),
    [teachers],
  );

  async function handleAssignClassTeacher(
    sectionId: string,
    sectionName: string,
    className: string,
    teacherId: string | null,
    forceTransfer = false,
  ) {
    if (!isAuthorizedHR) {
      toast.error("You don't have permission to modify allocations.");
      return;
    }
    const teacherName = teacherId ? (teacherMap[teacherId]?.name || teacherId) : "Unassigned";

    const res = await hrAssignClassTeacher({ sectionId, teacherId, forceTransfer });

    if (!res.success && res.conflict) {
      setConflictModal({
        open: true,
        conflict: res.conflict as ConflictInfo,
        pending: { type: "class_teacher", sectionId, sectionName, className, teacherId, teacherName },
      });
      return;
    }

    if (res.success) {
      // V2: Status-truth feedback contract
      toast.success(
        `Class teacher ${teacherName !== "Unassigned" ? `set to ${teacherName}` : "removed"} for ${className} ${sectionName}. Class Hub, Teacher PWA scope, and HR Directory will reflect the change on next load.`,
      );
      startTransition(() => {
        loadData();
        router.refresh();
      });
    } else {
      toast.error((res as any).error || "Failed to assign class teacher.");
    }
  }

  async function handleAssignSubjectTeacher(classSubjectId: string, teacherId: string | null) {
    if (!isAuthorizedHR) {
      toast.error("You don't have permission to modify allocations.");
      return;
    }
    const res = await hrAssignSubjectTeacher({ classSubjectId, teacherId });
    if (res.success) {
      const name = teacherId ? (teacherMap[teacherId]?.name || teacherId) : "Unassigned";
      toast.success(
        `Subject lead set to ${name}. Class Hub, Teacher PWA scope, and HR Directory will reflect the change on next load.`,
      );
      startTransition(() => {
        loadData();
        router.refresh();
      });
    } else {
      toast.error((res as any).error || "Failed to assign subject teacher.");
    }
  }

  if (loadingState === "loading" || loadingState === "idle") {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading allocation data…</span>
      </div>
    );
  }

  if (loadingState === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-slate-500">Failed to load allocation data.</p>
        <button onClick={loadData} className="text-sm text-indigo-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tab selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1">
        {(["classTeachers", "subjects"] as SubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`flex items-center gap-2 py-2.5 px-4 text-sm font-semibold border-b-2 transition-all ${
              subTab === t
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t === "classTeachers" ? (
              <><GraduationCap className="w-4 h-4" /> Class Teachers</>
            ) : (
              <><BookOpen className="w-4 h-4" /> Subject Allocations</>
            )}
          </button>
        ))}
      </div>

      {/* ── Class Teachers Sub-tab ──────────────────────────────────────────── */}
      {subTab === "classTeachers" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Assign homeroom class teachers to sections. One teacher per section per academic year.
          </p>

          {sections.length === 0 ? (
            /* TW-4: S14/S15 diagnostics empty state — never a bare empty control */
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <GraduationCap className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500">No sections configured yet.</p>
              <p className="text-xs text-slate-400">Set up classes in Academics before assigning class teachers.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Section</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Current Class Teacher</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sections.map((sec) => {
                    const currentTeacherId = sectionCTMap[sec.id] ?? null;
                    const currentTeacher = currentTeacherId ? teacherMap[currentTeacherId] : null;
                    return (
                      <tr key={sec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                          <div>{sec.class?.displayName || "—"}</div>
                          <div className="text-xs text-slate-500">{sec.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          {currentTeacher ? (
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-emerald-500" />
                              <span className="text-slate-700 dark:text-slate-300">{currentTeacher.name}</span>
                            </div>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" /> Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isAuthorizedHR ? (
                            <TeacherPicker
                              teachers={teachers}
                              value={currentTeacherId}
                              placeholder="Select class teacher…"
                              disabled={isPending}
                              onChange={(tid) =>
                                handleAssignClassTeacher(
                                  sec.id,
                                  sec.name,
                                  sec.class?.displayName || "",
                                  tid,
                                )
                              }
                            />
                          ) : (
                            <span className="text-xs text-slate-400">Read-only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Subject Allocations Sub-tab ─────────────────────────────────────── */}
      {subTab === "subjects" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Set the lead teacher for each class-subject. Section-level overrides are managed from Class Hub.
          </p>

          {uniqueClassSubjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500">No subject allocations yet.</p>
              <p className="text-xs text-slate-400">Assign subjects to classes in Academics first.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Subject</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Current Lead</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {uniqueClassSubjects.map((cs) => {
                    const currentTeacherId = cstLeadMap[cs.id] ?? null;
                    const currentTeacher = currentTeacherId ? teacherMap[currentTeacherId] : null;
                    return (
                      <tr key={cs.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                          {cs.subject?.name || cs.classSubject?.subject?.name || "Subject"}
                        </td>
                        <td className="px-4 py-3">
                          {currentTeacher ? (
                            <span className="text-slate-700 dark:text-slate-300">{currentTeacher.name}</span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isAuthorizedHR ? (
                            <TeacherPicker
                              teachers={teachers}
                              value={currentTeacherId}
                              placeholder="Select lead teacher…"
                              disabled={isPending}
                              onChange={(tid) => handleAssignSubjectTeacher(cs.id, tid)}
                            />
                          ) : (
                            <span className="text-xs text-slate-400">Read-only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Bidirectional Conflict Confirmation Modal (TW-3) ────────────────── */}
      <AppModal
        open={conflictModal.open}
        onClose={() => setConflictModal({ open: false, conflict: null, pending: null })}
        title="Allocation Conflict"
        size="sm"
      >
        {conflictModal.conflict && conflictModal.pending && (
          <div className="space-y-4">
            <div className="flex gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {conflictModal.conflict.message}
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Confirming will close the previous assignment and create a new one effective today.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConflictModal({ open: false, conflict: null, pending: null })}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const p = conflictModal.pending!;
                  setConflictModal({ open: false, conflict: null, pending: null });
                  if (p.type === "class_teacher") {
                    await handleAssignClassTeacher(
                      p.sectionId,
                      p.sectionName,
                      p.className,
                      p.teacherId,
                      true, // forceTransfer
                    );
                  }
                }}
                className="flex-1 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        )}
      </AppModal>
    </div>
  );
}

// ── Inline teacher picker — never a bare empty select (TW-4) ─────────────────
function TeacherPicker({
  teachers,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  teachers: any[];
  value: string | null;
  placeholder: string;
  disabled: boolean;
  onChange: (id: string | null) => void;
}) {
  const [localValue, setLocalValue] = useState(value || "");

  React.useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  if (teachers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
        <Info className="w-3.5 h-3.5" />
        No teaching staff found. Add staff in the Directory first.
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={localValue}
        disabled={disabled}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange(e.target.value || null);
        }}
        className="appearance-none pr-7 pl-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} {t.classificationConflict ? "(⚠ conflict)" : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 pointer-events-none" />
    </div>
  );
}
