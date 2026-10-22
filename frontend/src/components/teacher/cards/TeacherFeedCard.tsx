"use client";

import React from "react";
import {
  AlertTriangle,
  Clock,
  ArrowRight,
  Sparkles,
  CalendarCheck,
  Award,
  Users,
  MessageSquare,
  FileText,
  UserCheck,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeacherCardTier, TeacherCardType } from "@/lib/teacherEventEngine/types";

export interface FeedAction {
  label: string;
  href?: string | undefined;
  onClick?: (() => void) | undefined;
  variant?: ("primary" | "secondary" | "danger" | "outline") | undefined;
}

export interface TeacherFeedCardProps {
  id: string;
  cardType: TeacherCardType;
  tier: TeacherCardTier;
  title: string;
  summary: string;
  timestamp?: Date | string | undefined;
  severity?: ("NORMAL" | "AMBER" | "ROSE") | undefined;
  countdownChip?: string | undefined;
  microProgress?: {
    current: number;
    total: number;
    label?: string | undefined;
  } | undefined;
  primaryAction?: FeedAction | undefined;
  secondaryAction?: FeedAction | undefined;
  className?: string | undefined;
  children?: React.ReactNode | undefined;
}

const CARD_ICONS: Record<TeacherCardType, React.ElementType> = {
  AttendanceNowCard: CalendarCheck,
  NowNextCard: Clock,
  GradingQueueCard: Award,
  MarksEntryCard: Award,
  LeaveQueueCard: UserCheck,
  SubstitutionCard: Users,
  PTMTodayCard: Users,
  MessagesCard: MessageSquare,
  InsightCard: Sparkles,
  NoticeCard: FileText,
  HomeworkDueCard: FileText,
  ClassworkPendingCard: BookOpen,
};

export function TeacherFeedCard({
  id,
  cardType,
  tier,
  title,
  summary,
  timestamp,
  severity = "NORMAL",
  countdownChip,
  microProgress,
  primaryAction,
  secondaryAction,
  className,
  children,
}: TeacherFeedCardProps) {
  const IconComponent = CARD_ICONS[cardType] || Sparkles;

  const isT1 = tier === "T1_action_required";
  const isRose = severity === "ROSE" || (isT1 && severity !== "AMBER");
  const isAmber = severity === "AMBER";

  return (
    <div
      data-testid={`teacher-card-${cardType}`}
      className={cn(
        "rounded-2xl p-4 sm:p-5 transition-all relative overflow-hidden backdrop-blur-sm border shadow-md",
        isRose
          ? "bg-rose-950/20 border-rose-500/40 text-slate-100 shadow-rose-950/20"
          : isAmber
          ? "bg-amber-950/20 border-amber-500/40 text-slate-100 shadow-amber-950/20"
          : isT1
          ? "bg-slate-900/90 border-amber-500/30 text-slate-100"
          : "bg-slate-900/80 border-slate-800 text-slate-200",
        className
      )}
    >
      {/* Top Header: Badge, Icon, Title & Countdown */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5",
              isRose
                ? "bg-rose-500/20 border-rose-500/30 text-rose-400"
                : isAmber
                ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                : isT1
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            )}
          >
            <IconComponent className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {isT1 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  Action Required
                </span>
              )}
              {countdownChip && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {countdownChip}
                </span>
              )}
            </div>

            <h2 className="text-base font-bold text-white tracking-tight leading-snug">
              {title}
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{summary}</p>
          </div>
        </div>
      </div>

      {/* Optional Children (Custom Card Views) */}
      {children && <div className="mt-3.5">{children}</div>}

      {/* Optional Micro-progress bar */}
      {microProgress && (
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>{microProgress.label || "Progress"}</span>
            <span className="font-semibold text-slate-200">
              {microProgress.current} / {microProgress.total}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((microProgress.current / (microProgress.total || 1)) * 100)
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Actions Strip */}
      {(primaryAction || secondaryAction) && (
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-end gap-2.5">
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition"
            >
              {secondaryAction.label}
            </button>
          )}

          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95",
                isRose
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30"
                  : isAmber
                  ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30"
              )}
            >
              <span>{primaryAction.label}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default TeacherFeedCard;
