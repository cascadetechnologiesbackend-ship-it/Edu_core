"use client";

import { useState } from "react";
import {
  Search,
  Award,
  Calendar,
  ShieldCheck,
  Download,
  Printer,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Building,
  GraduationCap,
  Sparkles,
} from "lucide-react";

interface PublicResultPortalClientProps {
  slug: string;
  school: {
    id: string;
    name: string;
    code: string;
    address?: string | null;
  };
  setups: Array<{ id: string; name: string; isActive: boolean }>;
  defaultSetupId: string;
  toppers: Array<{
    rank: number;
    studentName: string;
    className: string;
    percentage: number;
    overallGrade: string;
  }>;
  isToppersEnabled: boolean;
}

export function PublicResultPortalClient({
  slug,
  school,
  setups,
  defaultSetupId,
  toppers,
  isToppersEnabled,
}: PublicResultPortalClientProps) {
  const [selectedSetupId, setSelectedSetupId] = useState(defaultSetupId);
  const [identifierType, setIdentifierType] = useState<"ADMISSION" | "ROLL">(
    "ADMISSION",
  );
  const [identifier, setIdentifier] = useState("");
  const [dob, setDob] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultData, setResultData] = useState<{
    candidate: {
      name: string;
      admissionNumber: string;
      rollNumber: string | null;
      className: string;
    };
    snapshotId: string;
    version: number;
    frozenAt: string;
    payload: any;
  } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResultData(null);

    if (!identifier.trim() || !dob.trim()) {
      setErrorMessage("Please enter both candidate identification and Date of Birth.");
      return;
    }

    setIsLoading(true);
    try {
      const payload: Record<string, string> = {
        setupId: selectedSetupId,
        dob: dob.trim(),
      };
      if (identifierType === "ADMISSION") {
        payload.admissionNumber = identifier.trim();
      } else {
        payload.rollNumber = identifier.trim();
      }

      const res = await fetch(`/s/${slug}/results/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(
          data.error || "Unable to retrieve candidate marks. Please verify details.",
        );
      } else {
        setResultData({
          candidate: data.candidate,
          snapshotId: data.snapshotId,
          version: data.version,
          frozenAt: data.frozenAt,
          payload: data.payload,
        });
      }
    } catch {
      setErrorMessage("Network connection error. Please try again in a few moments.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResultData(null);
    setErrorMessage(null);
    setIdentifier("");
    setDob("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* ─── Institutional Header ────────────────────────────────────────────── */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white shadow-lg shadow-indigo-600/30">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">
                {school.name}
              </h1>
              <p className="text-[11px] text-slate-400">
                School Code: {school.code} • Public Examination Portal
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Official Verification System</span>
            </span>
          </div>
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12 flex-1 w-full space-y-8">
        {!resultData ? (
          <>
            {/* Search Form Card */}
            <div className="max-w-2xl mx-auto rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <span className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 inline-block mb-1">
                  <GraduationCap className="w-7 h-7" />
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Candidate Result Lookup
                </h2>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Enter candidate credentials and verified Date of Birth to view official scholastic term records.
                </p>
              </div>

              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSearch} className="space-y-4">
                {/* Examination Setup Selection */}
                {setups.length > 1 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Examination Term
                    </label>
                    <select
                      value={selectedSetupId}
                      onChange={(e) => setSelectedSetupId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                    >
                      {setups.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Identifier Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      Candidate Identifier
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setIdentifierType("ADMISSION")}
                        className={`px-2 py-0.5 rounded-md font-bold transition ${
                          identifierType === "ADMISSION"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Admission No
                      </button>
                      <button
                        type="button"
                        onClick={() => setIdentifierType("ROLL")}
                        className={`px-2 py-0.5 rounded-md font-bold transition ${
                          identifierType === "ROLL"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Roll No
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    required
                    placeholder={
                      identifierType === "ADMISSION"
                        ? "e.g. ADM-2026-0042"
                        : "e.g. 1014"
                    }
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium tracking-wide uppercase"
                  />
                </div>

                {/* Date of Birth Picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Date of Birth (Security Verification)
                  </label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Must match institutional student admission records exactly.
                  </p>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>{isLoading ? "Searching Records..." : "Search Official Marks"}</span>
                </button>
              </form>
            </div>

            {/* Toppers Honors Board Showcase (if enabled) */}
            {isToppersEnabled && toppers.length > 0 && (
              <div className="max-w-2xl mx-auto rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Award className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Academic Merit Honors Board
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {toppers.map((t) => (
                    <div
                      key={t.rank}
                      className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-center space-y-1.5"
                    >
                      <span
                        className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center font-black text-xs ${
                          t.rank === 1
                            ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                            : t.rank === 2
                            ? "bg-slate-300 text-slate-950"
                            : "bg-amber-700 text-white"
                        }`}
                      >
                        {t.rank}
                      </span>
                      <h4 className="font-bold text-white text-xs truncate">
                        {t.studentName}
                      </h4>
                      <p className="text-[10px] text-slate-400">{t.className}</p>
                      <span className="text-xs font-black text-emerald-400 block pt-0.5">
                        {t.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Official Digital Statement of Marks */
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Search Another Candidate</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>

                <a
                  href={`/api/report-cards/${resultData.snapshotId}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Official PDF</span>
                </a>
              </div>
            </div>

            {/* Official Marksheet Document Card */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/95 backdrop-blur-sm p-6 sm:p-8 shadow-2xl space-y-6 print:bg-white print:text-black print:border-none print:shadow-none">
              {/* Document Header */}
              <div className="border-b border-slate-800 pb-5 text-center space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white print:text-black">
                  {school.name}
                </h2>
                <p className="text-xs text-indigo-400 print:text-slate-600 font-bold uppercase tracking-wider">
                  Official Statement of Academic Performance
                </p>
                <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400 print:text-slate-600 pt-1">
                  <span>Verified Snapshot v{resultData.version}</span>
                  <span>•</span>
                  <span>Declared: {new Date(resultData.frozenAt).toLocaleDateString("en-IN")}</span>
                </div>
              </div>

              {/* Candidate Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-950/60 print:bg-slate-100 border border-slate-800/80 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Candidate Name
                  </span>
                  <span className="font-bold text-white print:text-black">
                    {resultData.candidate.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Admission No
                  </span>
                  <span className="font-bold text-white print:text-black">
                    {resultData.candidate.admissionNumber}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Roll Number
                  </span>
                  <span className="font-bold text-white print:text-black">
                    {resultData.candidate.rollNumber || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Standard / Class
                  </span>
                  <span className="font-bold text-white print:text-black">
                    {resultData.candidate.className}
                  </span>
                </div>
              </div>

              {/* Scholastic Subject Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 print:bg-slate-200 text-slate-400 print:text-slate-700 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Subject Name</th>
                      <th className="p-3 text-right">Marks Obtained</th>
                      <th className="p-3 text-right">Max Marks</th>
                      <th className="p-3 text-right">Percentage</th>
                      <th className="p-3 text-center">Grade</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/30 print:bg-white">
                    {(resultData.payload?.subjects as any[])?.map((sub, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/30">
                        <td className="p-3 font-medium text-white print:text-black">
                          {sub.subjectName}
                        </td>
                        <td className="p-3 text-right font-bold text-white print:text-black">
                          {sub.totalObtained}
                        </td>
                        <td className="p-3 text-right text-slate-400 print:text-slate-600">
                          {sub.totalMax}
                        </td>
                        <td className="p-3 text-right font-medium text-indigo-400 print:text-black">
                          {sub.percent}%
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded font-bold bg-slate-800 print:bg-slate-200 text-slate-200 print:text-black">
                            {sub.grade}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              sub.isPassed
                                ? "text-emerald-400 bg-emerald-500/10"
                                : "text-rose-400 bg-rose-500/10"
                            }`}
                          >
                            {sub.isPassed ? "PASS" : "FAIL"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Score Badges */}
              {resultData.payload?.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Grand Total
                    </span>
                    <span className="text-lg font-black text-white print:text-black">
                      {resultData.payload.summary.totalMarks}
                      <span className="text-xs text-slate-500 font-normal">
                        {" "}
                        / {resultData.payload.summary.totalMax}
                      </span>
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Composite %
                    </span>
                    <span className="text-lg font-black text-indigo-400 print:text-black">
                      {resultData.payload.summary.percentage}%
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Overall Grade
                    </span>
                    <span className="text-lg font-black text-emerald-400 print:text-black">
                      {resultData.payload.summary.overallGrade}
                      {resultData.payload.summary.division && (
                        <span className="text-[11px] text-slate-400 font-normal ml-1">
                          ({resultData.payload.summary.division})
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Final Verdict
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          resultData.payload.summary.resultStatus === "PASSED"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {resultData.payload.summary.resultStatus}
                      </span>
                      {resultData.payload.summary.rank && (
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-0.5">
                          <Award className="w-3.5 h-3.5" />
                          Rank #{resultData.payload.summary.rank}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Digital Verification Footnote */}
              <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Cryptographically immutable record backed by SchoolMitra ERP.
                  </span>
                </div>
                <span>Snapshot Ref: {resultData.snapshotId.slice(0, 12)}...</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 bg-slate-950">
        <p>© {new Date().getFullYear()} {school.name}. All rights reserved.</p>
        <p className="text-[10px] text-slate-600 mt-1">
          Powered by SchoolMitra Enterprise Examination System
        </p>
      </footer>
    </div>
  );
}
