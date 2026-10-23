"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Sparkles,
  Clock,
  Layers,
  ChevronDown,
  ChevronRight,
  Bookmark,
  Info,
} from "lucide-react";
import type {
  EnrolledSubjectOption,
  StudentSyllabusUnit,
} from "@/app/(student)/student/syllabus/syllabusActions";
import type { SyllabusProgressSummary } from "@/lib/studentEventEngine/syllabusDerivation";

export interface StudentSyllabusClientProps {
  subjects: EnrolledSubjectOption[];
  selectedSubjectId: string | null;
  selectedSubjectName: string | null;
  units: StudentSyllabusUnit[];
  progress: SyllabusProgressSummary;
  studentName?: string | undefined;
  className?: string | undefined;
  sectionName?: string | undefined;
  studentIdParam?: string | undefined;
}

export function StudentSyllabusClient({
  subjects,
  selectedSubjectId,
  selectedSubjectName,
  units,
  progress,
  studentName,
  className,
  sectionName,
  studentIdParam,
}: StudentSyllabusClientProps) {
  const router = useRouter();
  const [isHindi, setIsHindi] = useState(false);
  const [collapsedUnits, setCollapsedUnits] = useState<Record<string, boolean>>({});

  const toggleUnit = (unitId: string) => {
    setCollapsedUnits((prev) => ({
      ...prev,
      [unitId]: !prev[unitId],
    }));
  };

  const handleSelectSubject = (classSubjectId: string) => {
    const params = new URLSearchParams();
    params.set("subjectId", classSubjectId);
    if (studentIdParam) params.set("studentId", studentIdParam);
    router.push(`/student/syllabus?${params.toString()}`);
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Top Banner & Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                {isHindi ? "पाठ्यक्रम प्रगति एवं ट्रैकर" : "Syllabus Progress Tracker"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {studentName && `${studentName} • `}
                {className && sectionName ? `${className} - ${sectionName}` : "Curriculum & Lessons"}
              </p>
            </div>
          </div>

          {/* Bilingual Toggle */}
          <button
            type="button"
            onClick={() => setIsHindi(!isHindi)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            {isHindi ? "English" : "हिंदी"}
          </button>
        </div>

        {/* Subject Pill Selector (2-Tap Click Budget from More) */}
        {subjects.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              {isHindi ? "विषय चुनें:" : "Select Subject:"}
            </p>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {subjects.map((subj) => {
                const isActive = subj.id === selectedSubjectId;
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => handleSelectSubject(subj.id)}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isActive
                        ? "bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/25 scale-[1.02]"
                        : "bg-slate-800/80 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span>{subj.name}</span>
                    {subj.isElective && (
                      <span className="text-[10px] opacity-75 font-normal">
                        ({isHindi ? "ऐच्छिक" : "Elective"})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Subject Progress Summary Card */}
      {selectedSubjectId && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                {isHindi ? "पाठ्यक्रम का विवरण" : "Subject Overview"}
              </span>
              <h2 className="text-base font-bold text-white mt-0.5">
                {selectedSubjectName || "Subject"}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-purple-300">
                {progress.coveragePercentage}%
              </span>
              <p className="text-[10px] text-slate-400">
                {isHindi ? "पढ़ाया जा चुका" : "Taught so far"}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800 overflow-hidden flex">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${progress.coveragePercentage}%` }}
            />
          </div>

          {/* Stat Badges */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-2.5">
              <div className="flex items-center justify-center gap-1 text-emerald-400 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{progress.taughtTopics}</span>
              </div>
              <p className="text-[10px] text-emerald-300/80 mt-0.5 font-medium">
                {isHindi ? "पढ़ाया गया" : "Taught"}
              </p>
            </div>

            <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-2.5">
              <div className="flex items-center justify-center gap-1 text-sky-400 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{progress.nextTopics}</span>
              </div>
              <p className="text-[10px] text-sky-300/80 mt-0.5 font-medium">
                {isHindi ? "अगला / प्रगति पर" : "Next in line"}
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-800 rounded-2xl p-2.5">
              <div className="flex items-center justify-center gap-1 text-slate-300 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{progress.upcomingTopics}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                {isHindi ? "आगामी" : "Upcoming"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Units & Chapters Tree */}
      {units.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              {isHindi ? "पाठ्यक्रम अभी उपलब्ध नहीं है" : "No syllabus topics published yet"}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {isHindi
                ? "इस विषय के शिक्षकों ने अभी तक पाठ्य विवरण (Units/Topics) प्रकाशित नहीं किया है।"
                : "Your teachers have not uploaded syllabus units or lesson plans for this subject yet."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {units.map((unit) => {
            const isCollapsed = Boolean(collapsedUnits[unit.id]);
            const totalUnitTopics = unit.chapters.reduce(
              (sum, ch) => sum + ch.topics.length,
              0
            );
            const taughtUnitTopics = unit.chapters.reduce(
              (sum, ch) =>
                sum + ch.topics.filter((t) => t.status === "TAUGHT").length,
              0
            );

            return (
              <div
                key={unit.id}
                className="bg-slate-900 border border-slate-800/80 rounded-3xl overflow-hidden shadow-lg transition-all"
              >
                {/* Unit Header Accordion Trigger */}
                <button
                  type="button"
                  onClick={() => toggleUnit(unit.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold shrink-0">
                      U{unit.sortOrder}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition truncate">
                        {unit.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {unit.chapters.length} {isHindi ? "अध्याय" : "Chapters"} •{" "}
                        {taughtUnitTopics}/{totalUnitTopics} {isHindi ? "पढ़ाए गए" : "Taught"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                    )}
                  </div>
                </button>

                {/* Chapters & Topics Content */}
                {!isCollapsed && (
                  <div className="px-4 pb-4 space-y-3 pt-1 border-t border-slate-800/50">
                    {unit.chapters.map((chapter) => (
                      <div
                        key={chapter.id}
                        className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-3.5 space-y-2.5"
                      >
                        {/* Chapter Banner */}
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300">
                              Ch {chapter.sortOrder}
                            </span>
                            <h4 className="text-xs font-bold text-slate-200">
                              {chapter.name}
                            </h4>
                          </div>

                          {chapter.ncertReference && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 flex items-center gap-1">
                              <Bookmark className="w-3 h-3 text-indigo-400" />
                              <span>{chapter.ncertReference}</span>
                            </span>
                          )}
                        </div>

                        {/* Topics List */}
                        <div className="divide-y divide-slate-800/40">
                          {chapter.topics.map((topic) => (
                            <div
                              key={topic.id}
                              className="py-2.5 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-slate-300 font-medium leading-tight">
                                  {topic.name}
                                </p>
                                {topic.estimatedPeriods && (
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" />
                                    <span>
                                      {topic.estimatedPeriods}{" "}
                                      {isHindi ? "कालांश" : "periods estimated"}
                                    </span>
                                  </span>
                                )}
                              </div>

                              {/* Honest Status Badge (BR8) */}
                              <div className="shrink-0">
                                {topic.status === "TAUGHT" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>{isHindi ? "पढ़ाया गया" : "Taught"}</span>
                                  </span>
                                )}

                                {topic.status === "NEXT" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                                    <Sparkles className="w-3 h-3" />
                                    <span>{isHindi ? "अगला (Next)" : "Next"}</span>
                                  </span>
                                )}

                                {topic.status === "UPCOMING" && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/50">
                                    <span>{isHindi ? "आगामी" : "Upcoming"}</span>
                                  </span>
                                )}
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
  );
}
