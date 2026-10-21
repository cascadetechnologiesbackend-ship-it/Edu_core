"use client";

import React from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { Sparkles, TrendingDown, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export interface InsightFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
}

export function InsightFeedCard({
  card,
  locale = "en",
}: InsightFeedCardProps) {
  const router = useRouter();
  const payload = card.payload || {};
  const model = payload.model;
  const severity = payload.severity || "NORMAL";

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  return (
    <TeacherFeedCard
      id={card.id}
      cardType="InsightCard"
      tier={card.tier}
      title={titleStr}
      summary={summaryStr}
      severity={severity}
      primaryAction={{
        label: locale === "hi" ? "विवरण देखें" : "View Analytics",
        onClick: () => router.push("/teacher/classes"),
      }}
    />
  );
}

export default InsightFeedCard;
