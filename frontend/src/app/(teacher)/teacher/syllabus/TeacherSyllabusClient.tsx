"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Layers,
  GraduationCap,
  Calendar,
} from "lucide-react";
import type { TeacherSyllabusData, SyllabusUnitItem } from "./syllabusActions";
import { markTopicTaughtAction } from "./syllabusActions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface TeacherSyllabusClientProps {
  initialData: TeacherSyllabusData;
  locale?: string;
}

export function TeacherSyllabusClient({
  initialData,
  locale = "en",
}: TeacherSyllabusClientProps) {
  const router = useRouter();
  const isHi = locale === "hi";

  const { subjects, selectedSubject, units, overallProgress, paceInsight } = initialData;
  const [unitsState, setUnitsState] = useState<SyllabusUnitItem[]>(units);
  const [togglingTopicId, setTogglingTopicId] = useState<string | null>(null);

  // Track expanded units
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(
    new Set(units.map((u) => u.id))
  );

  const handleToggleTopic = async (topicId: string, nextTaught: boolean) => {
    setTogglingTopicId(topicId);
    // Optimistic update
    setUnitsState((prevUnits) =>
      prevUnits.map((u) => ({
        ...u,
        chapters: u.chapters.map((ch) => ({
          ...ch,
          topics: ch.topics.map((top) =>
            top.id === topicId
              ? {
                  ...top,
                  isTaught: nextTaught,
                  taughtDate: nextTaught ? new Date().toISOString() : null,
                }
              : top
          ),
        })),
      }))
    );

    try {
      const res = await markTopicTaughtAction({
        topicId,
        isTaught: nextTaught,
      });
      if (res.success) {
        toast.success(
          isHi
            ? nextTaught
              ? "पाठ्यक्रम विषय पूर्ण चिह्नित किया गया!"
              : "विषय लंबित चिह्नित किया गया"
            : res.message
        );
      } else {
        toast.error("Failed to update topic status.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update topic status.");
    } finally {
      setTogglingTopicId(null);
    }
  };

  const toggleUnit = (unitId: string) => {
    setExpandedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

  const handleSelectSubject = (classSubjectId: string) => {
    router.replace(`/teacher/syllabus?classSubjectId=${classSubjectId}`);
  };

  return (
    <div className="space-y-6">
      {/* ─── Header & Subject Selector ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            {isHi ? "पाठ्यक्रम प्रगति एवं ट्रैकर" : "Syllabus & Curriculum Tracker"}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isHi
              ? "दैनिक क्लासवर्क और पाठ योजनाओं से जुड़ी वास्तविक पाठ्यक्रम प्रगति।"
              : "Read-only view of NCERT / Board curriculum coverage derived from completed classwork."}
          </p>
        </div>
      </div>

      {/* ─── Subjects Tab Bar ────────────────────────────────────────────── */}
      {subjects.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {subjects.map((sub) => {
            const isSelected = sub.classSubjectId === selectedSubject?.classSubjectId;
            return (
              <button
                key={sub.classSubjectId}
                type="button"
                onClick={() => handleSelectSubject(sub.classSubjectId)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2",
                  isSelected
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
                    : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700"
                )}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>
                  {sub.className} · {sub.subjectName}
                </span>
                {isSelected && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-500/30 text-indigo-200">
                    {sub.progressPercent}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Overall Progress & Pace Insight Cards ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Progress Card (Col Span 2) */}
        <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isHi ? "पाठ्यक्रम प्रगति" : "Curriculum Progress"}
              </span>
              <h3 className="text-base font-black text-white mt-0.5">
                {selectedSubject?.className} · {selectedSubject?.subjectName}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {overallProgress.progressPercent}%
              </span>
              <p className="text-[10px] text-slate-400">
                {overallProgress.taughtTopics} of {overallProgress.totalTopics} {isHi ? "विषय पूर्ण" : "Topics Done"}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${overallProgress.progressPercent}%` }}
            />
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-center">
            <div className="py-1">
              <span className="text-xs font-mono font-bold text-white">
                {overallProgress.totalUnits}
              </span>
              <p className="text-[10px] text-slate-400">{isHi ? "इकाइयाँ (Units)" : "Units"}</p>
            </div>
            <div className="py-1">
              <span className="text-xs font-mono font-bold text-white">
                {overallProgress.totalChapters}
              </span>
              <p className="text-[10px] text-slate-400">{isHi ? "अध्याय (Chapters)" : "Chapters"}</p>
            </div>
            <div className="py-1">
              <span className="text-xs font-mono font-bold text-white">
                {overallProgress.taughtTopics} / {overallProgress.totalTopics}
              </span>
              <p className="text-[10px] text-slate-400">{isHi ? "विषय (Topics)" : "Topics Taught"}</p>
            </div>
          </div>
        </div>

        {/* Pace InsightCard (AC-16 / Calm Dignified Metric) */}
        <div
          className={cn(
            "rounded-2xl border p-5 flex flex-col justify-between space-y-3",
            paceInsight.status === "AHEAD"
              ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
              : paceInsight.status === "BEHIND"
              ? "border-amber-500/30 bg-amber-950/20 text-amber-300"
              : "border-indigo-500/30 bg-indigo-950/20 text-indigo-300"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-slate-900/60 flex items-center gap-1.5">
              {paceInsight.status === "AHEAD" ? (
                <>
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  {isHi ? "गति से आगे" : "Ahead of Schedule"}
                </>
              ) : paceInsight.status === "BEHIND" ? (
                <>
                  <Clock className="w-3 h-3 text-amber-400" />
                  {isHi ? "गति समीक्षा आवश्यक" : "Pace Review"}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                  {isHi ? "समय पर" : "On Track"}
                </>
              )}
            </span>

            <Sparkles className="w-4 h-4 opacity-70" />
          </div>

          <p className="text-xs leading-relaxed text-slate-200">
            {isHi ? paceInsight.messageHi : paceInsight.message}
          </p>

          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800/40">
            <span>{isHi ? "अपेक्षित गति" : "Target benchmark"}:</span>
            <span className="font-mono font-bold text-white">~{paceInsight.expectedPercent}%</span>
          </div>
        </div>
      </div>

      {/* ─── Units / Chapters / Topics Tree ───────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          {isHi ? "इकाइयाँ एवं पाठ्यक्रम विवरण" : "Curriculum Units & Topics Breakdown"}
        </h2>

        {unitsState.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-sm font-bold text-white">
              {isHi ? "कोई पाठ्यक्रम इकाइयाँ नहीं मिलीं" : "No Curriculum Units Found"}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {isHi
                ? "इस विषय के लिए अभी तक कोई पाठ्यक्रम इकाई या अध्याय कॉन्फ़िगर नहीं किया गया है।"
                : "No syllabus units or chapters have been set up for this subject yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {unitsState.map((unit) => {
              const isExpanded = expandedUnitIds.has(unit.id);

              return (
                <div
                  key={unit.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden transition-all"
                >
                  {/* Unit Header Bar */}
                  <button
                    type="button"
                    onClick={() => toggleUnit(unit.id)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-850/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-white">{unit.name}</h4>
                        {unit.description && (
                          <p className="text-xs text-slate-400 line-clamp-1">{unit.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <span className="text-xs font-mono font-bold text-white">
                          {unit.taughtTopics} / {unit.totalTopics}
                        </span>
                        <p className="text-[10px] text-slate-400">{isHi ? "विषय" : "topics"}</p>
                      </div>

                      <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${unit.progressPercent}%` }}
                        />
                      </div>

                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-black font-mono",
                          unit.progressPercent === 100
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : unit.progressPercent > 0
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        )}
                      >
                        {unit.progressPercent}%
                      </span>
                    </div>
                  </button>

                  {/* Unit Content: Chapters */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 space-y-4 border-t border-slate-800/80 bg-slate-950/40">
                      {unit.chapters.map((chapter) => (
                        <div
                          key={chapter.id}
                          className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-4 space-y-3"
                        >
                          {/* Chapter Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-indigo-400 font-mono">
                                  Ch. {chapter.sortOrder}
                                </span>
                                <h5 className="text-xs font-bold text-white">{chapter.name}</h5>
                              </div>
                              {chapter.ncertReference && (
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  NCERT Ref: {chapter.ncertReference}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400 text-[11px]">
                                {chapter.taughtTopics} of {chapter.totalTopics} completed
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                {chapter.progressPercent}%
                              </span>
                            </div>
                          </div>

                          {/* Topics List */}
                          <div className="space-y-1.5 pt-1">
                            {chapter.topics.map((topic) => (
                              <div
                                key={topic.id}
                                className={cn(
                                  "px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-3 transition-colors",
                                  topic.isTaught
                                    ? "bg-emerald-950/20 border border-emerald-500/20 text-slate-200"
                                    : "bg-slate-950/30 border border-slate-800/50 text-slate-400"
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {topic.isTaught ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  )}
                                  <span className="font-mono text-[11px] text-slate-500 shrink-0">
                                    {chapter.sortOrder}.{topic.sortOrder}
                                  </span>
                                  <span className="truncate font-medium">{topic.name}</span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {topic.estimatedPeriods && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {topic.estimatedPeriods} {topic.estimatedPeriods === 1 ? "period" : "periods"}
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    disabled={togglingTopicId === topic.id}
                                    onClick={() => handleToggleTopic(topic.id, !topic.isTaught)}
                                    data-testid={`topic-toggle-${topic.id}`}
                                    className={cn(
                                      "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer",
                                      topic.isTaught
                                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                                        : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                                    )}
                                  >
                                    {topic.isTaught ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        <span>{isHi ? "पूर्ण" : "Taught"}</span>
                                        {topic.taughtDate && (
                                          <span className="text-[9px] text-emerald-400/80 hidden sm:inline font-mono">
                                            ({topic.taughtDate.slice(0, 10)})
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        <span>{isHi ? "लंबित (पूर्ण करें)" : "Mark Taught"}</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
