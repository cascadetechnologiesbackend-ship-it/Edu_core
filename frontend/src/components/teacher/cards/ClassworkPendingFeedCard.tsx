"use client";

import React from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { BookOpen, Clock, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export interface ClassworkPendingFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
}

export function ClassworkPendingFeedCard({
  card,
  locale = "en",
}: ClassworkPendingFeedCardProps) {
  const router = useRouter();
  const payload = card.payload || {};
  const periodNumber = payload.periodNumber;
  const subjectName = payload.subjectName || "";
  const className = payload.className || "";
  const sectionName = payload.sectionName || "";
  const startTime = payload.startTime || "";
  const endTime = payload.endTime || "";
  const sectionId = payload.sectionId || "";

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  const targetUrl = sectionId
    ? `/teacher/classes?period=${periodNumber}&sectionId=${sectionId}`
    : `/teacher/classes?period=${periodNumber}`;

  return (
    <TeacherFeedCard
      id={card.id}
      cardType="ClassworkPendingCard"
      tier={card.tier}
      title={titleStr}
      summary={summaryStr}
      severity="NORMAL"
      countdownChip={
        startTime && endTime
          ? `${startTime} - ${endTime}`
          : undefined
      }
      primaryAction={{
        label: locale === "hi" ? "कक्षा कार्य दर्ज करें" : "Record Classwork",
        onClick: () => router.push(targetUrl),
        variant: "primary",
      }}
      secondaryAction={{
        label: locale === "hi" ? "समय सारिणी" : "View Timetable",
        onClick: () => router.push("/teacher/classes"),
        variant: "outline",
      }}
    >
      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-white">
            {subjectName} {className && sectionName ? `(${className}-${sectionName})` : ""}
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          Period {periodNumber}
        </span>
      </div>
    </TeacherFeedCard>
  );
}

export default ClassworkPendingFeedCard;
