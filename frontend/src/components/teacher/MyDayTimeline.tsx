"use client";

import React, { useState, useTransition } from "react";
import {
  Clock,
  CheckCircle2,
  BookOpen,
  MapPin,
  ArrowRight,
  Sparkles,
  Users,
  Repeat,
  Coffee,
} from "lucide-react";
import { toast } from "sonner";
import {
  MyDayPeriodItem,
  completeLessonPlanAction,
} from "@/app/(teacher)/teacher/classes/classesActions";

interface MyDayTimelineProps {
  timeline: MyDayPeriodItem[];
  date: string;
  dayOfWeek: string;
  onLessonCompleted?: (periodNumber: number) => void;
}

export default function MyDayTimeline({
  timeline,
  date,
  dayOfWeek,
  onLessonCompleted,
}: MyDayTimelineProps) {
  const [periods, setPeriods] = useState<MyDayPeriodItem[]>(timeline);
  const [completingPeriod, setCompletingPeriod] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCompleteLesson = (period: MyDayPeriodItem) => {
    setCompletingPeriod(period.periodNumber);

    startTransition(async () => {
      try {
        const res = await completeLessonPlanAction({
          lessonPlanId: period.lessonPlan?.id,
          title: `${period.className}-${period.sectionName} ${period.subjectName || "Lesson"}`,
          chapterName: period.lessonPlan?.chapterName || "Daily Unit",
        });

        if (res.success) {
          toast.success(
            `Period ${period.periodNumber} (${period.className}-${period.sectionName}): Lesson marked complete!`
          );

          setPeriods((prev) =>
            prev.map((p) =>
              p.periodNumber === period.periodNumber
                ? {
                    ...p,
                    lessonPlan: {
                      id: p.lessonPlan?.id || "temp-completed",
                      title: p.lessonPlan?.title || "Lesson",
                      chapterName: p.lessonPlan?.chapterName || "Unit",
                      status: "COMPLETED",
                    },
                  }
                : p
            )
          );

          if (onLessonCompleted) {
            onLessonCompleted(period.periodNumber);
          }
        }
      } catch (err: any) {
        toast.error("Failed to complete lesson.");
      } finally {
        setCompletingPeriod(null);
      }
    });
  };

  if (periods.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">No Timetable Periods Scheduled</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          There are no scheduled teaching periods or bell schedule entries for {dayOfWeek}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Timeline Date Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Today&apos;s Schedule · {dayOfWeek} ({date})
          </h2>
          <p className="text-[11px] text-slate-400">
            Choreographed bell schedule with live lesson plan status and substitution overlays.
          </p>
        </div>
      </div>

      {/* ─── Vertical Choreographed Timeline ─────────────────────────────── */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
        {periods.map((period) => {
          const isLessonDone = period.lessonPlan?.status === "COMPLETED";

          return (
            <div key={period.periodNumber} className="relative group">
              {/* Timeline Indicator Dot */}
              <div
                className={`absolute -left-6 top-3.5 w-4 h-4 rounded-full border-2 transition-all ${
                  period.isNow
                    ? "bg-emerald-500 border-slate-950 ring-4 ring-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    : isLessonDone
                    ? "bg-emerald-600 border-slate-900"
                    : period.isFree
                    ? "bg-slate-800 border-slate-700"
                    : "bg-slate-700 border-slate-900"
                }`}
              />

              {/* Period Card */}
              <div
                className={`rounded-2xl border p-4 transition-all shadow-sm ${
                  period.isNow
                    ? "border-emerald-500/50 bg-gradient-to-r from-emerald-950/20 via-slate-900/90 to-slate-900/90 ring-1 ring-emerald-500/30"
                    : period.isFree
                    ? "border-slate-800/60 bg-slate-950/40 text-slate-400"
                    : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Period Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-white font-mono">
                        Period {period.periodNumber}
                      </span>

                      <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {period.startTime} – {period.endTime}
                      </span>

                      {period.isNow && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Running Now
                        </span>
                      )}

                      {period.substitution && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Repeat className="w-3 h-3" />
                          {period.substitution.type === "INCOMING_COVER"
                            ? "Covering Class"
                            : "Substitute Assigned"}
                        </span>
                      )}
                    </div>

                    {period.isFree ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 pt-0.5">
                        <Coffee className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {period.periodType === "LUNCH"
                            ? "Lunch Break"
                            : period.periodType === "BREAK"
                            ? "Recess / Break"
                            : `Free period until ${period.endTime}`}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>
                            {period.className} · Section {period.sectionName}
                          </span>
                          <span className="text-slate-400 font-normal">|</span>
                          <span className="text-emerald-400">{period.subjectName}</span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            {period.roomNumber || "Main Building"}
                          </span>

                          {period.lessonPlan && (
                            <span className="flex items-center gap-1 truncate max-w-xs">
                              <BookOpen className="w-3 h-3 text-slate-500" />
                              {period.lessonPlan.title}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Actions: 1-Tap Lesson Completion (AC-T1 / Click Budget: 1 tap) */}
                  {!period.isFree && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isLessonDone ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Lesson Complete
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCompleteLesson(period)}
                          disabled={isPending && completingPeriod === period.periodNumber}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                            period.isNow
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-emerald-900/40 shadow-md"
                              : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                          } disabled:opacity-50`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {isPending && completingPeriod === period.periodNumber
                            ? "Completing..."
                            : "Complete Lesson"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
