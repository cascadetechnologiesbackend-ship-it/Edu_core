"use client";

import React from "react";
import {
  Users,
  UserCheck,
  UserX,
  CalendarDays,
  GraduationCap,
  BookOpen,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Building2,
} from "lucide-react";

interface AllocStats {
  totalSections: number;
  sectionsWithClassTeacher: number;
  sectionsWithoutClassTeacher: number;
  uniqueSubjectAllocatedTeachers: number;
}

interface OverviewTabProps {
  staffList: any[];
  departments: any[];
  leaveRequests: any[];
  allocStats: AllocStats;
  school: any;
  activeYear: any;
  onTabChange: (tab: string) => void;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color,
  onClick,
  actionLabel,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sublabel?: string | undefined;
  color: string;
  onClick?: (() => void) | undefined;
  actionLabel?: string | undefined;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-border/40 dark:border-border/40 bg-white dark:bg-card p-5 shadow-xs flex flex-col gap-3 ${onClick ? "cursor-pointer hover:border-amber-500/40 transition-colors" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      <div className={`inline-flex p-2.5 rounded-xl ${color} w-fit`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold font-mono tabular-nums text-foreground dark:text-white tracking-tight">
          {value}
        </p>
        <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mt-0.5">
          {label}
        </p>
        {sublabel && (
          <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">{sublabel}</p>
        )}
      </div>
      {onClick && actionLabel && (
        <div className="flex items-center gap-1 text-xs font-semibold text-[#B45309] dark:text-[#FFD60A] mt-auto">
          {actionLabel} <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}

export function OverviewTab({
  staffList,
  departments,
  leaveRequests,
  allocStats,
  school,
  activeYear,
  onTabChange,
}: OverviewTabProps) {
  // ── Zero-Clutter Invariant: if no staff, render calm state only ─────────
  if (staffList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="p-4 rounded-2xl bg-amber-500/10">
          <Users className="w-10 h-10 text-amber-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground dark:text-white">
            {school?.name ? `Welcome to ${school.name}` : "Welcome"}
          </h2>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1 max-w-xs">
            No staff members have been added yet. Start by adding your first staff member.
          </p>
        </div>
        <button
          onClick={() => onTabChange("directory")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B45309] dark:bg-[#FFD60A] text-white dark:text-black text-sm font-bold hover:opacity-90 min-h-[44px] transition-colors"
        >
          <Users className="w-4 h-4" /> Add First Staff Member
        </button>
      </div>
    );
  }

  // ── Compute live census ───────────────────────────────────────────────────
  const totalStaff = staffList.length;
  const activeStaff = staffList.filter((s) => s.status === "ACTIVE").length;
  const teachingStaff = staffList.filter((s) => s.designation?.isTeaching).length;
  const nonTeachingStaff = totalStaff - teachingStaff;
  const onProbation = staffList.filter((s) => s.status === "PROBATION").length;
  const pendingLeaves = leaveRequests.filter((r) => r.status === "PENDING").length;
  const deptCount = departments.length;

  // Recent hires (last 3, PII-safe: initials + department only)
  const recentHires = staffList
    .slice(0, 3)
    .map((s) => ({
      initials: `${(s.firstName?.[0] || "?")}${(s.lastName?.[0] || "")}`.toUpperCase(),
      department: s.department?.name || "—",
      designation: s.designation?.name || "—",
      status: s.status,
    }));

  return (
    <div className="space-y-8">
      {/* Year context */}
      {activeYear && (
        <p className="text-xs text-muted-foreground dark:text-muted-foreground font-medium">
          Academic Year: <span className="font-semibold text-muted-foreground dark:text-muted-foreground">{activeYear.label}</span>
        </p>
      )}

      {/* ── Census Grid ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-4">
          Staff Census
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Staff"
            value={totalStaff}
            sublabel={`${activeStaff} active`}
            color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            onClick={() => onTabChange("directory")}
            actionLabel="View Directory"
          />
          <StatCard
            icon={GraduationCap}
            label="Teaching Staff"
            value={teachingStaff}
            color="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
            onClick={() => onTabChange("directory")}
            actionLabel="View Teaching Staff"
          />
          <StatCard
            icon={Building2}
            label="Non-Teaching Staff"
            value={nonTeachingStaff}
            color="bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400"
          />
          <StatCard
            icon={UserCheck}
            label="On Probation"
            value={onProbation}
            color="bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
            onClick={onProbation > 0 ? () => onTabChange("directory") : undefined}
            actionLabel={onProbation > 0 ? "Review" : undefined}
          />
        </div>
      </section>

      {/* ── Allocation Status ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-4">
          Allocation Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={UserCheck}
            label="Sections with Class Teacher"
            value={allocStats.sectionsWithClassTeacher}
            sublabel={`of ${allocStats.totalSections} sections`}
            color="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
          />
          {allocStats.sectionsWithoutClassTeacher > 0 ? (
            <StatCard
              icon={AlertTriangle}
              label="Sections without Class Teacher"
              value={allocStats.sectionsWithoutClassTeacher}
              sublabel="Needs action"
              color="bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400"
              onClick={() => onTabChange("allocations")}
              actionLabel="Assign Now"
            />
          ) : (
            <StatCard
              icon={UserCheck}
              label="Class Teacher Coverage"
              value="100%"
              sublabel="All sections covered"
              color="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
            />
          )}
          <StatCard
            icon={BookOpen}
            label="Subject-Allocated Teachers"
            value={allocStats.uniqueSubjectAllocatedTeachers}
            color="bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400"
            onClick={() => onTabChange("allocations")}
            actionLabel="Manage Allocations"
          />
        </div>
      </section>

      {/* ── Action Queue Row ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-4">
          Action Queue
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pending Leaves */}
          <button
            onClick={() => onTabChange("leaves")}
            className="flex items-center gap-4 p-4 rounded-2xl border border-border/40 dark:border-border/40 bg-white dark:bg-card hover:border-amber-400 dark:hover:border-amber-600 transition-colors text-left"
          >
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50">
              <CalendarDays className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground dark:text-white">
                Leave Approvals
              </p>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
                {pendingLeaves > 0
                  ? `${pendingLeaves} request${pendingLeaves > 1 ? "s" : ""} pending`
                  : "No pending requests"}
              </p>
            </div>
            {pendingLeaves > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                {pendingLeaves}
              </span>
            )}
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Departments health */}
          <button
            onClick={() => onTabChange("structure")}
            className="flex items-center gap-4 p-4 rounded-2xl border border-border/40 dark:border-border/40 bg-white dark:bg-card hover:border-amber-500/40 transition-colors text-left"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10">
              <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground dark:text-white">
                Structure & Departments
              </p>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
                {deptCount} department{deptCount !== 1 ? "s" : ""} configured
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </section>

      {/* ── Recent Hires (PII-safe) ─────────────────────────────────────────── */}
      {recentHires.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground dark:text-muted-foreground uppercase tracking-wider mb-4">
            Recent Hires
          </h2>
          <div className="rounded-2xl border border-border/40 dark:border-border/40 bg-white dark:bg-card divide-y divide-border/40 dark:divide-border/40">
            {recentHires.map((hire, idx) => (
              <div key={idx} className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center text-sm font-bold text-amber-700 dark:text-amber-300 shrink-0">
                  {hire.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground dark:text-white truncate">
                    {hire.designation}
                  </p>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">{hire.department}</p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    hire.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : hire.status === "PROBATION"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-muted/50 text-muted-foreground dark:bg-muted/60 dark:text-muted-foreground"
                  }`}
                >
                  {hire.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
