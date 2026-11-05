"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import {
  GraduationCap,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { claimStudentAccountAction } from "@/app/actions/claimAccount";

function ClaimStudentAccountForm() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") || "";
  const initialAdm = searchParams.get("adm") || "";

  const [token, setToken] = useState(initialToken);
  const [admissionNumber, setAdmissionNumber] = useState(initialAdm);
  const [dateOfBirth, setDateOfBirth] = useState("");
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

  const isValid =
    Boolean(token.trim()) &&
    Boolean(admissionNumber.trim()) &&
    Boolean(dateOfBirth) &&
    hasMinLength &&
    hasUpperCase &&
    hasNumber &&
    passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) {
      setError("Claim token is missing. Please use the link provided by your school.");
      return;
    }
    if (!isValid) return;

    setLoading(true);
    setError(null);

    try {
      const res = await claimStudentAccountAction({
        admissionNumber: admissionNumber.trim(),
        dateOfBirth,
        token: token.trim(),
        newPassword,
        confirmPassword,
      });

      if (!res.success) {
        setError(res.message);
        setLoading(false);
      } else {
        setSuccess("Student account claimed successfully! Logging you in...");

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
          window.location.href = "/student/dashboard";
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
        <div className="w-14 h-14 rounded-2xl bg-teal-600/20 border border-teal-500/30 flex items-center justify-center mb-4 text-teal-400 shadow-lg shadow-teal-950/40">
          <GraduationCap className="w-7 h-7" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-[11px] font-bold text-teal-300 uppercase tracking-widest mb-2">
          <ShieldCheck className="w-3 h-3 text-teal-400" />
          <span>Minor-Safe Student Claim</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          Claim Student Account
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
          Verify your official date of birth and set a private password to access your student hub, timetable, marks, and homework.
        </p>
      </div>

      {!initialToken && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-200 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <span>
            No token found in URL. Please paste your claim code or use the official link.
          </span>
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
        {/* Admission Number */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
            Admission Number
          </label>
          <input
            type="text"
            value={admissionNumber}
            onChange={(e) => setAdmissionNumber(e.target.value)}
            placeholder="e.g. ADM-2026-001"
            required
            disabled={loading || Boolean(success)}
            className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
          />
        </div>

        {/* Date of Birth Verification */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Date of Birth</span>
            <span className="text-[10px] text-teal-400 font-normal">Minor-Safety Verification</span>
          </label>
          <div className="relative">
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              required
              disabled={loading || Boolean(success)}
              className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Claim Token (if manual entry) */}
        {!initialToken && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Claim Token / Code
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste 32-character claim token"
              required
              disabled={loading || Boolean(success)}
              className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
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
              className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 pr-10 disabled:opacity-50"
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
              className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 pr-10 disabled:opacity-50"
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
                hasMinLength ? "bg-teal-500 text-white" : "bg-slate-700 text-slate-400"
              }`}
            >
              ✓
            </div>
            <span className={hasMinLength ? "text-teal-400 font-medium" : "text-slate-400"}>
              At least 8 characters
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                hasUpperCase ? "bg-teal-500 text-white" : "bg-slate-700 text-slate-400"
              }`}
            >
              ✓
            </div>
            <span className={hasUpperCase ? "text-teal-400 font-medium" : "text-slate-400"}>
              Contains an uppercase letter
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                hasNumber ? "bg-teal-500 text-white" : "bg-slate-700 text-slate-400"
              }`}
            >
              ✓
            </div>
            <span className={hasNumber ? "text-teal-400 font-medium" : "text-slate-400"}>
              Contains a number
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                passwordsMatch ? "bg-teal-500 text-white" : "bg-slate-700 text-slate-400"
              }`}
            >
              ✓
            </div>
            <span className={passwordsMatch ? "text-teal-400 font-medium" : "text-slate-400"}>
              Passwords match
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isValid || loading || Boolean(success)}
          className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 transition transform hover:-translate-y-0.5"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying & Setting Password...</span>
            </>
          ) : (
            <>
              <span>Verify & Claim Student Account</span>
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
          Already claimed? <span className="text-teal-400 font-semibold underline">Sign In</span>
        </Link>
      </div>
    </div>
  );
}

export default function ClaimStudentAccountPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="p-8 text-center text-slate-400 flex items-center gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
            <span>Loading verification page...</span>
          </div>
        }
      >
        <ClaimStudentAccountForm />
      </Suspense>
    </div>
  );
}
