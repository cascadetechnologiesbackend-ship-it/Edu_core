"use client";

import { useState, useEffect } from "react";
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
  Sparkles,
  Building2,
  GraduationCap,
  BookOpen,
  IndianRupee,
  Users,
  Compass,
  CheckCircle2,
} from "lucide-react";
import { ROLE_CONFIGS, type UserRole } from "@/lib/roleConfig";

// ─── Form schema ──────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  totpCode: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ─── Demo Board Specifications ────────────────────────────────────────────────

interface DemoBoard {
  code: "CBSE" | "ICSE" | "STATE" | "INTL";
  label: string;
  shortLabel: string;
  schoolName: string;
  prefix: string;
  curriculum: string;
}

const DEMO_BOARDS: DemoBoard[] = [
  {
    code: "CBSE",
    label: "CBSE (National)",
    shortLabel: "CBSE",
    schoolName: "Oakridge Global Academy",
    prefix: "cbse",
    curriculum: "CCE 9-Point Grading · NCERT Standards",
  },
  {
    code: "ICSE",
    label: "ICSE (Comprehensive)",
    shortLabel: "ICSE",
    schoolName: "St. Xavier's International Academy",
    prefix: "icse",
    curriculum: "Percentage Grading · Project Practicals",
  },
  {
    code: "STATE",
    label: "State Board",
    shortLabel: "State Board",
    schoolName: "Adarsh Vidya Mandir",
    prefix: "state",
    curriculum: "State Board (SSC) · Regional Language",
  },
  {
    code: "INTL",
    label: "International",
    shortLabel: "Cambridge",
    schoolName: "The Cambridge International School",
    prefix: "intl",
    curriculum: "CAIE / IGCSE · Checkpoint Evaluations",
  },
];

// ─── Demo Role Card Specifications ────────────────────────────────────────────

interface DemoRoleCard {
  role: UserRole;
  title: string;
  description: string;
  emailPrefix: string;
  icon: any;
  accentColor: {
    bg: string;
    text: string;
    border: string;
    ring: string;
  };
  destination: string;
}

const DEMO_ROLE_CARDS: DemoRoleCard[] = [
  {
    role: "SCHOOL_ADMIN",
    title: "School Admin",
    description: "Command Center, admissions, 360 roster & settings",
    emailPrefix: "admin",
    icon: Building2,
    accentColor: {
      bg: "bg-muted",
      text: "text-foreground",
      border: "border-border/40",
      ring: "group-hover:border-semantic-interactive/40",
    },
    destination: "/dashboard",
  },
  {
    role: "PRINCIPAL",
    title: "Principal",
    description: "Academic health, exam approvals & attendance audits",
    emailPrefix: "principal",
    icon: GraduationCap,
    accentColor: {
      bg: "bg-muted",
      text: "text-foreground",
      border: "border-border/40",
      ring: "group-hover:border-semantic-interactive/40",
    },
    destination: "/principal/dashboard",
  },
  {
    role: "TEACHER",
    title: "Teacher",
    description: "Mark attendance, record grades & post homework",
    emailPrefix: "teacher",
    icon: BookOpen,
    accentColor: {
      bg: "bg-muted",
      text: "text-foreground",
      border: "border-border/40",
      ring: "group-hover:border-semantic-interactive/40",
    },
    destination: "/teacher/dashboard",
  },
  {
    role: "ACCOUNTANT",
    title: "Accountant",
    description: "Fee collections, receipts & pending dues worklist",
    emailPrefix: "finance",
    icon: IndianRupee,
    accentColor: {
      bg: "bg-muted",
      text: "text-foreground",
      border: "border-border/40",
      ring: "group-hover:border-semantic-interactive/40",
    },
    destination: "/school/fees-dashboard",
  },
  {
    role: "PARENT",
    title: "Parent",
    description: "Child's live attendance, report cards & fee dues",
    emailPrefix: "parent",
    icon: Users,
    accentColor: {
      bg: "bg-muted",
      text: "text-foreground",
      border: "border-border/40",
      ring: "group-hover:border-semantic-interactive/40",
    },
    destination: "/parent/dashboard",
  },
  {
    role: "STUDENT",
    title: "Student",
    description: "Weekly timetable, homework & exam scores",
    emailPrefix: "student",
    icon: Compass,
    accentColor: {
      bg: "bg-muted",
      text: "text-foreground",
      border: "border-border/40",
      ring: "group-hover:border-semantic-interactive/40",
    },
    destination: "/student/dashboard",
  },
];

export default function LoginForm() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"demo" | "credentials">("demo");
  const [selectedBoard, setSelectedBoard] = useState<DemoBoard>(DEMO_BOARDS[0]!);
  const [launchingRole, setLaunchingRole] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresTOTP, setRequiresTOTP] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("error=SessionExpired")) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const handleQuickFill = (email: string, password = "SchoolMitra@123") => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", password, { shouldValidate: true });
  };

  // ─── 1-Tap Demo Role Launch ─────────────────────────────────────────────────

  const handleLaunchDemoRole = async (card: DemoRoleCard) => {
    setLaunchingRole(card.role);
    setServerError(null);

    try {
      const isCbse = selectedBoard.code === "CBSE";
      const targetEmail = isCbse
        ? `${card.emailPrefix}@demo.schoolos.io`
        : `${card.emailPrefix}.${selectedBoard.prefix}@demo.schoolos.io`;

      const defaultDashboard =
        (card.role && ROLE_CONFIGS[card.role]?.defaultDashboard) || card.destination;
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const targetDashboard =
        basePath && !defaultDashboard.startsWith(basePath)
          ? `${basePath}${defaultDashboard}`
          : defaultDashboard;

      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const fullCallbackUrl = new URL(targetDashboard, origin).toString();

      let result: any = null;
      try {
        result = await signIn("credentials", {
          email: targetEmail,
          password: "SchoolMitra@123",
          callbackUrl: fullCallbackUrl,
          redirect: false,
        });
      } catch (signInErr: any) {
        console.warn("[DEMO SIGNIN WARN] signIn returned client error:", signInErr);
        // If credentials were accepted by server and session exists, navigate directly
        const session = await getSession();
        if (session?.user) {
          window.location.replace(targetDashboard);
          return;
        }
        throw signInErr;
      }

      if (result?.error && result.error !== "SessionExpired") {
        setServerError(`Failed to launch demo role: ${result.error}`);
        setLaunchingRole(null);
        return;
      }

      // If signIn succeeded or session transition is active, navigate immediately to role dashboard
      if (result?.ok || !result?.error || result?.error === "SessionExpired") {
        window.location.replace(targetDashboard);
        return;
      }

      // Success: determine target route and navigate immediately
      const session = await getSession();
      if (session?.user) {
        const role = (session.user as any)?.role as UserRole;
        const resolvedDashboard =
          (role && ROLE_CONFIGS[role]?.defaultDashboard) || targetDashboard;
        window.location.replace(resolvedDashboard);
        return;
      }

      if (result?.error) {
        setServerError(`Failed to launch demo role: ${result.error}`);
      } else {
        setServerError("Failed to launch demo role. Please try again.");
      }
      setLaunchingRole(null);
    } catch (err) {
      console.error("[DEMO LAUNCH ERROR]", err);
      setServerError("Failed to launch role demo. Please check connection and try again.");
      setLaunchingRole(null);
    }
  };

  // ─── Standard Credentials Sign-In ───────────────────────────────────────────

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    setServerError(null);

    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const dashboardPath = basePath ? `${basePath}/dashboard` : "/dashboard";
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const fullCallbackUrl = new URL(dashboardPath, origin).toString();

      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        totpCode: data.totpCode || undefined,
        callbackUrl: fullCallbackUrl,
        redirect: false,
      });

      if (result?.error && result.error !== "SessionExpired") {
        if (result.error.includes("TOTP_REQUIRED") || result.error === "TOTP_REQUIRED") {
          setRequiresTOTP(true);
          setServerError("Two-factor authentication required. Please enter your 6-digit authenticator code.");
        } else if (result.error.includes("INVALID_TOTP") || result.error === "INVALID_TOTP") {
          setRequiresTOTP(true);
          setServerError("Invalid 2FA code. Please verify your authenticator app and try again.");
        } else if (result.error.toLowerCase().includes("locked")) {
          setServerError("Account is temporarily locked due to too many failed attempts. Please try again in 15 minutes.");
        } else if (
          result.error.includes("RATE_LIMIT_EXCEEDED") ||
          result.error.toLowerCase().includes("rate") ||
          result.error.toLowerCase().includes("too many")
        ) {
          setServerError("Too many login attempts. Please wait a moment and try again.");
        } else {
          try {
            const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
            const lockoutRes = await fetch(`${basePath}/api/auth/lockout?email=${encodeURIComponent(data.email)}`);
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

        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
        const defaultDashboard = (role && ROLE_CONFIGS[role]?.defaultDashboard) || "/dashboard";
        const targetDashboard =
          basePath && !defaultDashboard.startsWith(basePath)
            ? `${basePath}${defaultDashboard}`
            : defaultDashboard;

        let finalRedirect = targetDashboard;
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const cb = params.get("callbackUrl");
          if (cb) {
            try {
              const parsedCb = cb.startsWith("/") ? cb : new URL(cb).pathname;
              const fullCb = basePath && !parsedCb.startsWith(basePath) ? `${basePath}${parsedCb}` : parsedCb;
              if (fullCb && !fullCb.includes("/login")) {
                finalRedirect = fullCb;
              }
            } catch {}
          }
        }

        if (mustChangePassword) {
          const forceUrl = basePath
            ? `${basePath}/force-password-change?next=${encodeURIComponent(finalRedirect)}`
            : `/force-password-change?next=${encodeURIComponent(finalRedirect)}`;
          window.location.replace(forceUrl);
        } else {
          window.location.replace(finalRedirect);
        }
      }
    } catch (err) {
      console.error("[LOGIN ERROR]", err);
      try {
        const session = await getSession();
        if (session?.user) {
          const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
          const role = (session.user as any)?.role as UserRole;
          const defaultDashboard = (role && ROLE_CONFIGS[role]?.defaultDashboard) || "/dashboard";
          const targetDashboard =
            basePath && !defaultDashboard.startsWith(basePath)
              ? `${basePath}${defaultDashboard}`
              : defaultDashboard;
          window.location.replace(targetDashboard);
          return;
        }
      } catch {}
      setServerError("Something went wrong. Please check your network connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* ── Mode Switcher Tab (Apple HIG Segmented Control) ── */}
      <div className="flex p-1 bg-muted/60 border border-border/40 rounded-xl mb-6 select-none">
        <button
          type="button"
          onClick={() => {
            setActiveTab("demo");
            setServerError(null);
          }}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-semantic-interactive/40 ${
            activeTab === "demo"
              ? "bg-card text-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground active:scale-[0.98]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-semantic-attention" />
          <span>Explore Live Demo</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("credentials");
            setServerError(null);
          }}
          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-semantic-interactive/40 ${
            activeTab === "credentials"
              ? "bg-card text-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground active:scale-[0.98]"
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Sign In</span>
        </button>
      </div>

      {/* Server Error Alert Banner */}
      {serverError && (
        <div
          className="mb-5 rounded-2xl bg-semantic-money-owed/10 border border-semantic-money-owed/25 p-3.5 text-sm text-semantic-money-owed flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="w-4 h-4 text-semantic-money-owed shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs font-medium leading-relaxed">{serverError}</div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: 1-Click Interactive Demo Role Explorer                         */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "demo" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Board Selector Tabs */}
          <div>
            <div className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-1.5">
              Select School Curriculum
            </div>
            <div className="grid grid-cols-4 gap-1 p-1 bg-muted/40 border border-border/40 rounded-xl">
              {DEMO_BOARDS.map((b) => (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => setSelectedBoard(b)}
                  className={`py-1.5 px-1 text-[11px] font-medium rounded-lg transition text-center truncate ${
                    selectedBoard.code === b.code
                      ? "bg-card text-foreground font-semibold shadow-xs border border-border/40"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                  title={b.label}
                >
                  {b.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Active School Snapshot Card */}
          <div className="rounded-2xl p-3 bg-card border border-border/40 flex items-center justify-between shadow-xs">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span>{selectedBoard.schoolName}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-semantic-money-in" />
              </div>
              <div className="text-[11px] text-muted-foreground">
                {selectedBoard.curriculum} · 200 Students
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-semantic-interactive/10 border border-semantic-interactive/20 text-semantic-interactive font-medium">
              Demo Tenant
            </span>
          </div>

          {/* 6 Role Cards (2-column grid on desktop, 1-col on small screens) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {DEMO_ROLE_CARDS.map((card) => {
              const Icon = card.icon;
              const isCardLaunching = launchingRole === card.role;
              const isAnyLaunching = Boolean(launchingRole);

              return (
                <div
                  key={card.role}
                  className="group relative rounded-2xl p-3.5 bg-card hover:bg-muted/30 border border-border/40 hover:border-semantic-interactive/40 transition-all duration-200 flex flex-col justify-between shadow-xs"
                >
                  <div>
                    {/* Header: Icon + Title */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-7 h-7 rounded-xl bg-muted border border-border/40 text-foreground flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-semibold text-foreground tracking-tight">
                        {card.title}
                      </h4>
                    </div>

                    {/* Capability Tagline */}
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mb-3">
                      {card.description}
                    </p>
                  </div>

                  {/* 1-Tap Launch Button */}
                  <button
                    type="button"
                    disabled={isAnyLaunching}
                    onClick={() => handleLaunchDemoRole(card)}
                    className="w-full h-8 rounded-xl bg-muted/60 hover:bg-semantic-interactive hover:text-white border border-border/40 hover:border-semantic-interactive text-[11px] font-semibold text-foreground flex items-center justify-center gap-1.5 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {isCardLaunching ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin text-white" />
                        <span>Launching…</span>
                      </>
                    ) : (
                      <>
                        <span>Launch Role</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Notice */}
          <div className="pt-2 text-center text-[11px] text-muted-foreground">
            <span>Universal Demo Sandbox · </span>
            <button
              type="button"
              onClick={() => setActiveTab("credentials")}
              className="text-semantic-interactive hover:underline font-medium focus:outline-none"
            >
              Sign in with custom credentials →
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: Standard Staff & Super Admin Credentials Form                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "credentials" && (
        <form
          method="POST"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(onSubmit)(e);
          }}
          className="space-y-4 animate-in fade-in duration-200"
          noValidate
        >
          {/* Email Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="login-email"
              className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Email Address
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-semantic-interactive transition-colors">
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
                className="w-full h-11 pl-10 pr-4 bg-muted/40 hover:bg-muted/60 focus:bg-background border border-border/50 focus:border-semantic-interactive rounded-xl text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-4 focus:ring-semantic-interactive/15 transition-all duration-200"
              />
            </div>
            {errors.email && (
              <p
                id="email-error"
                className="text-xs text-semantic-money-owed flex items-center gap-1.5 pt-0.5"
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
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-semantic-interactive hover:underline transition-colors font-medium focus:outline-none"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-semantic-interactive transition-colors">
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
                className="w-full h-11 pl-10 pr-11 bg-muted/40 hover:bg-muted/60 focus:bg-background border border-border/50 focus:border-semantic-interactive rounded-xl text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-4 focus:ring-semantic-interactive/15 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors p-2 focus:outline-none"
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
                className="text-xs text-semantic-money-owed flex items-center gap-1.5 pt-0.5"
                role="alert"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.password.message}</span>
              </p>
            )}
          </div>

          {/* 2FA Prompt if required */}
          {requiresTOTP && (
            <div className="rounded-2xl p-3.5 bg-semantic-attention/10 border border-semantic-attention/30 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <label
                htmlFor="login-totp"
                className="block text-xs font-semibold uppercase tracking-wider text-semantic-attention flex items-center gap-2"
              >
                <KeyRound className="w-4 h-4 text-semantic-attention" />
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
                className="w-full h-11 text-center text-lg font-mono tracking-[0.35em] text-foreground bg-background border border-semantic-attention/40 rounded-xl focus:outline-none focus:ring-4 focus:ring-semantic-attention/20 focus:border-semantic-attention transition-all"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
                Enter 6-digit code from your authenticator app
              </p>
            </div>
          )}

          {/* Quick-Fill Shortcuts */}
          <div className="pt-1">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Quick Personas</span>
              <span className="text-[10px] text-semantic-interactive font-mono">1-Tap Fill</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill("admin@demo.schoolos.io")}
                className="px-2 py-1.5 rounded-xl bg-muted/60 hover:bg-muted border border-border/40 text-[11px] font-medium text-muted-foreground hover:text-foreground transition active:scale-95 text-center truncate"
              >
                School Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("teacher@demo.schoolos.io")}
                className="px-2 py-1.5 rounded-xl bg-muted/60 hover:bg-muted border border-border/40 text-[11px] font-medium text-muted-foreground hover:text-foreground transition active:scale-95 text-center truncate"
              >
                Teacher
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("finance@demo.schoolos.io")}
                className="px-2 py-1.5 rounded-xl bg-muted/60 hover:bg-muted border border-border/40 text-[11px] font-medium text-muted-foreground hover:text-foreground transition active:scale-95 text-center truncate"
              >
                Accountant
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("cascadetechnologiessolutions@gmail.com", "P4jkbnixj4@")}
                className="px-2 py-1.5 rounded-xl bg-muted/60 hover:bg-muted border border-border/40 text-[11px] font-medium text-muted-foreground hover:text-foreground transition active:scale-95 text-center truncate"
              >
                Super Admin
              </button>
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            id="login-submit"
            disabled={isLoading}
            className="w-full h-11 rounded-xl font-semibold text-sm text-white bg-semantic-interactive hover:bg-semantic-interactive/90 active:scale-[0.98] shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 transition-all duration-150 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white/90" aria-hidden="true" />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>

          {/* Secondary Pathway: Parent Portal */}
          <div className="pt-1 text-center">
            <Link
              href="/portal"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors group focus:outline-none focus:underline"
            >
              <span>Are you a parent or student?</span>
              <span className="text-semantic-interactive group-hover:underline">
                Access Parent Portal →
              </span>
            </Link>
          </div>
        </form>
      )}
    </>
  );
}
