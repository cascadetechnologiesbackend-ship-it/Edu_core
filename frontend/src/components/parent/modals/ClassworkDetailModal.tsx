"use client";

import React from "react";
import { AppModal } from "@/components/ui/AppModal";
import {
  BookOpen,
  Calendar,
  User,
  Target,
  Sparkles,
  FileCheck2,
  FolderOpen,
} from "lucide-react";

export interface ClassworkDetailModalProps {
  open: boolean;
  onClose: () => void;
  locale?: string;
  classwork?: {
    id: string;
    subjectName: string;
    chapterName: string;
    topicName?: string | null;
    objectives?: string | null;
    teachingMethods?: string | null;
    resources?: string | null;
    homework?: string | null;
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
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const teacherName = classwork.teacherName || (isHi ? "विषय अध्यापक" : "Subject Teacher");

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            {classwork.subjectName}
          </span>
          <span className="truncate">{classwork.chapterName}</span>
        </div>
      }
      description={
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {isHi ? "कक्षा में पढ़ाया गया: " : "Taught on: "} {formattedDate}
          </span>
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-400" />
            {teacherName}
          </span>
        </div>
      }
    >
      <div className="space-y-4 py-1 text-sm text-slate-800 dark:text-slate-200" data-testid="classwork-detail-modal">
        {/* Topic Title */}
        {classwork.topicName && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                {isHi ? "शीर्षक / विषय" : "Topic / Unit"}
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {classwork.topicName}
              </div>
            </div>
          </div>
        )}

        {/* Learning Objectives */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isHi ? "सीखने के उद्देश्य" : "Learning Objectives"}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
            {classwork.objectives || (isHi ? "कक्षा में अवधारणा को स्पष्ट किया गया और अभ्यास कराया गया।" : "Core concepts explained and problem solving practiced in class.")}
          </div>
        </div>

        {/* Teaching Methods or Resources */}
        {(classwork.teachingMethods || classwork.resources) && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{isHi ? "अध्यापन विधि व संदर्भ" : "Teaching Methods & Resources"}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              {classwork.teachingMethods && (
                <div><span className="font-semibold text-slate-700 dark:text-slate-200">{isHi ? "पद्धति: " : "Method: "}</span>{classwork.teachingMethods}</div>
              )}
              {classwork.resources && (
                <div className="mt-1"><span className="font-semibold text-slate-700 dark:text-slate-200">{isHi ? "सामग्री: " : "Resources: "}</span>{classwork.resources}</div>
              )}
            </div>
          </div>
        )}

        {/* Homework Assigned */}
        {classwork.homework && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-500">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>{isHi ? "दिया गया अभ्यास कार्य / गृहकार्य" : "Assigned Practice / Homework"}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/50 text-xs text-blue-950 dark:text-blue-200 font-medium">
              {classwork.homework}
            </div>
          </div>
        )}
      </div>
    </AppModal>
  );
}
