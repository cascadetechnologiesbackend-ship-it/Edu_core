"use client";

import React from "react";
import { UserX, Calendar, TrendingDown, CheckCircle, AlertTriangle } from "lucide-react";

export interface ExamAttendanceMetricItem {
  examName: string;
  className: string;
  subjectName: string;
  examDate: string;
  absentCount: number;
  leaveCount: number;
  presentCount: number;
}

interface ExamAttendanceTrendCardProps {
  metrics: ExamAttendanceMetricItem[];
  totalAbsents: number;
  totalLeaves: number;
  totalPresent: number;
}

export function ExamAttendanceTrendCard({
  metrics,
  totalAbsents,
  totalLeaves,
  totalPresent,
}: ExamAttendanceTrendCardProps) {
  const totalRecords = totalAbsents + totalLeaves + totalPresent;
  const attendanceRate = totalRecords > 0
    ? (((totalRecords - totalAbsents) / totalRecords) * 100).toFixed(1)
    : "100.0";

  return (
    <div
      data-ux-id="card_exam_attendance_trend"
      data-ux-label="Exam Day Attendance & Absentee Trend"
      className="bg-card border border-border/40 rounded-2xl p-6 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-border/40 gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#5856D6] dark:text-[#BF5AF2] text-xs font-bold uppercase tracking-wider">
            <TrendingDown className="w-4 h-4" />
            <span>Cross-Module Attendance Sync (Guide Spec)</span>
          </div>
          <h3 className="text-lg font-bold text-foreground mt-1">
            Exam Day Attendance & Absentee Trend
          </h3>
          <p className="text-xs text-muted-foreground">
            Bi-directional exam attendance synced to student_attendance with exact schedule linkage
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <strong className="font-mono tabular-nums">{attendanceRate}%</strong> Exam Turnout
          </span>
        </div>
      </div>

      {/* Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
        <div className="p-4 rounded-xl bg-muted/20 border border-border/40">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Exam Absences</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono tabular-nums">
              {totalAbsents}
            </span>
            <span className="text-[11px] text-muted-foreground">unexcused</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-muted/20 border border-border/40">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Medical Exemptions</span>
            <AlertTriangle className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-mono tabular-nums">
              {totalLeaves}
            </span>
            <span className="text-[11px] text-muted-foreground">medical leave</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-muted/20 border border-border/40">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Synced Records</span>
            <Calendar className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground font-mono tabular-nums">
              {totalRecords}
            </span>
            <span className="text-[11px] text-muted-foreground">paper records</span>
          </div>
        </div>
      </div>

      {/* Roster / Breakdown Table */}
      {metrics.length === 0 ? (
        <div className="p-6 text-center rounded-xl bg-gray-50/50 dark:bg-muted/20 border border-dashed border-gray-200 dark:border-border/40 text-xs text-gray-500 dark:text-muted-foreground">
          No examination absences recorded yet. When marks are entered with absent or medical flags, they automatically synchronize here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-border/40 text-gray-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">Exam & Paper</th>
                <th className="py-2.5 px-3">Class</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-center">Absents</th>
                <th className="py-2.5 px-3 text-center">Exemptions</th>
                <th className="py-2.5 px-3 text-right">Attendance Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-border/40/60">
              {metrics.map((m, idx) => {
                const rowTotal = m.absentCount + m.leaveCount + m.presentCount;
                const rowRate = rowTotal > 0
                  ? (((rowTotal - m.absentCount) / rowTotal) * 100).toFixed(0)
                  : "100";

                return (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50/60 dark:hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">
                      <div>{m.examName}</div>
                      <div className="text-[10px] text-gray-400 font-normal">{m.subjectName}</div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-muted-foreground">
                      {m.className}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 dark:text-muted-foreground whitespace-nowrap">
                      {m.examDate}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                        {m.absentCount}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                        {m.leaveCount}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-gray-200 bg-muted/60 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${rowRate}%` }}
                          />
                        </div>
                        <span className="font-bold text-gray-700 dark:text-foreground">
                          {rowRate}%
                        </span>
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
  );
}
