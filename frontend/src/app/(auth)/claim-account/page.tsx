"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import {
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { claimParentAccountAction } from "@/app/actions/claimAccount";

function ClaimAccountForm() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") || "";
  const [token, setToken] = useState(initialToken);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const isValid = hasMinLength && hasUpperCase && hasNumber && passwordsMatch && Boolean(token.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) {
      setError("Claim token is missing. Please enter the claim code provided by your school.");
      return;
    }
    if (!isValid) return;

    setLoading(true);
    setError(null);

    try {
      const res = await claimParentAccountAction({
        token,
        newPassword,
        confirmPassword,
      });

      if (!res.success) {
        setError(res.message);
        setLoading(false);
      } else {
        setSuccess("Account claimed successfully! Logging you in...");

        // Auto sign-in with the parent credentials
        if (res.email) {
          try {
            await signIn("credentials", {
              email: res.email,
              password: newPassword,
              redirect: false,
            });
          } catch {}
        }

        setTimeout(() => {
          window.location.href = "/parent/dashboard";
        }, 1200);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl p-6 sm:p-8 space-y-6">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4 text-indigo-400 shadow-lg shadow-indigo-950/40">
          <KeyRound className="w-7 h-7" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-bold text-indigo-300 uppercase tracking-widest mb-2">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>Parent Portal Access</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Claim Parent Account
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
          Set your private password to link and view your child&apos;s attendance, fee demands, homework, and reports.
        </p>
      </div>

      {!token && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-200 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">No verification token detected</span>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Please click the claim link sent via SMS or provided in your class claim sheet. If you believe this is an error, contact your school office.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 text-xs animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3 text-emerald-300 text-xs">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
          <div>
            <span className="font-bold block">Verification Successful</span>
            <span className="text-[11px] text-emerald-200/90">{success}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Claim Token / Code (if not in URL) */}
        {!initialToken && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Claim Token / Code
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
              placeholder="Paste claim token from SMS or sheet"
              required
              disabled={loading || Boolean(success)}
              className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>
        )}

        {/* New Password */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
            New Password
          </label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter at least 8 characters"
              required
              disabled={loading || Boolean(success)}
              className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              required
              disabled={loading || Boolean(success)}
              className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Password Strength Checklist */}
        <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2">
            <div
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                hasMinLength ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"
              }`}
            >
              ✓
            </div>
            <span className={hasMinLength ? "text-emerald-400 font-medium" : "text-slate-400"}>
              At least 8 characters
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                hasUpperCase ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"
              }`}
            >
              ✓
            </div>
            <span className={hasUpperCase ? "text-emerald-400 font-medium" : "text-slate-400"}>
              Contains an uppercase letter
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                hasNumber ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"
              }`}
            >
              ✓
            </div>
            <span className={hasNumber ? "text-emerald-400 font-medium" : "text-slate-400"}>
              Contains a number
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                passwordsMatch ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"
              }`}
            >
              ✓
            </div>
            <span className={passwordsMatch ? "text-emerald-400 font-medium" : "text-slate-400"}>
              Passwords match
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isValid || loading || Boolean(success)}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying & Setting Password...</span>
            </>
          ) : (
            <>
              <span>Claim Account & Enter Portal</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="pt-2 border-t border-slate-800 text-center">
        <Link
          href="/login"
          className="text-xs text-slate-400 hover:text-slate-200 transition"
        >
          Already claimed? <span className="text-indigo-400 font-semibold underline">Sign In</span>
        </Link>
      </div>
    </div>
  );
}

export default function ClaimAccountPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="p-8 text-center text-slate-400 flex items-center gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Loading verification page...</span>
          </div>
        }
      >
        <ClaimAccountForm />
      </Suspense>
    </div>
  );
}
