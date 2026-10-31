"use client";

import React from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { FileText, Clock, Users } from "lucide-react";
import { useRouter } from "next/navigation";

export interface HomeworkDueFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
}

export function HomeworkDueFeedCard({
  card,
  locale = "en",
}: HomeworkDueFeedCardProps) {
  const router = useRouter();
  const payload = card.payload || {};
  const assignmentId = payload.assignmentId;
  const title = payload.title || "";
  const subjectName = payload.subjectName || "";
  const className = payload.className || "";
  const sectionName = payload.sectionName || "";
  const submissionCount = payload.submissionCount || 0;
  const totalStudents = payload.totalStudents || 0;
  const dueDate = payload.dueDate;

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  const dueLabel = dueDate
    ? new Date(dueDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : undefined;

  return (
    <TeacherFeedCard
      id={card.id}
      cardType="HomeworkDueCard"
      tier={card.tier}
      title={titleStr}
      summary={summaryStr}
      severity="NORMAL"
      countdownChip={dueLabel ? `Due ${dueLabel}` : undefined}
      microProgress={{
        current: submissionCount,
        total: totalStudents,
        label: locale === "hi" ? "जमा करने की प्रगति" : "Submission Progress",
      }}
      primaryAction={{
        label: locale === "hi" ? "गृहकार्य देखें" : "View Submissions",
        onClick: () =>
          assignmentId
            ? router.push(`/teacher/homework?assignmentId=${assignmentId}`)
            : router.push("/teacher/homework"),
        variant: "primary",
      }}
    >
      <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-semibold text-white truncate max-w-[200px]">
            {title}
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          {submissionCount}/{totalStudents} submitted
        </span>
      </div>
    </TeacherFeedCard>
  );
}

export default HomeworkDueFeedCard;

