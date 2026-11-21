"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowUp,
  RotateCw,
  Calendar,
  GraduationCap,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentFeedCard } from "@/lib/studentEventEngine/types";
import { DueTodayStrip } from "./cards/DueTodayStrip";
import { HomeworkDueCard } from "./cards/HomeworkDueCard";
import { ClassworkRecapCard } from "./cards/ClassworkRecapCard";
import { AssessmentCountdownCard } from "./cards/AssessmentCountdownCard";
import { NoticeCard } from "./cards/NoticeCard";
import { MarksPublishedCard } from "./cards/MarksPublishedCard";
import { FeeHoldCard } from "./cards/FeeHoldCard";
import { HomeworkDetailModal } from "./modals/HomeworkDetailModal";
import { ClassworkDetailModal } from "./modals/ClassworkDetailModal";
import { AssessmentDetailModal } from "./modals/AssessmentDetailModal";
import { NoticeDetailModal } from "./modals/NoticeDetailModal";
import { MarksDetailModal } from "./modals/MarksDetailModal";

export interface StudentFeedContainerProps {
  initialCards: StudentFeedCard[];
  studentId: string;
  studentName: string;
  className: string;
  sectionName: string;
  rollNumber?: string | null;
  admissionNumber?: string | null;
  attendanceRate?: string;
  academicYearLabel?: string;
  locale?: string;
}

export function StudentFeedContainer({
  initialCards,
  studentId,
  studentName,
  className,
  sectionName,
  rollNumber,
  admissionNumber,
  attendanceRate,
  academicYearLabel,
  locale: initialLocale = "en",
}: StudentFeedContainerProps) {
  const [cards, setCards] = useState<StudentFeedCard[]>(initialCards);
  const [locale, setLocale] = useState<string>(initialLocale);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(initialCards.length);

  // Detail Modal States (1-tap click budget)
  const [selectedHomework, setSelectedHomework] = useState<any | null>(null);
  const [selectedClasswork, setSelectedClasswork] = useState<any | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<any | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<any | null>(null);
  const [selectedMarks, setSelectedMarks] = useState<any | null>(null);

  const isHi = locale === "hi";

  // Separate pinned and stream cards
  const pinnedCards = cards.filter((c) => Boolean(c.isPinned));
  const streamCards = cards.filter((c) => !c.isPinned);
  const hasNewPosts = cards.length > lastSeenCount;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/student/feed?studentId=${studentId}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.cards)) {
          setCards(json.cards);
          setLastSeenCount(json.cards.length);
        }
      }
    } catch {
      // Graceful offline fallback
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleNewPostsClick = () => {
    setLastSeenCount(cards.length);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const todayDateFormatted = new Date().toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="w-full space-y-5">
      {/* Floating "New Posts" indicator pill */}
      {hasNewPosts && (
        <button
          type="button"
          onClick={handleNewPostsClick}
          data-testid="new-posts-pill"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 min-h-[44px] rounded-full shadow-level-3 bg-blue-600/90 hover:bg-blue-600 active:scale-95 backdrop-blur-md text-white font-medium text-xs flex items-center gap-2 transition-all cursor-pointer"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>{isHi ? "नई अपडेट्स • ऊपर देखें" : "New updates • Tap to view"}</span>
        </button>
      )}

      {/* 1. Student Identity Header & Today Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-indigo-950/60 backdrop-blur-xl border border-white/[0.12] p-6 md:p-8 text-white shadow-level-2 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                <GraduationCap className="w-3.5 h-3.5" />
                {className} {sectionName ? `• Sec ${sectionName}` : ""}
              </span>
              {rollNumber && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white/90">
                  {isHi ? `क्रमांक ${rollNumber}` : `Roll #${rollNumber}`}
                </span>
              )}
              {academicYearLabel && (
                <span className="text-xs text-blue-200/70">
                  {academicYearLabel}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {isHi ? `नमस्ते, ${studentName}` : `Welcome back, ${studentName}`}
            </h1>

            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>{todayDateFormatted}</span>
              {attendanceRate && (
                <>
                  <span>•</span>
                  <span className="text-emerald-300 font-semibold">
                    {attendanceRate} {isHi ? "उपस्थिति" : "attendance"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Actions & Language Switch */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={() => setLocale(isHi ? "en" : "hi")}
              className="px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all border border-white/15 flex items-center justify-center"
              aria-label="Switch language"
            >
              {isHi ? "English" : "हिन्दी"}
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all border border-white/15 flex items-center justify-center"
              title={isHi ? "ताज़ा करें" : "Refresh feed"}
            >
              <RotateCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Pinned Strip: Due Today Items & Fee Holds */}
      {pinnedCards.length > 0 && (
        <DueTodayStrip
          pinnedCards={pinnedCards}
          locale={locale}
          onOpenDetail={(payload) => setSelectedHomework(payload)}
        />
      )}

      {/* 3. Event-Driven Feed or Calm State (Zero-Clutter Invariant AC-5) */}
      {cards.length === 0 ? (
        <div
          data-testid="student-calm-state"
          className="p-8 sm:p-10 rounded-2xl bg-card border border-border/80 text-center space-y-4 shadow-level-1"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              {isHi ? "सब कुछ व्यवस्थित है! कोई लंबित कार्य नहीं" : "All caught up! No homework due"}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {isHi
                ? "आज कोई नया गृहकार्य या सूचना लंबित नहीं है। आप अपनी आने वाली कक्षाओं और समय सारिणी की समीक्षा कर सकते हैं।"
                : "No homework due or unread notices today. Great job keeping your assignments up to date!"}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/student/timetable"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span>{isHi ? "समय सारिणी देखें" : "View Timetable"}</span>
            </Link>
            <Link
              href="/student/homework?tab=submitted"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isHi ? "पुराने सबमिशन देखें" : "Submitted Work"}</span>
            </Link>
          </div>
        </div>
      ) : (
        <div data-testid="student-feed-cards" className="space-y-3.5">
          <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>{isHi ? "नवीनतम अपडेट्स" : "Recent Updates"}</span>
            <span className="text-[11px] font-medium text-slate-500 lowercase">
              {streamCards.length} {isHi ? "गतिविधियां" : "activities"}
            </span>
          </div>

          {cards.map((card) => {
            // Skip pinned cards from duplicate rendering in stream
            if (card.isPinned && pinnedCards.length > 0) return null;

            if (card.cardType === "HomeworkDue") {
              return (
                <HomeworkDueCard
                  key={card.id}
                  card={card}
                  locale={locale}
                  onOpenDetail={(hw) => setSelectedHomework(hw)}
                />
              );
            }

            if (card.cardType === "ClassworkRecap") {
              return (
                <ClassworkRecapCard
                  key={card.id}
                  card={card}
                  locale={locale}
                  onOpenDetail={(cw) => setSelectedClasswork(cw)}
                />
              );
            }

            if (card.cardType === "AssessmentCountdown") {
              return (
                <AssessmentCountdownCard
                  key={card.id}
                  card={card}
                  locale={locale}
                  onOpenDetail={(asmt) => setSelectedAssessment(asmt)}
                />
              );
            }

            if (card.cardType === "NoticeCard") {
              return (
                <NoticeCard
                  key={card.id}
                  card={card}
                  locale={locale}
                  onOpenDetail={(not) => setSelectedNotice(not)}
                />
              );
            }

            if (card.cardType === "MarksPublished") {
              return (
                <MarksPublishedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                  onOpenDetail={(m) => setSelectedMarks(m)}
                />
              );
            }

            if (card.cardType === "FeeHoldWarning") {
              return <FeeHoldCard key={card.id} card={card} locale={locale} />;
            }

            return null;
          })}
        </div>
      )}

      {/* 4. One-Tap Detail Modals */}
      <HomeworkDetailModal
        open={Boolean(selectedHomework)}
        onClose={() => setSelectedHomework(null)}
        homework={selectedHomework}
        locale={locale}
      />

      <ClassworkDetailModal
        open={Boolean(selectedClasswork)}
        onClose={() => setSelectedClasswork(null)}
        classwork={selectedClasswork}
        locale={locale}
      />

      <AssessmentDetailModal
        open={Boolean(selectedAssessment)}
        onClose={() => setSelectedAssessment(null)}
        assessment={selectedAssessment}
        locale={locale}
      />

      <NoticeDetailModal
        open={Boolean(selectedNotice)}
        onClose={() => setSelectedNotice(null)}
        notice={selectedNotice}
        locale={locale}
      />

      <MarksDetailModal
        open={Boolean(selectedMarks)}
        onClose={() => setSelectedMarks(null)}
        marks={selectedMarks}
        locale={locale}
      />
    </div>
  );
}

export default StudentFeedContainer;
