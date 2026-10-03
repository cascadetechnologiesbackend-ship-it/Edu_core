"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerSchoolTenant, OnboardSchoolPayload } from "./actions/onboard";
import {
  GraduationCap,
  Building2,
  UserPlus,
  Receipt,
  Award,
  UserCheck,
  CalendarCheck,
  ShieldCheck,
  Bus,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
  Layers,
  Zap,
  Globe,
} from "lucide-react";

export default function PublicLandingPage() {
  const router = useRouter();
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState<OnboardSchoolPayload>({
    schoolName: "",
    board: "CBSE",
    udiseCode: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    email: "",
    academicYearLabel: "2026-27",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    selectedGrades: [
      "NURSERY",
      "LKG",
      "UKG",
      "CLASS_1",
      "CLASS_2",
      "CLASS_3",
      "CLASS_4",
      "CLASS_5",
      "CLASS_6",
      "CLASS_7",
      "CLASS_8",
      "CLASS_9",
      "CLASS_10",
    ],
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });

  const toggleGrade = (grade: string) => {
    if (form.selectedGrades.includes(grade)) {
      setForm({
        ...form,
        selectedGrades: form.selectedGrades.filter((g) => g !== grade),
      });
    } else {
      setForm({ ...form, selectedGrades: [...form.selectedGrades, grade] });
    }
  };

  const handleNextStep = () => {
    setError("");
    if (step === 1) {
      if (!form.schoolName || !form.udiseCode || !form.city || !form.email) {
        setError("Please fill out all required school profile fields.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (form.selectedGrades.length === 0) {
        setError("Please select at least one grade level.");
        return;
      }
      setStep(3);
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!form.adminName || !form.adminEmail || !form.adminPassword) {
      setError("Please fill out admin account credentials.");
      setLoading(false);
      return;
    }

    try {
      const res = await registerSchoolTenant(form);
      setLoading(false);
      if (res.success) {
        setSuccessMessage(res.message);
      } else {
        setError(res.message || "Onboarding failed.");
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "An unexpected error occurred.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                SchoolMitra ERP
              </span>
              <span className="block text-[10px] font-semibold tracking-widest text-blue-400 uppercase">
                Enterprise School OS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-800 hover:text-white transition"
            >
              Sign In
            </Link>
            <button
              onClick={() => {
                setShowOnboardModal(true);
                setStep(1);
                setSuccessMessage("");
                setError("");
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Register Your School
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.25),rgba(255,255,255,0))]"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-blue-400" /> Multi-Tenant School ERP Engine v2.0
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight max-w-4xl mx-auto leading-tight">
            The Complete Operating System for{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Modern Indian Schools
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Automate Admissions, Class Pricing Matrix Fees, EPFO Payroll, Student Attendance, CBSE Report Cards, and DPDP 2023 Data Privacy Compliance.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={() => {
                setShowOnboardModal(true);
                setStep(1);
                setSuccessMessage("");
                setError("");
              }}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base shadow-xl shadow-blue-600/40 transition flex items-center justify-center gap-3"
            >
              Onboard School Instantly <ArrowRight className="w-5 h-5" />
            </button>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-200 font-semibold text-base transition flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-slate-400" /> Demo Account Login
            </Link>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto pt-16 border-t border-slate-800/80">
            <div>
              <div className="text-3xl font-black text-white">100%</div>
              <div className="text-xs text-slate-400 mt-1">Automated Fee Engine</div>
            </div>
            <div>
              <div className="text-3xl font-black text-blue-400">DPDP 2023</div>
              <div className="text-xs text-slate-400 mt-1">Act Compliant Privacy</div>
            </div>
            <div>
              <div className="text-3xl font-black text-indigo-400">EPFO ECR</div>
              <div className="text-xs text-slate-400 mt-1">Text Format Export</div>
            </div>
            <div>
              <div className="text-3xl font-black text-purple-400">10 Roles</div>
              <div className="text-xs text-slate-400 mt-1">Dedicated Dashboards</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Showcase Grid ───────────────────────────────────────── */}
      <section className="py-20 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-extrabold text-white">
              Built for Every Stakeholder in Your Institution
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From school management to educators, accountants, librarians, parents, and students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-blue-500/50 transition space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Class Pricing Matrix & Fees</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Set annual fees per grade, bill frequency schedules (Annual, Monthly, Quarterly), sibling concessions, RTE 100% statutory waiver & counter fee receipts.
              </p>
            </div>

            <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-indigo-500/50 transition space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Admissions & Opt-Ins</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Multi-step digital admissions, DPDP Step-1 consent capture, RTE quota opt-in, school bus transport opt-in, and automated student enrollment.
              </p>
            </div>

            <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-purple-500/50 transition space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">HR & EPFO Payroll ECR</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Staff onboarding, leave quotas, LWP deductions, PF/PT/ESI statutory computations, and 1-click EPFO ECR text file generation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ONBOARDING MODAL ───────────────────────────────────────────── */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-blue-500" />
                <h2 className="text-2xl font-bold text-white">Onboard School Tenant</h2>
              </div>
              <button
                onClick={() => setShowOnboardModal(false)}
                className="text-slate-400 hover:text-white text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-4">
              <span className={step >= 1 ? "text-blue-400" : ""}>1. School Info</span>
              <span className={step >= 2 ? "text-blue-400" : ""}>2. Academic Year & Grades</span>
              <span className={step >= 3 ? "text-blue-400" : ""}>3. Admin Credentials</span>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {successMessage ? (
              <div className="space-y-6 text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-white">School Registered Successfully!</h3>
                <p className="text-slate-300 text-sm">{successMessage}</p>
                <div className="pt-4 flex justify-center gap-4">
                  <Link
                    href="/login"
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition"
                  >
                    Proceed to Login
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleOnboardSubmit} className="space-y-6">
                {/* STEP 1: School Profile */}
                {step === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white">Step 1: School Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">School Name *</label>
                        <input
                          type="text"
                          required
                          value={form.schoolName}
                          onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                          placeholder="e.g. Springfield Public School"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">UDISE Code (Tenant Slug) *</label>
                        <input
                          type="text"
                          required
                          value={form.udiseCode}
                          onChange={(e) => setForm({ ...form, udiseCode: e.target.value })}
                          placeholder="e.g. 27251101905"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Education Board *</label>
                        <select
                          value={form.board}
                          onChange={(e) => setForm({ ...form, board: e.target.value as any })}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500"
                        >
                          <option value="CBSE">CBSE</option>
                          <option value="ICSE">ICSE</option>
                          <option value="STATE_BOARD">State Board</option>
                          <option value="IGCSE">IGCSE</option>
                          <option value="IB">IB</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Official Email *</label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="contact@school.edu.in"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">City *</label>
                        <input
                          type="text"
                          required
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                          placeholder="Pune"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">State *</label>
                        <input
                          type="text"
                          required
                          value={form.state}
                          onChange={(e) => setForm({ ...form, state: e.target.value })}
                          placeholder="Maharashtra"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition"
                      >
                        Next: Academic Setup →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: Academic Year & Grades */}
                {step === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white">Step 2: Academic Setup & Grades</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Academic Year Label</label>
                        <input
                          type="text"
                          value={form.academicYearLabel}
                          onChange={(e) => setForm({ ...form, academicYearLabel: e.target.value })}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Start Date</label>
                        <input
                          type="date"
                          value={form.startDate}
                          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-2">Select Active Grade Levels</label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-800 rounded-xl bg-slate-950">
                        {[
                          "NURSERY",
                          "LKG",
                          "UKG",
                          "CLASS_1",
                          "CLASS_2",
                          "CLASS_3",
                          "CLASS_4",
                          "CLASS_5",
                          "CLASS_6",
                          "CLASS_7",
                          "CLASS_8",
                          "CLASS_9",
                          "CLASS_10",
                          "CLASS_11",
                          "CLASS_12",
                        ].map((g) => (
                          <label
                            key={g}
                            className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer border ${
                              form.selectedGrades.includes(g)
                                ? "bg-blue-600/20 border-blue-500 text-white"
                                : "border-slate-800 text-slate-400"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={form.selectedGrades.includes(g)}
                              onChange={() => toggleGrade(g)}
                              className="hidden"
                            />
                            {g.replace("_", " ")}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between pt-4">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition"
                      >
                        Next: Admin Credentials →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Admin Credentials */}
                {step === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white">Step 3: Initial School Admin Account</h3>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Admin Full Name *</label>
                      <input
                        type="text"
                        required
                        value={form.adminName}
                        onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                        placeholder="Dr. Ramesh Kumar"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Admin Email Address *</label>
                      <input
                        type="email"
                        required
                        value={form.adminEmail}
                        onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                        placeholder="admin@springfield.edu.in"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Admin Password *</label>
                      <input
                        type="password"
                        required
                        value={form.adminPassword}
                        onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-blue-500"
                      />
                    </div>

                    <div className="flex justify-between pt-4">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium"
                      >
                        ← Back
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition flex items-center gap-2"
                      >
                        {loading ? "Provisioning School Tenant..." : "Complete Onboarding"}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
