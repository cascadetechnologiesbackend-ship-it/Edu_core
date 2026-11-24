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
        <div className="w-20 h-20 rounded-3xl bg-semantic-money-in/12 text-semantic-money-in flex items-center justify-center mx-auto border border-semantic-money-in/25 shadow-level-1">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-semantic-attention/20 text-semantic-attention flex items-center justify-center border border-semantic-attention/30">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-semantic-money-in">
          Tenant Provisioning Complete
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {schoolName} is Officially Live!
        </h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          The school tenant is isolated, {board} curriculum matrix attached, statutory examination
          blueprints initialized, and master administrator credentials activated.
        </p>
      </div>

      {/* Admin credentials note */}
      <div className="p-4 rounded-2xl bg-card border border-border/40 text-xs text-foreground max-w-md mx-auto flex items-center justify-between shadow-xs">
        <span className="text-muted-foreground font-medium">Administrator:</span>
        <span className="font-mono font-bold text-foreground">
          {successResult?.email || adminEmail}
        </span>
      </div>

      {/* ── Primary Action: Direct route to Day One Cockpit (Eliminates empty-dashboard drop) ── */}
      <div className="pt-2">
        <Link
          data-testid="enter-day-one-cockpit-btn"
          href="/admin/day-one?welcome=true"
          className="w-full sm:w-auto px-8 py-3.5 min-h-[48px] rounded-2xl bg-semantic-interactive hover:bg-semantic-interactive/90 active:scale-[0.98] text-white font-bold text-sm inline-flex items-center justify-center gap-2.5 shadow-level-1 transition"
        >
          <Compass className="w-4 h-4" />
          <span>Enter Day One Cockpit</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="text-[11px] text-muted-foreground mt-2">
          Track the 8 Day One readiness checks and open your school for live attendance.
        </p>
      </div>

      {/* Direct Quick Shortcuts */}
      <div className="space-y-3 pt-6 border-t border-border/30 text-left">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block text-center">
          Day One Setup Shortcuts
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Action 1: Staff Import */}
          <Link
            href="/school/import-center?tab=staff"
            className="p-4 rounded-2xl bg-card border border-border/40 hover:border-semantic-interactive/40 transition-all group flex flex-col justify-between gap-3 shadow-xs hover:shadow-level-1 min-h-[110px]"
          >
            <div>
              <div className="p-2 rounded-xl bg-semantic-interactive/10 text-semantic-interactive border border-semantic-interactive/20 w-fit mb-2">
                <Users className="w-4 h-4" />
              </div>
              <h4 className="font-semibold text-xs text-foreground group-hover:text-semantic-interactive transition-colors">
                Import Staff
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Upload teaching faculty roster via CSV.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-semantic-interactive inline-flex items-center gap-1 mt-1">
              <span>Import Center</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Action 2: Student Import */}
          <Link
            href="/school/import-center?tab=students"
            className="p-4 rounded-2xl bg-card border border-border/40 hover:border-semantic-interactive/40 transition-all group flex flex-col justify-between gap-3 shadow-xs hover:shadow-level-1 min-h-[110px]"
          >
            <div>
              <div className="p-2 rounded-xl bg-semantic-money-in/10 text-semantic-money-in border border-semantic-money-in/20 w-fit mb-2">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h4 className="font-semibold text-xs text-foreground group-hover:text-semantic-interactive transition-colors">
                Import Students
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Enrol student cohort into sections.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-semantic-interactive inline-flex items-center gap-1 mt-1">
              <span>Import Center</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Action 3: Fee Structures */}
          <Link
            href="/school/fee-structures"
            className="p-4 rounded-2xl bg-card border border-border/40 hover:border-semantic-interactive/40 transition-all group flex flex-col justify-between gap-3 shadow-xs hover:shadow-level-1 min-h-[110px]"
          >
            <div>
              <div className="p-2 rounded-xl bg-semantic-attention/10 text-semantic-attention border border-semantic-attention/20 w-fit mb-2">
                <IndianRupee className="w-4 h-4" />
              </div>
              <h4 className="font-semibold text-xs text-foreground group-hover:text-semantic-interactive transition-colors">
                Fee Structures
              </h4>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                Set fees & generate initial demands.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-semantic-interactive inline-flex items-center gap-1 mt-1">
              <span>Fee Setup</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
