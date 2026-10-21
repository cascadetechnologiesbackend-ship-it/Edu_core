"use client";

import React from "react";
import Link from "next/link";
import { Bus, CheckCircle2, MapPin, ArrowRight, Clock } from "lucide-react";
import type { DerivedFeedCard } from "@/lib/parentEventEngine/types";

interface BusBoardingCardProps {
  card: DerivedFeedCard;
  studentName?: string;
  locale?: string;
}

export function BusBoardingCard({
  card,
  studentName = "Your child",
  locale = "en",
}: BusBoardingCardProps) {
  const payload = card.payload || {};
  const isBoarding = payload.direction === "BOARDING";
  const stopName = payload.stopName || "Designated Stop";
  const vehicleNumber = payload.vehicleNumber;

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  const scanDate = new Date(card.activatedAt);
  const timeFormatted = scanDate.toLocaleTimeString(locale === "hi" ? "hi-IN" : "en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div
      data-testid={`bus-boarding-card-${card.id}`}
      className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 p-4 shadow-sm transition-all hover:border-slate-700"
    >
      {/* Top row: Status Badge & Time */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {isBoarding ? (
            <>
              <Bus className="w-3.5 h-3.5" />
              <span>{locale === "hi" ? "बस में सवार" : "Bus Boarded"}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{locale === "hi" ? "गंतव्य पर पहुंचे" : "Bus Alighted"}</span>
            </>
          )}
        </div>

        <div className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>{timeFormatted}</span>
        </div>
      </div>

      {/* Main title & summary */}
      <h3 className="text-sm font-bold text-slate-100">{titleStr}</h3>
      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{summaryStr}</p>

      {/* Stop & Vehicle chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span>{stopName}</span>
        </div>
        {vehicleNumber && (
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 text-[11px] text-slate-300">
            <Bus className="w-3.5 h-3.5 text-indigo-400" />
            <span>{vehicleNumber}</span>
          </div>
        )}
      </div>

      {/* Action link */}
      <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">
          {locale === "hi" ? "चालक द्वारा सत्यापित स्कैन" : "Verified by driver scan"}
        </span>
        <Link
          href="/parent/bus"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <span>{locale === "hi" ? "लाइव बस देखें" : "View Live Bus"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
