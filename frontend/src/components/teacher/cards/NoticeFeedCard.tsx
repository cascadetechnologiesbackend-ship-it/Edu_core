"use client";

import React from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { FileText, Pin } from "lucide-react";

export interface NoticeFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
}

export function NoticeFeedCard({
  card,
  locale = "en",
}: NoticeFeedCardProps) {
  const payload = card.payload || {};
  const isPinned = !!payload.isPinned;

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  return (
    <TeacherFeedCard
      id={card.id}
      cardType="NoticeCard"
      tier={card.tier}
      title={titleStr}
      summary={summaryStr}
      countdownChip={isPinned ? (locale === "hi" ? "पिन किया गया" : "Pinned") : undefined}
    />
  );
}

export default NoticeFeedCard;
