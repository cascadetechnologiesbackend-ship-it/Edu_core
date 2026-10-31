"use client";

import React from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { UserCheck, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

export interface LeaveQueueFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
}

export function LeaveQueueFeedCard({
  card,
  locale = "en",
}: LeaveQueueFeedCardProps) {
  const router = useRouter();
  const payload = card.payload || {};
  const pendingCount = payload.pendingCount || 0;
  const isOverdue = !!payload.isOverdue;
  const oldestAgeHours = payload.oldestAgeHours;
  const requests = payload.requests || [];

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  const countdownChip = isOverdue
    ? locale === "hi"
      ? `${oldestAgeHours} घंटे से लंबित`
      : `${oldestAgeHours}h waiting`
    : undefined;

  return (
    <TeacherFeedCard
      id={card.id}
      cardType="LeaveQueueCard"
      tier={card.tier}
      title={titleStr}
      summary={summaryStr}
      severity={isOverdue ? "AMBER" : "NORMAL"}
      countdownChip={countdownChip}
      primaryAction={{
        label: locale === "hi" ? "अवकाश स्वीकृत करें" : "Review Requests",
        onClick: () => router.push("/teacher/attendance?tab=leaves"),
      }}
    >
      {requests.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {requests.slice(0, 2).map((req: any) => (
            <div
              key={req.id}
              onClick={() => router.push("/teacher/attendance?tab=leaves")}
              className="min-h-[38px] p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700 transition text-xs"
            >
              <div>
                <span className="font-semibold text-white">{req.studentName}</span>
                <span className="text-slate-400 ml-1.5">
                  ({req.className}-{req.sectionName}) · {req.leaveType}
                </span>
                <p className="text-[11px] text-slate-400 italic truncate max-w-xs mt-0.5">
                  &ldquo;{req.reason}&rdquo;
                </p>
              </div>
              <span className="text-[10px] text-amber-400 font-medium shrink-0 ml-2">
                {req.startDate}
              </span>
            </div>
          ))}
        </div>
      )}
    </TeacherFeedCard>
  );
}

export default LeaveQueueFeedCard;
