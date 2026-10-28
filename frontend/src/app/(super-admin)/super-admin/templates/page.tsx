import React from "react";
import Link from "next/link";
import { getAllCanonicalBlueprints, type CanonicalBlueprint } from "@/lib/canonicalBlueprints";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Layers,
  GraduationCap,
  Sparkles,
  BookOpen,
  Calendar,
  Wallet,
  Building,
  Users,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

export const metadata = {
  title: "Digital Twin Blueprints | Super Admin",
  description: "Browse authoritative school digital twin blueprints for rapid, idempotent multi-tenant onboarding.",
};

export const dynamic = "force-dynamic";

export default function TemplatesPage() {
  const blueprints: CanonicalBlueprint[] = getAllCanonicalBlueprints();

  const totalClasses = blueprints.reduce((acc: number, bp: CanonicalBlueprint) => acc + bp.classes.length, 0);
  const totalSubjects = blueprints.reduce((acc: number, bp: CanonicalBlueprint) => acc + bp.subjects.length, 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
      <PageHeader
        title="School Digital Twin Blueprints"
        description="Standardized, production-safe reference blueprints for CBSE, ICSE, State Boards, and IB. Automatically provisions classes, subjects, fee schedules, HR grades, and calendars."
        badge={<StatusBadge status="completed" label="Authoritative Catalog" size="sm" />}
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Digital Twin Blueprints" },
        ]}
      />

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Active Blueprints"
          value={blueprints.length.toString()}
          subtext="CBSE, ICSE, State, IB"
          icon={<Layers className="w-5 h-5" />}
        />
        <MetricCard
          title="Pre-mapped Classes"
          value={totalClasses.toString()}
          subtext="Nursery through Class 12"
          icon={<GraduationCap className="w-5 h-5" />}
        />
        <MetricCard
          title="Curriculum Subjects"
          value={totalSubjects.toString()}
          subtext="Core, Elective, Languages"
          icon={<BookOpen className="w-5 h-5" />}
        />
        <MetricCard
          title="Zero-Reset Safety"
          value="100%"
          subtext="Idempotent ON CONFLICT"
          icon={<ShieldCheck className="w-5 h-5" />}
        />
      </div>

      {/* Blueprints Matrix */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" /> Available School Blueprints
          </h2>
          <span className="text-xs text-slate-400">
            Showing {blueprints.length} certified configuration packs
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {blueprints.map((bp: CanonicalBlueprint) => (
            <div
              key={bp.id}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {bp.board}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    v{bp.version}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                    {bp.displayName}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {bp.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                    <span>{bp.classes.length} Classes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                    <span>{bp.subjects.length} Subjects</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-slate-500" />
                    <span>{bp.feeHeads.length} Fee Heads</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-500" />
                    <span>{bp.salaryGrades.length} Salary Grades</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{bp.holidays.length} Holidays</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>{bp.roleDefaults.length} Roles</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Type: {bp.schoolType}
                </span>
                <Link
                  href={`/super-admin/templates/${bp.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Inspect Pack <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
