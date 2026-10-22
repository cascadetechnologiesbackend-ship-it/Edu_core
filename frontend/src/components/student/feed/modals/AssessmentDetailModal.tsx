"use client";

import React from "react";
import { AppModal } from "@/components/ui/AppModal";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Award,
  BookOpen,
  AlertCircle,
  FileCheck2,
} from "lucide-react";

export interface AssessmentDetailModalProps {
  open: boolean;
  onClose: () => void;
  locale?: string;
  assessment?: {
    id: string;
    title: string;
    subjectName: string;
    assessmentType: string;
    scheduledDate: Date | string;
    countdown?: { en: string; hi: string } | null;
    maxMarks: number;
    syllabusCoverage?: string | null;
  } | null;
}

export function AssessmentDetailModal({
  open,
  onClose,
  locale = "en",
  assessment,
}: AssessmentDetailModalProps) {
  if (!assessment) return null;

  const isHi = locale === "hi";
  const dateObj = new Date(assessment.scheduledDate);
  const formattedDate = dateObj.toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              {assessment.subjectName}
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {assessment.title}
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
        {/* Scheduled Date Banner */}
        <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <div>
              <div className="font-semibold text-sm">{formattedDate}</div>
              <div className="text-[11px] opacity-80">
                {assessment.countdown ? (isHi ? assessment.countdown.hi : assessment.countdown.en) : ""}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">
              {isHi ? "अधिकतम अंक" : "Max Marks"}
            </div>
            <div className="text-base font-extrabold">{assessment.maxMarks}</div>
          </div>
        </div>

        {/* Assessment Type */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300">
          <span className="font-medium text-slate-500 dark:text-slate-400">
            {isHi ? "मूल्यांकन प्रकार" : "Assessment Category"}
          </span>
          <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
            {assessment.assessmentType.replace(/_/g, " ")}
          </span>
        </div>

        {/* Syllabus Coverage */}
        {assessment.syllabusCoverage && (
          <div className="space-y-1.5">
            <h4 className="font-semibold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
              {isHi ? "पाठ्यक्रम / टॉपिक्स" : "Syllabus Coverage"}
            </h4>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {assessment.syllabusCoverage}
            </div>
          </div>
        )}
      </div>
    </AppModal>
  );
}
