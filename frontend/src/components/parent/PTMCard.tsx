"use client";

import React from "react";
import Link from "next/link";
import { Calendar, Clock, MapPin, Users, BellPlus } from "lucide-react";
import { DerivedFeedCard } from "./FeedCard";

interface PTMCardProps {
  card: DerivedFeedCard;
  locale?: string;
}

export function PTMCard({ card, locale = "en" }: PTMCardProps) {
  const isHi = locale === "hi";
  const {
    eventId,
    title = "Parent-Teacher Meeting",
    startDate = new Date().toISOString(),
    endDate = null,
    venue = "School Campus",
    daysUntil = 3,
  } = card.payload || {};

  const dateObj = new Date(startDate);
  const dayNumber = dateObj.getDate();
  const monthStr = dateObj.toLocaleDateString([], { month: "short" }).toUpperCase();
  const timeStr = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let countdownText = isHi ? `${daysUntil} दिनों में` : `In ${daysUntil} days`;
  if (daysUntil === 0) countdownText = isHi ? "आज" : "Today";
  else if (daysUntil === 1) countdownText = isHi ? "कल" : "Tomorrow";

  return (
    <div
      className="rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-all"
      data-testid="ptm-card"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3">
          {/* Calendar Day Badge */}
          <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 flex flex-col items-center justify-center shrink-0 shadow-sm">
            <span className="text-[10px] font-bold leading-none">{monthStr}</span>
            <span className="text-base font-black leading-tight">{dayNumber}</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isHi ? card.title.hi : card.title.en}
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                {countdownText}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeStr}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {venue}
              </span>
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
        {isHi ? card.summary.hi : card.summary.en}
      </p>

      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {isHi ? "कक्षा शिक्षक के साथ व्यक्तिगत सत्र" : "Individual session with class teacher"}
        </span>

        <button
          onClick={() => {
            if ("Notification" in window && Notification.permission === "default") {
              Notification.requestPermission();
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold shadow-sm transition-colors"
        >
          <BellPlus className="w-3.5 h-3.5" />
          <span>{isHi ? "रिमाइंडर जोड़ें" : "Add Reminder"}</span>
        </button>
      </div>
    </div>
  );
}
