"use client";

import React from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  Sparkles,
  User,
} from "lucide-react";
import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";
import { cn } from "@/lib/utils";

export interface ClassworkPostCardProps {
  card: DerivedFeedCard;
  locale?: string;
  onOpenDetail?: (payload: any) => void;
}

export function ClassworkPostCard({
  card,
  locale = "en",
  onOpenDetail,
}: ClassworkPostCardProps) {
  const isHi = locale === "hi";
  const {
    classworkId,
    subjectName = "Academics",
    chapterName = "Chapter",
    topicName = null,
    objectives = null,
    teachingMethods = null,
    resources = null,
    homework = null,
    completedDate = new Date().toISOString(),
    teacherName = null,
  } = card.payload || {};

  const handleCardClick = () => {
    if (onOpenDetail) {
      onOpenDetail({
        id: classworkId || card.id,
        subjectName,
        chapterName,
        topicName,
        objectives,
        teachingMethods,
        resources,
        homework,
        completedDate,
        teacherName,
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
      data-testid="classwork-post-card"
      className="group w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
    >
      {/* Emerald Subject Top Band */}
      <div className="h-1.5 w-full bg-linear-to-r from-emerald-500 to-teal-600" />

      <div className="p-4 sm:p-5 space-y-3">
        {/* Top Header: Badge + Ward + Completed Time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 truncate">
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

          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>{isHi ? "कक्षा कार्य पूर्ण" : "Classwork Done"}</span>
          </span>
        </div>

        {/* Heading: 'Today in Mathematics' style */}
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            {chapterName}
            {topicName ? ` • ${topicName}` : ""}
          </h3>

          {/* One line objectives snippet */}
          {objectives && (
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {objectives}
            </p>
          )}
        </div>

        {/* Homework line if set */}
        {homework && (
          <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-2 text-xs">
            <FileCheck2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-bold text-blue-950 dark:text-blue-200">
                {isHi ? "गृहकार्य: " : "Homework: "}
              </span>
              <span className="text-blue-900/90 dark:text-blue-300 font-medium line-clamp-1">
                {homework}
              </span>
            </div>
          </div>
        )}

        {/* Footer: Teacher Name + Detail Tap Arrow */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {teacherName || (isHi ? "कक्षा अध्यापक" : "Class Teacher")}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <span>{isHi ? "विस्तार देखें" : "View Details"}</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
