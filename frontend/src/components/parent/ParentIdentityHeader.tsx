"use client";

import React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn, getAvatarColor, getInitials } from "@/lib/utils";
import { Sparkles, CheckCircle2 } from "lucide-react";

export interface StudentWardOption {
  id: string;
  name: string;
  className: string;
  sectionName: string;
  admissionNumber: string;
  avatarUrl?: string | null | undefined;
  attendanceRate?: number | undefined;
}

export interface ParentIdentityHeaderProps {
  currentStudent: StudentWardOption;
  availableStudents?: StudentWardOption[] | undefined;
  onSelectStudent?: ((studentId: string) => void) | undefined;
  className?: string | undefined;
}

export function ParentIdentityHeader({
  currentStudent,
  availableStudents = [],
  onSelectStudent,
  className,
}: ParentIdentityHeaderProps) {
  const avatarBg = getAvatarColor(currentStudent.name);
  const initials = getInitials(currentStudent.name);

  const attendancePercent =
    currentStudent.attendanceRate !== undefined
      ? Math.round(currentStudent.attendanceRate * 100)
      : null;

  return (
    <div
      className={cn(
        "sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 py-3 px-4 -mx-4 mb-4 transition-all",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Avatar + Name + Class */}
        <div className="flex items-center gap-3 min-w-0">
          <AvatarPrimitive.Root className="relative flex h-11 w-11 shrink-0 overflow-hidden rounded-2xl shadow-sm border border-slate-700 bg-slate-800">
            {currentStudent.avatarUrl && (
              <AvatarPrimitive.Image
                src={currentStudent.avatarUrl}
                alt={currentStudent.name}
                className="h-full w-full object-cover"
              />
            )}
            <AvatarPrimitive.Fallback
              className={cn(
                "flex h-full w-full items-center justify-center font-bold text-sm text-white",
                avatarBg
              )}
            >
              {initials}
            </AvatarPrimitive.Fallback>
          </AvatarPrimitive.Root>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100 truncate tracking-tight">
                {currentStudent.name}
              </h1>

              {/* Multi-student selector pill if more than 1 child */}
              {availableStudents.length > 1 && (
                <div className="shrink-0 flex items-center gap-1">
                  {availableStudents.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onSelectStudent?.(s.id)}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors border",
                        s.id === currentStudent.id
                          ? "bg-indigo-600/40 text-indigo-200 border-indigo-500/50"
                          : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200"
                      )}
                    >
                      {s.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>
                {currentStudent.className}
                {currentStudent.sectionName ? ` • ${currentStudent.sectionName}` : ""}
              </span>
              <span className="text-[11px] text-slate-500">
                ADM: {currentStudent.admissionNumber}
              </span>
            </div>
          </div>
        </div>

        {/* Attendance Sparkline / Health Chip */}
        {attendancePercent !== null && (
          <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                attendancePercent >= 85
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-amber-400"
              )}
            />
            <span className="text-xs font-semibold text-slate-200">
              {attendancePercent}%
            </span>
            <span className="text-[10px] text-slate-400">attendance</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ParentIdentityHeader;
