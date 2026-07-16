"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { GraduationCap, Eye, EyeOff, Loader2, Shield } from "lucide-react";

// ─── Form schema ──────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
        redirect: false,
      });

      if (result?.error) {
        setServerError("Invalid email or password. Please try again.");
      } else {
        // Fetch session to determine the user's role for proper portal/dashboard routing
        const session = await getSession();
        const role = session?.user?.role;

        if (role === "PARENT" || role === "STUDENT") {
          router.push("/portal");
        } else {
          router.push("/dashboard");
        }
        router.refresh();
      }
    } catch {
      setServerError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="glass-card p-8 rounded-2xl shadow-glass animate-fade-in">
          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
              <GraduationCap className="w-9 h-9 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-white">SchoolMitra ERP</h1>
            <p className="text-white/60 text-sm mt-1">Sign in to your account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Error banner */}
            {serverError && (
              <div
                className="bg-danger/20 border border-danger/40 rounded-lg px-4 py-3 text-sm text-white"
                role="alert"
                aria-live="assertive"
              >
                {serverError}
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-white/80 mb-1.5"
              >
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                autoFocus
                {...register("email")}
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg
                           text-white placeholder-white/40 text-sm
                           focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40
                           transition-all"
                placeholder="admin@school.edu.in"
                aria-describedby={errors.email ? "email-error" : undefined}
                aria-invalid={errors.email ? "true" : "false"}
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-xs text-danger-light" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-white/80 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  {...register("password")}
                  className="w-full px-4 py-2.5 pr-10 bg-white/10 border border-white/20 rounded-lg
                             text-white placeholder-white/40 text-sm
                             focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40
                             transition-all"
                  placeholder="Enter your password"
                  aria-describedby={errors.password ? "password-error" : undefined}
                  aria-invalid={errors.password ? "true" : "false"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
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
                <p id="password-error" className="mt-1 text-xs text-danger-light" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <a href="/forgot-password" className="text-xs text-white/60 hover:text-white transition-colors">
                Forgot password?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-white text-primary-800 font-semibold rounded-lg text-sm
                         hover:bg-white/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
              id="login-submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>

            {/* Parent login link */}
            <div className="text-center">
              <a
                href="/parent/login"
                className="text-xs text-white/60 hover:text-white transition-colors underline-offset-2 hover:underline"
              >
                Parent Portal Login →
              </a>
            </div>
          </form>
        </div>

        {/* DPDP footer */}
        <div className="mt-4 flex items-center justify-center gap-2 text-white/40 text-xs">
          <Shield className="w-3 h-3" aria-hidden="true" />
          <span>DPDP Act 2023 Compliant · Data encrypted at rest</span>
        </div>
      </div>
    </div>
  );
}
