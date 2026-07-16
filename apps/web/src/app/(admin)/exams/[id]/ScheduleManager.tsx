"use client";

import { useState, useTransition } from "react";
import { createExamSchedule, deleteExamSchedule } from "../actions";

interface ClassItem {
  id: string;
  displayName: string;
}

interface SubjectItem {
  id: string;
  name: string;
}

interface ScheduleItem {
  id: string;
  examDate: Date | string;
  startTime: string;
  durationMinutes: number;
  roomNumber: string | null;
  maxMarks: string | number;
  passingMarks: string | number;
  class?: ClassItem | null;
  subject?: SubjectItem | null;
}

interface ScheduleManagerProps {
  examId: string;
  classes: ClassItem[];
  subjects: SubjectItem[];
  schedules: ScheduleItem[];
  isLocked: boolean;
}

export function ScheduleManager({
  examId,
  classes,
  subjects,
  schedules: initialSchedules,
  isLocked,
}: ScheduleManagerProps) {
  const [schedulesList, setSchedulesList] =
    useState<ScheduleItem[]>(initialSchedules);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const formEl = e.currentTarget;

    const classId = formData.get("classId") as string;
    const subjectId = formData.get("subjectId") as string;
    const examDate = formData.get("examDate") as string;
    const startTime = formData.get("startTime") as string;
    const durationMinutes =
      parseInt(formData.get("durationMinutes") as string) || 180;
    const roomNumber = formData.get("roomNumber") as string;
    const maxMarks = parseFloat(formData.get("maxMarks") as string) || 100;
    const passingMarks =
      parseFloat(formData.get("passingMarks") as string) || 33;

    startTransition(async () => {
      setMessage("");
      const res = await createExamSchedule({
        examId,
        classId,
        subjectId,
        examDate,
        startTime,
        durationMinutes,
        roomNumber,
        maxMarks,
        passingMarks,
      });

      if (res.success) {
        setMessage("✓ Exam scheduled successfully!");
        formEl.reset();
        window.location.reload();
      } else {
        setMessage(`✗ ${res.message}`);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule entry?"))
      return;

    startTransition(async () => {
      setMessage("");
      const res = await deleteExamSchedule(id, examId);
      if (res.success) {
        setMessage("✓ Schedule entry deleted successfully!");
        setSchedulesList((prev) => prev.filter((item) => item.id !== id));
      } else {
        setMessage(`✗ ${res.message}`);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Schedule Form */}
      {!isLocked ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 h-fit space-y-6">
          <div>
            <h3 className="font-semibold text-lg">Add to Schedule</h3>
            <p className="text-sm text-gray-500">
              Configure subject dates, timings, and rooms.
            </p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Class *
                </label>
                <select
                  name="classId"
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Subject *
                </label>
                <select
                  name="subjectId"
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Exam Date *
                </label>
                <input
                  type="date"
                  name="examDate"
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  name="startTime"
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Duration (Min) *
                </label>
                <input
                  type="number"
                  name="durationMinutes"
                  defaultValue={180}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Room Number
                </label>
                <input
                  name="roomNumber"
                  placeholder="e.g., Room 102"
                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Max Marks *
                </label>
                <input
                  type="number"
                  name="maxMarks"
                  defaultValue={100}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Passing Marks *
                </label>
                <input
                  type="number"
                  name="passingMarks"
                  defaultValue={33}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-transparent px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-md font-medium text-xs transition-colors disabled:opacity-50"
            >
              {isPending ? "Scheduling..." : "Add to Schedule"}
            </button>
          </form>

          {message && (
            <div
              className={`p-3 rounded-md text-xs ${
                message.startsWith("✓")
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm h-fit">
          🔒 Exam is locked. Schedules cannot be modified.
        </div>
      )}

      {/* Schedule Table */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Exam Timetable
          </h3>
        </div>

        {schedulesList.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            No schedule entries configured yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-slate-800 text-[10px] text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Class</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Room</th>
                  <th className="px-4 py-3 text-left">Max / Pass</th>
                  {!isLocked && (
                    <th className="px-4 py-3 text-right">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {schedulesList.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-medium">
                      {s.class?.displayName ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {s.subject?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(s.examDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {s.startTime} ({s.durationMinutes}m)
                    </td>
                    <td className="px-4 py-3">{s.roomNumber ?? "—"}</td>
                    <td className="px-4 py-3">
                      {s.maxMarks} / {s.passingMarks}
                    </td>
                    {!isLocked && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={isPending}
                          className="text-[10px] bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
