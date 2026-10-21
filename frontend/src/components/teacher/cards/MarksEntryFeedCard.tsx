"use client";

import React from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { FileSpreadsheet, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

export interface MarksEntryFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
}

export function MarksEntryFeedCard({
  card,
  locale = "en",
}: MarksEntryFeedCardProps) {
  const router = useRouter();
  const payload = card.payload || {};
  const windows = payload.windows || [];
  const topWindow = payload.topWindow || windows[0];
  const isClosingSoon = payload.isClosingSoon;
  const hoursRemaining = payload.hoursRemaining;

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  const countdownChip = isClosingSoon
    ? locale === "hi"
      ? `${hoursRemaining} घंटे शेष`
      : `${hoursRemaining}h remaining`
    : undefined;

  return (
    <TeacherFeedCard
      id={card.id}
      cardType="MarksEntryCard"
      tier={card.tier}
      title={titleStr}
      summary={summaryStr}
      severity={isClosingSoon ? "AMBER" : "NORMAL"}
      countdownChip={countdownChip}
      microProgress={
        topWindow
          ? {
              current: topWindow.completedEntries,
              total: topWindow.totalStudents,
              label: locale === "hi" ? "अंक प्रविष्टि प्रगति" : "Marks Entry Progress",
            }
          : undefined
      }
      primaryAction={{
        label: locale === "hi" ? "अंक दर्ज करें" : "Enter Marks",
        onClick: () =>
          topWindow
            ? router.push(
                `/teacher/grading?examId=${topWindow.examId}&sectionId=${topWindow.sectionId}&subjectId=${topWindow.subjectId}`
              )
            : router.push("/teacher/grading"),
      }}
    />
  );
}

export default MarksEntryFeedCard;
