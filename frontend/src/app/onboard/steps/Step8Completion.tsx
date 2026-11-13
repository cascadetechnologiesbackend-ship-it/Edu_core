"use client";

import React from "react";
import Link from "next/link";
import { useOnboarding } from "../onboardContext";
import {
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Compass,
  Users,
  GraduationCap,
  IndianRupee,
} from "lucide-react";

export function Step8Completion() {
  const { schoolName, board, successResult, adminEmail } = useOnboarding();

  return (
    <div className="py-8 max-w-2xl mx-auto text-center space-y-6">
      {/* Emotional Milestone Celebration */}
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
          The school tenant is isolated, {board} curriculum matrix attached, statutory examination
          blueprints initialized, and master administrator credentials activated.
        </p>
      </div>

      {/* Admin credentials note */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 max-w-md mx-auto flex items-center justify-between">
        <span className="text-slate-400">Administrator:</span>
        <span className="font-mono font-bold text-white">
          {successResult?.email || adminEmail}
        </span>
      </div>

      {/* ── Primary Action: Direct route to Day One Cockpit (Eliminates empty-dashboard drop) ── */}
      <div className="pt-2">
        <Link
          data-testid="enter-day-one-cockpit-btn"
          href="/admin/day-one?welcome=true"
          className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-500 text-white font-black text-sm inline-flex items-center justify-center gap-2.5 shadow-xl shadow-primary/25 transition transform hover:-translate-y-0.5"
        >
          <Compass className="w-4 h-4" />
          <span>Enter Day One Cockpit</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-[11px] text-slate-400 mt-2">
          Track the 8 Day One readiness checks and open your school for live attendance.
        </p>
      </div>

      {/* Direct Quick Shortcuts */}
      <div className="space-y-3 pt-6 border-t border-slate-800 text-left">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block text-center">
          Day One Setup Shortcuts
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Action 1: Staff Import */}
          <Link
            href="/school/import-center?tab=staff"
            className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-primary/60 transition group flex flex-col justify-between gap-2 shadow-xs"
          >
            <div>
              <div className="p-2 rounded-lg bg-blue-950/60 text-blue-400 w-fit mb-2">
                <Users className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-white group-hover:text-primary transition-colors">
                Import Staff
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Upload teaching faculty roster via CSV.
              </p>
            </div>
            <div className="text-[11px] font-bold text-primary inline-flex items-center gap-1 mt-2">
              <span>Import Center</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Action 2: Student Import */}
          <Link
            href="/school/import-center?tab=students"
            className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-primary/60 transition group flex flex-col justify-between gap-2 shadow-xs"
          >
            <div>
              <div className="p-2 rounded-lg bg-emerald-950/60 text-emerald-400 w-fit mb-2">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-white group-hover:text-primary transition-colors">
                Import Students
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Enrol student cohort into sections.
              </p>
            </div>
            <div className="text-[11px] font-bold text-primary inline-flex items-center gap-1 mt-2">
              <span>Import Center</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Action 3: Fee Structures */}
          <Link
            href="/school/fee-structures"
            className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-primary/60 transition group flex flex-col justify-between gap-2 shadow-xs"
          >
            <div>
              <div className="p-2 rounded-lg bg-amber-950/60 text-amber-400 w-fit mb-2">
                <IndianRupee className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-white group-hover:text-primary transition-colors">
                Fee Structures
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                Set fees & generate initial demands.
              </p>
            </div>
            <div className="text-[11px] font-bold text-primary inline-flex items-center gap-1 mt-2">
              <span>Fee Setup</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
