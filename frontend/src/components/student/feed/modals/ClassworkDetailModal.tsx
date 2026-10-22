"use client";

import React from "react";
import { AppModal } from "@/components/ui/AppModal";
import {
  BookOpen,
  Calendar,
  User,
  CheckCircle2,
  FileText,
  Target,
  BookmarkCheck,
} from "lucide-react";

export interface ClassworkDetailModalProps {
  open: boolean;
  onClose: () => void;
  locale?: string;
  classwork?: {
    id: string;
    subjectName: string;
    chapterName?: string | null;
    topicTitle?: string | null;
    objectives?: string | null;
    homework?: string | null;
    teachingMethods?: string | null;
    resources?: string | null;
    completedDate: Date | string;
    teacherName?: string | null;
  } | null;
}

export function ClassworkDetailModal({
  open,
  onClose,
  locale = "en",
  classwork,
}: ClassworkDetailModalProps) {
  if (!classwork) return null;

  const isHi = locale === "hi";
  const completedDate = new Date(classwork.completedDate);
  const formattedDate = completedDate.toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              {classwork.subjectName}
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {classwork.topicTitle || classwork.chapterName || (isHi ? "कक्षा कार्य संक्षेप" : "Classwork Recap")}
            </h3>
          </div>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition ml-auto"
        >
          {isHi ? "बंद करें" : "Close"}
        </button>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Date & Teacher */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <Calendar className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                {isHi ? "कक्षा तिथि" : "Taught On"}
              </div>
              <div className="font-medium text-slate-900 dark:text-white">
                {formattedDate}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <User className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                {isHi ? "अध्यापक" : "Teacher"}
              </div>
              <div className="font-medium text-slate-900 dark:text-white">
                {classwork.teacherName || "Subject Teacher"}
              </div>
            </div>
          </div>
        </div>

        {/* Chapter & Topic */}
        {classwork.chapterName && (
          <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 space-y-1">
            <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
              {isHi ? "अध्याय" : "Chapter"}
            </div>
            <div className="font-semibold text-sm">{classwork.chapterName}</div>
          </div>
        )}

        {/* Learning Objectives */}
        {classwork.objectives && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 text-teal-500" />
              <span>{isHi ? "सीखने के मुख्य बिंदु" : "Learning Objectives"}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {classwork.objectives}
            </div>
          </div>
        )}

        {/* Homework assigned in class */}
        {classwork.homework && (
          <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider">
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>{isHi ? "कक्षा में दिया गया गृहकार्य" : "Homework Assigned in Class"}</span>
            </div>
            <p className="text-xs leading-relaxed font-medium">
              {classwork.homework}
            </p>
          </div>
        )}
      </div>
    </AppModal>
  );
}
