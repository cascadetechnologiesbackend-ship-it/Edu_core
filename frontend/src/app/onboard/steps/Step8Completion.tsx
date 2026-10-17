"use client";

import React from "react";
import Link from "next/link";
import { useOnboarding } from "../onboardContext";
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
  UserCheck,
  Calendar,
  Layers,
  ExternalLink,
} from "lucide-react";

export function Step8Completion() {
  const { schoolName, board, classesList, successResult, adminEmail } = useOnboarding();
  const firstClass = classesList[0]?.displayName || "Class 1";

  return (
    <div className="py-8 max-w-2xl mx-auto text-center space-y-6">
      {/* Emotional Milestone Celebration (Law F8) */}
      <div className="relative inline-block">
        <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-xl shadow-emerald-500/10">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
          Tenant Provisioning Complete
        </span>
        <h2 className="text-3xl font-black text-white">
          {schoolName} is Officially Live!
        </h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          The school tenant has been isolated, the {board} curriculum matrix attached, statutory examination
          blueprints initialized, and the master administrator credentials activated.
        </p>
      </div>

      {/* Admin credentials note */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 max-w-md mx-auto flex items-center justify-between">
        <span className="text-slate-400">Administrator:</span>
        <span className="font-mono font-bold text-white">{successResult?.email || adminEmail}</span>
      </div>

      {/* Next Best Actions (Spec Surface 0 requirement) */}
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
          Recommended Next Steps
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          {/* Action 1: Staff Onboarding */}
          <Link
            href="/hr"
            className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-primary/60 transition group flex flex-col justify-between gap-2 shadow-xs"
          >
            <div>
              <div className="p-2 rounded-lg bg-blue-950/60 text-blue-400 w-fit mb-2">
                <UserCheck className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-white group-hover:text-primary transition-colors">
                Assign Teachers
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Onboard teaching faculty and allocate subject teachers.
              </p>
            </div>
            <div className="text-[11px] font-bold text-primary inline-flex items-center gap-1 mt-2">
              <span>Staff Hub</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Action 2: Timetable */}
          <Link
            href="/academics"
            className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-primary/60 transition group flex flex-col justify-between gap-2 shadow-xs"
          >
            <div>
              <div className="p-2 rounded-lg bg-cyan-950/60 text-cyan-400 w-fit mb-2">
                <Calendar className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-white group-hover:text-primary transition-colors">
                Build Timetable
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Quick-fill weekly period schedules for {firstClass}.
              </p>
            </div>
            <div className="text-[11px] font-bold text-primary inline-flex items-center gap-1 mt-2">
              <span>QuickTimetable</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Action 3: Academics Hub */}
          <Link
            href="/academics"
            className="p-4 rounded-xl bg-primary/10 border border-primary/30 hover:border-primary/60 transition group flex flex-col justify-between gap-2 shadow-xs"
          >
            <div>
              <div className="p-2 rounded-lg bg-primary text-white w-fit mb-2">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-white group-hover:text-primary transition-colors">
                Academics Hub
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Explore classes, curriculum matrix, and student rosters.
              </p>
            </div>
            <div className="text-[11px] font-bold text-primary inline-flex items-center gap-1 mt-2">
              <span>Open Academics</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
