"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  BookOpen,
  ArrowRight,
  Sparkles,
  Info,
  CalendarCheck,
  AlertCircle,
} from "lucide-react";
import {
  StudentTimetableData,
  StudentTimetablePeriod,
  DayOfWeek,
} from "@/app/(student)/student/timetable/timetableActions";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";

const DAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const DAY_LABELS: Record<DayOfWeek | "SUNDAY", { en: string; hi: string }> = {
  SUNDAY: { en: "Sunday", hi: "रविवार" },
  MONDAY: { en: "Monday", hi: "सोमवार" },
  TUESDAY: { en: "Tuesday", hi: "मंगलवार" },
  WEDNESDAY: { en: "Wednesday", hi: "बुधवार" },
  THURSDAY: { en: "Thursday", hi: "गुरुवार" },
  FRIDAY: { en: "Friday", hi: "शुक्रवार" },
  SATURDAY: { en: "Saturday", hi: "शनिवार" },
};

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function getPeriodStatus(
  period: StudentTimetablePeriod,
  isToday: boolean
): "PAST" | "CURRENT" | "UPCOMING" {
  if (!isToday) return "UPCOMING";

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTimeToMinutes(period.startTime);
  const endMinutes = parseTimeToMinutes(period.endTime);

  if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
    return "CURRENT";
  } else if (currentMinutes > endMinutes) {
    return "PAST";
  } else {
    return "UPCOMING";
  }
}

export function StudentTimetableClient({
  data,
}: {
  data: StudentTimetableData;
}) {
  const [activeTab, setActiveTab] = useState<"today" | "weekly">("today");
  const initialWeeklyDay: DayOfWeek =
    data.todayDayOfWeek !== "SUNDAY" ? data.todayDayOfWeek : "MONDAY";
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(initialWeeklyDay);

  const isTodaySunday = data.todayDayOfWeek === "SUNDAY";
  const todayPeriods = data.periods.filter(
    (p) => p.dayOfWeek === data.todayDayOfWeek
  );
  const weeklyPeriods = data.periods.filter((p) => p.dayOfWeek === selectedDay);

  return (
    <div className="space-y-6 pb-12">
      {/* Student Scope Context Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Calendar className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Class Timetable
                </h1>
                <p className="text-xs text-slate-400">
                  समय-सारणी • {data.student.className} - {data.student.sectionName}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("today")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "today"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Today / आज
            </button>
            <button
              onClick={() => setActiveTab("weekly")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "weekly"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Weekly Grid / साप्ताहिक
            </button>
          </div>
        </div>
      </div>

      {/* Global Empty State if timetable has no periods at all */}
      {data.periods.length === 0 ? (
        <EmptyStateCTA
          icon={Calendar}
          title="No Timetable Published"
          hint={`The timetable for ${data.student.className} - ${data.student.sectionName} has not been published by the academic office yet. Please check back later.`}
          className="border-slate-800 bg-slate-900/40"
        />
      ) : activeTab === "today" ? (
        /* TODAY VIEW */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-200">
                {DAY_LABELS[data.todayDayOfWeek].en} Schedule (
                {DAY_LABELS[data.todayDayOfWeek].hi})
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                {data.todayDateFormatted}
              </span>
            </div>
            <span className="text-xs text-indigo-400 font-medium">
              {todayPeriods.length} Periods Today
            </span>
          </div>

          {isTodaySunday || todayPeriods.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-2">
              <CalendarCheck className="w-8 h-8 text-indigo-400/60 mx-auto" />
              <h3 className="text-base font-semibold text-slate-200">
                {isTodaySunday
                  ? "Sunday Holiday / रविवार अवकाश"
                  : "No Classes Scheduled Today"}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isTodaySunday
                  ? "Enjoy your weekend! You can inspect the upcoming week's classes using the Weekly Grid tab."
                  : "No periods are configured for today in your section's active timetable."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayPeriods.map((period) => {
                const status = getPeriodStatus(period, true);

                return (
                  <div
                    key={period.id}
                    className={`rounded-2xl border p-4 transition relative overflow-hidden ${
                      status === "CURRENT"
                        ? "bg-indigo-950/30 border-indigo-500/50 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/30"
                        : "bg-slate-900/90 border-slate-800/80 hover:border-slate-700"
                    }`}
                  >
                    {status === "CURRENT" && (
                      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3.5 min-w-0">
                        {/* Period Number Badge */}
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            status === "CURRENT"
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-800 text-slate-300 border border-slate-700/50"
                          }`}
                        >
                          P{period.periodNumber}
                        </div>

                        {/* Period Subject & Details */}
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-white truncate">
                              {period.subjectName}
                            </h3>
                            {period.subjectCode && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                {period.subjectCode}
                              </span>
                            )}
                            {period.isSubstituted && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                Substitute / प्रतिस्थानी
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                            {/* Teacher info */}
                            <span className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              {period.isSubstituted ? (
                                <span className="space-x-1">
                                  <span className="text-amber-300 font-medium">
                                    {period.teacherName}
                                  </span>
                                  {period.originalTeacherName && (
                                    <span className="line-through text-slate-500 text-[11px]">
                                      ({period.originalTeacherName})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span>{period.teacherName || "Unassigned"}</span>
                              )}
                            </span>

                            {/* Room info */}
                            {period.roomNumber && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                <span>Room {period.roomNumber}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Time & Status */}
                      <div className="text-right shrink-0 space-y-1">
                        <div className="flex items-center justify-end gap-1 text-xs font-mono font-medium text-slate-300">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>
                            {period.startTime.slice(0, 5)} - {period.endTime.slice(0, 5)}
                          </span>
                        </div>

                        <div>
                          {status === "CURRENT" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                              Active Now / अभी जारी
                            </span>
                          ) : status === "PAST" ? (
                            <span className="text-[10px] font-medium text-slate-500">
                              Completed / संपन्न
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400">
                              Upcoming / आगामी
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* WEEKLY GRID VIEW */
        <div className="space-y-4">
          {/* Day Selector Pills */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {DAYS.map((day) => {
              const isSelected = selectedDay === day;
              const isToday = data.todayDayOfWeek === day;
              const count = data.periods.filter((p) => p.dayOfWeek === day).length;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                  }`}
                >
                  <span className="text-xs font-bold">
                    {DAY_LABELS[day].en.slice(0, 3)}
                  </span>
                  <span className="text-[10px] opacity-80">
                    {DAY_LABELS[day].hi}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono mt-0.5 ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {count} p
                  </span>
                  {isToday && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        isSelected ? "bg-amber-300" : "bg-indigo-400"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Day's Schedule List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-slate-200">
                {DAY_LABELS[selectedDay].en} Schedule ({DAY_LABELS[selectedDay].hi})
              </h2>
              <span className="text-xs text-slate-400">
                {weeklyPeriods.length} Periods Scheduled
              </span>
            </div>

            {weeklyPeriods.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto" />
                <h3 className="text-sm font-semibold text-slate-300">
                  No Periods Scheduled for {DAY_LABELS[selectedDay].en}
                </h3>
                <p className="text-xs text-slate-500">
                  No classes have been mapped for this day in the section timetable.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {weeklyPeriods.map((period) => (
                  <div
                    key={period.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 flex items-center justify-between gap-3 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center font-bold text-xs text-slate-300 shrink-0">
                        P{period.periodNumber}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate">
                            {period.subjectName}
                          </h4>
                          {period.subjectCode && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                              {period.subjectCode}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-2 truncate">
                          <span>{period.teacherName || "Unassigned"}</span>
                          {period.roomNumber && (
                            <>
                              <span>•</span>
                              <span>Room {period.roomNumber}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-medium text-slate-300">
                        {period.startTime.slice(0, 5)} - {period.endTime.slice(0, 5)}
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        {period.periodType}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
