import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCanonicalBlueprint } from "@/lib/canonicalBlueprints";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Wallet,
  Clock,
  Calendar,
  Building,
  Users,
} from "lucide-react";

interface Props {
  params: {
    profileId: string;
  };
}

export const dynamic = "force-dynamic";

export default function BlueprintDetailPage({ params }: Props) {
  const blueprint = getCanonicalBlueprint(params.profileId);

  if (!blueprint) {
    notFound();
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
      <Link
        href="/super-admin/templates"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Blueprints Catalog
      </Link>

      <PageHeader
        title={blueprint.displayName}
        description={blueprint.description}
        badge={
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {blueprint.board}
            </span>
            <StatusBadge status="completed" label={`v${blueprint.version}`} size="sm" />
          </div>
        }
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Blueprints", href: "/super-admin/templates" },
          { label: blueprint.displayName },
        ]}
      />

      {/* Grid Layout of Specification Packs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classes & Sections Pack */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-indigo-400" /> Classes & Sections
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {blueprint.classes.length} classes mapped
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto pr-1 space-y-2 divide-y divide-slate-800/60 text-xs">
            {blueprint.classes.map((cls, idx) => (
              <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200">{cls.name}</span>
                  {cls.streams && cls.streams.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                      {cls.streams.join(", ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{cls.gradeLevel}</span>
                  <div className="flex gap-1">
                    {cls.defaultSections.map((sec) => (
                      <span
                        key={sec}
                        className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[10px] font-mono"
                      >
                        Sec {sec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Subjects & Curriculum Pack */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-400" /> Curriculum Subjects
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {blueprint.subjects.length} subjects defined
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto pr-1 space-y-2 divide-y divide-slate-800/60 text-xs">
            {blueprint.subjects.map((sub, idx) => (
              <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200">{sub.name}</span>
                  <span className="ml-2 font-mono text-[10px] text-slate-400">
                    {sub.code}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      sub.subjectType === "THEORY"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : sub.subjectType === "PRACTICAL"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    }`}
                  >
                    {sub.subjectType}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {sub.weeklyPeriods} per/wk
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bell Schedule & Timetable Defaults */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Bell Schedule & Periods
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {blueprint.bellSchedule.periodsPerDay} instruction periods/day
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto pr-1 space-y-2 text-xs">
            {blueprint.bellSchedule.periods.map((period, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-slate-200">
                    {period.periodNumber > 0 ? `Period ${period.periodNumber}` : period.periodType}
                  </span>
                  <p className="text-[10px] text-slate-400">
                    {period.periodType} • {period.durationMinutes} mins
                  </p>
                </div>
                <span className="font-mono text-slate-300 text-[11px]">
                  {period.startTime} — {period.endTime}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fee Structures Pack */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" /> Default Fee Heads
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {blueprint.feeHeads.length} heads (Inactive default)
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto pr-1 space-y-2 divide-y divide-slate-800/60 text-xs">
            {blueprint.feeHeads.map((fh, idx) => (
              <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200">{fh.name}</span>
                  <p className="text-[10px] text-slate-400">
                    Type: {fh.headType} • Ledger: {fh.defaultLedgerAccountCode || "General"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                    {fh.frequency}
                  </span>
                  {!fh.isMandatory && (
                    <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px]">
                      Optional
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar & Holidays Pack */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" /> Calendar & Holidays
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {blueprint.holidays.length} statutory dates
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto pr-1 space-y-2 divide-y divide-slate-800/60 text-xs">
            {blueprint.holidays.map((hol, idx) => (
              <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200">{hol.name}</span>
                  <span className="ml-2 text-[10px] text-slate-400">
                    Day {hol.day} of Month {hol.month}
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {hol.holidayType}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* HR Salary Grades & Roles */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-400" /> HR Grades & Roles
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {blueprint.salaryGrades.length} grades • {blueprint.roleDefaults.length} roles
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[11px] font-semibold text-slate-400">Salary Grades:</span>
              <div className="space-y-1.5 mt-1.5">
                {blueprint.salaryGrades.map((sg, idx) => (
                  <div key={idx} className="p-2 bg-slate-950/60 border border-slate-800/60 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-200">{sg.gradeName}</span>
                      <p className="text-[10px] text-slate-400">
                        HRA {sg.hraPercent}% • DA {sg.daPercent}% • PF {sg.pfPercent}%
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      Basic ₹{(sg.basicSalaryPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400">System Roles:</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {blueprint.roleDefaults.map((role, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-slate-800 border border-slate-700/80 rounded-md text-slate-300 text-[11px]"
                  >
                    {role.displayName}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
