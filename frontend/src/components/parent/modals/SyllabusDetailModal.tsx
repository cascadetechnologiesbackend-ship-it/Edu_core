"use client";

import React, { useState } from "react";
import { AppModal } from "@/components/ui/AppModal";
import {
  CheckCircle2,
  Circle,
  BookOpen,
  ChevronRight,
  TrendingUp,
  Layers,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SyllabusDetailModalProps {
  open: boolean;
  onClose: () => void;
  locale?: string;
  data?: {
    termName?: string | null;
    subjects: Array<{
      subjectId: string;
      subjectName: string;
      completedTopicsCount: number;
      totalTopicsCount: number;
      progressPercent: number;
      units?: Array<{
        unitNumber: number;
        title: string;
        chapters: Array<{
          chapterNumber: number;
          title: string;
          topics: Array<{
            id: string;
            topicNumber: number;
            title: string;
            isTaught: boolean;
          }>;
        }>;
      }>;
    }>;
  } | null;
  initialSubjectId?: string;
}

export function SyllabusDetailModal({
  open,
  onClose,
  locale = "en",
  data,
  initialSubjectId,
}: SyllabusDetailModalProps) {
  if (!data || !data.subjects || data.subjects.length === 0) return null;

  const isHi = locale === "hi";
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSubjectId || data.subjects[0]?.subjectId || ""
  );

  const activeSubject =
    data.subjects.find((s) => s.subjectId === selectedSubjectId) || data.subjects[0]!;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-indigo-500" />
          <span>{isHi ? "पाठ्यक्रम प्रगति व विषय सूची" : "Syllabus Coverage & Progress"}</span>
        </div>
      }
      description={
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {data.termName || (isHi ? "वर्तमान शैक्षणिक सत्र" : "Current Academic Term")}
        </span>
      }
    >
      <div className="space-y-4 py-1" data-testid="syllabus-detail-modal">
        {/* Subject Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {data.subjects.map((sub) => {
            const isSelected = sub.subjectId === activeSubject.subjectId;
            return (
              <button
                key={sub.subjectId}
                type="button"
                onClick={() => setSelectedSubjectId(sub.subjectId)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border",
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {sub.subjectName} ({sub.progressPercent}%)
              </button>
            );
          })}
        </div>

        {/* Progress Overview for Active Subject */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span>{activeSubject.subjectName}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {isHi
                ? `${activeSubject.completedTopicsCount} / ${activeSubject.totalTopicsCount} विषय पूरा हुआ`
                : `${activeSubject.completedTopicsCount} of ${activeSubject.totalTopicsCount} topics completed`}
            </div>
          </div>
          <div className="flex items-baseline gap-1 text-right">
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {activeSubject.progressPercent}%
            </span>
          </div>
        </div>

        {/* Units / Chapters / Topics Tree */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {activeSubject.units && activeSubject.units.length > 0 ? (
            activeSubject.units.map((unit) => (
              <div
                key={unit.unitNumber}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-3 space-y-2.5"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800/80 pb-2">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    {isHi ? `इकाई ${unit.unitNumber}: ` : `Unit ${unit.unitNumber}: `}
                    {unit.title}
                  </span>
                </div>

                <div className="space-y-2 pl-2">
                  {unit.chapters.map((ch) => (
                    <div key={ch.chapterNumber} className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {isHi ? `अध्याय ${ch.chapterNumber}: ` : `Chapter ${ch.chapterNumber}: `}
                        {ch.title}
                      </div>

                      <div className="space-y-1 pl-2">
                        {ch.topics.map((top) => (
                          <div
                            key={top.id}
                            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"
                          >
                            {top.isTaught ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                            )}
                            <span className={cn(top.isTaught && "text-slate-900 dark:text-slate-100 font-medium")}>
                              {top.title}
                            </span>
                            {top.isTaught && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-medium">
                                {isHi ? "पूर्ण" : "Taught"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-xs text-slate-400 border border-dashed rounded-xl">
              {isHi
                ? "इस विषय के लिए अभी कोई अध्याय दर्ज नहीं है।"
                : "Curriculum topics will appear as lesson plans are conducted."}
            </div>
          )}
        </div>
      </div>
    </AppModal>
  );
}
