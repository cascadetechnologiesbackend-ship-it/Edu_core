"use client";

import React from "react";
import {
  FileText,
  Calendar,
  User,
  Paperclip,
  CheckCircle2,
  Clock,
  Award,
  ChevronRight,
} from "lucide-react";
import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";
import { cn } from "@/lib/utils";

export interface HomeworkPostCardProps {
  card: DerivedFeedCard;
  locale?: string;
  onOpenDetail?: (payload: any) => void;
}

export function HomeworkPostCard({
  card,
  locale = "en",
  onOpenDetail,
}: HomeworkPostCardProps) {
  const isHi = locale === "hi";
  const {
    homeworkId,
    title = "Homework Assignment",
    description,
    subjectName = "Academics",
    dueDate = new Date().toISOString(),
    dueBadge,
    submissionStatus,
    isSubmitted = false,
    hasAttachment = false,
    teacherName,
    marksAwarded = null,
    grade = null,
    feedback = null,
  } = card.payload || {};

  const dueBadgeText =
    (dueBadge && typeof dueBadge === "object" ? dueBadge[isHi ? "hi" : "en"] : dueBadge) ||
    (isHi ? "देय" : "Due Soon");

  const subStatusText =
    (submissionStatus && typeof submissionStatus === "object"
      ? submissionStatus[isHi ? "hi" : "en"]
      : submissionStatus) ||
    (isSubmitted ? (isHi ? "जमा किया गया" : "Submitted") : (isHi ? "जमा करना बाकी" : "Pending"));

  const isDueToday = typeof dueBadgeText === "string" && (dueBadgeText.includes("today") || dueBadgeText.includes("आज"));
  const isDueTomorrow = typeof dueBadgeText === "string" && (dueBadgeText.includes("tomorrow") || dueBadgeText.includes("कल"));

  const handleCardClick = () => {
    if (onOpenDetail) {
      onOpenDetail({
        id: homeworkId || card.id,
        title,
        description,
        subjectName,
        dueDate,
        isSubmitted,
        attachmentS3Key: hasAttachment ? card.payload?.attachmentS3Key || "attachment" : null,
        teacherName,
        submission: isSubmitted
          ? {
              submittedAt: card.payload?.submittedAt || dueDate,
              grade,
              marksAwarded,
              feedback,
            }
          : null,
      });
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      data-testid="homework-post-card"
      className="group w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
    >
      {/* Subject Color Header Band */}
      <div className="h-1.5 w-full bg-linear-to-r from-blue-500 to-indigo-600" />

      <div className="p-4 sm:p-5 space-y-3">
        {/* Top Meta: Subject + Ward Avatar/Chip + Due Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 truncate">
              {subjectName}
            </span>
            {card.wardName && (
              <span
                data-testid="ward-chip"
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              >
                {card.wardName}
              </span>
            )}
          </div>

          <span
            className={cn(
              "shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
              isDueToday
                ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60"
                : isDueTomorrow
                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            )}
          >
            <Clock className="w-3 h-3" />
            {dueBadgeText}
          </span>
        </div>

        {/* Title & Description Snippet */}
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Footer info: Submission chip + Attachment + Teacher name */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            {isSubmitted ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{subStatusText}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{subStatusText}</span>
              </span>
            )}

            {hasAttachment && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-medium ml-1">
                <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isHi ? "फाइल संलग्न" : "Attachment"}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            {teacherName && <span>{teacherName}</span>}
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
