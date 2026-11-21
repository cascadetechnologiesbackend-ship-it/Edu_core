"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ROLE_CONFIGS, type UserRole } from "@schoolmitra/validators/roleConfig";
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
  const { data: session, status } = useSession();
  const router = useRouter();

  const userRole = (session?.user as any)?.role as UserRole | undefined;
  const dashboardPath = (userRole && ROLE_CONFIGS[userRole]?.defaultDashboard) || "/dashboard";

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.replace(dashboardPath);
    }
  }, [status, session, dashboardPath, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600/30 selection:text-blue-200">
      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-400 shadow-level-1">
              <GraduationCap className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white block">
                SchoolMitra ERP
              </span>
              <span className="block text-[10px] font-semibold tracking-wider text-blue-400/90 uppercase">
                Enterprise School OS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {status === "authenticated" ? (
              <Link
                href={dashboardPath}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-sm shadow-level-1 transition flex items-center gap-2"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-5 py-2.5 min-h-[44px] rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 font-medium text-sm transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/onboard"
                  className="px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-sm shadow-level-1 transition flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Register Your School
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,122,255,0.18),transparent)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-blue-400" /> Multi-Tenant School ERP Engine v2.0
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight text-white">
            The Complete Operating System for{" "}
            <span className="bg-gradient-to-r from-blue-300 via-white to-blue-200 bg-clip-text text-transparent">
              Modern Indian Schools
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Automate Admissions, Class Pricing Matrix Fees, EPFO Payroll, Student Attendance, CBSE Report Cards, and DPDP 2023 Data Privacy Compliance.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            {status === "authenticated" ? (
              <Link
                href={dashboardPath}
                className="w-full sm:w-auto px-8 py-3.5 min-h-[48px] rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-base shadow-level-2 transition flex items-center justify-center gap-3"
              >
                Go to Dashboard <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/onboard"
                  className="w-full sm:w-auto px-8 py-3.5 min-h-[48px] rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-base shadow-level-2 transition flex items-center justify-center gap-3"
                >
                  Onboard School Instantly <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-3.5 min-h-[48px] rounded-2xl border border-white/10 bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 font-semibold text-base transition flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-slate-400" /> Demo Account Login
                </Link>
              </>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto pt-16 border-t border-white/[0.08]">
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-white">100%</div>
              <div className="text-xs text-slate-400 mt-1">Automated Fee Engine</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-blue-400">DPDP 2023</div>
              <div className="text-xs text-slate-400 mt-1">Act Compliant Privacy</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-indigo-400">EPFO ECR</div>
              <div className="text-xs text-slate-400 mt-1">Text Format Export</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-emerald-400">10 Roles</div>
              <div className="text-xs text-slate-400 mt-1">Dedicated Dashboards</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Showcase Grid ───────────────────────────────────────── */}
      <section className="py-20 bg-slate-900/40 border-y border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Built for Every Stakeholder in Your Institution
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm leading-relaxed">
              From school management to educators, accountants, librarians, parents, and students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl hover:border-blue-500/30 transition-all space-y-4 shadow-level-1 hover:shadow-level-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Class Pricing Matrix & Fees</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Set annual fees per grade, bill frequency schedules (Annual, Monthly, Quarterly), sibling concessions, RTE 100% statutory waiver & counter fee receipts.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl hover:border-indigo-500/30 transition-all space-y-4 shadow-level-1 hover:shadow-level-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Admissions & Opt-Ins</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Multi-step digital admissions, DPDP Step-1 consent capture, RTE quota opt-in, school bus transport opt-in, and automated student enrollment.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl hover:border-emerald-500/30 transition-all space-y-4 shadow-level-1 hover:shadow-level-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
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
