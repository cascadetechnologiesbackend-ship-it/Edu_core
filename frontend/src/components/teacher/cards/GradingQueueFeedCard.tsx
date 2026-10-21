"use client";

import React from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { Award, AlertCircle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export interface GradingQueueFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
}

export function GradingQueueFeedCard({
  card,
  locale = "en",
}: GradingQueueFeedCardProps) {
  const router = useRouter();
  const payload = card.payload || {};
  const totalUngraded = payload.totalUngraded || 0;
  const assignments = payload.assignments || [];
  const topAssignment = payload.topAssignment || assignments[0];

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  return (
    <TeacherFeedCard
      id={card.id}
      cardType="GradingQueueCard"
      tier={card.tier}
      title={titleStr}
      summary={summaryStr}
      microProgress={
        topAssignment
          ? {
              current: topAssignment.gradedCount,
              total: topAssignment.totalSubmissions,
              label: locale === "hi" ? "मूल्यांकन प्रगति" : "Grading Progress",
            }
          : undefined
      }
      primaryAction={{
        label: locale === "hi" ? "अभी जांचें" : "Grade Now",
        onClick: () =>
          topAssignment
            ? router.push(`/teacher/grading?assignmentId=${topAssignment.assignmentId}`)
            : router.push("/teacher/grading"),
      }}
      secondaryAction={{
        label: locale === "hi" ? "सभी गृहकार्य" : "All Homework",
        onClick: () => router.push("/teacher/grading"),
      }}
    >
      {assignments.length > 1 && (
        <div className="space-y-1.5 pt-2">
          {assignments.slice(1, 3).map((asg: any) => (
            <div
              key={asg.assignmentId}
              onClick={() => router.push(`/teacher/grading?assignmentId=${asg.assignmentId}`)}
              className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700 transition text-xs"
            >
              <div>
                <span className="font-semibold text-slate-200">{asg.title}</span>
                <span className="text-slate-400 ml-1.5">
                  ({asg.className}-{asg.sectionName})
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {asg.ungradedCount} {locale === "hi" ? "बाकी" : "pending"}
              </span>
            </div>
          ))}
        </div>
      )}
    </TeacherFeedCard>
  );
}

export default GradingQueueFeedCard;
