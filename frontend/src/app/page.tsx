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
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-semantic-interactive/30 selection:text-semantic-interactive">
      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-semantic-interactive/15 border border-semantic-interactive/25 flex items-center justify-center text-semantic-interactive shadow-level-1">
              <GraduationCap className="w-5 h-5 text-semantic-interactive" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-foreground block">
                SchoolMitra ERP
              </span>
              <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Enterprise School OS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {status === "authenticated" ? (
              <Link
                href={dashboardPath}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 active:scale-[0.98] text-white font-semibold text-sm shadow-sm transition flex items-center gap-2"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-5 py-2.5 min-h-[44px] rounded-xl border border-border/40 bg-muted/60 hover:bg-muted text-foreground font-medium text-sm transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/onboard"
                  className="px-5 py-2.5 min-h-[44px] rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 active:scale-[0.98] text-white font-semibold text-sm shadow-sm transition flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Register Your School
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-semantic-interactive/10 border border-semantic-interactive/25 text-semantic-interactive text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-semantic-interactive" /> Multi-Tenant School ERP Engine v2.0
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight text-foreground">
            The Complete Operating System for{" "}
            <span className="text-semantic-interactive">
              Modern Indian Schools
            </span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Automate Admissions, Class Pricing Matrix Fees, EPFO Payroll, Student Attendance, CBSE Report Cards, and DPDP 2023 Data Privacy Compliance.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            {status === "authenticated" ? (
              <Link
                href={dashboardPath}
                className="w-full sm:w-auto px-8 py-3.5 min-h-[44px] rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 active:scale-[0.98] text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2.5"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/onboard"
                  className="w-full sm:w-auto px-8 py-3.5 min-h-[44px] rounded-xl bg-semantic-interactive hover:bg-semantic-interactive/90 active:scale-[0.98] text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2.5"
                >
                  Onboard School Instantly <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-3.5 min-h-[44px] rounded-xl border border-border/40 bg-muted/60 hover:bg-muted text-foreground font-medium text-sm transition flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-muted-foreground" /> Demo Account Login
                </Link>
              </>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto pt-14 border-t border-border/40">
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums font-mono">100%</div>
              <div className="text-xs text-muted-foreground mt-1">Automated Fee Engine</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-semantic-interactive font-mono">DPDP 2023</div>
              <div className="text-xs text-muted-foreground mt-1">Act Compliant Privacy</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-foreground font-mono">EPFO ECR</div>
              <div className="text-xs text-muted-foreground mt-1">Text Format Export</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-semantic-money-in tabular-nums font-mono">10 Roles</div>
              <div className="text-xs text-muted-foreground mt-1">Dedicated Dashboards</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Showcase Grid ───────────────────────────────────────── */}
      <section className="py-16 bg-muted/30 border-y border-border/40">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Built for Every Stakeholder in Your Institution
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm leading-relaxed">
              From school management to educators, accountants, librarians, parents, and students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-border/40 bg-card backdrop-blur-xl transition-all space-y-3 shadow-level-1 hover:shadow-level-2">
              <div className="w-10 h-10 rounded-xl bg-semantic-money-in/15 border border-semantic-money-in/25 text-semantic-money-in flex items-center justify-center font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Class Pricing Matrix & Fees</h3>
              <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                Set annual fees per grade, bill frequency schedules (Annual, Monthly, Quarterly), sibling concessions, RTE 100% statutory waiver & counter fee receipts.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border/40 bg-card backdrop-blur-xl transition-all space-y-3 shadow-level-1 hover:shadow-level-2">
              <div className="w-10 h-10 rounded-xl bg-semantic-interactive/15 border border-semantic-interactive/25 text-semantic-interactive flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Admissions & Opt-Ins</h3>
              <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                Multi-step digital admissions, DPDP Step-1 consent capture, RTE quota opt-in, school bus transport opt-in, and automated student enrollment.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-border/40 bg-card backdrop-blur-xl transition-all space-y-3 shadow-level-1 hover:shadow-level-2">
              <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border/40 text-foreground flex items-center justify-center font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">HR & EPFO Payroll ECR</h3>
              <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                Staff onboarding, leave quotas, LWP deductions, PF/PT/ESI statutory computations, and 1-click EPFO ECR text file generation.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
