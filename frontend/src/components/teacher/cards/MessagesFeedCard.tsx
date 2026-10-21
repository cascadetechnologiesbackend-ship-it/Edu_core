"use client";

import React from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { MessageSquare, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

export interface MessagesFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
}

export function MessagesFeedCard({
  card,
  locale = "en",
}: MessagesFeedCardProps) {
  const router = useRouter();
  const payload = card.payload || {};
  const threads = payload.threads || [];
  const unreadCount = payload.unreadCount || 0;

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  return (
    <TeacherFeedCard
      id={card.id}
      cardType="MessagesCard"
      tier={card.tier}
      title={titleStr}
      summary={summaryStr}
      primaryAction={{
        label: locale === "hi" ? "संदेश खोलें" : "Open Messages",
        onClick: () => router.push("/teacher/messages"),
      }}
    >
      {threads.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {threads.slice(0, 2).map((t: any) => (
            <div
              key={t.threadId}
              onClick={() => router.push(`/teacher/messages?threadId=${t.threadId}`)}
              className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700 transition text-xs"
            >
              <div className="min-w-0 pr-2">
                <div className="font-semibold text-white truncate">
                  {t.parentName}
                  <span className="text-slate-400 font-normal ml-1.5">
                    ({t.studentName})
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">
                  {t.lastMessagePreview}
                </p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </TeacherFeedCard>
  );
}

export default MessagesFeedCard;
