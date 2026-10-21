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
import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

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

  const isNight = isNightOverride ?? isNightChoreography(now ?? new Date());

  // Poll for latest feed cards
  // Tier 1 cards poll every 60s; standard feed polls every 120s; paused during night quiet hours
  const { data: cards = initialCards } = useQuery<DerivedFeedCard[]>({
    queryKey: ["parent-feed", activeStudentId],
    queryFn: async () => {
      const res = await fetch(`/api/parent/feed?studentId=${activeStudentId}`);
      if (!res.ok) return initialCards;
      const json = await res.json();
      return json.cards || [];
    },
    initialData: initialCards,
    refetchInterval: (query) => {
      if (isNight) return false; // Feed frozen during quiet hours
      const currentList = query.state.data ?? initialCards;
      const hasTier1 = currentList.some((c) => c.tier === "T1_action_required");
      return hasTier1 ? 60000 : 300000; // 60s for Tier 1, else 5m
    },
  });

  const handleStudentSelect = (id: string) => {
    setActiveStudentId(id);
    router.push(`/parent/dashboard?studentId=${id}`);
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

  return (
    <div className="w-full space-y-4">
      {/* 1. Child Identity Header (sticky on scroll) */}
      <ParentIdentityHeader
        currentStudent={selectedStudent}
        availableStudents={availableStudents}
        onSelectStudent={handleStudentSelect}
      />

      {/* 2. Today Strip (Date + Calm State / Count) */}
      <TodayStrip activeCardsCount={cards.length} locale={locale} />

      {/* Night Choreography Staleness Note (D9) */}
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
        <div className="space-y-3.5 pt-1" data-testid="parent-feed-cards">
          {cards.map((card) => {
            const wardStudentName = card.wardName || selectedStudent.name;

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

            // Extract actions and payload
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
          })}
        </div>
      )}
    </div>
  );
}

export default ParentFeedContainer;
