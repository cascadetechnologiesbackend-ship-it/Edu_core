"use client";

import { useState, useTransition } from "react";
import { saveMarkEntries } from "./actions";

interface StudentRow {
  id: string;
  admissionNumber: string;
  name: string;
}

interface SubjectCol {
  id: string;
  name: string;
  maxMarks: number;
}

interface ExistingMark {
  id?: string;
  studentId: string;
  subjectId: string;
  marksObtained: number | null;
  maxMarks: number;
  isAbsent: boolean;
  isMedicalExempt: boolean;
  grade: string | null;
  status: string;
}

interface MarkEntryGridProps {
  examId: string;
  classId: string;
  students: StudentRow[];
  subjects: SubjectCol[];
  existingMarks: ExistingMark[];
  isLocked: boolean;
}

type MarkKey = `${string}_${string}`;

interface MarkState {
  marksObtained: string;
  isAbsent: boolean;
  isMedicalExempt: boolean;
}

export function MarkEntryGrid({
  examId,
  students,
  subjects,
  existingMarks,
  isLocked,
}: Omit<MarkEntryGridProps, "classId">) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Build initial state from existing marks
  const initialState: Record<MarkKey, MarkState> = {};
  for (const m of existingMarks) {
    const key: MarkKey = `${m.studentId}_${m.subjectId}`;
    initialState[key] = {
      marksObtained: m.marksObtained?.toString() ?? "",
      isAbsent: m.isAbsent,
      isMedicalExempt: m.isMedicalExempt,
    };
  }

  const [marks, setMarks] = useState<Record<MarkKey, MarkState>>(initialState);

  const setMark = (studentId: string, subjectId: string, value: Partial<MarkState>) => {
    const key: MarkKey = `${studentId}_${subjectId}`;
    setMarks((prev) => ({
      ...prev,
      [key]: { ...{ marksObtained: "", isAbsent: false, isMedicalExempt: false }, ...prev[key], ...value },
    }));
  };

  const handleSave = () => {
    startTransition(async () => {
      setError("");
      setSuccess("");

      const entries = [];
      for (const student of students) {
        for (const subject of subjects) {
          const key: MarkKey = `${student.id}_${subject.id}`;
          const state = marks[key] ?? { marksObtained: "", isAbsent: false, isMedicalExempt: false };
          if (state.marksObtained !== "" || state.isAbsent || state.isMedicalExempt) {
            entries.push({
              studentId: student.id,
              subjectId: subject.id,
              marksObtained: state.isAbsent || state.isMedicalExempt ? null : parseFloat(state.marksObtained) || 0,
              maxMarks: subject.maxMarks,
              isAbsent: state.isAbsent,
              isMedicalExempt: state.isMedicalExempt,
            });
          }
        }
      }

      const res = await saveMarkEntries({ examId, entries });
      if (res.success) {
        setSuccess(`✓ Marks saved successfully (${entries.length} entries)`);
      } else {
        setError(res.message ?? "Failed to save marks");
      }
    });
  };

  if (students.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center text-gray-500">
        No students found in this class.
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center text-gray-500">
        No subjects configured for this class.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
      <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
        <h2 className="font-semibold">
          {students.length} students × {subjects.length} subjects
        </h2>
        {!isLocked && (
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save All Marks"}
          </button>
        )}
      </div>

      {success && (
        <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800 text-xs text-gray-500">
              <th className="sticky left-0 bg-gray-50 dark:bg-slate-800 px-4 py-3 text-left border-r border-gray-200 dark:border-slate-700 z-10 min-w-[180px]">
                Student
              </th>
              {subjects.map((s) => (
                <th key={s.id} className="px-3 py-3 text-center min-w-[120px]">
                  <div>{s.name}</div>
                  <div className="text-xs font-normal text-gray-400">(Max: {s.maxMarks})</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {students.map((student, sIdx) => (
              <tr key={student.id} className={sIdx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-gray-50/50 dark:bg-slate-800/30"}>
                <td className="sticky left-0 bg-inherit px-4 py-2 border-r border-gray-100 dark:border-slate-800 z-10">
                  <div className="font-medium text-gray-900 dark:text-white text-xs">{student.name}</div>
                  <div className="text-xs text-gray-400">{student.admissionNumber}</div>
                </td>
                {subjects.map((subject) => {
                  const key: MarkKey = `${student.id}_${subject.id}`;
                  const state = marks[key] ?? { marksObtained: "", isAbsent: false, isMedicalExempt: false };

                  return (
                    <td key={subject.id} className="px-2 py-1.5 text-center">
                      {state.isAbsent ? (
                        <span className="text-xs font-bold text-red-600">AB</span>
                      ) : state.isMedicalExempt ? (
                        <span className="text-xs font-bold text-blue-600">ME</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          max={subject.maxMarks}
                          step={0.5}
                          disabled={isLocked}
                          value={state.marksObtained}
                          onChange={(e) =>
                            setMark(student.id, subject.id, { marksObtained: e.target.value })
                          }
                          className="w-16 text-center rounded border border-gray-300 dark:border-slate-600 px-1 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="—"
                        />
                      )}
                      {!isLocked && (
                        <div className="flex justify-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setMark(student.id, subject.id, {
                                isAbsent: !state.isAbsent,
                                isMedicalExempt: false,
                                marksObtained: "",
                              })
                            }
                            className={`text-[9px] px-1 rounded transition-colors ${
                              state.isAbsent
                                ? "bg-red-200 text-red-800"
                                : "bg-gray-100 text-gray-500 hover:bg-red-100"
                            }`}
                          >
                            AB
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setMark(student.id, subject.id, {
                                isMedicalExempt: !state.isMedicalExempt,
                                isAbsent: false,
                                marksObtained: "",
                              })
                            }
                            className={`text-[9px] px-1 rounded transition-colors ${
                              state.isMedicalExempt
                                ? "bg-blue-200 text-blue-800"
                                : "bg-gray-100 text-gray-500 hover:bg-blue-100"
                            }`}
                          >
                            ME
                          </button>
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

      {!isLocked && (
        <div className="p-4 border-t border-gray-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save All Marks"}
          </button>
        </div>
      )}
    </div>
  );
}
