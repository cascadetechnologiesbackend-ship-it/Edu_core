"use client";

import React, { useState } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  ShieldAlert,
  FileText,
} from "lucide-react";
import {
  StudentAttendanceData,
  StudentAttendanceDayRecord,
  AttendanceStatus,
} from "@/app/(student)/student/attendance/attendanceActions";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { labelEn: string; labelHi: string; color: string; dotColor: string }
> = {
  PRESENT: {
    labelEn: "Present",
    labelHi: "उपस्थित",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    dotColor: "bg-emerald-400",
  },
  LATE: {
    labelEn: "Late",
    labelHi: "विलंब",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    dotColor: "bg-amber-400",
  },
  HALF_DAY: {
    labelEn: "Half Day",
    labelHi: "आधा दिन",
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    dotColor: "bg-indigo-400",
  },
  ABSENT: {
    labelEn: "Absent",
    labelHi: "अनुपस्थित",
    color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    dotColor: "bg-rose-400",
  },
  LEAVE: {
    labelEn: "Leave",
    labelHi: "अवकाश",
    color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    dotColor: "bg-sky-400",
  },
  HOLIDAY: {
    labelEn: "Holiday",
    labelHi: "छुट्टी",
    color: "text-slate-400 bg-slate-800 border-slate-700",
    dotColor: "bg-slate-400",
  },
};

export function StudentAttendanceClient({
  data,
}: {
  data: StudentAttendanceData;
}) {
  const [activeTab, setActiveTab] = useState<"logs" | "leaves">("logs");

  // Filter records by selected month
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthPrefix);

  const monthRecords = data.records.filter((r) =>
    r.date.startsWith(selectedMonth)
  );

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const d = new Date(year!, month! - 2, 1);
    setSelectedMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const d = new Date(year!, month!, 1);
    setSelectedMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const [displayYear, displayMonth] = selectedMonth.split("-").map(Number);
  const monthName = new Date(displayYear!, displayMonth! - 1, 1).toLocaleString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  const { stats } = data;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Context Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CalendarCheck className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Attendance & Leaves
              </h1>
              <p className="text-xs text-slate-400">
                उपस्थिति एवं अवकाश विवरण • {data.student.className} - {data.student.sectionName}
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "logs"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Daily Logs / उपस्थिति
            </button>
            <button
              onClick={() => setActiveTab("leaves")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "leaves"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Leaves / अवकाश ({data.leaveRequests.length})
            </button>
          </div>
        </div>

        {/* Overall Percentage Strip (AC-11, AC-17 Truth Invariant: zero hardcoded values!) */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          {stats.totalDaysMarked === 0 ? (
            <div className="text-center py-2 text-slate-400 text-xs flex items-center justify-center gap-2">
              <Info className="w-4 h-4 text-slate-500 shrink-0" />
              <span>
                No attendance marked yet this term / इस सत्र में अभी तक कोई उपस्थिति दर्ज नहीं की गई है
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 text-center sm:col-span-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  Term Rate / कुल उपस्थिति
                </span>
                <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                  {stats.attendancePercentage}%
                </div>
                <span className="text-[10px] text-slate-500">
                  {stats.presentDays} of {stats.totalDaysMarked} days attended
                </span>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 text-center">
                <span className="text-[10px] uppercase font-semibold text-emerald-400">
                  Present
                </span>
                <div className="text-lg font-bold text-slate-200 font-mono mt-0.5">
                  {stats.presentDays}
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 text-center">
                <span className="text-[10px] uppercase font-semibold text-amber-400">
                  Late
                </span>
                <div className="text-lg font-bold text-slate-200 font-mono mt-0.5">
                  {stats.lateDays}
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 text-center">
                <span className="text-[10px] uppercase font-semibold text-rose-400">
                  Absent
                </span>
                <div className="text-lg font-bold text-slate-200 font-mono mt-0.5">
                  {stats.absentDays}
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 text-center">
                <span className="text-[10px] uppercase font-semibold text-sky-400">
                  Leave
                </span>
                <div className="text-lg font-bold text-slate-200 font-mono mt-0.5">
                  {stats.leaveDays}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeTab === "logs" ? (
        /* DAILY LOGS & MONTH SELECTOR */
        <div className="space-y-4">
          {/* Month Navigator */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-3">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-slate-200 font-sans">
                {monthName}
              </span>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {monthRecords.length === 0 ? (
            <EmptyStateCTA
              icon={CalendarCheck}
              title={`No Attendance in ${monthName}`}
              hint="No daily roll logs recorded for your section in this calendar month."
              className="border-slate-800 bg-slate-900/40"
            />
          ) : (
            <div className="space-y-2">
              {monthRecords.map((rec) => {
                const conf = STATUS_CONFIG[rec.status];
                const dateObj = new Date(rec.date);
                const dayName = dateObj.toLocaleDateString("en-US", {
                  weekday: "short",
                });
                const dayNum = dateObj.getDate();

                return (
                  <div
                    key={rec.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 flex items-center justify-between gap-4 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                          {dayName}
                        </span>
                        <span className="text-xs font-bold text-slate-200 font-mono">
                          {dayNum}
                        </span>
                      </div>

                      <div>
                        <div className="text-xs font-mono font-medium text-slate-300">
                          {rec.date}
                        </div>
                        {rec.remarks && (
                          <p className="text-[11px] text-slate-500 italic mt-0.5">
                            {rec.remarks}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${conf.color}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${conf.dotColor}`}
                        />
                        <span>
                          {conf.labelEn} / {conf.labelHi}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* LEAVE REQUESTS SECTION (BR7 Read-Only for Students) */
        <div className="space-y-4">
          <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-indigo-200">
                Parent-Managed Leave Applications (अभिभावक-प्रबंधित)
              </h3>
              <p className="text-[11px] text-indigo-300/80 leading-relaxed">
                As per school regulatory guidelines, formal student leave applications are submitted and tracked by parents through the Parent Companion app. This view displays the historical review status of applications for your record.
              </p>
            </div>
          </div>

          {data.leaveRequests.length === 0 ? (
            <EmptyStateCTA
              icon={FileText}
              title="No Leave Applications"
              hint="No student leave requests have been submitted by your parents for this academic session."
              className="border-slate-800 bg-slate-900/40"
            />
          ) : (
            <div className="space-y-3">
              {data.leaveRequests.map((lr) => {
                let badgeClass = "bg-amber-500/10 text-amber-300 border-amber-500/30";
                let statusLabel = "Pending Approval / प्रतीक्षित";

                if (lr.status === "APPROVED") {
                  badgeClass = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
                  statusLabel = "Approved / स्वीकृत";
                } else if (lr.status === "REJECTED") {
                  badgeClass = "bg-rose-500/15 text-rose-300 border-rose-500/30";
                  statusLabel = "Rejected / अस्वीकृत";
                } else if (lr.status === "CANCELLED_BY_PARENT") {
                  badgeClass = "bg-slate-800 text-slate-400 border-slate-700";
                  statusLabel = "Cancelled / रद्द";
                }

                return (
                  <div
                    key={lr.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white capitalize">
                          {lr.leaveType.toLowerCase()} Leave
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ({lr.startDate} to {lr.endDate})
                        </span>
                      </div>

                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badgeClass}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                      Reason: &ldquo;{lr.reason}&rdquo;
                    </p>

                    {lr.decisionNote && (
                      <div className="text-[11px] text-slate-400 pt-1 flex items-start gap-1.5">
                        <span className="font-semibold text-slate-300">
                          Office Note:
                        </span>
                        <span>{lr.decisionNote}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
