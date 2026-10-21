"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bell, Pin, Clock, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DerivedFeedCard } from "./FeedCard";

interface NoticeCardProps {
  card: DerivedFeedCard;
  locale?: string;
  onAcknowledgeSuccess?: () => void;
}

export function NoticeCard({ card, locale = "en", onAcknowledgeSuccess }: NoticeCardProps) {
  const isHi = locale === "hi";
  const {
    noticeId,
    contentPreview = "",
    isPinned = false,
    publishedAt = new Date().toISOString(),
    requiresAcknowledgment = false,
    acknowledgedAt = null,
  } = card.payload || {};

  const [isAcknowledged, setIsAcknowledged] = useState<boolean>(Boolean(acknowledgedAt));
  const [acknowledgedDate, setAcknowledgedDate] = useState<string | null>(
    acknowledgedAt ? new Date(acknowledgedAt).toISOString() : null
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const publishedDate = new Date(publishedAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  const handleAcknowledge = async () => {
    if (isSubmitting || isAcknowledged) return;
    setIsSubmitting(true);

    try {
      // Dynamic import to avoid next-auth / server runtime issues under Vitest
      const { acknowledgeNotice } = await import(
        "@/app/(parent)/parent/actions/noticeActions"
      );

      const targetId = noticeId || card.id.replace(/^notice-/, "");
      const res = await acknowledgeNotice(targetId, "FEED");

      if (res.success) {
        setIsAcknowledged(true);
        setAcknowledgedDate(res.acknowledgedAt || new Date().toISOString());
        toast.success(
          isHi
            ? "सूचना सफलतापूर्वक स्वीकार कर ली गई है"
            : "Notice acknowledged successfully"
        );
        onAcknowledgeSuccess?.();
      } else {
        toast.error(res.error || (isHi ? "स्वीकृति विफल रही" : "Failed to acknowledge"));
      }
    } catch (err: any) {
      console.error("[NoticeCard.handleAcknowledge] Error:", err);
      toast.error(isHi ? "तकनीकी समस्या हुई" : "Failed to process acknowledgment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm transition-all ${
        isPinned
          ? "border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10"
          : "border-slate-200 dark:border-slate-800"
      }`}
      data-testid="notice-card"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isPinned
                ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            }`}
          >
            {isPinned ? <Pin className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isHi ? card.title.hi : card.title.en}
              </h3>
              {isPinned && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                  <Pin className="w-2.5 h-2.5" />
                  PINNED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{publishedDate}</span>
            </p>
          </div>
        </div>

        {/* Status chip for acknowledgment */}
        {requiresAcknowledgment && isAcknowledged && (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0"
            data-testid="acknowledged-notice-badge"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{isHi ? "स्वीकृत" : "Acknowledged"}</span>
          </span>
        )}
      </div>

      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2 leading-relaxed">
        {contentPreview || (isHi ? card.summary.hi : card.summary.en)}
      </p>

      {/* 1-Click Acknowledgment Button (Workflow OP7, AC-P24) */}
      {requiresAcknowledgment && !isAcknowledged && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
          <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
            {isHi ? "यह सूचना आपकी स्वीकृति की मांग करती है" : "School requests your acknowledgment"}
          </p>
          <button
            onClick={handleAcknowledge}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50"
            data-testid="acknowledge-notice-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isHi ? "प्रक्रिया जारी..." : "Saving..."}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isHi ? "मैंने पढ़ लिया" : "Acknowledge"}</span>
              </>
            )}
          </button>
        </div>
      )}

      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          {isHi ? "प्रशासनिक सूचना" : "Official Circular"}
        </span>

        <Link
          href={`/parent/more?tab=notices&id=${noticeId || card.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          <span>{isHi ? "पूरी सूचना पढ़ें" : "Read Full Notice"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

