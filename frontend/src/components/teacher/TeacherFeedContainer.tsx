"use client";

import React, { useState } from "react";
import { TeacherIdentityHeader } from "./TeacherIdentityHeader";
import { TeacherTodayStrip } from "./TeacherTodayStrip";
import { AttendanceNowFeedCard } from "./cards/AttendanceNowFeedCard";
import { NowNextFeedCard } from "./cards/NowNextFeedCard";
import { GradingQueueFeedCard } from "./cards/GradingQueueFeedCard";
import { MarksEntryFeedCard } from "./cards/MarksEntryFeedCard";
import { LeaveQueueFeedCard } from "./cards/LeaveQueueFeedCard";
import { SubstitutionFeedCard } from "./cards/SubstitutionFeedCard";
import { PTMTodayFeedCard } from "./cards/PTMTodayFeedCard";
import { MessagesFeedCard } from "./cards/MessagesFeedCard";
import { InsightFeedCard } from "./cards/InsightFeedCard";
import { NoticeFeedCard } from "./cards/NoticeFeedCard";
import { HomeworkDueFeedCard } from "./cards/HomeworkDueFeedCard";
import { ClassworkPendingFeedCard } from "./cards/ClassworkPendingFeedCard";
import { AttendanceWorkbench } from "./AttendanceWorkbench";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { useQuery } from "@tanstack/react-query";
import { FeatureTutorialFlashCards } from "@/components/onboarding/FeatureTutorialFlashCards";
import Link from "next/link";
import { CalendarCheck, BookOpen, Award } from "lucide-react";

export interface TeacherFeedContainerProps {
  initialCards: DerivedTeacherFeedCard[];
  teacherName: string;
  schoolName: string;
  sectionsTaught?: string[] | undefined;
  subjectsTaught?: string[] | undefined;
  isClassTeacher?: boolean | undefined;
  classTeacherSectionName?: string | undefined;
  locale?: string | undefined;
  now?: Date | undefined;
  isNightOverride?: boolean | undefined;
  daySummary?: string | undefined;
  dayCompleteSummary?: string | undefined;
  isWorkingDay?: boolean | undefined;
  isRestDay?: boolean | undefined;
  calendarEventTitle?: string | undefined;
  isSetupMissing?: boolean | undefined;
  missingAllocationsSummary?: string[] | undefined;
  isDayComplete?: boolean | undefined;
}

export function isNightQuietHours(date: Date = new Date()): boolean {
  const hours = date.getHours() + date.getMinutes() / 60;
  // Quiet hours: 21:30 - 06:30
  return hours >= 21.5 || hours < 6.5;
}

export function TeacherFeedContainer({
  initialCards,
  teacherName,
  schoolName,
  sectionsTaught = [],
  subjectsTaught = [],
  isClassTeacher = false,
  classTeacherSectionName,
  locale = "en",
  now,
  isNightOverride,
  daySummary,
  dayCompleteSummary,
  isWorkingDay = true,
  isRestDay = false,
  calendarEventTitle,
  isSetupMissing = false,
  missingAllocationsSummary = [],
  isDayComplete = false,
}: TeacherFeedContainerProps) {
  const isNight = isNightOverride ?? isNightQuietHours(now ?? new Date());

  const [workbenchModalOpen, setWorkbenchModalOpen] = useState(false);
  const [workbenchSectionId, setWorkbenchSectionId] = useState<string | undefined>(undefined);

  // React Query polling for live updates
  // T1 cards poll at 60s, normal feed at 5min, paused during night quiet hours
  const { data: cards = initialCards, refetch } = useQuery<DerivedTeacherFeedCard[]>({
    queryKey: ["teacher-feed"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/feed");
      if (!res.ok) return initialCards;
      const json = await res.json();
      return json.cards || [];
    },
    initialData: initialCards,
    refetchInterval: (query) => {
      if (isNight) return false;
      const currentList = query.state.data ?? initialCards;
      const hasTier1 = currentList.some((c) => c.tier === "T1_action_required");
      return hasTier1 ? 60000 : 300000;
    },
  });

  return (
    <div className="w-full space-y-4 overflow-x-hidden">
      {/* 1. Teacher Identity Header */}
      <TeacherIdentityHeader
        teacherName={teacherName}
        schoolName={schoolName}
        sectionsTaught={sectionsTaught}
        subjectsTaught={subjectsTaught}
        isClassTeacher={isClassTeacher}
        classTeacherSectionName={classTeacherSectionName}
        locale={locale}
      />

      {/* 2. Today Strip (Day summary, Rest-Day strip, or Calm Day-Complete strip) */}
      <div data-tour="teacher-today-periods">
        <TeacherTodayStrip
          activeCardsCount={cards.length}
          daySummary={daySummary}
          dayCompleteSummary={dayCompleteSummary}
          isDayComplete={isDayComplete}
          isRestDay={isRestDay}
          isWorkingDay={isWorkingDay}
          holidayTitle={calendarEventTitle}
          isSetupMissing={isSetupMissing}
          missingAllocationsSummary={missingAllocationsSummary}
          locale={locale}
        />
      </div>

      {/* Podium Quick Actions Bar */}
      <div
        data-tour="teacher-quick-actions"
        className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
      >
        <Link
          href="/teacher/attendance"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition"
        >
          <CalendarCheck className="w-4 h-4 text-emerald-400" />
          <span>{locale === "hi" ? "उपस्थिति दर्ज करें" : "Mark Attendance"}</span>
        </Link>
        <Link
          href="/teacher/homework"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition"
        >
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span>{locale === "hi" ? "गृहकार्य पोस्ट करें" : "Post Homework"}</span>
        </Link>
        <Link
          href="/teacher/grading"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition"
        >
          <Award className="w-4 h-4 text-amber-400" />
          <span>{locale === "hi" ? "अंक व मूल्यांकन" : "Grading & Marks"}</span>
        </Link>
      </div>

      {/* Teacher Guided Tour Flashcards */}
      <FeatureTutorialFlashCards role="TEACHER" className="my-3" />

      {/* Night Quiet Hours Staleness Note */}
      {isNight && (
        <div
          data-testid="night-staleness-note"
          className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3.5 text-xs text-slate-300 flex items-center justify-between backdrop-blur-sm shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {locale === "hi"
                ? "रात के शांत घंटे (21:30 - 06:30) • फ़ीड स्थिर है, सुबह नई सूचनाएं आएंगी"
                : "Quiet hours active (21:30 - 06:30) • Feed paused until morning"}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">
            {locale === "hi" ? "स्थिर फ़ीड" : "Updates paused"}
          </span>
        </div>
      )}

      {/* 3. Event-Driven Feed Cards: Zero cards is a valid, calm state (AC-T1) */}
      {cards.length > 0 && (
        <div className="space-y-3.5 pt-1" data-testid="teacher-feed-cards">
          {cards.map((card) => {
            if (card.cardType === "AttendanceNowCard") {
              return (
                <AttendanceNowFeedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                  onOpenWorkbench={(secId) => {
                    setWorkbenchSectionId(secId);
                    setWorkbenchModalOpen(true);
                  }}
                />
              );
            }

            if (card.cardType === "NowNextCard") {
              return (
                <NowNextFeedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                />
              );
            }

            if (card.cardType === "GradingQueueCard") {
              return (
                <GradingQueueFeedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                />
              );
            }

            if (card.cardType === "MarksEntryCard") {
              return (
                <MarksEntryFeedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                />
              );
            }

            if (card.cardType === "LeaveQueueCard") {
              return (
                <LeaveQueueFeedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                />
              );
            }

            if (card.cardType === "SubstitutionCard") {
              return (
                <SubstitutionFeedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                />
              );
            }

            if (card.cardType === "PTMTodayCard") {
              return (
                <PTMTodayFeedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                />
              );
            }

            if (card.cardType === "MessagesCard") {
              return (
                <MessagesFeedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                />
              );
            }

            if (card.cardType === "InsightCard") {
              return (
                <InsightFeedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                />
              );
            }

            if (card.cardType === "NoticeCard") {
              return (
                <NoticeFeedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                />
              );
            }

            if (card.cardType === "HomeworkDueCard") {
              return (
                <HomeworkDueFeedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                />
              );
            }

            if (card.cardType === "ClassworkPendingCard") {
              return (
                <ClassworkPendingFeedCard
                  key={card.id}
                  card={card}
                  locale={locale}
                />
              );
            }

            return null;
          })}
        </div>
      )}

      {/* Attendance Workbench AppModal for 1-Tap Dashboard Roll Call */}
      {workbenchModalOpen && (
        <AttendanceWorkbench
          isModal={true}
          isOpen={workbenchModalOpen}
          initialSectionId={workbenchSectionId}
          onClose={() => setWorkbenchModalOpen(false)}
          onSaved={() => {
            refetch();
          }}
          locale={locale}
        />
      )}
    </div>
  );
}

export default TeacherFeedContainer;
