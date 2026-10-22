"use client";

import React from "react";
import Link from "next/link";
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
  Send,
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
      remarks?: string | null;
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
  const isGraded = marksAwarded !== null && marksAwarded !== undefined;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {homework.subjectName}
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {homework.title}
            </h3>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {isHi ? "बंद करें" : "Close"}
          </button>
          {!isGraded ? (
            <Link
              href={`/student/homework?id=${homework.id}&action=submit`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSubmitted
                  ? isHi
                    ? "सबमिशन बदलें"
                    : "Resubmit Homework"
                  : isHi
                  ? "गृहकार्य जमा करें"
                  : "Submit Homework"}
              </span>
            </Link>
          ) : (
            <Link
              href="/student/homework?tab=graded"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition"
            >
              <Award className="w-3.5 h-3.5" />
              <span>{isHi ? "मूल्यांकन देखें" : "View Feedback"}</span>
            </Link>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Submission Status Chip Banner */}
        <div
          className={cn(
            "p-3 rounded-xl border flex items-center justify-between",
            isGraded
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
              : isSubmitted
              ? "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
          )}
        >
          <div className="flex items-center gap-2">
            {isGraded ? (
              <Award className="w-4 h-4 shrink-0" />
            ) : isSubmitted ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 shrink-0" />
            )}
            <span className="font-semibold">
              {isGraded
                ? isHi
                  ? `मूल्यांकित (${marksAwarded} अंक)`
                  : `Graded (${marksAwarded} Marks)`
                : isSubmitted
                ? isHi
                  ? "जमा किया गया"
                  : "Submitted"
                : isHi
                ? "जमा करना बाकी"
                : "Pending Submission"}
            </span>
          </div>
          <span className="text-[11px] font-medium opacity-80">
            {homework.teacherName || "Class Teacher"}
          </span>
        </div>

        {/* Due Date & Teacher */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <Calendar className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                {isHi ? "अंतिम तिथि" : "Due Date"}
              </div>
              <div className="font-medium text-slate-900 dark:text-white">
                {formattedDueDate}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <User className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                {isHi ? "अध्यापक" : "Assigned By"}
              </div>
              <div className="font-medium text-slate-900 dark:text-white">
                {homework.teacherName || "Class Teacher"}
              </div>
            </div>
          </div>
        </div>

        {/* Description / Instructions */}
        {homework.description && (
          <div className="space-y-1.5">
            <h4 className="font-semibold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
              {isHi ? "विवरण व निर्देश" : "Instructions"}
            </h4>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {homework.description}
            </div>
          </div>
        )}

        {/* Attached Teacher Resource File */}
        {homework.attachmentS3Key && (
          <div className="space-y-1.5">
            <h4 className="font-semibold text-slate-900 dark:text-white text-[11px] uppercase tracking-wider">
              {isHi ? "संलग्न सामग्री" : "Attached Material"}
            </h4>
            <a
              href={`/api/documents/download?key=${encodeURIComponent(homework.attachmentS3Key)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100/60 transition"
            >
              <Paperclip className="w-4 h-4" />
              <span className="font-medium">
                {isHi ? "सामग्री डाउनलोड करें" : "Download Attached Reference"}
              </span>
              <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-70" />
            </a>
          </div>
        )}

        {/* Feedback remarks if graded */}
        {homework.submission?.remarks && (
          <div className="space-y-1.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-1.5 font-semibold text-[11px]">
              <Award className="w-3.5 h-3.5" />
              <span>{isHi ? "अध्यापक की टिप्पणी" : "Teacher's Feedback"}</span>
            </div>
            <p className="text-xs leading-relaxed italic">
              &ldquo;{homework.submission.remarks}&rdquo;
            </p>
          </div>
        )}
      </div>
    </AppModal>
  );
}
