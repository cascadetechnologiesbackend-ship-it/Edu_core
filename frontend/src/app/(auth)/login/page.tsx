import type { Metadata } from "next";
import Image from "next/image";
import { Sparkles, CheckCircle2, Shield } from "lucide-react";
import LoginForm from "./login-form";
import { getActiveTenant } from "@/lib/tenant";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to SchoolMitra ERP — Your school, beautifully organized.",
};

export default async function LoginPage() {
  await getActiveTenant();
  return (
    <div className="relative min-h-screen w-full bg-background text-foreground flex flex-col justify-between selection:bg-semantic-interactive/30 selection:text-semantic-interactive overflow-x-hidden">
      {/* ── Subtle Ambient Background Lighting ── */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
        aria-hidden="true"
      >
        {/* Soft Neutral Bloom in Top-Left */}
        <div className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-br from-semantic-interactive/10 via-muted/10 to-transparent blur-[120px] will-change-transform" />
        
        {/* Gentle Neutral Bloom in Bottom-Right */}
        <div className="absolute -bottom-[20%] -right-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-tl from-muted/20 via-transparent to-transparent blur-[140px] will-change-transform" />

        {/* Micro-dot grid texture for architectural tactility */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(120,120,128,0.2)_0.75px,transparent_0.75px)] [background-size:24px_24px] opacity-20" />
      </div>

      {/* ── Main Split-Screen Container ── */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10 xl:p-12">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14 items-center">
          
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* LEFT COLUMN: Editorial Educational Brand Environment (Desktop)  */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <section
            aria-label="About SchoolMitra"
            className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between relative rounded-[28px] overflow-hidden border border-border/40 bg-card/60 backdrop-blur-md shadow-2xl p-8 xl:p-12 min-h-[640px] xl:min-h-[700px] group text-card-foreground"
          >
            {/* Background Campus Image with Soft Editorial Overlay */}
            <div className="absolute inset-0 z-0">
              <Image
                src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/images/campus-morning.jpg`}
                alt="Architectural view of a serene school campus courtyard"
                fill
                priority
                sizes="(min-width: 1280px) 58vw, (min-width: 1024px) 50vw, 100vw"
                className="object-cover object-center scale-[1.02] transition-transform duration-1000 ease-out group-hover:scale-[1.04]"
              />
              {/* Multi-layered dark and warm gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30 dark:opacity-90 opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
            </div>

            {/* Top Brand Header */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-card/80 backdrop-blur-xl border border-border/40 p-2 flex items-center justify-center shadow-lg">
                  <Image
                    src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon.svg`}
                    alt="SchoolMitra Logo"
                    width={28}
                    height={28}
                    unoptimized
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <span className="font-semibold text-lg tracking-tight text-white block">
                    SchoolMitra
                  </span>
                  <span className="text-[11px] font-medium tracking-wider text-semantic-interactive uppercase block">
                    School Operating System
                  </span>
                </div>
              </div>

              {/* Status Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] backdrop-blur-md border border-white/10 text-xs text-white/80 font-medium">
                <span className="w-2 h-2 rounded-full bg-semantic-money-in animate-pulse" />
                <span>Academic Session 2025–26</span>
              </div>
            </div>

            {/* Center Editorial Quote & Vision - Normative Server LCP Element (PF-R50) */}
            <div className="relative z-10 my-auto py-12 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-semantic-interactive/15 border border-semantic-interactive/30 text-white text-xs font-medium mb-6">
                <Sparkles className="w-3.5 h-3.5 text-semantic-interactive" />
                <span>Everything your school needs, thoughtfully unified</span>
              </div>

              <h1 className="text-3xl xl:text-4xl 2xl:text-[42px] font-light tracking-tight text-white leading-[1.25] mb-5">
                Better schools begin with{" "}
                <span className="font-medium text-white">
                  calm, dependable organization.
                </span>
              </h1>

              <p className="text-white/85 text-base xl:text-lg font-normal leading-relaxed">
                From daily attendance and lesson plans to examinations and fee management — designed with care for teachers, administrators, and families.
              </p>
            </div>

            {/* Bottom Educational Modules Bar */}
            <div className="relative z-10 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-white/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-semantic-money-in" />
                <span>Comprehensive K–10 ERP</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-semantic-money-in" />
                <span>DPDP Act 2023 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-semantic-money-in" />
                <span>Multi-role Secure Access</span>
              </div>
            </div>
          </section>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* RIGHT COLUMN: Refined Floating Glass Authentication Surface     */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <section
            aria-label="Sign in"
            className="w-full lg:col-span-6 xl:col-span-5 flex flex-col items-center justify-center"
          >
            {/* Mobile / Tablet Brand Header */}
            <div className="lg:hidden flex flex-col items-center text-center mb-6 w-full max-w-md">
              <div className="w-13 h-13 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/15 p-2.5 flex items-center justify-center mb-3 shadow-lg shadow-black/30">
                <Image
                  src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon.svg`}
                  alt="SchoolMitra Logo"
                  width={34}
                  height={34}
                  unoptimized
                  className="w-full h-full object-contain"
                />
              </div>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                SchoolMitra ERP
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Your school, beautifully organized.
              </p>
            </div>

            {/* ── Refined Apple-Quality Floating Glass Card ── */}
            <div className="w-full max-w-[480px] sm:max-w-[540px] rounded-3xl bg-card border border-border/40 shadow-2xl p-6 sm:p-8 xl:p-9 transition-all duration-300">
              
              {/* Header inside card */}
              <div className="mb-5">
                <h2 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-foreground">
                  Welcome to SchoolMitra
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                  Explore interactive live demo or sign in to your school account.
                </p>
              </div>

              {/* Client Interactive Form */}
              <LoginForm />
            </div>

            {/* Reassurance Footer */}
            <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground text-xs text-center px-4">
              <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>DPDP Act 2023 Compliant · Data encrypted at rest</span>
            </div>
          </section>

        </div>
      </main>

      {/* ── Minimal Bottom Legal / Accessibility Bar ── */}
      <footer className="relative z-10 py-4 px-6 text-center text-xs text-muted-foreground border-t border-border/40">
        <p>© {new Date().getFullYear()} SchoolMitra ERP. Built for Indian Schools.</p>
      </footer>
    </div>
  );
}
