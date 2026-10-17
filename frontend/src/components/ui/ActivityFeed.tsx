"use client";

import React from "react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

export interface ActivityEvent {
  id: string | number;
  icon?: React.ReactNode | undefined;
  color?: ("blue" | "emerald" | "amber" | "rose" | "purple" | "slate") | undefined;
  actor?: string | undefined;
  text: string;
  timestamp: string | Date;
}

export interface ActivityFeedProps {
  events: ActivityEvent[];
  className?: string | undefined;
  emptyMessage?: string | undefined;
}

const COLOR_MAP = {
  blue: "bg-blue-500 ring-blue-100 dark:ring-blue-950",
  emerald: "bg-emerald-500 ring-emerald-100 dark:ring-emerald-950",
  amber: "bg-amber-500 ring-amber-100 dark:ring-amber-950",
  rose: "bg-rose-500 ring-rose-100 dark:ring-rose-950",
  purple: "bg-purple-500 ring-purple-100 dark:ring-purple-950",
  slate: "bg-slate-400 ring-slate-100 dark:ring-slate-800",
};

export function ActivityFeed({
  events,
  className,
  emptyMessage = "No recent activity recorded today.",
}: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className={cn("py-8 text-center text-xs text-gray-400 dark:text-gray-500", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("relative pl-4 space-y-5 my-2", className)}>
      {/* Continuous vertical timeline connector line */}
      <div className="absolute left-[21px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-slate-800" />

      {events.map((event) => {
        const dateObj = typeof event.timestamp === "string" ? new Date(event.timestamp) : event.timestamp;
        const relativeTime = isNaN(dateObj.getTime())
          ? "Recently"
          : formatDistanceToNow(dateObj, { addSuffix: true });
        const absoluteTime = isNaN(dateObj.getTime())
          ? ""
          : format(dateObj, "MMM d, yyyy h:mm a");

        const dotColorClass = event.color ? COLOR_MAP[event.color] : COLOR_MAP.blue;

        return (
          <div key={event.id} className="relative flex items-start gap-3.5 group">
            {/* Timeline dot / icon */}
            <div
              className={cn(
                "relative z-10 w-3 h-3 rounded-full mt-1 shrink-0 ring-4 transition-transform group-hover:scale-125 duration-150",
                dotColorClass
              )}
              title={absoluteTime}
            />

            {/* Event content */}
            <div className="flex-1 min-w-0 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800/80 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                {event.actor && (
                  <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">
                    {event.actor}
                  </span>
                )}
                <span
                  className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 cursor-help"
                  title={absoluteTime}
                >
                  {relativeTime}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {event.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ActivityFeed;
