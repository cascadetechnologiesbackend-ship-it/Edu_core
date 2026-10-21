"use client";

import React from "react";
import { AppModal } from "@/components/ui/AppModal";
import {
  Calendar,
  Award,
  BookOpen,
  FileText,
  Clock,
  Sparkles,
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
    maxMarks: number;
    syllabusCoverage?: string | null;
    status: string;
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
  const scheduledDate = new Date(assessment.scheduledDate);
  const formattedDate = scheduledDate.toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const typeDisplay = assessment.assessmentType.replace(/_/g, " ");

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
            {assessment.subjectName}
          </span>
          <span className="truncate">{assessment.title}</span>
        </div>
      }
      description={
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formattedDate}</span>
        </div>
      }
    >
      <div className="space-y-4 py-1 text-sm text-slate-800 dark:text-slate-200" data-testid="assessment-detail-modal">
        {/* Key Metrics Strip */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/50">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isHi ? "परीक्षा प्रकार" : "Assessment Type"}
            </div>
            <div className="text-sm font-bold text-purple-950 dark:text-purple-200 capitalize mt-0.5">
              {typeDisplay}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isHi ? "पूर्णांक (अधिकतम अंक)" : "Maximum Marks"}
            </div>
            <div className="text-sm font-bold text-indigo-950 dark:text-indigo-200 mt-0.5 flex items-center gap-1">
              <Award className="w-4 h-4 text-indigo-500" />
              <span>{assessment.maxMarks}</span>
            </div>
          </div>
        </div>

        {/* Syllabus / Chapters Covered */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            <span>{isHi ? "पाठ्यक्रम व अध्याय कवरेज" : "Syllabus & Topics Covered"}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
            {assessment.syllabusCoverage || (isHi ? "अध्यापक द्वारा निर्धारित इकाइयां शामिल हैं।" : "Chapters and topics covered in class will be tested.")}
          </div>
        </div>

        {/* Preparation Note */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            {isHi
              ? "विद्यार्थी कक्षा के नोट्स व दिए गए गृहकार्य का पुनरावलोकन करें।"
              : "Students should review class notes and assigned homework in preparation."}
          </span>
        </div>
      </div>
    </AppModal>
  );
}
