"use client";

import { useState, useTransition } from "react";
import { useSession, signIn } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  Loader2,
  Check,
  X,
  Building2,
  GraduationCap,
  BookOpen,
  IndianRupee,
  Users,
  Compass,
  ArrowRight,
  Send,
} from "lucide-react";
import { ROLE_CONFIGS, type UserRole } from "@/lib/roleConfig";

interface DemoPersona {
  role: UserRole;
  label: string;
  icon: any;
  emailSuffix: string;
  defaultDashboard: string;
  tagline: string;
}

const DEMO_ROLES: DemoPersona[] = [
  {
    role: "SCHOOL_ADMIN",
    label: "School Admin",
    icon: Building2,
    emailSuffix: "admin",
    defaultDashboard: "/dashboard",
    tagline: "Command Center, Admissions & Roster",
  },
  {
    role: "PRINCIPAL",
    label: "Principal",
    icon: GraduationCap,
    emailSuffix: "principal",
    defaultDashboard: "/principal/dashboard",
    tagline: "Academic Health & Exam Approvals",
  },
  {
    role: "TEACHER",
    label: "Teacher",
    icon: BookOpen,
    emailSuffix: "teacher",
    defaultDashboard: "/teacher/dashboard",
    tagline: "Attendance, Gradebook & Homework",
  },
  {
    role: "ACCOUNTANT",
    label: "Accountant",
    icon: IndianRupee,
    emailSuffix: "finance",
    defaultDashboard: "/school/fees-dashboard",
    tagline: "Fee Collections, Invoices & Day Book",
  },
  {
    role: "PARENT",
    label: "Parent",
    icon: Users,
    emailSuffix: "parent",
    defaultDashboard: "/parent/dashboard",
    tagline: "Child's Live Attendance & Report Cards",
  },
  {
    role: "STUDENT",
    label: "Student",
    icon: Compass,
    emailSuffix: "student",
    defaultDashboard: "/student/dashboard",
    tagline: "Timetable, Homework & Exam Marks",
  },
];

interface BoardSpec {
  code: string;
  label: string;
  shortLabel: string;
  schoolName: string;
  prefix: string;
}

const BOARDS: BoardSpec[] = [
  {
    code: "CBSE",
    label: "CBSE (National)",
    shortLabel: "CBSE",
    schoolName: "Oakridge Global Academy",
    prefix: "cbse",
  },
  {
    code: "ICSE",
    label: "ICSE (Comprehensive)",
    shortLabel: "ICSE",
    schoolName: "St. Xavier's International Academy",
    prefix: "icse",
  },
  {
    code: "STATE",
    label: "State Board (Regional)",
    shortLabel: "State Board",
    schoolName: "Adarsh Vidya Mandir",
    prefix: "state",
  },
  {
    code: "INTL",
    label: "International (CAIE/IB)",
    shortLabel: "International",
    schoolName: "The Cambridge International School",
    prefix: "intl",
  },
];

export function DemoTopBanner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    schoolName: "",
    contactName: "",
    phone: "",
    email: "",
    studentCount: "500-1000",
  });

  // Only render banner when user is logged in AND isDemo is true (or demo email detected)
  const isDemoUser =
    session?.user &&
    ((session.user as any).isDemo === true ||
      session.user.email?.endsWith("@demo.schoolos.io") ||
      session.user.email?.includes("demo"));

  if (status === "loading" || !isDemoUser) {
    return null;
  }

  // Detect current active board from email or school
  const currentEmail = session?.user?.email?.toLowerCase() || "";
  let currentBoard = BOARDS[0]!;
  if (currentEmail.includes(".icse@")) currentBoard = BOARDS[1]!;
  else if (currentEmail.includes(".state@")) currentBoard = BOARDS[2]!;
  else if (currentEmail.includes(".intl@")) currentBoard = BOARDS[3]!;

  const currentRoleName = (session?.user as any)?.role || "SCHOOL_ADMIN";
  const activeRoleObj =
    DEMO_ROLES.find((r) => r.role === currentRoleName) || DEMO_ROLES[0]!;

  const handleSwitchRole = async (targetRole: DemoPersona, targetBoard: BoardSpec = currentBoard) => {
    setIsSwitching(`${targetRole.role}-${targetBoard.code}`);
    setShowRoleDropdown(false);
    setShowBoardDropdown(false);

    try {
      // Formulate target demo email
      const isCbse = targetBoard.code === "CBSE";
      const targetEmail = isCbse
        ? `${targetRole.emailSuffix}@demo.schoolos.io`
        : `${targetRole.emailSuffix}.${targetBoard.prefix}@demo.schoolos.io`;

      const destination = targetRole.defaultDashboard || "/dashboard";
      const result = await signIn("credentials", {
        email: targetEmail,
        password: "SchoolMitra@123",
        callbackUrl: destination,
        redirect: false,
      });

      if (result?.ok || !result?.error || result?.error === "SessionExpired") {
        window.location.href = destination;
      } else {
        alert("Failed to switch role in demo sandbox. Please try again.");
      }
    } catch (err) {
      console.error("[DEMO ROLE SWITCH ERROR]", err);
    } finally {
      setIsSwitching(null);
    }
  };

  const handleResetSandbox = async () => {
    if (
      !confirm(
        "Reset Demo Sandbox?\n\nThis will restore all 4 demo schools, 800 students, 30 days of attendance, timetables, and fee invoices to pristine default state."
      )
    ) {
      return;
    }

    setIsResetting(true);
    setResetFeedback(null);
    try {
      const res = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: currentBoard.code }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetFeedback("Sandbox Restored!");
        setTimeout(() => {
          setResetFeedback(null);
          window.location.reload();
        }, 1200);
      } else {
        alert(data.error || "Failed to reset demo data.");
      }
    } catch (err) {
      console.error("[DEMO RESET ERROR]", err);
      alert("Network error resetting sandbox. Please try again.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingSubmitted(true);
    setTimeout(() => {
      setBookingSubmitted(false);
      setShowBookingModal(false);
      setBookingForm({
        schoolName: "",
        contactName: "",
        phone: "",
        email: "",
        studentCount: "500-1000",
      });
    }, 2500);
  };

  return (
    <>
      {/* ── Persistent Top Demo Banner ── */}
      <header
        role="region"
        aria-label="Demo Mode Control Center"
        className="sticky top-0 z-50 w-full bg-slate-950/90 backdrop-blur-xl border-b border-indigo-500/25 px-3 sm:px-4 py-2 text-white shadow-xl transition-all"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Brand & Demo Status Badge */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-[11px] font-semibold text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Interactive Demo</span>
            </span>

            {/* School & Board Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowBoardDropdown(!showBoardDropdown);
                  setShowRoleDropdown(false);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-200 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 px-2.5 py-1 rounded-lg transition"
                title="Switch School Curriculum"
              >
                <span className="font-semibold">{currentBoard.schoolName}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                  {currentBoard.shortLabel}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showBoardDropdown && (
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-slate-900 border border-white/15 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Switch School Board
                  </div>
                  {BOARDS.map((b) => (
                    <button
                      key={b.code}
                      type="button"
                      onClick={() => handleSwitchRole(activeRoleObj, b)}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                        b.code === currentBoard.code
                          ? "bg-indigo-600/20 text-indigo-200 font-semibold border border-indigo-500/30"
                          : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-white">{b.schoolName}</div>
                        <div className="text-[10px] text-slate-400">{b.label}</div>
                      </div>
                      {b.code === currentBoard.code && (
                        <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Middle: 1-Click Role Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium hidden md:inline">
              Viewing as:
            </span>

            {/* Desktop Quick Role Pills */}
            <div className="hidden lg:flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/10">
              {DEMO_ROLES.map((r) => {
                const Icon = r.icon;
                const isActive = r.role === currentRoleName;
                const isCurrentSwitching =
                  isSwitching === `${r.role}-${currentBoard.code}`;

                return (
                  <button
                    key={r.role}
                    type="button"
                    disabled={isActive || Boolean(isSwitching)}
                    onClick={() => handleSwitchRole(r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                      isActive
                        ? "bg-blue-600 text-white shadow-level-1 font-semibold"
                        : "text-slate-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-60"
                    }`}
                    title={r.tagline}
                  >
                    {isCurrentSwitching ? (
                      <Loader2 className="w-3 h-3 animate-spin text-white" />
                    ) : (
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{r.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Compact Dropdown on smaller screens */}
            <div className="relative lg:hidden">
              <button
                type="button"
                onClick={() => {
                  setShowRoleDropdown(!showRoleDropdown);
                  setShowBoardDropdown(false);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 font-medium px-2.5 py-1 rounded-lg transition"
              >
                <activeRoleObj.icon className="w-3.5 h-3.5" />
                <span>{activeRoleObj.label}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showRoleDropdown && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-slate-900 border border-white/15 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Switch Active Persona
                  </div>
                  {DEMO_ROLES.map((r) => {
                    const Icon = r.icon;
                    const isActive = r.role === currentRoleName;
                    return (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => handleSwitchRole(r)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                          isActive
                            ? "bg-blue-600/20 text-blue-200 font-semibold border border-blue-500/30"
                            : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-blue-400" />
                          <div>
                            <div className="font-medium text-white">{r.label}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[170px]">
                              {r.tagline}
                            </div>
                          </div>
                        </div>
                        {isActive && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Reset Action & Primary Conversion CTA */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Reset Sandbox */}
            <button
              type="button"
              disabled={isResetting}
              onClick={handleResetSandbox}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-xs font-medium text-slate-300 hover:text-rose-200 transition active:scale-95 disabled:opacity-60"
              title="Wipe mutations and restore pristine seeded demo records"
            >
              <RefreshCw
                className={`w-3 h-3 ${isResetting ? "animate-spin text-rose-400" : "text-slate-400"}`}
              />
              <span className="hidden sm:inline">
                {resetFeedback || (isResetting ? "Resetting…" : "Reset Data")}
              </span>
            </button>

            {/* High-Intent Conversion CTA */}
            <button
              type="button"
              onClick={() => setShowBookingModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-level-1 active:scale-95 transition"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>Subscribe / Book Demo</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Conversion Modal: Book a Demo / Subscribe ── */}
      {showBookingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-white/15 p-6 sm:p-8 shadow-2xl text-white animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowBookingModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            {bookingSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Inquiry Received!</h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Thank you! Our dedicated school architect will reach out within 2 hours with customized pricing and implementation timelines.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Transform Your Institution</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
                  Ready to deploy SchoolMitra?
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
                  Join premier schools running zero-excel operations with four-minute attendance, automated fee ledgers, and CBSE/ICSE compliance.
                </p>

                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-300">
                        School Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={bookingForm.schoolName}
                        onChange={(e) =>
                          setBookingForm({ ...bookingForm, schoolName: e.target.value })
                        }
                        placeholder="e.g. DPS International"
                        className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-300">
                        Principal / Director Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={bookingForm.contactName}
                        onChange={(e) =>
                          setBookingForm({ ...bookingForm, contactName: e.target.value })
                        }
                        placeholder="e.g. Dr. Ramesh Gupta"
                        className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-300">
                        Phone / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        value={bookingForm.phone}
                        onChange={(e) =>
                          setBookingForm({ ...bookingForm, phone: e.target.value })
                        }
                        placeholder="+91 98765 43210"
                        className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-300">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={bookingForm.email}
                        onChange={(e) =>
                          setBookingForm({ ...bookingForm, email: e.target.value })
                        }
                        placeholder="principal@school.edu.in"
                        className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-300">
                      Estimated Student Strength
                    </label>
                    <select
                      value={bookingForm.studentCount}
                      onChange={(e) =>
                        setBookingForm({ ...bookingForm, studentCount: e.target.value })
                      }
                      className="w-full h-10 px-3 rounded-xl bg-slate-800 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="Under 500">Under 500 Students</option>
                      <option value="500-1000">500 to 1,000 Students (Standard)</option>
                      <option value="1000-2500">1,000 to 2,500 Students (Large Campus)</option>
                      <option value="2500+">2,500+ Students (Group / Chain of Schools)</option>
                    </select>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="submit"
                      className="w-full sm:flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-xs text-white flex items-center justify-center gap-2 shadow-level-1 transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Request Guided Walkthrough</span>
                    </button>

                    <Link
                      href="/onboard"
                      onClick={() => setShowBookingModal(false)}
                      className="w-full sm:w-auto h-11 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5 transition"
                    >
                      <span>Start Onboarding</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </Link>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
