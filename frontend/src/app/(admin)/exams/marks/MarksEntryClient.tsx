"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Lock,
  Unlock,
  Save,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  Filter,
  CheckSquare,
  Square,
  ShieldAlert,
  MoreVertical,
  RotateCcw,
  Download,
} from "lucide-react";
import {
  saveMarkEntries,
  lockMarks,
  unlockMarks,
} from "../actions/marksActions";

export interface ComponentCol {
  id: string;
  name: string;
  code?: string;
  maxMarks: number;
  passingMarks: number;
}

export interface StudentRow {
  id: string;
  rollNumber: string | null;
  admissionNumber: string;
  name: string;
  marks: Record<string, string>; // componentId (or "_total") -> string value
  isAbsent: boolean;
  isMedicalExempt: boolean;
  remarks: string;
}

interface MarksEntryClientProps {
  exams: Array<{ id: string; name: string }>;
  selectedExamId: string;
  classes: Array<{ id: string; displayName: string }>;
  selectedClassId: string;
  subjects: Array<{ id: string; name: string; code: string }>;
  selectedSubjectId: string;
  lockInfo: {
    isLocked: boolean;
    lockedByName: string | null;
    lockedAt: string | null;
  };
  components: ComponentCol[];
  defaultMaxMarks: number;
  defaultPassingMarks: number;
  initialStudents: StudentRow[];
  canLockUnlock: boolean;
}

export function MarksEntryClient({
  exams,
  selectedExamId,
  classes,
  selectedClassId,
  subjects,
  selectedSubjectId,
  lockInfo,
  components,
  defaultMaxMarks,
  defaultPassingMarks,
  initialStudents,
  canLockUnlock,
}: MarksEntryClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [students, setStudents] = useState<StudentRow[]>(initialStudents);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Unsaved changes & overflow state (UX-R10 / UX-R20)
  const [isDirty, setIsDirty] = useState(false);
  const [showSecondaryMenu, setShowSecondaryMenu] = useState(false);

  // Unlock Modal
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  const hasComponents = components.length > 0;
  const isLocked = lockInfo.isLocked;

  // Filter students by search
  const filteredStudents = students.filter((st) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      st.name.toLowerCase().includes(q) ||
      st.admissionNumber.toLowerCase().includes(q) ||
      (st.rollNumber && st.rollNumber.toLowerCase().includes(q))
    );
  });

  const handleExportCsv = () => {
    const headers = ["Roll", "Admission No", "Student Name"];
    if (hasComponents) {
      components.forEach((c) => headers.push(`${c.name} (Max ${c.maxMarks})`));
    } else {
      headers.push(`Marks (Max ${defaultMaxMarks})`);
    }
    headers.push("Total", "Status");

    const rows = filteredStudents.map((st) => {
      const row = [st.rollNumber || "", st.admissionNumber, `"${st.name.replace(/"/g, '""')}"`];
      if (hasComponents) {
        components.forEach((c) => row.push(st.marks[c.id] || ""));
      } else {
        row.push(st.marks["_total"] || "");
      }
      row.push(getStudentTotal(st));
      row.push(st.isAbsent ? "ABSENT" : st.isMedicalExempt ? "EXEMPT" : "PRESENT");
      return row.join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Marks_${selectedExamId}_${selectedClassId}_${selectedSubjectId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetChanges = () => {
    if (confirm("Discard all unsaved edits and restore original values?")) {
      setStudents(initialStudents);
      setIsDirty(false);
      setShowSecondaryMenu(false);
    }
  };

  const handleExamChange = (examId: string) => {
    router.push(`/exams/marks?examId=${examId}&classId=${selectedClassId}&subjectId=${selectedSubjectId}`);
  };

  const handleClassChange = (classId: string) => {
    router.push(`/exams/marks?examId=${selectedExamId}&classId=${classId}`);
  };

  const handleSubjectChange = (subjectId: string) => {
    router.push(`/exams/marks?examId=${selectedExamId}&classId=${selectedClassId}&subjectId=${subjectId}`);
  };

  const handleMarkChange = (
    studentId: string,
    key: string,
    val: string,
    maxAllowed: number,
  ) => {
    if (isLocked) return;
    const num = parseFloat(val);
    if (!isNaN(num)) {
      if (num < 0 || num > maxAllowed) return; // Disallow out of bounds
    }

    setIsDirty(true);
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          marks: {
            ...s.marks,
            [key]: val,
          },
        };
      }),
    );
  };

  const toggleAbsent = (studentId: string) => {
    if (isLocked) return;
    setIsDirty(true);
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const nextAbsent = !s.isAbsent;
        return {
          ...s,
          isAbsent: nextAbsent,
          isMedicalExempt: nextAbsent ? false : s.isMedicalExempt,
        };
      }),
    );
  };

  const toggleMedicalExempt = (studentId: string) => {
    if (isLocked) return;
    setIsDirty(true);
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const nextExempt = !s.isMedicalExempt;
        return {
          ...s,
          isMedicalExempt: nextExempt,
          isAbsent: nextExempt ? false : s.isAbsent,
        };
      }),
    );
  };

  const handleSaveMarks = () => {
    if (isLocked) return;
    setFeedback(null);

    startTransition(async () => {
      // Build entries array
      const entries: Array<{
        studentId: string;
        marksObtained: number | null;
        componentId?: string | null;
        isAbsent?: boolean;
        isMedicalExempt?: boolean;
        remarks?: string | null;
      }> = [];

      for (const st of students) {
        if (st.isAbsent || st.isMedicalExempt) {
          if (hasComponents) {
            for (const c of components) {
              entries.push({
                studentId: st.id,
                marksObtained: null,
                componentId: c.id,
                isAbsent: st.isAbsent,
                isMedicalExempt: st.isMedicalExempt,
                ...(st.remarks ? { remarks: st.remarks } : {}),
              });
            }
          } else {
            entries.push({
              studentId: st.id,
              marksObtained: null,
              componentId: null,
              isAbsent: st.isAbsent,
              isMedicalExempt: st.isMedicalExempt,
              ...(st.remarks ? { remarks: st.remarks } : {}),
            });
          }
        } else {
          if (hasComponents) {
            for (const c of components) {
              const strVal = st.marks[c.id];
              const val = strVal !== undefined && strVal !== "" ? parseFloat(strVal) : null;
              entries.push({
                studentId: st.id,
                marksObtained: val,
                componentId: c.id,
                isAbsent: false,
                isMedicalExempt: false,
                ...(st.remarks ? { remarks: st.remarks } : {}),
              });
            }
          } else {
            const strVal = st.marks["_total"];
            const val = strVal !== undefined && strVal !== "" ? parseFloat(strVal) : null;
            entries.push({
              studentId: st.id,
              marksObtained: val,
              componentId: null,
              isAbsent: false,
              isMedicalExempt: false,
              ...(st.remarks ? { remarks: st.remarks } : {}),
            });
          }
        }
      }

      const res = await saveMarkEntries({
        examId: selectedExamId,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        entries,
      });

      if (res.success) {
        setIsDirty(false);
        setFeedback({
          text: `✓ Saved marks for ${students.length} student(s) successfully!`,
          type: "success",
        });
        router.refresh();
      } else {
        setFeedback({
          text: res.message || "Failed to save marks.",
          type: "error",
        });
      }
    });
  };

  const handleLockToggle = () => {
    if (!canLockUnlock) return;

    if (isLocked) {
      // Need unlock reason modal
      setUnlockReason("");
      setShowUnlockModal(true);
    } else {
      // Lock directly
      if (!confirm("Are you sure you want to lock marks for this subject? Once locked, teachers and staff cannot modify marks until unlocked by an administrator.")) {
        return;
      }
      startTransition(async () => {
        setFeedback(null);
        const res = await lockMarks({
          examId: selectedExamId,
          classId: selectedClassId,
          subjectId: selectedSubjectId,
        });
        if (res.success) {
          setFeedback({
            text: "✓ Marks successfully LOCKED and finalized.",
            type: "success",
          });
          router.refresh();
        } else {
          setFeedback({ text: "Failed to lock marks.", type: "error" });
        }
      });
    }
  };

  const handleConfirmUnlock = () => {
    if (!unlockReason.trim()) return;

    startTransition(async () => {
      setFeedback(null);
      const res = await unlockMarks({
        examId: selectedExamId,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        reason: unlockReason.trim(),
      });
      setShowUnlockModal(false);
      if (res.success) {
        setFeedback({
          text: "✓ Marks UNLOCKED. Updates are now permitted.",
          type: "success",
        });
        router.refresh();
      } else {
        setFeedback({ text: "Failed to unlock marks.", type: "error" });
      }
    });
  };

  // Compute student total marks
  const getStudentTotal = (st: StudentRow) => {
    if (st.isAbsent) return "ABSENT";
    if (st.isMedicalExempt) return "EXEMPT";

    if (!hasComponents) {
      const v = st.marks["_total"];
      return v !== undefined && v !== "" ? parseFloat(v).toFixed(1) : "—";
    }

    let sum = 0;
    let anyEntered = false;
    for (const c of components) {
      const v = st.marks[c.id];
      if (v !== undefined && v !== "") {
        sum += parseFloat(v);
        anyEntered = true;
      }
    }
    return anyEntered ? sum.toFixed(1) : "—";
  };

  const totalMaxMarks = hasComponents
    ? components.reduce((acc, c) => acc + c.maxMarks, 0)
    : defaultMaxMarks;

  const totalPassingMarks = hasComponents
    ? components.reduce((acc, c) => acc + c.passingMarks, 0)
    : defaultPassingMarks;

  return (
    <div className="space-y-6">
      {/* ─── 1. Filter Bar ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-card p-4 md:p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Exam Selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Examination
            </label>
            <select
              data-ux-id="select_exam_filter"
              data-ux-label="Exam Filter Select"
              data-ux-action="filter_change"
              value={selectedExamId}
              onChange={(e) => handleExamChange(e.target.value)}
              className="w-full bg-muted/40 border border-border/40 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-semantic-interactive font-medium"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id} className="bg-card text-foreground">
                  {ex.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class Selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Class / Standard
            </label>
            <select
              data-ux-id="select_class_filter"
              data-ux-label="Class Filter Select"
              data-ux-action="filter_change"
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="w-full bg-muted/40 border border-border/40 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-semantic-interactive font-medium"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id} className="bg-card text-foreground">
                  {cls.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Subject
            </label>
            <select
              data-ux-id="select_subject_filter"
              data-ux-label="Subject Filter Select"
              data-ux-action="filter_change"
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full bg-muted/40 border border-border/40 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-semantic-interactive font-medium"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id} className="bg-card text-foreground">
                  {sub.name} ({sub.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lock status banner & control */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
          <div className="flex items-center gap-2.5">
            {isLocked ? (
              <span className="p-1.5 rounded-lg bg-semantic-money-owed/12 border border-semantic-money-owed/25 text-semantic-money-owed flex items-center gap-1.5 text-xs font-bold">
                <Lock className="w-4 h-4" />
                LOCKED
              </span>
            ) : (
              <span className="p-1.5 rounded-lg bg-semantic-money-in/12 border border-semantic-money-in/25 text-semantic-money-in flex items-center gap-1.5 text-xs font-bold">
                <Unlock className="w-4 h-4" />
                OPEN FOR GRADING
              </span>
            )}

            <p className="text-xs text-muted-foreground">
              {isLocked
                ? `Marks finalized${lockInfo.lockedByName ? ` by ${lockInfo.lockedByName}` : ""}${lockInfo.lockedAt ? ` on ${new Date(lockInfo.lockedAt).toLocaleDateString()}` : ""}. Edits are restricted.`
                : "Marks entries can be recorded and updated. Remember to lock when evaluation completes."}
            </p>
          </div>

          {canLockUnlock && (
            <button
              type="button"
              data-ux-id={isLocked ? "btn_unlock_marks" : "btn_lock_marks"}
              data-ux-label={isLocked ? "Unlock Marks Request" : "Lock Marks Verification"}
              data-ux-action="click"
              disabled={isPending}
              onClick={handleLockToggle}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                isLocked
                  ? "bg-semantic-attention/12 hover:bg-semantic-attention/20 text-semantic-attention border border-semantic-attention/25 cursor-pointer"
                  : "bg-semantic-money-owed/12 hover:bg-semantic-money-owed/20 text-semantic-money-owed border border-semantic-money-owed/25 cursor-pointer"
              }`}
            >
              {isLocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Unlock Marks</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lock &amp; Finalize</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ─── Feedback Alert ────────────────────────────────────────────────────── */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-semantic-money-in/12 border border-semantic-money-in/25 text-semantic-money-in"
              : "bg-semantic-money-owed/12 border border-semantic-money-owed/25 text-semantic-money-owed"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-semantic-money-in" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-semantic-money-owed" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ─── 2. Search & Toolbar ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/40">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search student or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted/40 border border-border/40 rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-interactive"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="text-xs text-muted-foreground">
            Total Max Marks: <span className="font-bold text-foreground font-mono tabular-nums">{totalMaxMarks}</span> | Passing: <span className="font-bold text-semantic-money-in font-mono tabular-nums">{totalPassingMarks}</span>
          </div>

          <button
            type="button"
            data-ux-id="btn_save_marks_draft"
            data-ux-label="Save Marks Draft"
            data-ux-action="click"
            disabled={isPending || isLocked || filteredStudents.length === 0}
            onClick={handleSaveMarks}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition ${
              isLocked
                ? "bg-muted text-muted-foreground cursor-not-allowed border border-border/40"
                : "bg-semantic-interactive hover:bg-semantic-interactive/90 text-white cursor-pointer"
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{isPending ? "Saving..." : "Save Marks"}</span>
          </button>
        </div>
      </div>

      {/* ─── 3. Marks Matrix Table ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-3 px-4 w-16">Roll</th>
                <th className="py-3 px-4 w-28">Admission No</th>
                <th className="py-3 px-4 min-w-[180px]">Student Name</th>

                {hasComponents ? (
                  components.map((c) => (
                    <th key={c.id} className="py-3 px-4 text-center min-w-[110px]">
                      <div>{c.name}</div>
                      <div className="text-[9px] text-muted-foreground/75 font-normal">
                        Max {c.maxMarks} (Pass {c.passingMarks})
                      </div>
                    </th>
                  ))
                ) : (
                  <th className="py-3 px-4 text-center min-w-[120px]">
                    <div>Marks</div>
                    <div className="text-[9px] text-muted-foreground/75 font-normal">
                      Max {defaultMaxMarks} (Pass {defaultPassingMarks})
                    </div>
                  </th>
                )}

                <th className="py-3 px-4 text-center w-24">Total</th>
                <th className="py-3 px-4 text-center w-24">Exempt</th>
                <th className="py-3 px-4 text-center w-24">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={hasComponents ? 6 + components.length : 7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No students found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => {
                  const total = getStudentTotal(st);
                  const isNumTotal = !isNaN(parseFloat(total));
                  const isPass = isNumTotal && parseFloat(total) >= totalPassingMarks;

                  return (
                    <tr
                      key={st.id}
                      className={`hover:bg-muted/30 transition ${
                        st.isAbsent
                          ? "bg-semantic-money-owed/5 text-muted-foreground"
                          : st.isMedicalExempt
                          ? "bg-semantic-attention/5 text-muted-foreground"
                          : ""
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                        {st.rollNumber || "—"}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-muted-foreground">
                        {st.admissionNumber}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-foreground">
                        {st.name}
                      </td>

                      {/* Component score inputs */}
                      {hasComponents ? (
                        components.map((c) => {
                          const val = st.marks[c.id] ?? "";
                          return (
                            <td key={c.id} className="py-2 px-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={c.maxMarks}
                                step="any"
                                disabled={isLocked || st.isAbsent || st.isMedicalExempt}
                                value={val}
                                onChange={(e) =>
                                  handleMarkChange(st.id, c.id, e.target.value, c.maxMarks)
                                }
                                placeholder="—"
                                className={`w-20 text-center rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none transition ${
                                  st.isAbsent || st.isMedicalExempt || isLocked
                                    ? "bg-muted/30 text-muted-foreground border border-border/40 cursor-not-allowed"
                                    : "bg-muted/40 text-foreground border border-border/40 focus:border-semantic-interactive"
                                }`}
                              />
                            </td>
                          );
                        })
                      ) : (
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={defaultMaxMarks}
                            step="any"
                            disabled={isLocked || st.isAbsent || st.isMedicalExempt}
                            value={st.marks["_total"] ?? ""}
                            onChange={(e) =>
                              handleMarkChange(st.id, "_total", e.target.value, defaultMaxMarks)
                            }
                            placeholder="—"
                            className={`w-24 text-center rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none transition ${
                              st.isAbsent || st.isMedicalExempt || isLocked
                                ? "bg-muted/30 text-muted-foreground border border-border/40 cursor-not-allowed"
                                : "bg-muted/40 text-foreground border border-border/40 focus:border-semantic-interactive"
                            }`}
                          />
                        </td>
                      )}

                      {/* Total */}
                      <td className="py-2.5 px-4 text-center font-bold">
                        {st.isAbsent ? (
                          <span className="text-semantic-money-owed text-[11px] font-black">
                            ABSENT
                          </span>
                        ) : st.isMedicalExempt ? (
                          <span className="text-semantic-attention text-[11px] font-black">
                            EXEMPT
                          </span>
                        ) : (
                          <span
                            className={
                              isPass ? "text-semantic-money-in" : isNumTotal ? "text-semantic-money-owed" : "text-muted-foreground"
                            }
                          >
                            {total}
                          </span>
                        )}
                      </td>

                      {/* Medical Exempt Checkbox */}
                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => toggleMedicalExempt(st.id)}
                          className={`p-1 rounded transition ${
                            isLocked
                              ? "cursor-not-allowed text-muted-foreground/40"
                              : "cursor-pointer text-muted-foreground hover:text-semantic-attention"
                          }`}
                        >
                          {st.isMedicalExempt ? (
                            <CheckSquare className="w-4 h-4 text-semantic-attention" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Absent Checkbox */}
                      <td className="py-2.5 px-4 text-center">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => toggleAbsent(st.id)}
                          className={`p-1 rounded transition ${
                            isLocked
                              ? "cursor-not-allowed text-muted-foreground/40"
                              : "cursor-pointer text-muted-foreground hover:text-semantic-money-owed"
                          }`}
                        >
                          {st.isAbsent ? (
                            <CheckSquare className="w-4 h-4 text-semantic-money-owed" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 4. Adaptive Sticky Action Dock (UX-R20 Thumb Zone & Scroll Persistence) ─── */}
      <div className="sticky bottom-4 z-30 rounded-2xl border border-border/40 bg-card/95 backdrop-blur-md p-3.5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
        {/* Left: Status & Row counts */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isDirty ? "bg-semantic-attention animate-pulse" : "bg-semantic-money-in"
              }`}
            />
            <span className="text-xs font-semibold text-foreground">
              {isDirty ? "Unsaved Edits Pending" : "All Entries Saved"}
            </span>
          </div>

          <span className="hidden sm:inline text-xs text-muted-foreground/60">•</span>

          <span className="text-xs text-muted-foreground">
            <strong className="text-foreground">{filteredStudents.length}</strong> students in sheet
          </span>
        </div>

        {/* Right: Secondary Actions Overflow Menu & Primary Save Button */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Secondary Actions Overflow (UX-R10) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSecondaryMenu(!showSecondaryMenu)}
              className="p-2.5 rounded-xl bg-muted border border-border/40 text-foreground hover:bg-muted/80 transition text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              title="Secondary Actions & Export"
            >
              <MoreVertical className="w-4 h-4" />
              <span className="hidden sm:inline">Options</span>
            </button>

            {showSecondaryMenu && (
              <div className="absolute right-0 bottom-full mb-2 w-56 rounded-2xl border border-border/40 bg-card/95 backdrop-blur-md shadow-2xl p-2 z-40 space-y-1">
                <button
                  type="button"
                  data-ux-id="btn_export_marks_csv"
                  data-ux-label="Export Marks CSV"
                  data-ux-action="export"
                  onClick={() => {
                    handleExportCsv();
                    setShowSecondaryMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-muted flex items-center gap-2 cursor-pointer transition"
                >
                  <Download className="w-4 h-4 text-semantic-interactive" />
                  <span>Export Marks to CSV</span>
                </button>

                {isDirty && (
                  <button
                    type="button"
                    onClick={handleResetChanges}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium text-semantic-attention hover:bg-semantic-attention/10 flex items-center gap-2 cursor-pointer transition"
                  >
                    <RotateCcw className="w-4 h-4 text-semantic-attention" />
                    <span>Discard Unsaved Edits</span>
                  </button>
                )}

                {canLockUnlock && (
                  <button
                    type="button"
                    data-ux-id={isLocked ? "btn_unlock_marks" : "btn_lock_marks"}
                    data-ux-label={isLocked ? "Unlock Marks Request" : "Lock Marks Verification"}
                    data-ux-action="click"
                    disabled={isPending}
                    onClick={() => {
                      setShowSecondaryMenu(false);
                      handleLockToggle();
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer transition ${
                      isLocked
                        ? "text-semantic-attention hover:bg-semantic-attention/10"
                        : "text-semantic-money-owed hover:bg-semantic-money-owed/10"
                    }`}
                  >
                    {isLocked ? (
                      <>
                        <Unlock className="w-4 h-4 text-semantic-attention" />
                        <span>Unlock Marks Entry</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-semantic-money-owed" />
                        <span>Lock & Finalize Subject</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Primary Save Action (UX-R20 Thumb Zone: prominent, 42px+ touch target) */}
          <button
            type="button"
            data-ux-id="btn_save_marks_draft"
            data-ux-label="Save Marks Draft"
            data-ux-action="click"
            disabled={isPending || isLocked || filteredStudents.length === 0}
            onClick={handleSaveMarks}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition min-h-[42px] cursor-pointer ${
              isLocked
                ? "bg-muted text-muted-foreground cursor-not-allowed border border-border/40 shadow-none"
                : isDirty
                ? "bg-semantic-interactive hover:bg-semantic-interactive/90 text-white active:scale-95 animate-pulse"
                : "bg-semantic-interactive hover:bg-semantic-interactive/90 text-white active:scale-95"
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{isPending ? "Saving..." : isDirty ? "Save Changes" : "Save Marks"}</span>
          </button>
        </div>
      </div>

      {/* ─── 5. Unlock Modal ──────────────────────────────────────────────────── */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-md bg-card border border-border/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-semantic-attention/10 border border-semantic-attention/20 text-semantic-attention">
                <Unlock className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-foreground text-base">
                  Unlock Marks Entry
                </h3>
                <p className="text-xs text-muted-foreground">
                  State a mandatory reason for reopening grade submissions.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Revision / Reopening Reason *
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Recalculation request approved by Principal for Term exam."
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                className="w-full bg-muted/40 border border-border/40 rounded-xl p-3 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-semantic-attention"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUnlockModal(false)}
                className="px-4 py-2 rounded-xl border border-border/40 text-muted-foreground hover:text-foreground text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!unlockReason.trim() || isPending}
                onClick={handleConfirmUnlock}
                className="px-4 py-2 rounded-xl bg-semantic-attention hover:bg-semantic-attention/90 text-white text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                Confirm Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
