"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle, CreditCard, ChevronRight } from "lucide-react";
import type { StudentFeedCard } from "@/lib/studentEventEngine/types";

export interface FeeHoldCardProps {
  card: StudentFeedCard;
  locale?: string;
}

export function FeeHoldCard({
  card,
  locale = "en",
}: FeeHoldCardProps) {
  const isHi = locale === "hi";
  const payload = card.payload || {};
  const balanceDue = payload.balanceDue ? Number(payload.balanceDue).toLocaleString("en-IN") : "0";

  const titleStr = isHi && card.title.hi ? card.title.hi : card.title.en;
  const summaryStr = isHi && card.summary.hi ? card.summary.hi : card.summary.en;

  return (
    <div className="relative p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {isHi ? "शुल्क रोक सूचना" : "Fee Clearance Hold"}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                ₹{balanceDue}
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
              {titleStr}
            </h4>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              {summaryStr}
            </p>
          </div>
        </div>

        <Link
          href="/student/fees"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition self-center shrink-0"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>{isHi ? "शुल्क देखें" : "View Dues"}</span>
        </Link>
      </div>
    </div>
  );
}
