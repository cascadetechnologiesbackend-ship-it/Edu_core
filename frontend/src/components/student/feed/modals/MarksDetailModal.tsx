"use client";

import React from "react";
import Link from "next/link";
import { AppModal } from "@/components/ui/AppModal";
import {
  Award,
  Calendar,
  FileCheck2,
  Download,
  ExternalLink,
  Percent,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MarksDetailModalProps {
  open: boolean;
  onClose: () => void;
  locale?: string;
  marks?: {
    examId: string;
    examName: string;
    overallGrade?: string | null;
    percentage?: number | null;
    rank?: number | null;
    teacherRemarks?: string | null;
    pdfS3Key?: string | null;
    publishedAt: Date | string;
  } | null;
}

export function MarksDetailModal({
  open,
  onClose,
  locale = "en",
  marks,
}: MarksDetailModalProps) {
  if (!marks) return null;

  const isHi = locale === "hi";
  const pubDate = new Date(marks.publishedAt);
  const formattedDate = pubDate.toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {isHi ? "परीक्षा परिणाम" : "Examination Result"}
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {marks.examName}
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
          <Link
            href="/student/marks"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition"
          >
            <span>{isHi ? "विस्तृत रिपोर्ट कार्ड देखें" : "View Full Report Card"}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Overall Score Highlight */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              {isHi ? "ग्रेड" : "Grade"}
            </div>
            <div className="text-xl font-black mt-0.5">
              {marks.overallGrade || "—"}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-800 dark:text-indigo-300">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              {isHi ? "प्रतिशत" : "Percentage"}
            </div>
            <div className="text-xl font-black mt-0.5">
              {marks.percentage !== null && marks.percentage !== undefined
                ? `${marks.percentage}%`
                : "—"}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-800 dark:text-purple-300">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              {isHi ? "रैंक" : "Class Rank"}
            </div>
            <div className="text-xl font-black mt-0.5">
              {marks.rank ? `#${marks.rank}` : "—"}
            </div>
          </div>
        </div>

        {/* Date published */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-400">
          <Calendar className="w-4 h-4 text-slate-400" />
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">
              {isHi ? "परिणाम घोषणा तिथि" : "Published On"}
            </div>
            <div className="font-medium text-slate-900 dark:text-white">
              {formattedDate}
            </div>
          </div>
        </div>

        {/* Teacher Remarks */}
        {marks.teacherRemarks && (
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300">
            <div className="font-semibold text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isHi ? "कक्षा अध्यापक की टिप्पणी" : "Class Teacher's Remarks"}
            </div>
            <p className="text-xs leading-relaxed italic">
              &ldquo;{marks.teacherRemarks}&rdquo;
            </p>
          </div>
        )}

        {/* PDF Download link if available */}
        {marks.pdfS3Key && (
          <a
            href={`/api/documents/download?key=${encodeURIComponent(marks.pdfS3Key)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/60 transition w-full"
          >
            <Download className="w-4 h-4" />
            <span className="font-semibold">
              {isHi ? "हस्ताक्षरित रिपोर्ट कार्ड (PDF) डाउनलोड करें" : "Download Signed Report Card (PDF)"}
            </span>
            <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-70" />
          </a>
        )}
      </div>
    </AppModal>
  );
}
