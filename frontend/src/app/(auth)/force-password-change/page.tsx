"use client";

import { useState } from "react";
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { forceChangePassword } from "@/app/actions/changePassword";

export default function ForcePasswordChangePage() {
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

  const isValid = hasMinLength && hasUpperCase && hasNumber && passwordsMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);

    try {
      const res = await forceChangePassword(newPassword, confirmPassword);
      if (!res.success) {
        setError(res.message || "Failed to update password.");
        setLoading(false);
      } else {
        setSuccess(res.message || "Password updated successfully!");
        // Refresh session state so middleware permits dashboard navigation
        try {
          await fetch("/api/auth/session");
        } catch {}

        const destination = res.redirectUrl || "/dashboard";
        setTimeout(() => {
          window.location.href = destination;
        }, 800);
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4 text-indigo-400">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security Setup</h1>
          <p className="text-sm text-slate-400 mt-1">
            Welcome to the ERP! For security, please set a new personal password before accessing your dashboard.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3 text-emerald-300 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 8 characters"
                required
                className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
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

          {/* Validation Checklist */}
          <div className="p-3 bg-slate-800/40 rounded-xl space-y-1.5 text-xs text-slate-400 border border-slate-800">
            <div className={`flex items-center gap-2 ${hasMinLength ? "text-emerald-400" : ""}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? "bg-emerald-400" : "bg-slate-600"}`} />
              At least 8 characters
            </div>
            <div className={`flex items-center gap-2 ${hasUpperCase ? "text-emerald-400" : ""}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${hasUpperCase ? "bg-emerald-400" : "bg-slate-600"}`} />
              At least one uppercase letter (A-Z)
            </div>
            <div className={`flex items-center gap-2 ${hasNumber ? "text-emerald-400" : ""}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${hasNumber ? "bg-emerald-400" : "bg-slate-600"}`} />
              At least one number (0-9)
            </div>
            <div className={`flex items-center gap-2 ${passwordsMatch ? "text-emerald-400" : ""}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${passwordsMatch ? "bg-emerald-400" : "bg-slate-600"}`} />
              Passwords match
            </div>
          </div>

          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed font-semibold text-white text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating Password...
              </>
            ) : (
              "Save New Password & Continue"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
