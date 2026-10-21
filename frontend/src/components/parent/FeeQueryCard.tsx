"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";

export interface FeeQueryCardProps {
  card: DerivedFeedCard;
  studentName?: string;
  locale?: string;
  className?: string;
}

export function FeeQueryCard({
  card,
  studentName = "Your child",
  locale = "en",
  className,
}: FeeQueryCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [escalated, setEscalated] = useState(false);

  const payload = card.payload || {};
  const queryId = payload.queryId || card.id;
  const status = escalated ? "ESCALATED" : resolved ? "RESOLVED" : payload.status || "OPEN";
  const category = payload.category || "BREAKDOWN";
  const message = payload.message || "";
  const answer = payload.answer || "";
  const termName = payload.termName || "School Fee";
  const hoursElapsed = payload.hoursElapsed ?? 0;

  const handleResolve = async () => {
    try {
      setIsSubmitting(true);
      const { resolveFeeQuery } = await import("@/app/(parent)/parent/actions/feeQueryActions");
      const res = await resolveFeeQuery(queryId);
      if (res.success) {
        setResolved(true);
        toast.success(
          locale === "hi"
            ? "शुल्क प्रश्न हल के रूप में चिह्नित किया गया"
            : "Fee query marked as resolved"
        );
      } else {
        toast.error(res.error || "Failed to update query");
      }
    } catch {
      toast.error("Network error while resolving query");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEscalate = async () => {
    try {
      setIsSubmitting(true);
      const { escalateFeeQuery } = await import("@/app/(parent)/parent/actions/feeQueryActions");
      const res = await escalateFeeQuery(queryId);
      if (res.success) {
        setEscalated(true);
        toast.success(
          locale === "hi"
            ? "प्रश्न प्रधानाचार्य को भेजा गया"
            : "Query escalated to Principal"
        );
      } else {
        toast.error(res.error || "Failed to escalate query");
      }
    } catch {
      toast.error("Network error while escalating query");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryLabel: Record<string, { en: string; hi: string }> = {
    BREAKDOWN: { en: "Item Breakdown", hi: "मद विवरण" },
    LATE_FEE: { en: "Late Fee Inquiry", hi: "विलंब शुल्क पूछताछ" },
    WAIVER_REQUEST: { en: "Concession Request", hi: "छूट अनुरोध" },
    DOUBLE_PAYMENT: { en: "Double Payment", hi: "दोहरा भुगतान" },
    OTHER: { en: "General Inquiry", hi: "सामान्य पूछताछ" },
  };

  const catText = categoryLabel[category]?.[locale as "en" | "hi"] || category;

  // ─── ANSWERED STATE: Action Required from Parent (T2) ─────────────────────
  if (status === "ANSWERED") {
    return (
      <div
        data-card-id={card.id}
        data-card-type="FeeQueryCard"
        data-card-tier="T2_informational"
        className={cn(
          "rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-sm border-l-4 border-l-indigo-500 transition-all",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5 text-indigo-400">
              <MessageSquare className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-indigo-400">
                  {catText}
                </span>
                <span className="text-[10px] text-slate-500">•</span>
                <span className="text-xs text-slate-400">{termName}</span>
                {card.wardName && (
                  <>
                    <span className="text-[10px] text-slate-500">•</span>
                    <span
                      data-testid="ward-chip"
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    >
                      {card.wardName}
                    </span>
                  </>
                )}
              </div>

              <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight mt-0.5">
                {locale === "hi"
                  ? `विद्यालय ने आपके प्रश्न का उत्तर दिया`
                  : `School Responded to Fee Query`}
              </h2>

              <p className="text-xs text-slate-400 mt-1 line-clamp-1 italic">
                "{message}"
              </p>
            </div>
          </div>

          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
            {locale === "hi" ? "उत्तर प्राप्त" : "Answered"}
          </span>
        </div>

        {/* School Answer block */}
        <div className="mt-3.5 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-200">
          <div className="text-[11px] font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              {payload.answeredByName
                ? `${payload.answeredByName} (${locale === "hi" ? "लेखाकार/प्रशासक" : "Accountant"})`
                : locale === "hi"
                ? "विद्यालय प्रशासन"
                : "School Accounts Office"}
            </span>
          </div>
          <p className="leading-relaxed text-slate-300">{answer}</p>
        </div>

        {/* Actions footer */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleEscalate}
            disabled={isSubmitting}
            className="text-xs font-medium text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 focus:outline-none"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>{locale === "hi" ? "समाधान नहीं हुआ? आगे बढ़ाएं" : "Still unclear? Escalate"}</span>
          </button>

          <button
            type="button"
            onClick={handleResolve}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{locale === "hi" ? "समाधान स्वीकारें" : "Accept & Close"}</span>
          </button>
        </div>
      </div>
    );
  }

  // ─── ESCALATED STATE: Under Principal Review ──────────────────────────────
  if (status === "ESCALATED") {
    return (
      <div
        data-card-id={card.id}
        data-card-type="FeeQueryCard"
        data-card-tier="T2_informational"
        className={cn(
          "rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-sm border-l-4 border-l-amber-500 transition-all",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-400">{catText}</span>
                <span className="text-[10px] text-slate-500">•</span>
                <span className="text-xs text-slate-400">{termName}</span>
                {card.wardName && (
                  <>
                    <span className="text-[10px] text-slate-500">•</span>
                    <span
                      data-testid="ward-chip"
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    >
                      {card.wardName}
                    </span>
                  </>
                )}
              </div>

              <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight mt-0.5">
                {locale === "hi"
                  ? "प्रश्न प्रधानाचार्य को भेजा गया"
                  : "Escalated to Principal"}
              </h2>

              <p className="text-xs text-slate-300 mt-1">
                {locale === "hi"
                  ? "आपका शुल्क प्रश्न कार्यकारी समीक्षा के लिए प्रधानाचार्य को भेज दिया गया है।"
                  : "Your fee query has been escalated to the Principal for executive resolution."}
              </p>
            </div>
          </div>

          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
            {locale === "hi" ? "प्रधानाचार्य समीक्षा" : "Under Review"}
          </span>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800 flex justify-end">
          <Link
            href="/parent/fees"
            className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1"
          >
            <span>{locale === "hi" ? "शुल्क विवरण देखें" : "View fee records"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // ─── OPEN STATE: Under Review (48h SLA) ───────────────────────────────────
  return (
    <div
      data-card-id={card.id}
      data-card-type="FeeQueryCard"
      data-card-tier="T2_informational"
      className={cn(
        "rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-sm border-l-4 border-l-slate-600 transition-all",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center shrink-0 mt-0.5 text-slate-400">
            <HelpCircle className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">{catText}</span>
              <span className="text-[10px] text-slate-600">•</span>
              <span className="text-xs text-slate-500">{termName}</span>
              {card.wardName && (
                <>
                  <span className="text-[10px] text-slate-600">•</span>
                  <span
                    data-testid="ward-chip"
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  >
                    {card.wardName}
                  </span>
                </>
              )}
            </div>

            <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight mt-0.5">
              {locale === "hi"
                ? `शुल्क प्रश्न विचाराधीन`
                : `Fee Query Under Review`}
            </h2>

            <p className="text-xs text-slate-300 mt-1 line-clamp-2">
              "{message}"
            </p>
          </div>
        </div>

        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0 flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{locale === "hi" ? "प्रतीक्षारत" : "Pending"}</span>
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-indigo-400" />
          <span>
            {locale === "hi"
              ? "सामान्य प्रतिक्रिया: 2 दिन"
              : "Typical response: 2 days"}
          </span>
        </span>

        <Link
          href="/parent/fees"
          className="text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1"
        >
          <span>{locale === "hi" ? "खाता बही देखें" : "View ledger"}</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

export default FeeQueryCard;
