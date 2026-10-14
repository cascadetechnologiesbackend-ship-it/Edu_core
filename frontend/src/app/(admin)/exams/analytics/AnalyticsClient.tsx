"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Award,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
} from "lucide-react";

export interface AnalyticsProps {
  setups: Array<{ id: string; name: string }>;
  selectedSetupId: string;
  classes: Array<{ id: string; displayName: string }>;
  selectedClassId: string;
  metrics: {
    totalAssessed: number;
    passCount: number;
    failCount: number;
    passPercentage: number;
    averagePercentage: number;
    highestPercentage: number;
    lowestPercentage: number;
  };
  gradeDistribution: Array<{
    grade: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  subjectAnalysis: Array<{
    subjectName: string;
    averageMarks: number;
    maxMarks: number;
    averagePercent: number;
    highestMarks: number;
    passRate: number;
  }>;
  toppers: Array<{
    rank: number;
    studentName: string;
    admissionNumber: string;
    rollNumber: string | null;
    totalMarks: number;
    totalMax: number;
    percentage: number;
    overallGrade: string;
    division: string;
  }>;
  remedialStudents: Array<{
    studentName: string;
    admissionNumber: string;
    rollNumber: string | null;
    percentage: number;
    failedSubjects: Array<{
      subjectName: string;
      obtained: number;
      max: number;
    }>;
  }>;
}

export function AnalyticsClient({
  setups,
  selectedSetupId,
  classes,
  selectedClassId,
  metrics,
  gradeDistribution,
  subjectAnalysis,
  toppers,
  remedialStudents,
}: AnalyticsProps) {
  const router = useRouter();

  const handleSetupChange = (newSetupId: string) => {
    router.push(
      `/exams/analytics?setupId=${newSetupId}&classId=${selectedClassId}`,
    );
  };

  const handleClassChange = (newClassId: string) => {
    router.push(
      `/exams/analytics?setupId=${selectedSetupId}&classId=${newClassId}`,
    );
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. Controls Bar ──────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm p-5 md:p-6 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Setup Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Report Card Framework Setup
            </label>
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
              Standard / Class Division
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {metrics.totalAssessed === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs space-y-2">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white">No Frozen Snapshots Found</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            Results have not yet been frozen for this setup and standard. Freeze result snapshots in Report Cards to generate analytics.
          </p>
        </div>
      ) : (
        <>
          {/* ─── 2. Top KPI Cards ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Total Evaluated
              </span>
              <p className="text-2xl font-black text-white">
                {metrics.totalAssessed}
              </p>
              <span className="text-[11px] text-slate-400">Enrolled Candidates</span>
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Pass Percentage
              </span>
              <p className="text-2xl font-black text-emerald-400">
                {metrics.passPercentage}%
              </p>
              <span className="text-[11px] text-slate-400">
                {metrics.passCount} passed • {metrics.failCount} failed
              </span>
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Class Average
              </span>
              <p className="text-2xl font-black text-indigo-400">
                {metrics.averagePercentage}%
              </p>
              <span className="text-[11px] text-slate-400">Mean Composite Score</span>
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Highest Score
              </span>
              <p className="text-2xl font-black text-amber-400">
                {metrics.highestPercentage}%
              </p>
              <span className="text-[11px] text-slate-400">Top Benchmark</span>
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Lowest Score
              </span>
              <p className="text-2xl font-black text-rose-400">
                {metrics.lowestPercentage}%
              </p>
              <span className="text-[11px] text-slate-400">Minimum Recorded</span>
            </div>
          </div>

          {/* ─── 3. Grade Distribution & Subject Performance ───────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Distribution */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-white">CBSE Grade Distribution</h3>
                </div>
                <span className="text-xs text-slate-400">All Assessed</span>
              </div>

              <div className="space-y-3 pt-1">
                {gradeDistribution.map((item) => (
                  <div key={item.grade} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">
                        Grade {item.grade}
                      </span>
                      <span className="text-slate-400">
                        <strong className="text-white">{item.count}</strong> students ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${Math.max(item.percentage, 2)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subject Performance Comparison */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <BookOpen className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-white">Subject-Wise Analytics</h3>
                </div>
                <span className="text-xs text-slate-400">
                  {subjectAnalysis.length} Subjects
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Subject</th>
                      <th className="p-2.5 text-right">Avg Score</th>
                      <th className="p-2.5 text-right">Avg %</th>
                      <th className="p-2.5 text-right">Highest</th>
                      <th className="p-2.5 text-center">Pass Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {subjectAnalysis.map((sub) => (
                      <tr key={sub.subjectName} className="hover:bg-slate-950/30">
                        <td className="p-2.5 font-bold text-white">
                          {sub.subjectName}
                        </td>
                        <td className="p-2.5 text-right text-slate-200">
                          {sub.averageMarks} / {sub.maxMarks}
                        </td>
                        <td className="p-2.5 text-right font-bold text-indigo-400">
                          {sub.averagePercent}%
                        </td>
                        <td className="p-2.5 text-right text-emerald-400 font-semibold">
                          {sub.highestMarks}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              sub.passRate >= 75
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : sub.passRate >= 50
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {sub.passRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ─── 4. Topper Honors Board & Remedial Attention Roster ──────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Toppers Board */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Award className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-white">Topper Honors Board</h3>
                </div>
                <span className="text-xs text-amber-400 font-semibold">Top Achievers</span>
              </div>

              {toppers.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  No passed candidates eligible for topper ranking.
                </p>
              ) : (
                <div className="space-y-3">
                  {toppers.map((t) => (
                    <div
                      key={t.admissionNumber}
                      className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                            t.rank === 1
                              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                              : t.rank === 2
                              ? "bg-slate-300 text-slate-950"
                              : t.rank === 3
                              ? "bg-amber-700 text-white"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {t.rank}
                        </span>
                        <div>
                          <h4 className="font-bold text-white">{t.studentName}</h4>
                          <span className="text-[11px] text-slate-400">
                            Adm: {t.admissionNumber} {t.rollNumber ? `• Roll: ${t.rollNumber}` : ""}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-emerald-400 block">
                          {t.percentage}%
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {t.totalMarks}/{t.totalMax} • Grade {t.overallGrade}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Remedial Intervention Roster */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-white">Remedial Intervention Roster</h3>
                </div>
                <span className="text-xs text-rose-400 font-semibold">
                  {remedialStudents.length} Students
                </span>
              </div>

              {remedialStudents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                  <p className="font-semibold text-white">100% Class Pass Rate</p>
                  <p className="text-[11px]">All evaluated students achieved passing marks.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {remedialStudents.map((st) => (
                    <div
                      key={st.admissionNumber}
                      className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-white">{st.studentName}</h4>
                          <span className="text-[11px] text-slate-400">
                            Adm: {st.admissionNumber} {st.rollNumber ? `• Roll: ${st.rollNumber}` : ""}
                          </span>
                        </div>
                        <span className="text-xs font-black text-rose-400">
                          {st.percentage}% Overall
                        </span>
                      </div>

                      {/* Weak subjects pill list */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {st.failedSubjects.map((sub, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20"
                          >
                            {sub.subjectName}: {sub.obtained}/{sub.max}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
