import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { KeyRound, ArrowLeft, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset your SchoolMitra ERP password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 overflow-x-hidden selection:bg-blue-600/30 selection:text-blue-200">
      {/* ── Ambient Background Lighting ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
        <div className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-br from-blue-700/15 via-indigo-600/10 to-transparent blur-[120px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full bg-gradient-to-tl from-amber-600/10 via-blue-600/5 to-transparent blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(0,122,255,0.75)_0.75px,transparent_0.75px)] [background-size:24px_24px] opacity-[0.06]" />
      </div>

      <div className="relative z-10 w-full max-w-[440px] rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-white/[0.12] shadow-level-3 p-7 sm:p-9 transition-all duration-300">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-4 text-blue-400 shadow-sm">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-white">
            Reset Password
          </h1>
          <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
            Enter your registered school email to receive a secure password reset link.
          </p>
        </div>

        <form
          className="space-y-5"
          action={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/auth/reset-password`}
          method="POST"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-medium uppercase tracking-wider text-slate-300"
            >
              Email address
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-400 transition-colors">
                <Mail className="w-4 h-4" aria-hidden="true" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                placeholder="name@school.edu.in"
                className="w-full h-12 pl-10 pr-4 bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 focus:border-blue-500/70 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/15 transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full h-12 rounded-xl font-semibold text-[15px] text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] shadow-sm disabled:opacity-50 flex items-center justify-center transition-all duration-150"
            >
              Send Reset Link
            </button>
          </div>
        </form>

        <div className="pt-6 border-t border-white/10 mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors focus:outline-none focus:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
