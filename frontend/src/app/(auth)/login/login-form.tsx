"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import { ROLE_CONFIGS, type UserRole } from "@/lib/roleConfig";

// ─── Form schema ──────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  totpCode: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresTOTP, setRequiresTOTP] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    setServerError(null);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        totpCode: data.totpCode || undefined,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes("TOTP_REQUIRED") || result.error === "TOTP_REQUIRED") {
          setRequiresTOTP(true);
          setServerError("Two-factor authentication required. Please enter your 6-digit authenticator code.");
        } else if (result.error.includes("INVALID_TOTP") || result.error === "INVALID_TOTP") {
          setRequiresTOTP(true);
          setServerError("Invalid 2FA code. Please verify your authenticator app and try again.");
        } else if (result.error.toLowerCase().includes("locked")) {
          setServerError("Account is temporarily locked due to too many failed attempts. Please try again in 15 minutes.");
        } else {
          try {
            const lockoutRes = await fetch(`/api/auth/lockout?email=${encodeURIComponent(data.email)}`);
            if (lockoutRes.ok) {
              const lockoutData = await lockoutRes.json();
              if (lockoutData.locked) {
                setServerError("Account is temporarily locked due to too many failed attempts. Please try again in 15 minutes.");
                return;
              }
            }
          } catch {}
          setServerError("Invalid email or password. Please try again.");
        }
      } else {
        const session = await getSession();
        const role = (session?.user as any)?.role as UserRole;
        const mustChangePassword = (session?.user as any)?.mustChangePassword;

        const defaultDashboard = (role && ROLE_CONFIGS[role]?.defaultDashboard) || "/dashboard";

        if (mustChangePassword) {
          window.location.href = `/force-password-change?next=${encodeURIComponent(defaultDashboard)}`;
        } else {
          window.location.href = defaultDashboard;
        }
      }
    } catch {
      setServerError("Something went wrong. Please check your network connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Server Error Alert Banner */}
      {serverError && (
        <div
          className="mb-6 rounded-2xl bg-rose-500/[0.08] border border-rose-500/25 p-4 text-sm text-rose-200 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs sm:text-sm font-medium leading-relaxed">
            {serverError}
          </div>
        </div>
      )}

      {/* Form */}
      <form
        method="POST"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(onSubmit)(e);
        }}
        className="space-y-5"
        noValidate
      >
        {/* Email Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="block text-xs font-medium uppercase tracking-wider text-slate-300"
          >
            Email Address
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-400 transition-colors">
              <Mail className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              autoFocus
              {...register("email")}
              placeholder="admin@school.edu.in"
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-invalid={errors.email ? "true" : "false"}
              className="w-full h-12 pl-10 pr-4 bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 focus:border-blue-500/70 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/15 transition-all duration-200"
            />
          </div>
          {errors.email && (
            <p
              id="email-error"
              className="text-xs text-rose-400 flex items-center gap-1.5 pt-0.5"
              role="alert"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.email.message}</span>
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="block text-xs font-medium uppercase tracking-wider text-slate-300"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-blue-400/90 hover:text-blue-300 transition-colors font-medium focus:outline-none focus:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-400 transition-colors">
              <Lock className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              {...register("password")}
              placeholder="Enter your password"
              aria-describedby={errors.password ? "password-error" : undefined}
              aria-invalid={errors.password ? "true" : "false"}
              className="w-full h-12 pl-10 pr-11 bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] border border-white/10 focus:border-blue-500/70 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/15 transition-all duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 focus:text-white transition-colors p-2 focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password && (
            <p
              id="password-error"
              className="text-xs text-rose-400 flex items-center gap-1.5 pt-0.5"
              role="alert"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.password.message}</span>
            </p>
          )}
        </div>

        {/* ── Two-Factor Authentication Prompt (for Super Admins & 2FA Users) ── */}
        {requiresTOTP && (
          <div className="rounded-2xl p-4 bg-amber-500/[0.08] border border-amber-500/30 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <label
              htmlFor="login-totp"
              className="block text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-2"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              Authenticator Code (TOTP)
            </label>
            <input
              id="login-totp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              {...register("totpCode")}
              placeholder="000000"
              autoFocus
              className="w-full h-12 text-center text-xl font-mono tracking-[0.35em] text-white bg-slate-950/60 border border-amber-400/40 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-500/20 focus:border-amber-400 transition-all"
            />
            <p className="text-[11px] text-amber-200/80 leading-relaxed text-center">
              Enter the 6-digit code from Google Authenticator or 1Password
            </p>
          </div>
        )}

        {/* Submit Primary CTA */}
        <button
          type="submit"
          id="login-submit"
          disabled={isLoading}
          className="w-full h-12 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] shadow-[0_4px_24px_rgba(37,99,235,0.4),0_1px_0_rgba(255,255,255,0.2)_inset] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 transition-all duration-200 mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white/90" aria-hidden="true" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4 text-blue-100 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>

        {/* Secondary Pathway: Parent & Student Portal */}
        <div className="pt-2 text-center">
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors group focus:outline-none focus:underline"
          >
            <span>Are you a parent or student?</span>
            <span className="text-blue-400 group-hover:text-blue-300">
              Access Parent Portal →
            </span>
          </Link>
        </div>
      </form>
    </>
  );
}
