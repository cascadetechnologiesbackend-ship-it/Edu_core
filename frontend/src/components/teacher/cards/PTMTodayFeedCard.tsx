"use client";

import React from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { Users, Clock, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";

export interface PTMTodayFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
}

export function PTMTodayFeedCard({
  card,
  locale = "en",
}: PTMTodayFeedCardProps) {
  const router = useRouter();
  const payload = card.payload || {};
  const bookings = payload.bookings || [];

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  return (
    <TeacherFeedCard
      id={card.id}
      cardType="PTMTodayCard"
      tier={card.tier}
      title={titleStr}
      summary={summaryStr}
      primaryAction={{
        label: locale === "hi" ? "पीटीएम सत्र देखें" : "View PTM Schedule",
        onClick: () => router.push("/teacher/ptm"),
      }}
    >
      {bookings.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {bookings.slice(0, 3).map((b: any) => (
            <div
              key={b.bookingId}
              onClick={() => router.push("/teacher/ptm")}
              className="min-h-[38px] p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700 transition text-xs"
            >
              <div>
                <span className="font-semibold text-white">{b.parentName}</span>
                <span className="text-slate-400 ml-1.5">
                  ({b.studentName} · {b.sectionName})
                </span>
              </div>
              <span className="text-[11px] text-emerald-400 font-medium">
                {b.startTime ? new Date(b.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Scheduled"}
              </span>
            </div>
          ))}
        </div>
      )}
    </TeacherFeedCard>
  );
}

export default PTMTodayFeedCard;
