"use client";

import React from "react";
import { AppModal } from "@/components/ui/AppModal";
import {
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  Award,
  AlertCircle,
  Paperclip,
  Download,
  RotateCw,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentHomeworkItem } from "@/app/(student)/student/homework/homeworkActions";

export interface HomeworkViewModalProps {
  open: boolean;
  onClose: () => void;
  homework: StudentHomeworkItem | null;
  locale?: string;
  onResubmit?: (homework: StudentHomeworkItem) => void;
}

export function HomeworkViewModal({
  open,
  onClose,
  homework,
  locale = "en",
  onResubmit,
}: HomeworkViewModalProps) {
  if (!homework) return null;

  const isHi = locale === "hi";
  const sub = homework.submission;
  const isGraded = Boolean(sub?.isGraded);

  const formattedDueDate = new Date(homework.dueDate).toLocaleDateString(
    isHi ? "hi-IN" : "en-IN",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  const formattedSubmittedAt = sub?.submittedAt
    ? new Date(sub.submittedAt).toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const formattedGradedAt = sub?.gradedAt
    ? new Date(sub.gradedAt).toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {homework.subjectName}
              </span>
              {isGraded ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {isHi ? "जाँचा गया" : "Graded"}
                </span>
              ) : sub ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {isHi ? "समीक्षाधीन" : "Under Review"}
                </span>
              ) : null}
            </div>
            <h3 className="text-base font-bold text-slate-100 leading-tight mt-0.5">
              {homework.title}
            </h3>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            {isHi ? "बंद करें" : "Close"}
          </button>
          {!isGraded && onResubmit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onResubmit(homework);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition"
            >
              <RotateCw className="w-4 h-4" />
              <span>{isHi ? "उत्तर संशोधित करें" : "Edit / Resubmit"}</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Graded Score Card Banner */}
        {isGraded && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    {isHi ? "प्राप्त अंक" : "Score Awarded"}
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl font-black text-white">
                      {sub?.marksAwarded ?? "--"}
                    </span>
                    {homework.maxMarks && (
                      <span className="text-sm font-semibold text-slate-400">
                        / {homework.maxMarks}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {formattedGradedAt && (
                <div className="text-right text-[11px] text-slate-400">
                  <span>{isHi ? "जाँच की तिथि" : "Graded on"}</span>
                  <div className="font-semibold text-slate-300">
                    {formattedGradedAt}
                  </div>
                </div>
              )}
            </div>

            {sub?.remarks && (
              <div className="mt-3 pt-3 border-t border-emerald-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  {isHi ? "शिक्षक की टिप्पणी" : "Teacher Feedback & Remarks"}
                </span>
                <p className="text-slate-200 text-xs italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  "{sub.remarks}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Timing and Teacher Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-2.5 text-slate-300">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 block">
                {isHi ? "अंतिम तिथि" : "Due Date"}
              </span>
              <span className="font-semibold">{formattedDueDate}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-2.5 text-slate-300">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 block">
                {isHi ? "शिक्षक" : "Teacher"}
              </span>
              <span className="font-semibold">{homework.teacherName}</span>
            </div>
          </div>
        </div>

        {/* Late submission badge if late */}
        {sub?.isLate && (
          <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {isHi
                ? "यह कार्य अंतिम तिथि के बाद जमा किया गया था (Late Submission)।"
                : "This assignment was submitted after the deadline and recorded as Late."}
            </span>
          </div>
        )}

        {/* Assignment Prompt */}
        {homework.description && (
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {isHi ? "गृहकार्य विवरण" : "Assignment Instructions"}
            </h4>
            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
              {homework.description}
            </p>
          </div>
        )}

        {/* Student Submission Record */}
        {sub && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isHi ? "आपका जमा किया गया उत्तर" : "Your Submission"}</span>
              </h4>
              {formattedSubmittedAt && (
                <span className="text-[10px] text-slate-500">
                  {formattedSubmittedAt}
                </span>
              )}
            </div>

            {sub.studentContent ? (
              <p className="text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 font-sans">
                {sub.studentContent}
              </p>
            ) : (
              <p className="text-slate-500 italic">
                {isHi ? "कोई लिखित उत्तर दर्ज नहीं है।" : "No written text answer."}
              </p>
            )}

            {sub.attachmentS3Key && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center gap-2 truncate">
                  <Paperclip className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-xs text-slate-300 truncate">
                    {sub.attachmentS3Key.split("/").pop() || "Attached File"}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                  {isHi ? "संलग्नक" : "Attached"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </AppModal>
  );
}
