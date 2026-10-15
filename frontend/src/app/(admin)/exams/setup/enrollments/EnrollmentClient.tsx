"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  RefreshCw,
  Search,
  Users,
  AlertCircle,
  Upload,
  Download,
  Filter,
} from "lucide-react";
import {
  getEnrollmentMatrixAction,
  assignStudentElectivesAction,
  bulkAssignSectionElectiveAction,
  runMandatoryBackfillAction,
} from "../../actions/enrollmentActions";
import type { ClassEnrollmentMatrixResult } from "@/lib/enrollmentEngine";

interface ClassOption {
  id: string;
  gradeLevel: string;
}

interface SectionOption {
  id: string;
  classId: string;
  name: string;
}

interface Props {
  classes: ClassOption[];
  sections: SectionOption[];
}

export function EnrollmentClient({ classes, sections }: Props) {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [matrixData, setMatrixData] = useState<ClassEnrollmentMatrixResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Local state for elective toggles: studentId -> classSubjectId -> boolean
  const [enrollmentState, setEnrollmentState] = useState<Record<string, Record<string, boolean>>>({});
  const [isPending, startTransition] = useTransition();

  // Load matrix on class selection change
  useEffect(() => {
    if (!selectedClassId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    getEnrollmentMatrixAction(selectedClassId).then((res) => {
      if (!isMounted) return;
      setLoading(false);
      if (res.success && res.data) {
        setMatrixData(res.data);
        const initialMap: Record<string, Record<string, boolean>> = {};
        for (const stud of res.data.students) {
          initialMap[stud.studentId] = { ...stud.enrollments };
        }
        setEnrollmentState(initialMap);
      } else {
        setError(res.error || "Failed to load class matrix");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedClassId]);

  const handleToggleElective = (studentId: string, classSubjectId: string) => {
    setEnrollmentState((prev) => {
      const studentMap = { ...(prev[studentId] || {}) };
      studentMap[classSubjectId] = !studentMap[classSubjectId];
      return {
        ...prev,
        [studentId]: studentMap,
      };
    });
  };

  const handleSaveStudent = (studentId: string) => {
    if (!matrixData) return;
    const studentMap = enrollmentState[studentId] || {};
    const assignments = matrixData.subjects
      .filter((s) => s.isElective)
      .map((s) => ({
        classSubjectId: s.classSubjectId,
        isElectiveTaken: studentMap[s.classSubjectId] ?? false,
      }));

    startTransition(async () => {
      const res = await assignStudentElectivesAction(studentId, assignments);
      if (res.success) {
        setStatusMessage({ text: "Elective enrollment saved successfully.", type: "success" });
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        setStatusMessage({ text: res.error || "Failed to save enrollments", type: "error" });
      }
    });
  };

  const handleSaveAllChanges = () => {
    if (!matrixData) return;
    startTransition(async () => {
      let successCount = 0;
      for (const student of matrixData.students) {
        const studentMap = enrollmentState[student.studentId] || {};
        const assignments = matrixData.subjects
          .filter((s) => s.isElective)
          .map((s) => ({
            classSubjectId: s.classSubjectId,
            isElectiveTaken: studentMap[s.classSubjectId] ?? false,
          }));

        const res = await assignStudentElectivesAction(student.studentId, assignments);
        if (res.success) successCount++;
      }
      setStatusMessage({
        text: `Successfully saved elective enrollments for ${successCount} student(s).`,
        type: "success",
      });
      setTimeout(() => setStatusMessage(null), 4000);
    });
  };

  const handleRunBackfill = () => {
    startTransition(async () => {
      const res = await runMandatoryBackfillAction();
      if (res.success) {
        setStatusMessage({
          text: `Mandatory backfill completed. Inserted ${res.insertedCount ?? 0} missing non-elective records.`,
          type: "success",
        });
        // Reload current matrix
        if (selectedClassId) {
          const matrixRes = await getEnrollmentMatrixAction(selectedClassId);
          if (matrixRes.success && matrixRes.data) {
            setMatrixData(matrixRes.data);
          }
        }
      } else {
        setStatusMessage({ text: res.error || "Backfill failed", type: "error" });
      }
    });
  };

  const filteredStudents = matrixData?.students.filter((st) => {
    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (st.rollNumber && st.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  }) || [];

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb & Navigation ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/exams/manage"
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Student Subject Enrollments
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Assign and manage elective subject rosters for examinations, marks entry, and report cards.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunBackfill}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors shadow-sm disabled:opacity-50"
            title="Idempotently ensure all active students have rows for mandatory subjects"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
            Run Mandatory Backfill
          </button>

          <button
            onClick={handleSaveAllChanges}
            disabled={isPending || loading || filteredStudents.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Save All Changes
          </button>
        </div>
      </div>

      {/* ─── Status Notification Alert ─────────────────────────────────── */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-3 border shadow-sm transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* ─── Filters & Class Selector ──────────────────────────────────── */}
      <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Select Class
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.gradeLevel}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Search Student
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Name, Adm # or Roll #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none w-64"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span>Mandatory Subject (Core)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
            <span>Enrolled Elective</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
            <span>Unassigned Elective</span>
          </div>
        </div>
      </div>

      {/* ─── Enrollment Matrix Grid ────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-sm">Loading enrollment matrix...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500 space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : !matrixData || matrixData.students.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-medium">No active students found in this class.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                  <th className="p-3 font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-gray-800/60 z-10 w-48">
                    Student Info
                  </th>
                  {matrixData.subjects.map((sub) => (
                    <th
                      key={sub.classSubjectId}
                      className="p-3 font-semibold text-gray-700 dark:text-gray-300 text-center min-w-[140px]"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {sub.code}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                          {sub.name}
                        </span>
                        <span
                          className={`mt-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            sub.isElective
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          }`}
                        >
                          {sub.isElective ? "Elective" : "Mandatory"}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="p-3 font-semibold text-gray-700 dark:text-gray-300 text-right w-24">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredStudents.map((st) => {
                  const studentMap = enrollmentState[st.studentId] || {};
                  return (
                    <tr
                      key={st.studentId}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      {/* Student Info */}
                      <td className="p-3 sticky left-0 bg-white dark:bg-gray-900 z-10 border-r border-gray-100 dark:border-gray-800">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {st.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Adm: {st.admissionNumber} {st.rollNumber ? `• Roll: ${st.rollNumber}` : ""}
                        </div>
                      </td>

                      {/* Subject Cells */}
                      {matrixData.subjects.map((sub) => {
                        const isEnrolled = studentMap[sub.classSubjectId] ?? !sub.isElective;
                        return (
                          <td
                            key={sub.classSubjectId}
                            className="p-3 text-center align-middle"
                          >
                            {!sub.isElective ? (
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                <Check className="w-4 h-4" />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleElective(st.studentId, sub.classSubjectId)
                                }
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                  isEnrolled
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
                                    : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300"
                                }`}
                              >
                                {isEnrolled ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    Enrolled
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Unassigned
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Action */}
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSaveStudent(st.studentId)}
                          disabled={isPending}
                          className="px-2.5 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
