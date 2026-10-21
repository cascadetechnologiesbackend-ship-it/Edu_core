"use client";

import React, { useState } from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { Check, CheckCircle2, Clock, MapPin, ArrowRight } from "lucide-react";
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
        locale === "hi"
          ? `पीरियड ${currentPeriod.periodNumber} पाठ पूरा हुआ`
          : `Period ${currentPeriod.periodNumber} lesson marked complete`
      );
    } catch {
      toast.error(
        locale === "hi" ? "पाठ पूर्ण करने में विफल" : "Failed to complete lesson"
      );
    } finally {
      setIsCompleting(false);
    }
  };

  return (
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
                ? locale === "hi" ? "पाठ पूर्ण" : "Lesson Done"
                : isCompleting
                ? locale === "hi" ? "सहेज रहे हैं..." : "Completing..."
                : locale === "hi" ? "पाठ पूर्ण करें" : "Complete Lesson",
              onClick: handleCompleteLesson,
            }
          : {
              label: locale === "hi" ? "समय सारिणी" : "My Timetable",
              onClick: () => router.push("/teacher/classes"),
            }
      }
      secondaryAction={{
        label: locale === "hi" ? "कक्षाएं" : "Classes",
        onClick: () => router.push("/teacher/classes"),
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {/* Current Period Card */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-emerald-400">
                {locale === "hi" ? "वर्तमान पीरियड" : "Current Period"}
              </span>
              {currentPeriod && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  {currentPeriod.startTime} - {currentPeriod.endTime}
                </span>
              )}
            </div>

            {currentPeriod && !isFreeNow ? (
              <div>
                <div className="text-sm font-bold text-white">
                  {currentPeriod.subjectName || "Subject"} · {currentPeriod.className}-{currentPeriod.sectionName}
                </div>
                {currentPeriod.roomNumber && (
                  <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    Room {currentPeriod.roomNumber}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-300 italic py-1">
                {locale === "hi"
                  ? `${freeUntil ? `${freeUntil} तक ` : ""}खाली पीरियड`
                  : `Free period${freeUntil ? ` until ${freeUntil}` : ""}`}
              </div>
            )}
          </div>
        </div>

        {/* Next Period Card */}
        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-indigo-400">
                {locale === "hi" ? "अगला पीरियड" : "Up Next"}
              </span>
              {nextPeriod && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
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
              <div className="text-xs text-slate-400 italic py-1">
                {locale === "hi" ? "दिन का कोई अगला पीरियड नहीं है" : "No more periods today"}
              </div>
            )}
          </div>
        </div>
      </div>
    </TeacherFeedCard>
  );
}

export default NowNextFeedCard;
