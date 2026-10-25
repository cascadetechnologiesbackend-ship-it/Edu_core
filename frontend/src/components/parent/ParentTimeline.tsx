"use client";

import React from "react";
import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";
import { Calendar, Clock, Sparkles, ChevronRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ParentTimelineProps {
  cards: DerivedFeedCard[];
  renderCard: (card: DerivedFeedCard) => React.ReactNode;
  locale?: string;
  wardName?: string;
}

type TimelineBucketKey = "COMING_UP" | "TODAY" | "EARLIER";

interface TimelineBucket {
  key: TimelineBucketKey;
  labelEn: string;
  labelHi: string;
  cards: DerivedFeedCard[];
}

/**
 * Determine time-of-day priority rank:
 * 1. Morning: Attendance, Bus Live
 * 2. Midday: Notices, Classwork, Curriculum/Syllabus
 * 3. Afternoon: Homework
 * 4. Evening: Fee, Report Cards, Insights
 */
function getCardTimeOfDayRank(card: DerivedFeedCard): number {
  switch (card.cardType) {
    case "AttendanceCard":
    case "BusLiveCard":
    case "BusBoardingCard":
      return 1;
    case "NoticeCard":
    case "ClassworkPostCard":
    case "SyllabusCoverageCard":
    case "CurriculumProgressCard":
      return 2;
    case "HomeworkCard":
    case "HomeworkPostCard":
      return 3;
    case "PaymentCard":
    case "FeeQueryCard":
    case "ReportCardCard":
    case "PTMCard":
    case "ConsentCard":
    case "DocumentRequestCard":
    case "ProfileChangeCard":
      return 4;
    default:
      return 5;
  }
}

export function ParentTimeline({
  cards,
  renderCard,
  locale = "en",
  wardName,
}: ParentTimelineProps) {
  const isHi = locale === "hi";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000;

  // Partition cards into Coming Up, Today, and Earlier
  const comingUpCards: DerivedFeedCard[] = [];
  const todayCards: DerivedFeedCard[] = [];
  const earlierCards: DerivedFeedCard[] = [];

  for (const card of cards) {
    // Check if card has a future target / due date
    const targetDate = card.occurredAt
      ? new Date(card.occurredAt).getTime()
      : card.payload?.dueDate
      ? new Date(card.payload.dueDate).getTime()
      : card.activatedAt
      ? new Date(card.activatedAt).getTime()
      : startOfToday;

    if (targetDate > endOfToday) {
      comingUpCards.push(card);
    } else if (targetDate >= startOfToday && targetDate <= endOfToday) {
      todayCards.push(card);
    } else {
      earlierCards.push(card);
    }
  }

  // Sort each bucket by time-of-day rank, then priority desc
  const sortBucket = (list: DerivedFeedCard[]) => {
    return list.slice().sort((a, b) => {
      const rankA = getCardTimeOfDayRank(a);
      const rankB = getCardTimeOfDayRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return (b.priority ?? 50) - (a.priority ?? 50);
    });
  };

  const rawBuckets: TimelineBucket[] = [
    {
      key: "COMING_UP",
      labelEn: "Coming Up",
      labelHi: "आगामी",
      cards: sortBucket(comingUpCards),
    },
    {
      key: "TODAY",
      labelEn: "Today",
      labelHi: "आज की गतिविधियाँ",
      cards: sortBucket(todayCards),
    },
    {
      key: "EARLIER",
      labelEn: "Earlier",
      labelHi: "पिछले दिन",
      cards: sortBucket(earlierCards),
    },
  ];
  const buckets = rawBuckets.filter((b) => b.cards.length > 0);

  if (buckets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="parent-timeline">
      {buckets.map((bucket) => {
        const isComingUp = bucket.key === "COMING_UP";
        const isToday = bucket.key === "TODAY";

        return (
          <section
            key={bucket.key}
            data-timeline-bucket={bucket.key}
            className="space-y-3"
          >
            {/* Sticky Day / Section Header */}
            <div
              data-testid="timeline-day-header"
              data-timeline-group={bucket.key}
              className="sticky top-14 z-20 -mx-1 px-1 py-1.5 backdrop-blur-md bg-slate-950/80 flex items-center justify-between border-b border-slate-800/60"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isComingUp
                      ? "bg-indigo-400 animate-pulse"
                      : isToday
                      ? "bg-emerald-400"
                      : "bg-slate-500"
                  )}
                />
                <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase flex items-center gap-1.5">
                  <span>{isHi ? bucket.labelHi : bucket.labelEn}</span>
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {bucket.cards.length}
                </span>
              </div>

              {wardName && (
                <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[140px]">
                  {wardName}
                </span>
              )}
            </div>

            {/* Cards List */}
            <div className="space-y-3 pl-1">
              {bucket.cards.map((card) => (
                <div key={card.id} className="relative">
                  {renderCard(card)}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default ParentTimeline;
