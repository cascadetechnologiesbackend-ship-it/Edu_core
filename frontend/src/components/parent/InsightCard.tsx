"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, MessageSquare, AlertTriangle, TrendingDown, BookOpen } from "lucide-react";
import { DerivedFeedCard } from "./FeedCard";

interface InsightCardProps {
  card: DerivedFeedCard;
  locale?: string;
}

export function InsightCard({ card, locale = "en" }: InsightCardProps) {
  const isHi = locale === "hi";
  const {
    signal = "",
    severity = "AMBER",
    actionType = "message_teacher",
    targetUrl = "/parent/messages",
  } = card.payload || {};

  const borderClass =
    severity === "ROSE"
      ? "border-l-4 border-l-rose-500 bg-rose-50/20 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
      : "border-l-4 border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40";

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition-all ${borderClass}`}
      data-testid="insight-card"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0 border border-amber-200 dark:border-amber-800">
            <Sparkles className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isHi ? card.title.hi : card.title.en}
              </h3>
              {card.wardName && (
                <span
                  data-testid="ward-chip"
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                >
                  {card.wardName}
                </span>
              )}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 uppercase">
                {isHi ? "सुझाव" : "ATTENTION"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isHi ? "एकेडेमिक प्रोग्रेस इनसाइट" : "Academic & Attendance Support"}
            </p>
          </div>
        </div>
      </div>

      {/* Fact-based neutral copy (Strictly no shame words: no 'defaulter', no 'churn') */}
      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
        {isHi ? card.summary.hi : card.summary.en}
      </p>

      {/* Primary Action Button */}
      <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {isHi ? "कक्षा शिक्षक आपकी सहायता के लिए उपलब्ध हैं" : "Class teacher is available to assist"}
        </span>

        <Link
          href={targetUrl}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-xs shadow-sm transition-colors"
        >
          <span>
            {actionType === "talk_teacher" || actionType === "message_teacher"
              ? isHi ? "शिक्षक से बात करें" : "Talk to class teacher"
              : isHi ? "विवरण देखें" : "View Details"}
          </span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
