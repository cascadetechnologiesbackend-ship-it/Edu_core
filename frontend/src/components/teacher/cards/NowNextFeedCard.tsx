"use client";

import React, { useState } from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import {
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowRight,
  Users,
  BookOpen,
  FileSpreadsheet,
  Coffee,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export interface NowNextFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
  onLessonComplete?: ((periodId: string) => Promise<void>) | undefined;
}

export function NowNextFeedCard({
  card,
  locale = "en",
  onLessonComplete,
}: NowNextFeedCardProps) {
  const router = useRouter();
  const [isCompleting, setIsCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const payload = card.payload || {};
  const currentPeriod = payload.currentPeriod;
  const nextPeriod = payload.nextPeriod;
  const isFreeNow = payload.isFreeNow;
  const freeUntil = payload.freeUntil;
  const totalPeriodsCount = payload.totalPeriodsCount ?? 0;
  const completedPeriodsCount = payload.completedPeriodsCount ?? 0;
  const minutesRemaining = payload.minutesRemaining ?? 0;

  const isHi = locale === "hi";
  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  const handleCompleteLesson = async () => {
    if (!currentPeriod?.periodId) return;
    setIsCompleting(true);
    try {
      if (onLessonComplete) {
        await onLessonComplete(currentPeriod.periodId);
      }
      setCompleted(true);
      toast.success(
        isHi
          ? `पीरियड ${currentPeriod.periodNumber} पाठ पूरा हुआ`
          : `Period ${currentPeriod.periodNumber} lesson marked complete`
      );
    } catch {
      toast.error(
        isHi ? "पाठ पूर्ण करने में विफल" : "Failed to complete lesson"
      );
    } finally {
      setIsCompleting(false);
    }
  };

  const progressPercent =
    totalPeriodsCount > 0
      ? Math.round((completedPeriodsCount / totalPeriodsCount) * 100)
      : 0;

  return (
    <div data-testid="now-cockpit-card">
      <TeacherFeedCard
        id={card.id}
        cardType="NowNextCard"
        tier={card.tier}
        title={titleStr}
        summary={summaryStr}
        primaryAction={
          currentPeriod && !isFreeNow
            ? {
                label: completed
                  ? isHi ? "पाठ पूर्ण" : "Lesson Done"
                  : isCompleting
                  ? isHi ? "सहेज रहे हैं..." : "Completing..."
                  : isHi ? "पाठ पूर्ण करें" : "Complete Lesson",
                onClick: handleCompleteLesson,
              }
            : {
                label: isHi ? "समय सारिणी" : "My Timetable",
                onClick: () => router.push("/teacher/classes"),
              }
        }
        secondaryAction={
          currentPeriod?.sectionId
            ? {
                label: isHi ? "उपस्थिति दर्ज करें" : "Take Attendance",
                onClick: () => router.push(`/teacher/attendance?sectionId=${currentPeriod.sectionId}`),
              }
            : {
                label: isHi ? "कक्षाएं" : "Classes",
                onClick: () => router.push("/teacher/classes"),
              }
        }
      >
        <div className="space-y-3 pt-1">
          {/* Day Progress Strip (if periods exist) */}
          {totalPeriodsCount > 0 && (
            <div
              data-testid="now-cockpit-progress-ring"
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
            >
              <div className="flex items-center gap-2">
                <div className="relative w-7 h-7 flex items-center justify-center">
                  <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      className="stroke-slate-800"
                      strokeWidth="3.5"
                      fill="none"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      className="stroke-emerald-500 transition-all duration-500"
                      strokeWidth="3.5"
                      strokeDasharray="88"
                      strokeDashoffset={88 - (88 * progressPercent) / 100}
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                  <span className="absolute text-[9px] font-black font-mono text-emerald-400">
                    {progressPercent}%
                  </span>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-white">
                    {isHi ? "दैनिक प्रगति" : "Daily Period Progress"}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isHi
                      ? `${totalPeriodsCount} में से ${completedPeriodsCount} पीरियड पूरे हुए`
                      : `${completedPeriodsCount} of ${totalPeriodsCount} teaching periods complete`}
                  </div>
                </div>
              </div>

              {minutesRemaining > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {minutesRemaining}m {isHi ? "शेष" : "left"}
                </span>
              )}
            </div>
          )}

          {/* Current & Next Periods Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Current Period Card */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    {isHi ? "वर्तमान पीरियड" : "Current Period"}
                  </span>
                  {currentPeriod && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      {currentPeriod.startTime} - {currentPeriod.endTime}
                    </span>
                  )}
                </div>

                {currentPeriod && !isFreeNow ? (
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-white">
                      {currentPeriod.subjectName || "Subject"} · {currentPeriod.className}-{currentPeriod.sectionName}
                    </div>
                    {currentPeriod.roomNumber && (
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        Room {currentPeriod.roomNumber}
                      </div>
                    )}

                    {/* 1-tap roll call launcher */}
                    {currentPeriod.sectionId && (
                      <div className="pt-2">
                        <button
                          type="button"
                          data-testid="now-cockpit-rollcall-btn"
                          onClick={() =>
                            router.push(`/teacher/attendance?sectionId=${currentPeriod.sectionId}`)
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600/90 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{isHi ? "रोल कॉल दर्ज करें" : "Take Roll Call"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-300 italic py-2 flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-slate-500" />
                    <span>
                      {isHi
                        ? `${freeUntil ? `${freeUntil} तक ` : ""}खाली पीरियड`
                        : `Free period${freeUntil ? ` until ${freeUntil}` : ""}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Next Period Card */}
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-indigo-400">
                    {isHi ? "अगला पीरियड" : "Up Next"}
                  </span>
                  {nextPeriod && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                      <Clock className="w-3 h-3 text-indigo-400" />
                      {nextPeriod.startTime}
                    </span>
                  )}
                </div>

                {nextPeriod ? (
                  <div>
                    <div className="text-sm font-bold text-slate-200">
                      Period {nextPeriod.periodNumber}: {nextPeriod.subjectName || "Subject"}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {nextPeriod.className}-{nextPeriod.sectionName}
                      {nextPeriod.roomNumber && ` · Room ${nextPeriod.roomNumber}`}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-2">
                    {isHi ? "दिन का कोई अगला पीरियड नहीं है" : "No more periods today"}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Shortcuts Rail */}
          <div className="pt-1 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => router.push("/teacher/homework")}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <BookOpen className="w-3 h-3 text-emerald-400" />
              <span>{isHi ? "गृहकार्य" : "Homework"}</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/teacher/classes")}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Users className="w-3 h-3 text-indigo-400" />
              <span>{isHi ? "कक्षाएं व रोस्टर" : "Classes & Rosters"}</span>
            </button>
            <button
              type="button"
              onClick={() => router.push("/teacher/syllabus")}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3 h-3 text-amber-400" />
              <span>{isHi ? "पाठ्यक्रम प्रगति" : "Syllabus Tracker"}</span>
            </button>
          </div>
        </div>
      </TeacherFeedCard>
    </div>
  );
}

export default NowNextFeedCard;
