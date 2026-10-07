"use client";

import { useState } from "react";
import { ArrowRight, RefreshCw, AlertCircle, CheckCircle2, User, ChevronRight } from "lucide-react";
import { processFeesCarryForward } from "./actions";

interface StudentPendingDue {
  studentId: string;
  name: string;
  admissionNumber: string;
  className: string;
  sectionName: string | null;
  pendingDue: number;
}

interface CarryForwardClientProps {
  academicYears: { id: string; name: string; isActive: boolean }[];
  studentsWithDues: StudentPendingDue[];
  previousMigrations: {
    id: string;
    studentName: string;
    fromYear: string;
    toYear: string;
    carriedAmount: string;
    status: string;
    appliedAt: Date | string;
  }[];
}

export function CarryForwardClient({
  academicYears,
  studentsWithDues,
  previousMigrations,
}: CarryForwardClientProps) {
  const [fromYearId, setFromYearId] = useState(academicYears[0]?.id || "");
  const [toYearId, setToYearId] = useState(academicYears[1]?.id || "");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    studentsWithDues.map((s) => s.studentId)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === studentsWithDues.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(studentsWithDues.map((s) => s.studentId));
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedTotal = studentsWithDues
    .filter((s) => selectedStudentIds.includes(s.studentId))
    .reduce((sum, s) => sum + s.pendingDue, 0);

  const handleCarryForward = async () => {
    if (!fromYearId || !toYearId) {
      setStatusMsg({ type: "error", message: "Please select both source and target sessions." });
      return;
    }
    if (fromYearId === toYearId) {
      setStatusMsg({
        type: "error",
        message: "Source and target sessions must be distinct academic years.",
      });
      return;
    }
    if (selectedStudentIds.length === 0) {
      setStatusMsg({ type: "error", message: "Select at least one student to carry forward dues." });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      const res = await processFeesCarryForward({
        fromAcademicYearId: fromYearId,
        toAcademicYearId: toYearId,
        studentIds: selectedStudentIds,
      });

      if (res.success) {
        setStatusMsg({
          type: "success",
          message: `Successfully carried forward dues for ${res.count} student(s) into the new academic year!`,
        });
        setSelectedStudentIds([]);
      }
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        message: err.message || "Failed to process fees carry forward.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Session Mapping Setup Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="border-b border-gray-100 dark:border-slate-800 pb-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Session Dues Migration Configuration
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Choose the closing academic session and the destination upcoming academic session for outstanding balance roll-forward.
          </p>
        </div>

        {statusMsg && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
              statusMsg.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{statusMsg.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              Source Academic Year (With Unpaid Dues)
            </label>
            <select
              value={fromYearId}
              onChange={(e) => setFromYearId(e.target.value)}
              className="w-full text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isActive ? "(Current Active)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center items-center py-2 md:py-0">
            <div className="p-2.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
              Target Academic Year (Receiving Session)
            </label>
            <select
              value={toYearId}
              onChange={(e) => setToYearId(e.target.value)}
              className="w-full text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isActive ? "(Current Active)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Eligible Students Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Outstanding Balance Review Ledger ({studentsWithDues.length} Students)
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Selected: {selectedStudentIds.length} students | Total to roll forward:{" "}
              <strong className="text-gray-900 dark:text-white">₹{selectedTotal.toLocaleString("en-IN")}</strong>
            </p>
          </div>

          <button
            onClick={handleCarryForward}
            disabled={isSubmitting || selectedStudentIds.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Processing Migration...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" /> Carry Forward Selected ({selectedStudentIds.length})
              </>
            )}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={
                      studentsWithDues.length > 0 &&
                      selectedStudentIds.length === studentsWithDues.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Adm #</th>
                <th className="py-3 px-4">Class & Section</th>
                <th className="py-3 px-4 text-right">Unpaid Balance</th>
                <th className="py-3 px-4 text-center">Action Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-slate-200">
              {studentsWithDues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 dark:text-slate-400">
                    No students found with pending balance in the selected session. All dues are cleared!
                  </td>
                </tr>
              ) : (
                studentsWithDues.map((s) => {
                  const isChecked = selectedStudentIds.includes(s.studentId);
                  return (
                    <tr
                      key={s.studentId}
                      className={`hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition ${
                        isChecked ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStudent(s.studentId)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                        {s.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600 dark:text-slate-400">
                        {s.admissionNumber}
                      </td>
                      <td className="py-3 px-4">
                        {s.className} {s.sectionName ? `(${s.sectionName})` : ""}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400 font-mono">
                        ₹{s.pendingDue.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                          Create Opening Invoice <ChevronRight className="w-3 h-3" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Carry Forward Logs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            Carry Forward Migration Audit Log
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Historical records of fee dues migrated across academic sessions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">From Session</th>
                <th className="py-3 px-4">To Session</th>
                <th className="py-3 px-4 text-right">Carried Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Applied Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-slate-200">
              {previousMigrations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-slate-400">
                    No migration records recorded yet.
                  </td>
                </tr>
              ) : (
                previousMigrations.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      {m.studentName}
                    </td>
                    <td className="py-3 px-4">{m.fromYear}</td>
                    <td className="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400">
                      {m.toYear}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-gray-900 dark:text-white">
                      ₹{parseFloat(m.carriedAmount).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500 dark:text-slate-400 font-mono">
                      {new Date(m.appliedAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
