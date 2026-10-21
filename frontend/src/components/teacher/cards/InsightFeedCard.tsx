"use client";

import React from "react";
import { TeacherFeedCard } from "./TeacherFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { Sparkles, TrendingDown, BookOpen, AlertCircle, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface InsightFeedCardProps {
  card: DerivedTeacherFeedCard;
  locale?: string | undefined;
}

export function InsightFeedCard({
  card,
  locale = "en",
}: InsightFeedCardProps) {
  const router = useRouter();
  const isHi = locale === "hi";
  const payload = card.payload || {};
  const model = payload.model;
  const severity = payload.severity || "AMBER";

  const titleStr = card.title[locale as "en" | "hi"] || card.title.en;
  const summaryStr = card.summary[locale as "en" | "hi"] || card.summary.en;

  const sparklineData: number[] = payload.sparklineData || [];
  const students: Array<{ studentId: string; studentName: string; missingCount: number }> =
    payload.students || [];

  return (
    <TeacherFeedCard
      id={card.id}
      cardType="InsightCard"
      tier={card.tier}
      title={titleStr}
      summary={summaryStr}
      severity={severity === "AMBER" || severity === "ROSE" ? severity : "NORMAL"}
      primaryAction={{
        label: isHi ? "विवरण देखें" : "View Analytics",
        onClick: () => router.push(model === "homework_neglect_list" ? "/teacher/grading" : "/teacher/classes"),
      }}
    >
      {/* 1. Sparkline Visualization for Attendance Trend */}
      {model === "section_attendance_trend" && sparklineData.length > 0 && (
        <div className="pt-2 space-y-2" data-testid="insight-attendance-sparkline">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-medium">
              <TrendingDown className="w-3 h-3 text-amber-400" />
              {isHi ? "30-दिवसीय दैनिक उपस्थिति दर" : "30-day Daily Attendance Rate"}
            </span>
            <span className="font-bold text-amber-400">
              {payload.avgRate ? `${payload.avgRate}% avg` : ""}
            </span>
          </div>

          {/* Sparkline Bar Chart */}
          <div className="flex items-end gap-1 h-10 p-1.5 bg-slate-950/70 border border-slate-800 rounded-xl">
            {sparklineData.map((rate, idx) => {
              const heightPct = Math.max(10, Math.min(100, rate));
              const isLow = rate < 85;
              return (
                <div
                  key={idx}
                  title={`Day ${idx + 1}: ${rate}%`}
                  className={cn(
                    "flex-1 rounded-sm transition-all",
                    isLow ? "bg-amber-500/80 hover:bg-amber-400" : "bg-emerald-500/80 hover:bg-emerald-400"
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Neglected Homework Student List */}
      {model === "homework_neglect_list" && students.length > 0 && (
        <div className="pt-2 space-y-1.5" data-testid="insight-homework-neglect-list">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            <BookOpen className="w-3 h-3 text-amber-400" />
            <span>{isHi ? "गृहकार्य में पिछड़ रहे विद्यार्थी:" : "Students needing homework support:"}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {students.slice(0, 5).map((s) => (
              <span
                key={s.studentId}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium"
              >
                <span>{s.studentName}</span>
                <span className="px-1 py-0.2 rounded bg-amber-500/20 text-[10px] font-black">
                  {s.missingCount} {isHi ? "छूटे" : "missed"}
                </span>
              </span>
            ))}
            {students.length > 5 && (
              <span className="text-[11px] text-slate-400 self-center font-bold">
                +{students.length - 5} {isHi ? "और" : "more"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. Pre-publish Marks Outliers Check */}
      {model === "pre_publish_distribution" && (
        <div className="pt-2 flex items-center justify-between text-xs" data-testid="insight-marks-outliers">
          <span className="text-slate-400 font-medium">
            {isHi ? "कक्षा औसत:" : "Class Average:"}{" "}
            <strong className="text-white">{payload.mean} / {payload.maxMarks}</strong>
          </span>
          {payload.outliersCount && (
            <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-[11px]">
              {payload.outliersCount} {isHi ? "असामान्य प्राप्तांक" : "Outliers Detected"}
            </span>
          )}
        </div>
      )}
    </TeacherFeedCard>
  );
}

export default InsightFeedCard;
