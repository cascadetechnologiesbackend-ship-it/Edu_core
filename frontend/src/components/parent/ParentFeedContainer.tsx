"use client";

import React, { useState } from "react";
import { TodayStrip } from "./TodayStrip";
import { ParentIdentityHeader, type StudentWardOption } from "./ParentIdentityHeader";
import { FeedCard } from "./FeedCard";
import { PaymentCard } from "./PaymentCard";
import { BusLiveCard } from "./BusLiveCard";
import { AttendanceCard } from "./AttendanceCard";
import { HomeworkCard } from "./HomeworkCard";
import { ReportCardCard } from "./ReportCardCard";
import { PTMCard } from "./PTMCard";
import { NoticeCard } from "./NoticeCard";
import { ConsentCard } from "./ConsentCard";
import { InsightCard } from "./InsightCard";
import { MessageCard } from "./MessageCard";
import { LeaveApprovedCard } from "./LeaveApprovedCard";
import { LeaveRejectedCard } from "./LeaveRejectedCard";
import { FeeQueryCard } from "./FeeQueryCard";
import { WeeklyDigestCard } from "./WeeklyDigestCard";
import { BusBoardingCard } from "./BusBoardingCard";
import { DocumentRequestCard } from "./DocumentRequestCard";
import { ProfileChangeCard } from "./ProfileChangeCard";

// Academic Stream Cards
import { HomeworkPostCard } from "./HomeworkPostCard";
import { ClassworkPostCard } from "./ClassworkPostCard";
import { SyllabusCoverageCard } from "./SyllabusCoverageCard";
import { CurriculumProgressCard } from "./CurriculumProgressCard";
import { AssessmentScheduledCard } from "./AssessmentScheduledCard";

// Academic Detail Modals
import { HomeworkDetailModal } from "./modals/HomeworkDetailModal";
import { ClassworkDetailModal } from "./modals/ClassworkDetailModal";
import { SyllabusDetailModal } from "./modals/SyllabusDetailModal";
import { AssessmentDetailModal } from "./modals/AssessmentDetailModal";

import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowUp, RotateCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ParentFeedContainerProps {
  initialCards: DerivedFeedCard[];
  currentStudent: StudentWardOption;
  availableStudents: StudentWardOption[];
  locale?: string;
  now?: Date;
  isNightOverride?: boolean;
}

export function isNightChoreography(date: Date = new Date()): boolean {
  const hours = date.getHours() + date.getMinutes() / 60;
  return hours >= 21.5 || hours < 6.5;
}

export function ParentFeedContainer({
  initialCards,
  currentStudent,
  availableStudents,
  locale = "en",
  now,
  isNightOverride,
}: ParentFeedContainerProps) {
  const router = useRouter();
  const [activeStudentId, setActiveStudentId] = useState(currentStudent.id);
  const [lastSeenCount, setLastSeenCount] = useState(initialCards.length);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal states for one-tap detail views (AC-13)
  const [selectedHomework, setSelectedHomework] = useState<any | null>(null);
  const [selectedClasswork, setSelectedClasswork] = useState<any | null>(null);
  const [selectedSyllabus, setSelectedSyllabus] = useState<any | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<any | null>(null);

  const isNight = isNightOverride ?? isNightChoreography(now ?? new Date());

  // Poll for latest feed cards
  const { data: cards = initialCards, refetch } = useQuery<DerivedFeedCard[]>({
    queryKey: ["parent-feed", activeStudentId],
    queryFn: async () => {
      const res = await fetch(`/api/parent/feed?studentId=${activeStudentId}`);
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

  const handleStudentSelect = (id: string) => {
    setActiveStudentId(id);
    router.push(`/parent/dashboard?studentId=${id}`);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setLastSeenCount(cards.length);
    setIsRefreshing(false);
  };

  const handleNewPostsClick = () => {
    setLastSeenCount(cards.length);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectedStudent: StudentWardOption =
    activeStudentId === "all"
      ? {
          id: "all",
          name: locale === "hi" ? "सभी बच्चे" : "All Children",
          className: `${availableStudents.length} Students`,
          sectionName: "",
          admissionNumber: "MULTI",
          attendanceRate:
            availableStudents.length > 0
              ? availableStudents.reduce((sum, s) => sum + (s.attendanceRate ?? 1), 0) /
                availableStudents.length
              : undefined,
        }
      : availableStudents.find((s) => s.id === activeStudentId) || currentStudent;

  // Split feed into pinned Needs Attention cards and chronological stream cards (AC-12)
  const pinnedCards = cards.filter((c) => Boolean(c.isPinned));
  const streamCards = cards.filter((c) => !c.isPinned);
  const hasNewPosts = cards.length > lastSeenCount;

  // Unified card renderer
  const renderCard = (card: DerivedFeedCard) => {
    const wardStudentName = card.wardName || selectedStudent.name;

    // Academic Feed Stream Cards (Phase F5)
    if (card.cardType === "HomeworkPostCard") {
      return (
        <HomeworkPostCard
          key={card.id}
          card={card}
          locale={locale}
          onOpenDetail={(hw) => setSelectedHomework(hw)}
        />
      );
    }

    if (card.cardType === "ClassworkPostCard") {
      return (
        <ClassworkPostCard
          key={card.id}
          card={card}
          locale={locale}
          onOpenDetail={(cw) => setSelectedClasswork(cw)}
        />
      );
    }

    if (card.cardType === "SyllabusCoverageCard") {
      return (
        <SyllabusCoverageCard
          key={card.id}
          card={card}
          locale={locale}
          onOpenDetail={(syl) => setSelectedSyllabus(syl)}
        />
      );
    }

    if (card.cardType === "CurriculumProgressCard") {
      return (
        <CurriculumProgressCard
          key={card.id}
          card={card}
          locale={locale}
          onOpenDetail={(prog) => setSelectedSyllabus(prog)}
        />
      );
    }

    if (card.cardType === "AssessmentScheduledCard") {
      return (
        <AssessmentScheduledCard
          key={card.id}
          card={card}
          locale={locale}
          onOpenDetail={(asmt) => setSelectedAssessment(asmt)}
        />
      );
    }

    // Operational & Event Cards
    if (card.cardType === "PaymentCard") {
      return (
        <PaymentCard
          key={card.id}
          card={card}
          studentName={wardStudentName}
        />
      );
    }

    if (card.cardType === "BusLiveCard") {
      return (
        <BusLiveCard
          key={card.id}
          card={card}
          locale={locale}
        />
      );
    }

    if (card.cardType === "AttendanceCard") {
      return (
        <AttendanceCard
          key={card.id}
          card={card}
          studentName={wardStudentName}
          locale={locale}
        />
      );
    }

    if (card.cardType === "HomeworkCard") {
      return (
        <HomeworkCard
          key={card.id}
          card={card}
          locale={locale}
        />
      );
    }

    if (card.cardType === "ReportCardCard") {
      return (
        <ReportCardCard
          key={card.id}
          card={card}
          locale={locale}
        />
      );
    }

    if (card.cardType === "PTMCard") {
      return (
        <PTMCard
          key={card.id}
          card={card}
          locale={locale}
        />
      );
    }

    if (card.cardType === "NoticeCard") {
      return (
        <NoticeCard
          key={card.id}
          card={card}
          locale={locale}
        />
      );
    }

    if (card.cardType === "ConsentCard") {
      return (
        <ConsentCard
          key={card.id}
          card={card}
          locale={locale}
        />
      );
    }

    if (card.cardType === "InsightCard") {
      return (
        <InsightCard
          key={card.id}
          card={card}
          locale={locale}
        />
      );
    }

    if (card.cardType === "MessageCard") {
      return (
        <MessageCard
          key={card.id}
          card={card}
          locale={locale}
        />
      );
    }

    if (card.cardType === "LeaveApprovedCard") {
      return (
        <LeaveApprovedCard
          key={card.id}
          card={card}
          studentName={wardStudentName}
          locale={locale}
        />
      );
    }

    if (card.cardType === "LeaveRejectedCard") {
      return (
        <LeaveRejectedCard
          key={card.id}
          card={card}
          studentName={wardStudentName}
          locale={locale}
        />
      );
    }

    if (card.cardType === "FeeQueryCard") {
      return (
        <FeeQueryCard
          key={card.id}
          card={card}
          studentName={wardStudentName}
          locale={locale}
        />
      );
    }

    if (card.cardType === "WeeklyDigestCard") {
      return (
        <WeeklyDigestCard
          key={card.id}
          card={card}
          studentName={wardStudentName}
          locale={locale}
        />
      );
    }

    if (card.cardType === "BusBoardingCard") {
      return (
        <BusBoardingCard
          key={card.id}
          card={card}
          studentName={wardStudentName}
          locale={locale}
        />
      );
    }

    if (card.cardType === "DocumentRequestCard") {
      return (
        <DocumentRequestCard
          key={card.id}
          card={card}
          studentName={wardStudentName}
          locale={locale}
        />
      );
    }

    if (card.cardType === "ProfileChangeCard") {
      return (
        <ProfileChangeCard
          key={card.id}
          card={card}
          studentName={wardStudentName}
          locale={locale}
        />
      );
    }

    const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
    const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

    const primaryAction = card.payload?.primaryAction;
    const secondaryAction = card.payload?.secondaryAction;
    const countdownChip = card.payload?.countdownChip;
    const microProgress = card.payload?.microProgress;
    const severity = card.payload?.severity;

    return (
      <FeedCard
        key={card.id}
        id={card.id}
        cardType={card.cardType}
        tier={card.tier}
        title={titleStr}
        summary={summaryStr}
        timestamp={card.activatedAt}
        severity={severity}
        countdownChip={countdownChip}
        microProgress={microProgress}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        wardName={card.wardName}
      />
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Floating "New Posts" indicator pill (AC-12) */}
      {hasNewPosts && (
        <button
          type="button"
          onClick={handleNewPostsClick}
          data-testid="new-posts-pill"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-1.5 rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 animate-bounce transition-all cursor-pointer"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>{locale === "hi" ? "नई पोस्ट • ऊपर देखें" : "New posts • Tap to view"}</span>
        </button>
      )}

      {/* 1. Child Identity Header (sticky on scroll) */}
      <ParentIdentityHeader
        currentStudent={selectedStudent}
        availableStudents={availableStudents}
        onSelectStudent={handleStudentSelect}
      />

      {/* 2. Today Strip with Pull/Click to Refresh */}
      <div className="relative">
        <TodayStrip activeCardsCount={cards.length} locale={locale} />
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          aria-label="Refresh feed"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <RotateCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-indigo-500")} />
        </button>
      </div>

      {/* Night Choreography Staleness Note */}
      {isNight && (
        <div
          data-testid="night-staleness-note"
          className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-3.5 text-xs text-slate-300 flex items-center justify-between backdrop-blur-sm shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
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

      {/* 3. Event-Driven Feed: Zero cards is a valid, calm state (AC-P1) */}
      {cards.length > 0 && (
        <div className="space-y-3.5 pt-1">
          {/* Pinned "Needs Attention" Strip (AC-12) */}
          {pinnedCards.length > 0 && (
            <div
              data-testid="needs-attention-strip"
              className="space-y-3 p-3 sm:p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20"
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4" />
                  <span>{locale === "hi" ? "जरूरी सूचनाएं" : "Needs Attention"}</span>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                  {pinnedCards.length}
                </span>
              </div>
              <div className="space-y-3">
                {pinnedCards.map((card) => renderCard(card))}
              </div>
            </div>
          )}

          {/* 4. Chronological Stream (AC-12) */}
          <div data-testid="parent-feed-cards" className="space-y-3.5">
            {cards.map((card) => {
              if (card.isPinned && pinnedCards.length > 0) return null;
              return renderCard(card);
            })}
          </div>
        </div>
      )}

      {/* 5. Modals for 1-Tap Details (AC-13) */}
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

      <SyllabusDetailModal
        open={Boolean(selectedSyllabus)}
        onClose={() => setSelectedSyllabus(null)}
        data={selectedSyllabus}
        locale={locale}
      />

      <AssessmentDetailModal
        open={Boolean(selectedAssessment)}
        onClose={() => setSelectedAssessment(null)}
        assessment={selectedAssessment}
        locale={locale}
      />
    </div>
  );
}

export default ParentFeedContainer;
