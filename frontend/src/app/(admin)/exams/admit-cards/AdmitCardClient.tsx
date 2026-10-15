"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveAdmitCardSettings,
  toggleAdmitCardHold,
} from "../actions/admitCardActions";
import {
  FileCheck2,
  Calendar,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  FileText,
  SlidersHorizontal,
  DollarSign,
  Download,
} from "lucide-react";

interface AdmitCardClientProps {
  exams: Array<{ id: string; name: string }>;
  selectedExamId: string;
  classes: Array<{ id: string; displayName: string }>;
  settings: {
    id?: string;
    isReleased: boolean;
    availableFrom: string | null;
    availableUntil: string | null;
    instructions: string | null;
    examCentre: string | null;
    reportingTime: string | null;
    feeLockMode: "OFF" | "SOFT" | "HARD";
    feeLockThresholdAmount: string;
  } | null;
  students: Array<{
    id: string;
    rollNumber: string | null;
    admissionNumber: string;
    name: string;
    classId: string | null;
    className: string;
    dueAmount: number;
    isHeld: boolean;
    holdReason: string | null;
  }>;
}

export function AdmitCardClient({
  exams,
  selectedExamId,
  classes,
  settings,
  students,
}: AdmitCardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Class Filter
  const [selectedClassFilter, setSelectedClassFilter] = useState("ALL");

  // Settings form
  const [availFrom, setAvailFrom] = useState(
    settings?.availableFrom ? settings.availableFrom.split("T")[0] : "",
  );
  const [availUntil, setAvailUntil] = useState(
    settings?.availableUntil ? settings.availableUntil.split("T")[0] : "",
  );
  const [feeMode, setFeeMode] = useState<"OFF" | "SOFT" | "HARD">(
    settings?.feeLockMode || "OFF",
  );
  const [threshold, setThreshold] = useState(
    settings?.feeLockThresholdAmount ? parseFloat(settings.feeLockThresholdAmount) : 0,
  );
  const [examCentre, setExamCentre] = useState(settings?.examCentre || "");
  const [reportingTime, setReportingTime] = useState(settings?.reportingTime || "09:00 AM");
  const [instructions, setInstructions] = useState(
    settings?.instructions || "Candidates must bring this admit card and valid school ID card. Electronic devices prohibited.",
  );

  // Hold reason modal
  const [holdModalStudent, setHoldModalStudent] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [holdReasonInput, setHoldReasonInput] = useState("");

  const filteredStudents = students.filter((st) => {
    if (selectedClassFilter !== "ALL" && st.classId !== selectedClassFilter) {
      return false;
    }
    return true;
  });

  const handleExamChange = (examId: string) => {
    router.push(`/exams/admit-cards?examId=${examId}`);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId || !availFrom || !availUntil) {
      setMessage({ text: "Please enter release availability start and end dates.", type: "error" });
      return;
    }

    startTransition(async () => {
      setMessage(null);
      const res = await saveAdmitCardSettings({
        examId: selectedExamId,
        downloadStartDate: availFrom,
        downloadEndDate: availUntil,
        feeLockMode: feeMode,
        feeThresholdAmount: threshold,
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        ...(examCentre.trim() ? { examCentre: examCentre.trim() } : {}),
        ...(reportingTime.trim() ? { reportingTime: reportingTime.trim() } : {}),
      });

      if (res.success) {
        setMessage({ text: "✓ Admit card configuration and fee gate saved!", type: "success" });
        router.refresh();
      } else {
        setMessage({ text: "Failed to save settings.", type: "error" });
      }
    });
  };

  const handleToggleHold = (studentId: string, currentHeld: boolean) => {
    if (!selectedExamId) return;

    if (!currentHeld) {
      // Open modal to specify hold reason
      const st = students.find((s) => s.id === studentId);
      setHoldModalStudent(st ? { id: st.id, name: st.name } : null);
      setHoldReasonInput("Pending disciplinary or attendance review");
    } else {
      // Direct release
      startTransition(async () => {
        setMessage(null);
        const res = await toggleAdmitCardHold({
          examId: selectedExamId,
          studentId,
          isHeld: false,
        });

        if (res.success) {
          setMessage({ text: "✓ Admit card hold released.", type: "success" });
          router.refresh();
        } else {
          setMessage({ text: "Failed to release hold.", type: "error" });
        }
      });
    }
  };

  const handleConfirmPlaceHold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdModalStudent || !selectedExamId) return;

    startTransition(async () => {
      setMessage(null);
      const res = await toggleAdmitCardHold({
        examId: selectedExamId,
        studentId: holdModalStudent.id,
        isHeld: true,
        holdReason: holdReasonInput.trim() || "Withheld by administration",
      });

      if (res.success) {
        setMessage({ text: `✓ Admit card withheld for ${holdModalStudent.name}.`, type: "success" });
        setHoldModalStudent(null);
        router.refresh();
      } else {
        setMessage({ text: "Failed to place hold.", type: "error" });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
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

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Fee Gate:{" "}
            <span
              className={`font-bold ${
                feeMode === "HARD"
                  ? "text-red-600"
                  : feeMode === "SOFT"
                  ? "text-amber-600"
                  : "text-emerald-600"
              }`}
            >
              {feeMode === "HARD" ? "STRICT LOCK" : feeMode === "SOFT" ? "WARNING ONLY" : "DISABLED"}
            </span>
          </span>
        </div>
      </div>

      {/* Status Banner */}
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

      {/* Settings & Fee Gate Configuration Panel */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-4 mb-5">
          <SlidersHorizontal className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-bold text-base text-gray-900 dark:text-white">
            Admit Card Release Window & Fee Defaulter Gate
          </h3>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Release Start Date *
              </label>
              <input
                type="date"
                required
                value={availFrom}
                onChange={(e) => setAvailFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Release End Date *
              </label>
              <input
                type="date"
                required
                value={availUntil}
                onChange={(e) => setAvailUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Fee Defaulter Lock Mode *
              </label>
              <select
                value={feeMode}
                onChange={(e) => setFeeMode(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold dark:text-white"
              >
                <option value="OFF">OFF — No fee verification</option>
                <option value="SOFT">SOFT — Warn student/parent on download</option>
                <option value="HARD">HARD — Strictly block admit card download</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Due Threshold Amount (₹)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Exam Centre
              </label>
              <input
                type="text"
                placeholder="School Main Campus / Junior Wing"
                value={examCentre}
                onChange={(e) => setExamCentre(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Candidate Reporting Time
              </label>
              <input
                type="text"
                placeholder="08:45 AM"
                value={reportingTime}
                onChange={(e) => setReportingTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              Instructions for Candidates
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Settings & Update Gate"}
            </button>
          </div>
        </form>
      </div>

      {/* Student Admit Card Roster & Defaulter List */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Student Admit Cards Roster ({filteredStudents.length})
            </h3>
            <p className="text-xs text-gray-500">
              Surfaces individual holds and fee defaulter balances
            </p>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <p className="p-10 text-center text-sm text-gray-500">
            No active students found in selected filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Roll No</th>
                  <th className="px-6 py-3.5">Student</th>
                  <th className="px-6 py-3.5">Class</th>
                  <th className="px-6 py-3.5">Fee Balance</th>
                  <th className="px-6 py-3.5">Fee Gate Impact</th>
                  <th className="px-6 py-3.5">Hold Status</th>
                  <th className="px-6 py-3.5 text-right">Hold Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {filteredStudents.map((st) => {
                  const isDefaulter = st.dueAmount > threshold;
                  const isHardBlocked = isDefaulter && feeMode === "HARD";

                  return (
                    <tr
                      key={st.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-gray-600 dark:text-slate-400">
                        {st.rollNumber ?? "—"}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                        <span>{st.name}</span>
                        <div className="text-xs text-gray-400 font-mono">
                          {st.admissionNumber}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-slate-300">
                        {st.className}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                        ₹{st.dueAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        {isHardBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                            <Lock className="w-3 h-3" />
                            Blocked by Fee Gate
                          </span>
                        ) : isDefaulter && feeMode === "SOFT" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <AlertTriangle className="w-3 h-3" />
                            Warning Displayed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Allowed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {st.isHeld ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            Withheld
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            Ready
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleToggleHold(st.id, st.isHeld)}
                          disabled={isPending}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                            st.isHeld
                              ? "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300"
                              : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                        >
                          {st.isHeld ? "Release Hold" : "Place Hold"}
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

      {/* MODAL: PLACE HOLD */}
      {holdModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                Withhold Admit Card
              </h3>
              <button
                onClick={() => setHoldModalStudent(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleConfirmPlaceHold} className="space-y-4">
              <p className="text-xs text-gray-500">
                Specify the reason for withholding the admit card for{" "}
                <span className="font-bold text-gray-800 dark:text-slate-200">
                  {holdModalStudent.name}
                </span>
                . The student/parent will see this reason in their portal.
              </p>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                  Reason for Hold *
                </label>
                <textarea
                  rows={3}
                  required
                  value={holdReasonInput}
                  onChange={(e) => setHoldReasonInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setHoldModalStudent(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm text-gray-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm px-5 py-2 rounded-xl transition-all"
                >
                  Confirm Withhold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
