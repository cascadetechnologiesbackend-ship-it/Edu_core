"use client";

import React from "react";
import { AppModal } from "@/components/ui/AppModal";
import {
  FileText,
  Calendar,
  User,
  Paperclip,
  CheckCircle2,
  Clock,
  Award,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface HomeworkDetailModalProps {
  open: boolean;
  onClose: () => void;
  locale?: string;
  homework?: {
    id: string;
    title: string;
    description?: string | null;
    subjectName: string;
    dueDate: Date | string;
    isSubmitted?: boolean;
    attachmentS3Key?: string | null;
    teacherName?: string | null;
    status?: string | null;
    submission?: {
      submittedAt: Date | string;
      grade?: string | null;
      marksAwarded?: number | null;
      feedback?: string | null;
    } | null;
  } | null;
}

export function HomeworkDetailModal({
  open,
  onClose,
  locale = "en",
  homework,
}: HomeworkDetailModalProps) {
  if (!homework) return null;

  const isHi = locale === "hi";
  const dueDate = new Date(homework.dueDate);
  const formattedDueDate = dueDate.toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const isSubmitted = Boolean(homework.isSubmitted || homework.submission);
  const marksAwarded = homework.submission?.marksAwarded;
  const grade = homework.submission?.grade;
  const feedback = homework.submission?.feedback;
  const teacherName = homework.teacherName || (isHi ? "विषय अध्यापक" : "Subject Teacher");

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
            {homework.subjectName}
          </span>
          <span className="truncate">{homework.title}</span>
        </div>
      }
      description={
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {isHi ? "देय तिथि: " : "Due: "} {formattedDueDate}
          </span>
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-400" />
            {teacherName}
          </span>
        </div>
      }
    >
      <div className="space-y-4 py-1 text-sm text-slate-800 dark:text-slate-200" data-testid="homework-detail-modal">
        {/* Status Chip */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isHi ? "जमा करने की स्थिति" : "Submission Status"}
          </span>
          {isSubmitted ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {marksAwarded !== null && marksAwarded !== undefined
                ? `${isHi ? "मूल्यांकित: " : "Graded: "} ${marksAwarded} ${isHi ? "अंक" : "Marks"}`
                : isHi
                ? "जमा किया गया"
                : "Submitted"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              <Clock className="w-3.5 h-3.5" />
              {isHi ? "जमा करना बाकी" : "Pending Submission"}
            </span>
          )}
        </div>

        {/* Assignment Instructions / Description */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isHi ? "गृहकार्य विवरण" : "Assignment Instructions"}
          </h4>
          <div className="p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 whitespace-pre-wrap leading-relaxed">
            {homework.description || (isHi ? "कोई विस्तृत विवरण नहीं दिया गया है।" : "Complete the exercises as instructed in class.")}
          </div>
        </div>

        {/* Attachment if present */}
        {homework.attachmentS3Key && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {isHi ? "संलग्न फाइल" : "Attachment"}
            </h4>
            <a
              href={`/api/upload/view?key=${encodeURIComponent(homework.attachmentS3Key)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-xs font-medium text-indigo-950 dark:text-indigo-200 truncate">
                  {isHi ? "कार्यपत्रक या संदर्भ सामग्री देखें" : "View Worksheet / Reference Material"}
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 shrink-0 ml-2" />
            </a>
          </div>
        )}

        {/* Evaluation / Feedback if graded */}
        {isSubmitted && (feedback || grade || (marksAwarded !== null && marksAwarded !== undefined)) && (
          <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <Award className="w-4 h-4" />
              <span>{isHi ? "अध्यापक का मूल्यांकन" : "Teacher Evaluation"}</span>
            </div>
            {feedback && (
              <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                &ldquo;{feedback}&rdquo;
              </p>
            )}
          </div>
        )}
      </div>
    </AppModal>
  );
}
