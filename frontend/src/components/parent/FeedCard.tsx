"use client";

import React from "react";
import Link from "next/link";
import {
  CreditCard,
  CalendarCheck,
  Bus,
  FileText,
  Award,
  Calendar,
  Bell,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  ArrowRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
export type { DerivedFeedCard } from "@/lib/parentEventEngine/types";

export interface FeedCardAction {
  label: string;
  href?: string | undefined;
  onClick?: (() => void) | undefined;
  variant?: ("primary" | "secondary" | "danger") | undefined;
}

export interface FeedCardProps {
  id: string;
  cardType: string;
  tier: "T1_action_required" | "T2_informational" | "T3_system_state";
  title: string;
  summary: string;
  timestamp?: Date | string | undefined;
  severity?: ("ROSE" | "AMBER" | "EMERALD" | "INDIGO" | "DEFAULT") | undefined;
  icon?: React.ReactNode | undefined;
  primaryAction?: FeedCardAction | undefined;
  secondaryAction?: FeedCardAction | undefined;
  microProgress?: {
    currentState: string;
    states: string[];
  } | undefined;
  countdownChip?: {
    text: string;
    variant: "rose" | "amber" | "emerald" | "slate";
  } | undefined;
  children?: React.ReactNode | undefined;
  className?: string | undefined;
}

const DEFAULT_ICONS: Record<string, React.ReactNode> = {
  PaymentCard: <CreditCard className="w-5 h-5 text-indigo-400" />,
  AttendanceCard: <CalendarCheck className="w-5 h-5 text-rose-400" />,
  BusLiveCard: <Bus className="w-5 h-5 text-amber-400" />,
  HomeworkCard: <FileText className="w-5 h-5 text-blue-400" />,
  ReportCardCard: <Award className="w-5 h-5 text-emerald-400" />,
  PTMCard: <Calendar className="w-5 h-5 text-purple-400" />,
  NoticeCard: <Bell className="w-5 h-5 text-amber-400" />,
  ConsentCard: <ShieldCheck className="w-5 h-5 text-amber-400" />,
  InsightCard: <Sparkles className="w-5 h-5 text-amber-400" />,
  MessageCard: <MessageSquare className="w-5 h-5 text-blue-400" />,
  LeaveApprovedCard: <CalendarCheck className="w-5 h-5 text-emerald-400" />,
  LeaveRejectedCard: <AlertCircle className="w-5 h-5 text-amber-400" />,
};

export function FeedCard({
  id,
  cardType,
  tier,
  title,
  summary,
  timestamp,
  severity = "DEFAULT",
  icon,
  primaryAction,
  secondaryAction,
  microProgress,
  countdownChip,
  children,
  className,
}: FeedCardProps) {
  // Severity left-border coloring
  const borderAccent =
    severity === "ROSE"
      ? "border-l-4 border-l-rose-500"
      : severity === "AMBER"
      ? "border-l-4 border-l-amber-500"
      : severity === "EMERALD"
      ? "border-l-4 border-l-emerald-500"
      : severity === "INDIGO"
      ? "border-l-4 border-l-indigo-500"
      : tier === "T1_action_required"
      ? "border-l-4 border-l-rose-500"
      : "border-l border-l-slate-800";

  // Relative timestamp display
  let timeAgo = "";
  if (timestamp) {
    const diffMin = Math.round(
      (Date.now() - new Date(timestamp).getTime()) / (1000 * 60)
    );
    if (diffMin < 1) timeAgo = "Just now";
    else if (diffMin < 60) timeAgo = `${diffMin}m ago`;
    else {
      const diffHours = Math.round(diffMin / 60);
      if (diffHours < 24) timeAgo = `${diffHours}h ago`;
      else timeAgo = `${Math.round(diffHours / 24)}d ago`;
    }
  }

  const cardIcon = icon || DEFAULT_ICONS[cardType] || (
    <Bell className="w-5 h-5 text-slate-400" />
  );

  return (
    <div
      data-card-id={id}
      data-card-type={cardType}
      data-card-tier={tier}
      className={cn(
        "rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-sm transition-all duration-200 hover:border-slate-700/80",
        borderAccent,
        className
      )}
    >
      {/* Header Row: Icon + Title + Countdown/Time */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center shrink-0 mt-0.5">
            {cardIcon}
          </div>

          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight leading-snug">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
              {summary}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {countdownChip && (
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border tracking-wide",
                countdownChip.variant === "rose" &&
                  "bg-rose-500/20 text-rose-300 border-rose-500/30",
                countdownChip.variant === "amber" &&
                  "bg-amber-500/20 text-amber-300 border-amber-500/30",
                countdownChip.variant === "emerald" &&
                  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                countdownChip.variant === "slate" &&
                  "bg-slate-800 text-slate-300 border-slate-700"
              )}
            >
              {countdownChip.text}
            </span>
          )}

          {timeAgo && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              {timeAgo}
            </span>
          )}
        </div>
      </div>

      {/* Optional micro-progress progress bar (e.g. Swiggy/Zepto style tracking) */}
      {microProgress && (
        <div className="mt-3.5 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span className="font-medium text-slate-300">Status</span>
            <span className="font-semibold text-indigo-400">
              {microProgress.currentState}
            </span>
          </div>
          <div className="flex items-center gap-1 w-full">
            {microProgress.states.map((state, idx) => {
              const currentIdx = microProgress.states.indexOf(
                microProgress.currentState
              );
              const isDone = idx <= currentIdx;
              return (
                <div
                  key={state}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    isDone ? "bg-indigo-500" : "bg-slate-800"
                  )}
                  title={state}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Card Content slot */}
      {children && <div className="mt-3.5">{children}</div>}

      {/* Actions footer (at most 1 primary action + optional secondary link) */}
      {(primaryAction || secondaryAction) && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
          {secondaryAction ? (
            secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                {secondaryAction.label}
              </button>
            )
          ) : (
            <div />
          )}

          {primaryAction &&
            (primaryAction.href ? (
              <Link
                href={primaryAction.href}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900",
                  primaryAction.variant === "danger"
                    ? "bg-rose-600 hover:bg-rose-500 text-white focus:ring-rose-500"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-500"
                )}
              >
                <span>{primaryAction.label}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900",
                  primaryAction.variant === "danger"
                    ? "bg-rose-600 hover:bg-rose-500 text-white focus:ring-rose-500"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-500"
                )}
              >
                <span>{primaryAction.label}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default FeedCard;
