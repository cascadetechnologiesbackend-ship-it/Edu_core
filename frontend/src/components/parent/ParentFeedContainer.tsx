"use client";

import React, { useState } from "react";
import { TodayStrip } from "./TodayStrip";
import { ParentIdentityHeader, type StudentWardOption } from "./ParentIdentityHeader";
import { FeedCard } from "./FeedCard";
import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export interface ParentFeedContainerProps {
  initialCards: DerivedFeedCard[];
  currentStudent: StudentWardOption;
  availableStudents: StudentWardOption[];
  locale?: string;
}

export function ParentFeedContainer({
  initialCards,
  currentStudent,
  availableStudents,
  locale = "en",
}: ParentFeedContainerProps) {
  const router = useRouter();
  const [activeStudentId, setActiveStudentId] = useState(currentStudent.id);

  // Poll for latest feed cards
  // Tier 1 cards poll every 60s; standard feed polls every 120s
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
      const currentList = query.state.data ?? initialCards;
      const hasTier1 = currentList.some((c) => c.tier === "T1_action_required");
      return hasTier1 ? 60000 : 300000; // 60s for Tier 1, else 5m
    },
  });

  const handleStudentSelect = (id: string) => {
    setActiveStudentId(id);
    router.push(`/parent/dashboard?studentId=${id}`);
  };

  const selectedStudent =
    availableStudents.find((s) => s.id === activeStudentId) || currentStudent;

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

      {/* 3. Event-Driven Feed: Zero cards is a valid, calm state (AC-P1) */}
      {cards.length > 0 && (
        <div className="space-y-3.5 pt-1" data-testid="parent-feed-cards">
          {cards.map((card) => {
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
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ParentFeedContainer;
