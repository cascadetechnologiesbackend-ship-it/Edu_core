"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createExamSchedule,
  deleteExamSchedule,
  publishDatesheet,
  setMarkDistribution,
} from "../actions/scheduleActions";
import {
  Calendar,
  Clock,
  PlusCircle,
  Trash2,
  Share2,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Sparkles,
  MapPin,
  BookOpen,
} from "lucide-react";

interface ScheduleClientProps {
  exams: Array<{ id: string; name: string }>;
  selectedExamId: string;
  classes: Array<{ id: string; displayName: string }>;
  subjects: Array<{ id: string; name: string; code: string }>;
  components: Array<{ id: string; displayName: string }>;
  schedules: Array<{
    id: string;
    classId: string;
    subjectId: string;
    examDate: string;
    startTime: string;
    durationMinutes: number;
    maxMarks: string;
    passingMarks: string;
    roomNumber: string | null;
    datesheetPublishedAt: Date | string | null;
    class?: { displayName: string } | null;
    subject?: { name: string; code: string } | null;
  }>;
  distributions: Array<{
    id: string;
    classId: string;
    subjectId: string;
    componentId: string | null;
    maxMarks: string;
    passingMarks: string | null;
  }>;
}

export function ScheduleClient({
  exams,
  selectedExamId,
  classes,
  subjects,
  components,
  schedules,
  distributions,
}: ScheduleClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Filters
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("ALL");

  // Add Schedule Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formClassId, setFormClassId] = useState(classes[0]?.id || "");
  const [formSubjectId, setFormSubjectId] = useState(subjects[0]?.id || "");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("09:30 AM");
  const [formDuration, setFormDuration] = useState("180");
  const [formMaxMarks, setFormMaxMarks] = useState("100");
  const [formPassMarks, setFormPassMarks] = useState("33");
  const [formRoom, setFormRoom] = useState("");

  // Distribution Modal
  const [distributionModalData, setDistributionModalData] = useState<{
    classId: string;
    subjectId: string;
    className: string;
    subjectName: string;
  } | null>(null);
  const [distComponentId, setDistComponentId] = useState<string>("");
  const [distMax, setDistMax] = useState("70");
  const [distPass, setDistPass] = useState("23");

  const filteredSchedules = schedules.filter((s) => {
    if (selectedClassFilter !== "ALL" && s.classId !== selectedClassFilter) {
      return false;
    }
    return true;
  });

  const handleExamChange = (examId: string) => {
    router.push(`/exams/schedule?examId=${examId}`);
  };

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId || !formClassId || !formSubjectId || !formDate) {
      setMessage({ text: "Please fill out all mandatory schedule fields.", type: "error" });
      return;
    }

    startTransition(async () => {
      setMessage(null);
      const res = await createExamSchedule({
        examId: selectedExamId,
        classId: formClassId,
        subjectId: formSubjectId,
        examDate: formDate,
        startTime: formTime,
        durationMinutes: parseInt(formDuration, 10) || 180,
        maxMarks: parseFloat(formMaxMarks) || 100,
        passingMarks: parseFloat(formPassMarks) || 33,
        ...(formRoom.trim() ? { roomNumber: formRoom.trim() } : {}),
      });

      if (res.success) {
        setMessage({ text: "✓ Timetable schedule entry added!", type: "success" });
        setShowAddModal(false);
        router.refresh();
      } else {
        setMessage({ text: `✗ ${res.message || "Failed to create schedule"}`, type: "error" });
      }
    });
  };

  const handleDeleteSchedule = (id: string) => {
    if (!confirm("Are you sure you want to remove this examination schedule entry?")) return;

    startTransition(async () => {
      setMessage(null);
      const res = await deleteExamSchedule(id);
      if (res.success) {
        setMessage({ text: "✓ Schedule entry deleted successfully.", type: "success" });
        router.refresh();
      } else {
        setMessage({ text: "Failed to delete schedule entry.", type: "error" });
      }
    });
  };

  const handlePublishAll = () => {
    if (filteredSchedules.length === 0) return;
    if (!confirm("Publish datesheet to student & parent portals?")) return;

    startTransition(async () => {
      setMessage(null);
      const ids = filteredSchedules.map((s) => s.id);
      const res = await publishDatesheet(ids);
      if (res.success) {
        setMessage({ text: `✓ Published datesheet for ${ids.length} subjects to student and parent portals!`, type: "success" });
        router.refresh();
      } else {
        setMessage({ text: "Failed to publish datesheet.", type: "error" });
      }
    });
  };

  const handleSaveDistribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!distributionModalData || !selectedExamId) return;

    startTransition(async () => {
      setMessage(null);
      const res = await setMarkDistribution({
        examId: selectedExamId,
        classId: distributionModalData.classId,
        subjectId: distributionModalData.subjectId,
        componentId: distComponentId || null,
        maxMarks: parseFloat(distMax) || 0,
        passingMarks: parseFloat(distPass) || 0,
      });

      if (res.success) {
        setMessage({ text: "✓ Mark distribution component saved!", type: "success" });
        setDistributionModalData(null);
        router.refresh();
      } else {
        setMessage({ text: "Failed to save mark distribution.", type: "error" });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Select Examination
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => handleExamChange(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold dark:text-white"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Filter by Class
            </label>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium dark:text-white"
            >
              <option value="ALL">All Classes</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!selectedExamId}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Schedule</span>
          </button>

          <button
            onClick={handlePublishAll}
            disabled={isPending || filteredSchedules.length === 0}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            <span>Publish Datesheet</span>
          </button>
        </div>
      </div>

      {/* Message Banner */}
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

      {/* Timetable Schedule Cards & Table */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Subject Datesheets ({filteredSchedules.length})
            </h3>
            <p className="text-xs text-gray-500">
              Timetable, maximum marks, duration, and component breakdowns.
            </p>
          </div>
        </div>

        {filteredSchedules.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              No schedules created yet
            </h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Add individual subject examination dates, timing, and passing criteria to construct the official datesheet.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add First Schedule</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Class</th>
                  <th className="px-6 py-3.5">Subject</th>
                  <th className="px-6 py-3.5">Duration</th>
                  <th className="px-6 py-3.5">Marks (Max / Pass)</th>
                  <th className="px-6 py-3.5">Room</th>
                  <th className="px-6 py-3.5">Portal Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {filteredSchedules.map((item) => {
                  const dateStr = new Date(item.examDate).toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  const isPublished = Boolean(item.datesheetPublishedAt);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-500" />
                          <span>{dateStr}</span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{item.startTime}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-800 dark:text-slate-200">
                        {item.class?.displayName ?? "—"}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                        <span>{item.subject?.name ?? "—"}</span>
                        <span className="text-xs text-gray-400 ml-1.5">
                          ({item.subject?.code ?? "SUB"})
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-slate-300">
                        {item.durationMinutes} mins
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-slate-200">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {item.maxMarks}
                        </span>{" "}
                        / <span className="text-gray-500">{item.passingMarks}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-slate-300">
                        {item.roomNumber ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {item.roomNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Not Assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isPublished ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() =>
                              setDistributionModalData({
                                classId: item.classId,
                                subjectId: item.subjectId,
                                className: item.class?.displayName || "Class",
                                subjectName: item.subject?.name || "Subject",
                              })
                            }
                            className="p-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 transition-colors"
                            title="Configure Component Mark Breakdown"
                          >
                            <Sliders className="w-4 h-4 text-indigo-500" />
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(item.id)}
                            className="p-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 text-gray-400 transition-colors"
                            title="Delete Schedule Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ADD SCHEDULE ENTRY */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Add Exam Datesheet Schedule
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Class *
                  </label>
                  <select
                    value={formClassId}
                    onChange={(e) => setFormClassId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Subject *
                  </label>
                  <select
                    value={formSubjectId}
                    onChange={(e) => setFormSubjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Exam Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="09:30 AM"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Duration (mins)
                  </label>
                  <input
                    type="number"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Max Marks *
                  </label>
                  <input
                    type="number"
                    value={formMaxMarks}
                    onChange={(e) => setFormMaxMarks(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Passing Marks *
                  </label>
                  <input
                    type="number"
                    value={formPassMarks}
                    onChange={(e) => setFormPassMarks(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Room / Hall Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hall A or Room 204"
                  value={formRoom}
                  onChange={(e) => setFormRoom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2 rounded-xl transition-all"
                >
                  {isPending ? "Adding..." : "Add to Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COMPONENT BREAKDOWN */}
      {distributionModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900 dark:text-white">
                  Mark Distribution Breakdown
                </h3>
                <p className="text-xs text-gray-500">
                  {distributionModalData.className} • {distributionModalData.subjectName}
                </p>
              </div>
              <button
                onClick={() => setDistributionModalData(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveDistribution} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Sub-Component (Optional)
                </label>
                <select
                  value={distComponentId}
                  onChange={(e) => setDistComponentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                >
                  <option value="">-- Main Paper / Aggregate --</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Max Marks *
                  </label>
                  <input
                    type="number"
                    required
                    value={distMax}
                    onChange={(e) => setDistMax(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Passing Marks
                  </label>
                  <input
                    type="number"
                    value={distPass}
                    onChange={(e) => setDistPass(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setDistributionModalData(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-5 py-2 rounded-xl transition-all"
                >
                  Save Distribution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
