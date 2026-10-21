"use client";

import React from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { Users, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export interface AttendanceNowFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
  onOpenWorkbench?: ((sectionId?: string) => void) | undefined;
}

export function AttendanceNowFeedCard({
  card,
  locale = "en",
  onOpenWorkbench,
}: AttendanceNowFeedCardProps) {
  const router = useRouter();
  const payload = card.payload || {};
  const sections = payload.sections || [];
  const unmarkedSections = payload.unmarkedSections || [];
  const isApproachingCutoff = !!payload.isApproachingCutoff;
  const isCutoffPassed = !!payload.isCutoffPassed;

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  const severity = isCutoffPassed ? "ROSE" : isApproachingCutoff ? "AMBER" : "NORMAL";
  const countdownChip = isCutoffPassed
    ? locale === "hi" ? "समय समाप्त" : "Cutoff Passed"
    : isApproachingCutoff
    ? locale === "hi" ? "समय समाप्त होने वाला है" : "Window Closing Soon"
    : undefined;

  const handleAction = () => {
    if (onOpenWorkbench) {
      onOpenWorkbench(unmarkedSections[0]?.sectionId);
    } else {
      router.push("/teacher/attendance");
    }
  };

  return (
    <TeacherFeedCard
      id={card.id}
      cardType="AttendanceNowCard"
      tier={card.tier}
      title={titleStr}
      summary={summaryStr}
      severity={severity}
      countdownChip={countdownChip}
      primaryAction={{
        label: locale === "hi" ? "उपस्थिति दर्ज करें" : "Mark Attendance",
        onClick: handleAction,
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {sections.map((sec: any) => (
          <div
            key={sec.sectionId}
            onClick={() => onOpenWorkbench ? onOpenWorkbench(sec.sectionId) : router.push(`/teacher/attendance?sectionId=${sec.sectionId}`)}
            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
              sec.isMarked
                ? "bg-slate-950/40 border-emerald-500/30 hover:border-emerald-500/50"
                : "bg-slate-950/80 border-slate-700/80 hover:border-amber-500/50"
            }`}
          >
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{sec.className}-{sec.sectionName}</span>
                {sec.isMarked && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {sec.isMarked
                  ? `${sec.presentCount} present · ${sec.absentCount} absent`
                  : `${sec.totalStudents} students waiting`}
              </div>
            </div>

            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                sec.isMarked
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
              }`}
            >
              {sec.isMarked
                ? locale === "hi" ? "पूर्ण" : "Marked"
                : locale === "hi" ? "लंबित" : "Pending"}
            </span>
          </div>
        ))}
      </div>
    </TeacherFeedCard>
  );
}

export default AttendanceNowFeedCard;
