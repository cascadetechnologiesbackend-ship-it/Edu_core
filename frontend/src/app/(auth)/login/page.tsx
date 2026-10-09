import type { Metadata } from "next";
import Image from "next/image";
import { Sparkles, CheckCircle2, Shield } from "lucide-react";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to SchoolMitra ERP — Your school, beautifully organized.",
};

export default function LoginPage() {
  return (
    <div className="relative min-h-screen w-full bg-[#070b18] text-slate-100 flex flex-col justify-between selection:bg-blue-600/30 selection:text-blue-200 overflow-x-hidden">
      {/* ── Subtle Ambient Background Lighting ── */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
        aria-hidden="true"
      >
        {/* Soft Indigo Bloom in Top-Left */}
        <div className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-br from-blue-700/15 via-indigo-600/10 to-transparent blur-[120px] will-change-transform" />
        
        {/* Gentle Amber Dawn Bloom in Bottom-Right */}
        <div className="absolute -bottom-[20%] -right-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-tl from-amber-600/10 via-blue-600/5 to-transparent blur-[140px] will-change-transform" />

        {/* Micro-dot grid texture for architectural tactility */}
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_0.75px,transparent_0.75px)] [background-size:24px_24px] opacity-[0.06]" />
      </div>

      {/* ── Main Split-Screen Container ── */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10 xl:p-12">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14 items-center">
          
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* LEFT COLUMN: Editorial Educational Brand Environment (Desktop)  */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          <section
            aria-label="About SchoolMitra"
            className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between relative rounded-[28px] overflow-hidden border border-white/10 bg-slate-900/40 backdrop-blur-md shadow-2xl p-8 xl:p-12 min-h-[640px] xl:min-h-[700px] group"
          >
            {/* Background Campus Image with Soft Editorial Overlay */}
            <div className="absolute inset-0 z-0">
              <Image
                src="/images/campus-morning.jpg"
                alt="Architectural view of a serene school campus courtyard"
                fill
                priority
                sizes="(min-width: 1280px) 58vw, (min-width: 1024px) 50vw, 100vw"
                className="object-cover object-center scale-[1.02] transition-transform duration-1000 ease-out group-hover:scale-[1.04]"
              />
              {/* Multi-layered dark and warm gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#070b18] via-[#070b18]/70 to-[#070b18]/30" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#070b18]/80 via-transparent to-blue-950/20" />
            </div>

            {/* Top Brand Header */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/15 p-2 flex items-center justify-center shadow-lg shadow-black/20">
                  <Image
                    src="/icon.svg"
                    alt="SchoolMitra Logo"
                    width={28}
                    height={28}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <span className="font-semibold text-lg tracking-tight text-white block">
                    SchoolMitra
                  </span>
                  <span className="text-[11px] font-medium tracking-wider text-blue-300/80 uppercase block">
                    School Operating System
                  </span>
                </div>
              </div>

              {/* Status Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] backdrop-blur-md border border-white/10 text-xs text-slate-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Academic Session 2025–26</span>
              </div>
            </div>

            {/* Center Editorial Quote & Vision - Normative Server LCP Element (PF-R50) */}
            <div className="relative z-10 my-auto py-12 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-medium mb-6">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Everything your school needs, thoughtfully unified</span>
              </div>

              <h1 className="text-3xl xl:text-4xl 2xl:text-[42px] font-light tracking-tight text-white leading-[1.25] mb-5">
                Better schools begin with{" "}
                <span className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-indigo-100 to-amber-200">
                  calm, dependable organization.
                </span>
              </h1>

              <p className="text-slate-300/85 text-base xl:text-lg font-normal leading-relaxed">
                From daily attendance and lesson plans to examinations and fee management — designed with care for teachers, administrators, and families.
              </p>
            </div>

            {/* Bottom Educational Modules Bar */}
            <div className="relative z-10 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Comprehensive K–10 ERP</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>DPDP Act 2023 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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
                  src="/icon.svg"
                  alt="SchoolMitra Logo"
                  width={34}
                  height={34}
                  className="w-full h-full object-contain"
                />
              </div>
              <h2 className="text-xl font-semibold text-white tracking-tight">
                SchoolMitra ERP
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Your school, beautifully organized.
              </p>
            </div>

            {/* ── Refined Apple-Quality Floating Glass Card ── */}
            <div className="w-full max-w-[440px] rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-white/[0.12] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.6),0_1px_0_rgba(255,255,255,0.12)_inset] p-7 sm:p-9 xl:p-10 transition-all duration-300">
              
              {/* Header inside card */}
              <div className="mb-7">
                <h2 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-white">
                  Welcome back
                </h2>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
                  Sign in to continue to your school account.
                </p>
              </div>

              {/* Client Interactive Form */}
              <LoginForm />
            </div>

            {/* Reassurance Footer */}
            <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-xs text-center px-4">
              <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <span>DPDP Act 2023 Compliant · Data encrypted at rest</span>
            </div>
          </section>

        </div>
      </main>

      {/* ── Minimal Bottom Legal / Accessibility Bar ── */}
      <footer className="relative z-10 py-4 px-6 text-center text-xs text-slate-600 border-t border-white/[0.04]">
        <p>© {new Date().getFullYear()} SchoolMitra ERP. Built for Indian Schools.</p>
      </footer>
    </div>
  );
}
