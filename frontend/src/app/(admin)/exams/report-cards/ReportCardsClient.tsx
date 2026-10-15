"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Award,
  Lock,
  Unlock,
  Printer,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  Search,
  Eye,
  ShieldAlert,
  Send,
  Calendar,
} from "lucide-react";
import {
  generateResultSnapshots,
  setResultHold,
  configureResultSettings,
  issueTopperCertificate,
} from "../actions/resultActions";
import Link from "next/link";

export interface SnapshotItem {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  admissionNumber: string;
  version: number;
  isCurrent: boolean;
  frozenAt: string;
  payload: any;
  isHeld: boolean;
  holdReason: string | null;
}

interface ReportCardsClientProps {
  setups: Array<{ id: string; name: string }>;
  selectedSetupId: string;
  classes: Array<{ id: string; displayName: string }>;
  selectedClassId: string;
  snapshots: SnapshotItem[];
  settings: {
    withholdAll: boolean;
    releaseAt: string | null;
    feeLockMode: "OFF" | "SOFT" | "HARD";
    feeLockThresholdAmount: string;
    publicLookupEnabled: boolean;
    publicToppersEnabled: boolean;
  } | null;
}

export function ReportCardsClient({
  setups,
  selectedSetupId,
  classes,
  selectedClassId,
  snapshots,
  settings,
}: ReportCardsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Selected student for report card preview modal
  const [previewSnapshot, setPreviewSnapshot] = useState<SnapshotItem | null>(
    null,
  );

  // Withhold reason modal
  const [holdModalStudent, setHoldModalStudent] = useState<{
    studentId: string;
    studentName: string;
  } | null>(null);
  const [holdReasonInput, setHoldReasonInput] = useState("");

  // Certificate Issuance Modal
  const [certModalStudent, setCertModalStudent] = useState<{
    studentId: string;
    studentName: string;
    rank: number;
  } | null>(null);
  const [certTitle, setCertTitle] = useState("Academic Excellence");

  const filteredSnapshots = snapshots.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.studentName.toLowerCase().includes(q) ||
      s.admissionNumber.toLowerCase().includes(q) ||
      (s.rollNumber && s.rollNumber.toLowerCase().includes(q))
    );
  });

  // Calculate summary metrics
  const totalCount = snapshots.length;
  const passedCount = snapshots.filter(
    (s) => s.payload?.summary?.resultStatus === "PASSED",
  ).length;
  const passRate = totalCount > 0 ? (passedCount / totalCount) * 100 : 0;

  const percentages = snapshots
    .map((s) => s.payload?.summary?.percentage)
    .filter((p) => typeof p === "number");
  const classAvg =
    percentages.length > 0
      ? percentages.reduce((a, b) => a + b, 0) / percentages.length
      : 0;
  const highestMarks =
    percentages.length > 0 ? Math.max(...percentages) : 0;

  const handleSetupChange = (setupId: string) => {
    router.push(`/exams/report-cards?setupId=${setupId}&classId=${selectedClassId}`);
  };

  const handleClassChange = (classId: string) => {
    router.push(`/exams/report-cards?setupId=${selectedSetupId}&classId=${classId}`);
  };

  const handleGenerateSnapshots = () => {
    if (!selectedSetupId || !selectedClassId) return;
    if (
      !confirm(
        "Generate & Freeze Result Snapshots for this class? This will compute weighted marks, grades, and class ranks into immutable snapshot records.",
      )
    ) {
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const res = await generateResultSnapshots(
        selectedSetupId,
        selectedClassId,
      );
      if (res.success) {
        setFeedback({
          text: `✓ Generated & frozen immutable result snapshots for ${res.count} student(s)!`,
          type: "success",
        });
        router.refresh();
      } else {
        setFeedback({
          text: res.message || "Failed to generate snapshots.",
          type: "error",
        });
      }
    });
  };

  const handleConfirmHold = () => {
    if (!holdModalStudent) return;
    startTransition(async () => {
      const trimmedReason = holdReasonInput.trim();
      const res = await setResultHold({
        setupId: selectedSetupId,
        studentId: holdModalStudent.studentId,
        isHeld: true,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      });
      setHoldModalStudent(null);
      setHoldReasonInput("");
      if (res.success) {
        setFeedback({
          text: "✓ Result hold placed successfully.",
          type: "success",
        });
        router.refresh();
      }
    });
  };

  const handleReleaseHold = (studentId: string) => {
    startTransition(async () => {
      setFeedback(null);
      const res = await setResultHold({
        setupId: selectedSetupId,
        studentId,
        isHeld: false,
      });
      if (res.success) {
        setFeedback({
          text: "✓ Result released from administrative hold.",
          type: "success",
        });
        router.refresh();
      }
    });
  };

  const handleIssueCertificate = () => {
    if (!certModalStudent) return;
    startTransition(async () => {
      setFeedback(null);
      const res = await issueTopperCertificate(
        certModalStudent.studentId,
        selectedSetupId,
        certModalStudent.rank,
        certTitle.trim() || undefined,
      );
      setCertModalStudent(null);
      if (res.success) {
        setFeedback({
          text: `✓ ${res.message}`,
          type: "success",
        });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. Selector Bar & Actions ────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm p-5 md:p-6 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Setup Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Report Card Framework Setup
              </label>
              <Link
                href="/exams/report-cards/setups"
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Manage Frameworks</span>
              </Link>
            </div>
            <select
              value={selectedSetupId}
              onChange={(e) => handleSetupChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
            >
              {setups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Target Standard / Class
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <FileText className="w-4 h-4" />
            </span>
            <span className="text-xs text-slate-400">
              Snapshots: <strong className="text-white">{snapshots.length}</strong> frozen records
            </span>
          </div>

          <button
            type="button"
            disabled={isPending || !selectedSetupId || !selectedClassId}
            onClick={handleGenerateSnapshots}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isPending ? "Freezing..." : "Freeze & Generate Snapshots"}</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ─── 2. KPI Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1">
          <span className="text-slate-500 uppercase text-[10px] font-bold">
            Total Assessed
          </span>
          <p className="text-2xl font-black text-white">{totalCount}</p>
          <span className="text-[11px] text-slate-400">Students in roster</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1">
          <span className="text-slate-500 uppercase text-[10px] font-bold">
            Pass Percentage
          </span>
          <p className="text-2xl font-black text-emerald-400">
            {passRate.toFixed(1)}%
          </p>
          <span className="text-[11px] text-slate-400">{passedCount} of {totalCount} passed</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1">
          <span className="text-slate-500 uppercase text-[10px] font-bold">
            Class Average
          </span>
          <p className="text-2xl font-black text-indigo-400">
            {classAvg.toFixed(1)}%
          </p>
          <span className="text-[11px] text-slate-400">Across all evaluated papers</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1">
          <span className="text-slate-500 uppercase text-[10px] font-bold">
            Highest Score
          </span>
          <p className="text-2xl font-black text-purple-400">
            {highestMarks.toFixed(1)}%
          </p>
          <span className="text-[11px] text-slate-400">Class top mark</span>
        </div>
      </div>

      {/* ─── 3. Search & Roster ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search student or roll number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-3 px-4 w-16">Rank</th>
                  <th className="py-3 px-4 w-20">Roll</th>
                  <th className="py-3 px-4 min-w-[160px]">Student Name</th>
                  <th className="py-3 px-4 text-center">Marks</th>
                  <th className="py-3 px-4 text-center">Percentage</th>
                  <th className="py-3 px-4 text-center">Grade</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Version</th>
                  <th className="py-3 px-4 text-right min-w-[200px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSnapshots.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500">
                      No result snapshots generated yet. Click &quot;Freeze &amp; Generate Snapshots&quot; above.
                    </td>
                  </tr>
                ) : (
                  filteredSnapshots.map((item) => {
                    const summary = item.payload?.summary;
                    const rank = summary?.rank || "—";
                    const status = summary?.resultStatus || "PENDING";
                    const isPass = status === "PASSED";

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-800/30 transition ${
                          item.isHeld ? "bg-rose-950/10" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                          #{rank}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {item.rollNumber || "—"}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>{item.studentName}</span>
                            {item.isHeld && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                                WITHHELD
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-300">
                          {summary?.totalMarks || 0} / {summary?.totalMaxMarks || 0}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-white">
                          {summary?.percentage ? `${summary.percentage}%` : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-slate-700">
                            {summary?.overallGrade || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isPass
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-mono text-[11px] text-slate-400">
                            v{item.version}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Report Card */}
                            <button
                              type="button"
                              onClick={() => setPreviewSnapshot(item)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                              title="View Marks Card"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Issue Certificate for top 3 */}
                            {typeof rank === "number" && rank <= 3 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setCertModalStudent({
                                    studentId: item.studentId,
                                    studentName: item.studentName,
                                    rank,
                                  })
                                }
                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition cursor-pointer"
                                title="Issue Topper Certificate"
                              >
                                <Award className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Withhold / Release Toggle */}
                            {item.isHeld ? (
                              <button
                                type="button"
                                onClick={() => handleReleaseHold(item.studentId)}
                                className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-semibold transition cursor-pointer"
                              >
                                Release
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setHoldModalStudent({
                                    studentId: item.studentId,
                                    studentName: item.studentName,
                                  })
                                }
                                className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[11px] font-semibold transition cursor-pointer"
                              >
                                Withhold
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── 4. Report Card Preview Modal ────────────────────────────────────── */}
      {previewSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl my-8 print:border-none print:shadow-none print:p-0 print:m-0 print:bg-white print:text-black">
            {/* Modal Controls */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-800 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">
                  Official Grade Card Snapshot
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-600/30 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Grade Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSnapshot(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="space-y-6 pt-6 print:pt-0 font-sans text-slate-100 print:text-black">
              <div className="text-center border-b-2 border-slate-700 print:border-black pb-4 space-y-1">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-white print:text-black">
                  OFFICIAL SCHOLASTIC REPORT CARD
                </h2>
                <p className="text-xs text-slate-400 print:text-gray-700">
                  Frozen Record Version {previewSnapshot.version} • Immutable Snapshot
                </p>
              </div>

              {/* Student Metadata Box */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950/60 print:bg-gray-50 print:border-gray-400 text-xs">
                <div>
                  <span className="text-slate-500 print:text-gray-600 uppercase text-[10px] font-bold">
                    Student Name
                  </span>
                  <p className="font-bold text-white print:text-black text-sm">
                    {previewSnapshot.studentName}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 print:text-gray-600 uppercase text-[10px] font-bold">
                    Roll Number
                  </span>
                  <p className="font-bold text-white print:text-black text-sm">
                    {previewSnapshot.rollNumber || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 print:text-gray-600 uppercase text-[10px] font-bold">
                    Admission No
                  </span>
                  <p className="font-bold text-white print:text-black text-sm">
                    {previewSnapshot.admissionNumber}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 print:text-gray-600 uppercase text-[10px] font-bold">
                    Class Rank
                  </span>
                  <p className="font-black text-indigo-400 print:text-black text-sm">
                    #{previewSnapshot.payload?.summary?.rank || "—"}
                  </p>
                </div>
              </div>

              {/* Subject Breakdown Table */}
              <div className="border border-slate-800 print:border-black rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 print:bg-gray-200 text-slate-400 print:text-black font-semibold uppercase text-[10px] border-b border-slate-800 print:border-black">
                    <tr>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3 text-center">Marks Obtained</th>
                      <th className="py-2.5 px-3 text-center">Max Marks</th>
                      <th className="py-2.5 px-3 text-center">Percentage</th>
                      <th className="py-2.5 px-3 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 print:divide-black">
                    {(previewSnapshot.payload?.subjects || []).map((sb: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/20 print:hover:bg-transparent">
                        <td className="py-2.5 px-3 font-semibold text-white print:text-black">
                          {sb.subjectName} {sb.subjectCode ? `(${sb.subjectCode})` : ""}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-white print:text-black">
                          {sb.totalObtained}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 print:text-black">
                          {sb.totalMax}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium text-slate-200 print:text-black">
                          {sb.percent}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-300 print:text-black">
                          {sb.grade}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Footer Box */}
              <div className="p-4 rounded-xl border border-slate-800 print:border-black bg-slate-950/60 print:bg-gray-50 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 uppercase text-[10px] font-bold">Overall Result</span>
                  <p className="text-base font-black text-emerald-400 print:text-black">
                    {previewSnapshot.payload?.summary?.resultStatus}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 uppercase text-[10px] font-bold">Total Marks</span>
                  <p className="text-sm font-bold text-white print:text-black">
                    {previewSnapshot.payload?.summary?.totalMarks} / {previewSnapshot.payload?.summary?.totalMaxMarks}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 uppercase text-[10px] font-bold">Aggregate Percentage</span>
                  <p className="text-sm font-bold text-indigo-400 print:text-black">
                    {previewSnapshot.payload?.summary?.percentage}%
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 uppercase text-[10px] font-bold">Final Grade</span>
                  <p className="text-sm font-bold text-purple-400 print:text-black">
                    {previewSnapshot.payload?.summary?.overallGrade}
                  </p>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs">
                <div className="border-t border-slate-700 print:border-black pt-2">
                  <p className="text-[11px] font-medium text-slate-400 print:text-black">
                    Class Teacher
                  </p>
                </div>
                <div className="border-t border-slate-700 print:border-black pt-2">
                  <p className="text-[11px] font-medium text-slate-400 print:text-black">
                    Exam Coordinator
                  </p>
                </div>
                <div className="border-t border-slate-700 print:border-black pt-2">
                  <p className="text-[11px] font-semibold text-white print:text-black">
                    Principal
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. Withhold Modal ──────────────────────────────────────────────── */}
      {holdModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-white text-base">
                  Withhold Student Result
                </h3>
                <p className="text-xs text-slate-400">
                  {holdModalStudent.studentName}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Reason for Withholding Result
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Disciplinary review pending / document verification required."
                value={holdReasonInput}
                onChange={(e) => setHoldReasonInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setHoldModalStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmHold}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-md shadow-rose-600/30 cursor-pointer"
              >
                Confirm Withhold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. Issue Topper Certificate Modal ───────────────────────────────── */}
      {certModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Award className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-white text-base">
                  Issue Topper Certificate
                </h3>
                <p className="text-xs text-slate-400">
                  {certModalStudent.studentName} (Rank #{certModalStudent.rank})
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Certificate Title / Citation
              </label>
              <input
                type="text"
                value={certTitle}
                onChange={(e) => setCertTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCertModalStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleIssueCertificate}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition shadow-md shadow-amber-600/30 cursor-pointer"
              >
                Issue Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
