"use client";

import Link from "next/link";
import {
  GraduationCap,
  Building2,
  UserPlus,
  Receipt,
  UserCheck,
  ArrowRight,
  Sparkles,
  Lock,
  Zap,
} from "lucide-react";

export default function PublicLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-orange-500 selection:text-white">
      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 via-amber-600 to-yellow-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                SchoolMitra ERP
              </span>
              <span className="block text-[10px] font-semibold tracking-widest text-orange-400 uppercase">
                Enterprise School OS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-800 hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              href="/onboard"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-semibold text-sm shadow-lg shadow-orange-600/30 transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Register Your School
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(234,88,12,0.2),rgba(255,255,255,0))]"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-orange-400" /> Multi-Tenant School ERP Engine v2.0
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight max-w-4xl mx-auto leading-tight">
            The Complete Operating System for{" "}
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent">
              Modern Indian Schools
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Automate Admissions, Class Pricing Matrix Fees, EPFO Payroll, Student Attendance, CBSE Report Cards, and DPDP 2023 Data Privacy Compliance.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/onboard"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-base shadow-xl shadow-orange-600/40 transition flex items-center justify-center gap-3"
            >
              Onboard School Instantly <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-200 font-semibold text-base transition flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-slate-400" /> Demo Account Login
            </Link>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto pt-16 border-t border-slate-800/80">
            <div>
              <div className="text-3xl font-black text-white">100%</div>
              <div className="text-xs text-slate-400 mt-1">Automated Fee Engine</div>
            </div>
            <div>
              <div className="text-3xl font-black text-orange-400">DPDP 2023</div>
              <div className="text-xs text-slate-400 mt-1">Act Compliant Privacy</div>
            </div>
            <div>
              <div className="text-3xl font-black text-amber-400">EPFO ECR</div>
              <div className="text-xs text-slate-400 mt-1">Text Format Export</div>
            </div>
            <div>
              <div className="text-3xl font-black text-yellow-400">10 Roles</div>
              <div className="text-xs text-slate-400 mt-1">Dedicated Dashboards</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Showcase Grid ───────────────────────────────────────── */}
      <section className="py-20 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-extrabold text-white">
              Built for Every Stakeholder in Your Institution
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From school management to educators, accountants, librarians, parents, and students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-orange-500/50 transition space-y-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center font-bold">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Class Pricing Matrix & Fees</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Set annual fees per grade, bill frequency schedules (Annual, Monthly, Quarterly), sibling concessions, RTE 100% statutory waiver & counter fee receipts.
              </p>
            </div>

            <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-amber-500/50 transition space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Admissions & Opt-Ins</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Multi-step digital admissions, DPDP Step-1 consent capture, RTE quota opt-in, school bus transport opt-in, and automated student enrollment.
              </p>
            </div>

            <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-yellow-500/50 transition space-y-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center font-bold">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">HR & EPFO Payroll ECR</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Staff onboarding, leave quotas, LWP deductions, PF/PT/ESI statutory computations, and 1-click EPFO ECR text file generation.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
