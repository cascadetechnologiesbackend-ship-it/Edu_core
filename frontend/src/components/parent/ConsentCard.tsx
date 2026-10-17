"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight, Lock } from "lucide-react";
import { DerivedFeedCard } from "./FeedCard";

interface ConsentCardProps {
  card: DerivedFeedCard;
  locale?: string;
}

export function ConsentCard({ card, locale = "en" }: ConsentCardProps) {
  const isHi = locale === "hi";

  return (
    <div
      className="rounded-2xl border-l-4 border-l-amber-500 border border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/20 p-4 sm:p-5 shadow-sm transition-all"
      data-testid="consent-card"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0 border border-amber-200 dark:border-amber-800">
            <ShieldCheck className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isHi ? card.title.hi : card.title.en}
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <Lock className="w-2.5 h-2.5" />
                DPDP 2023
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isHi
                ? "डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम (DPDP) अनुपालन"
                : "Statutory Personal Data Protection Compliance"}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
        {isHi ? card.summary.hi : card.summary.en}
      </p>

      {/* Deep-link to (parent)/portal/consent - strictly never duplicates consent UI */}
      <div className="mt-3.5 pt-3 border-t border-amber-200/60 dark:border-amber-900/60 flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {isHi ? "सहमति समीक्षा आवश्यक है" : "Guardian consent required"}
        </span>

        <Link
          href="/portal/consent"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition-colors"
        >
          <span>{isHi ? "सहमति की समीक्षा करें" : "Review & Consent"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
