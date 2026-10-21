"use client";

import React from "react";
import Link from "next/link";
import { UserCheck, Clock, CheckCircle2, XCircle, ArrowRight, UserCog } from "lucide-react";
import { DerivedFeedCard } from "@/lib/parentEventEngine/types";

interface ProfileChangeCardProps {
  card: DerivedFeedCard;
  studentName?: string;
  locale?: string;
}

export function ProfileChangeCard({
  card,
  studentName,
  locale = "en",
}: ProfileChangeCardProps) {
  const isHi = locale === "hi";
  const payload = card.payload || {};
  const status = payload.status || "PENDING";
  const isPending = status === "PENDING";
  const isApplied = status === "APPLIED";
  const isRejected = status === "REJECTED";

  const diffItems: Array<{ label: string; from: string; to: string }> =
    payload.diffItems || [];

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition-all ${
        isApplied
          ? "border-l-4 border-l-emerald-500 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/20"
          : isRejected
          ? "border-l-4 border-l-slate-400 border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20"
          : "border-l-4 border-l-indigo-500 border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/20 dark:bg-indigo-950/20"
      }`}
      data-testid="profile-change-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isApplied
                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                : isRejected
                ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                : "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
            }`}
          >
            {isApplied ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : isRejected ? (
              <XCircle className="w-5 h-5" />
            ) : (
              <UserCog className="w-5 h-5" />
            )}
          </div>

          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              {isHi ? card.title.hi : card.title.en}
            </h3>
            {studentName && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {studentName} • {payload.fieldDisplay || payload.field || "Profile"}
              </p>
            )}
          </div>
        </div>

        {/* Status chip */}
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            isApplied
              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
              : isRejected
              ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700"
              : "bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800"
          }`}
        >
          {isApplied ? (
            <>
              <CheckCircle2 className="w-3 h-3" />
              {isHi ? "स्वीकृत एवं लागू" : "Applied"}
            </>
          ) : isRejected ? (
            <>
              <XCircle className="w-3 h-3" />
              {isHi ? "समीक्षा पूर्ण" : "Reviewed"}
            </>
          ) : (
            <>
              <Clock className="w-3 h-3" />
              {isHi ? "समीक्षाधीन" : "Pending Review"}
            </>
          )}
        </span>
      </div>

      {/* Summary */}
      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
        {isHi ? card.summary.hi : card.summary.en}
      </p>

      {/* Diff Table / Summary */}
      {diffItems.length > 0 && (
        <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
          {diffItems.map((item, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
              <span className="font-semibold text-slate-600 dark:text-slate-400">{item.label}:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="line-through text-slate-400 dark:text-slate-500">{item.from}</span>
                <span className="text-slate-400">→</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{item.to}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decision Reason */}
      {payload.decisionReason && (
        <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-semibold">{isHi ? "प्रशासन नोट: " : "Admin Note: "}</span>
          {payload.decisionReason}
        </div>
      )}

      {/* Footer / Profile Link */}
      <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {payload.decidedAt
            ? `${isHi ? "निर्णय तिथि: " : "Decided: "}${new Date(payload.decidedAt).toLocaleDateString("en-IN")}`
            : isHi
            ? "विद्यालय प्रशासन द्वारा समीक्षाधीन"
            : "Under review by school administration"}
        </span>

        <Link
          href={`/parent/student/${card.studentId}`}
          className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
        >
          <span>{isHi ? "प्रोफ़ाइल देखें" : "View Profile"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
