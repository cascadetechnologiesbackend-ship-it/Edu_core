"use client";

import React from "react";
import { useOnboarding } from "../onboardContext";
import {
  GraduationCap,
  Building2,
  Calendar,
  Layers,
  BookOpen,
  DollarSign,
  ShieldCheck,
  Sparkles,
  RefreshCw,
} from "lucide-react";

export function Step7Review({ onProvision }: { onProvision: () => void }) {
  const {
    board,
    schoolName,
    udiseCode,
    email,
    academicSession,
    startDate,
    endDate,
    classesList,
    subjectMatrix,
    feeHeadsList,
    adminName,
    adminEmail,
    loading,
  } = useOnboarding();

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          Step 7: Final Review & Provisioning
        </span>
        <h2 className="text-2xl font-black text-white mt-1">
          Review Configuration & Launch Tenant
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Verify institutional settings before initiating atomic multi-tenant schema provisioning.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* School & Board */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            <span>Institution & Curriculum</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">School Name:</span>
              <span className="font-bold text-white">{schoolName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">UDISE / Slug:</span>
              <span className="font-mono text-slate-300">{udiseCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Educational Board:</span>
              <span className="font-bold text-primary">{board}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Session Window:</span>
              <span className="text-slate-300">
                {academicSession} ({startDate} to {endDate})
              </span>
            </div>
          </div>
        </div>

        {/* Academics & Structure */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>Classroom & Curriculum Scope</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Configured Classes:</span>
              <span className="font-bold text-white">
                {classesList.length} classes (
                {classesList.reduce((acc, c) => acc + c.sections.length, 0)} sections)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Curriculum Subjects:</span>
              <span className="font-bold text-white">{subjectMatrix.length} subjects</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Configured Fee Heads:</span>
              <span className="font-bold text-white">{feeHeadsList.length} billing plans</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Master Administrator:</span>
              <span className="font-bold text-emerald-400">{adminName} ({adminEmail})</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-xs">
              Ready for Zero-Click Deployment
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Atomic transaction will initialize classes, blueprint curriculum, statutory examinations, and admin credentials.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onProvision}
          disabled={loading}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-xs rounded-xl inline-flex items-center justify-center gap-2 transition shadow-lg shadow-orange-600/20 disabled:opacity-50 min-h-[44px]"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Provisioning Tenant...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Provision School Tenant</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
