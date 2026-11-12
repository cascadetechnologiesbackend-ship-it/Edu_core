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
  Building2,
  RotateCcw,
} from "lucide-react";

export function Step8Completion() {
  const { mode, schoolName, board, successResult, adminEmail, resetWizard } = useOnboarding();

  if (mode === "superadmin") {
    return (
      <div className="py-8 max-w-2xl mx-auto text-center space-y-6">
        {/* Emotional Milestone Celebration */}
        <div className="relative inline-block">
          <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30 shadow-xl shadow-indigo-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
            Super Admin School Provisioning Complete
          </span>
          <h2 className="text-3xl font-black text-white">
            {schoolName} is Provisioned!
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            The school tenant is isolated in the multi-tenant registry, {board} curriculum matrix attached, statutory examination
            blueprints initialized, and master administrator credentials configured.
          </p>
        </div>

        {/* School details overview */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 max-w-md mx-auto space-y-2 text-left">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">School Name:</span>
            <span className="font-bold text-white">{schoolName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Board:</span>
            <span className="font-semibold text-indigo-300">{board}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span className="text-slate-400">Administrator:</span>
            <span className="font-mono font-bold text-white">
              {successResult?.email || adminEmail}
            </span>
          </div>
        </div>

        {/* Primary Super Admin Actions */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            data-testid="return-to-schools-directory-btn"
            href="/super-admin/schools"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
          >
            <Building2 className="w-4 h-4" />
            <span>Return to School Directory</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={resetWizard}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs inline-flex items-center justify-center gap-2 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Provision Another School</span>
          </button>
        </div>
      </div>
    );
  }

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
