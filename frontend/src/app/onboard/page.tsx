"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  registerSchoolTenant,
  ClassSetupItem,
  SubjectSetupItem,
  FeeHeadSetupItem,
} from "@/app/actions/onboard";
import {
  GraduationCap,
  Building2,
  UserPlus,
  Receipt,
  UserCheck,
  Calendar,
  Layers,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
  Plus,
  X,
  HelpCircle,
} from "lucide-react";

export default function DedicatedSchoolOnboardingWizard() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successResult, setSuccessResult] = useState<{ message: string; email: string } | null>(null);

  // ── 1. Academic Session State ───────────────────────────────────────────
  const [academicSession, setAcademicSession] = useState("2026-27");
  const [startDate, setStartDate] = useState("2026-04-01");
  const [endDate, setEndDate] = useState("2027-03-31");

  // ── 2. School Profile State ──────────────────────────────────────────────
  const [schoolName, setSchoolName] = useState("");
  const [board, setBoard] = useState<"CBSE" | "ICSE" | "STATE_BOARD" | "IGCSE" | "IB">("CBSE");
  const [udiseCode, setUdiseCode] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [phone, setPhone] = useState("+91 ");
  const [email, setEmail] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("₹");

  // ── 3. Classes & Sections State ─────────────────────────────────────────
  const [classesList, setClassesList] = useState<ClassSetupItem[]>([
    { gradeLevel: "NURSERY", displayName: "Nursery", sections: ["A"] },
    { gradeLevel: "LKG", displayName: "LKG", sections: ["A"] },
    { gradeLevel: "UKG", displayName: "UKG", sections: ["A"] },
    { gradeLevel: "CLASS_1", displayName: "Class 1", sections: ["A"] },
    { gradeLevel: "CLASS_2", displayName: "Class 2", sections: ["A"] },
    { gradeLevel: "CLASS_3", displayName: "Class 3", sections: ["A"] },
    { gradeLevel: "CLASS_4", displayName: "Class 4", sections: ["A"] },
    { gradeLevel: "CLASS_5", displayName: "Class 5", sections: ["A"] },
    { gradeLevel: "CLASS_6", displayName: "Class 6", sections: ["A"] },
    { gradeLevel: "CLASS_7", displayName: "Class 7", sections: ["A"] },
    { gradeLevel: "CLASS_8", displayName: "Class 8", sections: ["A"] },
    { gradeLevel: "CLASS_9", displayName: "Class 9", sections: ["A"] },
    { gradeLevel: "CLASS_10", displayName: "Class 10", sections: ["A"] },
  ]);
  const [customClassInput, setCustomClassInput] = useState("");

  // ── 4. Subjects State ───────────────────────────────────────────────────
  const [subjectsList, setSubjectsList] = useState<SubjectSetupItem[]>([
    { name: "English Language & Literature", code: "ENG", subjectType: "LANGUAGE" },
    { name: "Hindi Course A", code: "HIN", subjectType: "LANGUAGE" },
    { name: "Mathematics", code: "MATH", subjectType: "THEORY" },
    { name: "General Science", code: "SCI", subjectType: "THEORY" },
    { name: "Social Science", code: "SST", subjectType: "THEORY" },
    { name: "Computer Science & IT", code: "CS", subjectType: "PRACTICAL" },
    { name: "Environmental Studies (EVS)", code: "EVS", subjectType: "THEORY" },
    { name: "Physical Education", code: "PED", subjectType: "ACTIVITY" },
  ]);
  const [customSubjectInput, setCustomSubjectInput] = useState("");

  // ── 5. Fee Heads & Grading State ────────────────────────────────────────
  const [feeHeadsList, setFeeHeadsList] = useState<FeeHeadSetupItem[]>([
    { name: "Tuition Fee", code: "TUT", category: "RECURRING", headType: "TUITION" },
    { name: "Science & Computer Lab Fee", code: "LAB", category: "RECURRING", headType: "LAB" },
    { name: "Library & Resource Hub", code: "LIB", category: "RECURRING", headType: "LIBRARY" },
    { name: "Transport Fee (Opt-In)", code: "TRN", category: "OPTIONAL", headType: "TRANSPORT" },
    { name: "Admission Fee", code: "ADM", category: "ONE_TIME", headType: "ADMISSION" },
    { name: "Refundable Caution Deposit", code: "CAU", category: "ONE_TIME", headType: "MISCELLANEOUS", isRefundable: true },
  ]);
  const [customFeeHeadInput, setCustomFeeHeadInput] = useState("");
  const [gradingScale, setGradingScale] = useState<"CBSE_9_POINT" | "PERCENTAGE" | "GPA">("CBSE_9_POINT");

  // ── 6. Admin Security State ─────────────────────────────────────────────
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [num1] = useState(1);
  const [num2] = useState(9);

  // ── Helper Presets ─────────────────────────────────────────────────────
  const applyClassPreset = (presetName: string) => {
    switch (presetName) {
      case "PRE_PRIMARY":
        setClassesList([
          { gradeLevel: "NURSERY", displayName: "Nursery", sections: ["A"] },
          { gradeLevel: "LKG", displayName: "LKG", sections: ["A"] },
          { gradeLevel: "UKG", displayName: "UKG", sections: ["A"] },
        ]);
        break;
      case "CBSE_PRIMARY":
        setClassesList([
          { gradeLevel: "CLASS_1", displayName: "Class 1", sections: ["A"] },
          { gradeLevel: "CLASS_2", displayName: "Class 2", sections: ["A"] },
          { gradeLevel: "CLASS_3", displayName: "Class 3", sections: ["A"] },
          { gradeLevel: "CLASS_4", displayName: "Class 4", sections: ["A"] },
          { gradeLevel: "CLASS_5", displayName: "Class 5", sections: ["A"] },
        ]);
        break;
      case "CBSE_MIDDLE":
        setClassesList([
          { gradeLevel: "CLASS_6", displayName: "Class 6", sections: ["A"] },
          { gradeLevel: "CLASS_7", displayName: "Class 7", sections: ["A"] },
          { gradeLevel: "CLASS_8", displayName: "Class 8", sections: ["A"] },
        ]);
        break;
      case "CBSE_SECONDARY":
        setClassesList([
          { gradeLevel: "CLASS_9", displayName: "Class 9", sections: ["A"] },
          { gradeLevel: "CLASS_10", displayName: "Class 10", sections: ["A"] },
        ]);
        break;
      case "CBSE_SENIOR_SEC":
        setClassesList([
          { gradeLevel: "CLASS_11", displayName: "Class 11", sections: ["A"] },
          { gradeLevel: "CLASS_12", displayName: "Class 12", sections: ["A"] },
        ]);
        break;
      case "CBSE_FULL":
      case "FULL_K12":
        setClassesList([
          { gradeLevel: "NURSERY", displayName: "Nursery", sections: ["A"] },
          { gradeLevel: "LKG", displayName: "LKG", sections: ["A"] },
          { gradeLevel: "UKG", displayName: "UKG", sections: ["A"] },
          { gradeLevel: "CLASS_1", displayName: "Class 1", sections: ["A"] },
          { gradeLevel: "CLASS_2", displayName: "Class 2", sections: ["A"] },
          { gradeLevel: "CLASS_3", displayName: "Class 3", sections: ["A"] },
          { gradeLevel: "CLASS_4", displayName: "Class 4", sections: ["A"] },
          { gradeLevel: "CLASS_5", displayName: "Class 5", sections: ["A"] },
          { gradeLevel: "CLASS_6", displayName: "Class 6", sections: ["A"] },
          { gradeLevel: "CLASS_7", displayName: "Class 7", sections: ["A"] },
          { gradeLevel: "CLASS_8", displayName: "Class 8", sections: ["A"] },
          { gradeLevel: "CLASS_9", displayName: "Class 9", sections: ["A"] },
          { gradeLevel: "CLASS_10", displayName: "Class 10", sections: ["A"] },
          { gradeLevel: "CLASS_11", displayName: "Class 11", sections: ["A"] },
          { gradeLevel: "CLASS_12", displayName: "Class 12", sections: ["A"] },
        ]);
        break;
    }
  };

  const applySubjectPreset = (presetName: string) => {
    switch (presetName) {
      case "CBSE_PRIMARY":
        setSubjectsList([
          { name: "English", code: "ENG", subjectType: "LANGUAGE" },
          { name: "Hindi", code: "HIN", subjectType: "LANGUAGE" },
          { name: "Mathematics", code: "MATH", subjectType: "THEORY" },
          { name: "Environmental Studies (EVS)", code: "EVS", subjectType: "THEORY" },
          { name: "Art & Craft", code: "ART", subjectType: "CO_SCHOLASTIC" },
          { name: "Computer Basics", code: "COMP", subjectType: "PRACTICAL" },
        ]);
        break;
      case "CBSE_SCIENCE_11_12":
        setSubjectsList([
          { name: "English Core", code: "ENG", subjectType: "LANGUAGE" },
          { name: "Physics", code: "PHY", subjectType: "THEORY" },
          { name: "Chemistry", code: "CHEM", subjectType: "THEORY" },
          { name: "Mathematics", code: "MATH", subjectType: "THEORY" },
          { name: "Biology", code: "BIO", subjectType: "THEORY" },
          { name: "Computer Science", code: "CS", subjectType: "PRACTICAL" },
        ]);
        break;
      case "CBSE_COMMERCE_11_12":
        setSubjectsList([
          { name: "English Core", code: "ENG", subjectType: "LANGUAGE" },
          { name: "Accountancy", code: "ACC", subjectType: "THEORY" },
          { name: "Business Studies", code: "BST", subjectType: "THEORY" },
          { name: "Economics", code: "ECO", subjectType: "THEORY" },
          { name: "Applied Mathematics", code: "MATH", subjectType: "THEORY" },
        ]);
        break;
    }
  };

  const addCustomClass = () => {
    if (!customClassInput.trim()) return;
    const name = customClassInput.trim();
    const code = name.toUpperCase().replace(/\s+/g, "_");
    setClassesList([
      ...classesList,
      { gradeLevel: code, displayName: name, sections: ["A"] },
    ]);
    setCustomClassInput("");
  };

  const removeClass = (idx: number) => {
    setClassesList(classesList.filter((_, i) => i !== idx));
  };

  const addCustomSubject = () => {
    if (!customSubjectInput.trim()) return;
    const name = customSubjectInput.trim();
    const code = name.substring(0, 4).toUpperCase();
    setSubjectsList([
      ...subjectsList,
      { name, code, subjectType: "THEORY" },
    ]);
    setCustomSubjectInput("");
  };

  const removeSubject = (idx: number) => {
    setSubjectsList(subjectsList.filter((_, i) => i !== idx));
  };

  const addCustomFeeHead = () => {
    if (!customFeeHeadInput.trim()) return;
    const name = customFeeHeadInput.trim();
    const code = name.substring(0, 4).toUpperCase();
    setFeeHeadsList([
      ...feeHeadsList,
      { name, code, category: "RECURRING", headType: "TUITION" },
    ]);
    setCustomFeeHeadInput("");
  };

  const removeFeeHead = (idx: number) => {
    setFeeHeadsList(feeHeadsList.filter((_, i) => i !== idx));
  };

  // ── Step Navigation Handlers ───────────────────────────────────────────
  const validateAndNext = () => {
    setError("");
    if (activeStep === 1) {
      if (!academicSession) {
        setError("Please specify the academic session name.");
        return;
      }
      setActiveStep(2);
    } else if (activeStep === 2) {
      if (!schoolName || !udiseCode || !email) {
        setError("Please enter School Name, UDISE Code (Slug), and Official Email.");
        return;
      }
      setActiveStep(3);
    } else if (activeStep === 3) {
      if (classesList.length === 0) {
        setError("Please configure at least one class.");
        return;
      }
      setActiveStep(4);
    } else if (activeStep === 4) {
      if (subjectsList.length === 0) {
        setError("Please configure at least one master subject.");
        return;
      }
      setActiveStep(5);
    } else if (activeStep === 5) {
      if (feeHeadsList.length === 0) {
        setError("Please configure at least one fee head.");
        return;
      }
      setActiveStep(6);
    } else if (activeStep === 6) {
      if (!adminName || !adminEmail || !adminPassword) {
        setError("Please fill out all admin account credentials.");
        return;
      }
      if (adminPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (parseInt(captchaAnswer) !== num1 + num2) {
        setError(`Antispan verification failed. What is ${num1} + ${num2}?`);
        return;
      }
      setActiveStep(7);
    }
  };

  // ── Complete Onboarding Submission ─────────────────────────────────────
  const handleSubmitOnboard = async () => {
    setError("");
    setLoading(true);

    try {
      const payload = {
        academicYearLabel: academicSession,
        startDate,
        endDate,
        schoolName,
        board,
        udiseCode,
        address,
        city,
        state,
        pincode,
        phone,
        email,
        principalName: principalName || adminName,
        currencySymbol,
        classesSetup: classesList,
        subjectsSetup: subjectsList,
        feeHeadsSetup: feeHeadsList,
        gradingScale,
        adminName,
        adminEmail,
        adminPassword,
      };

      const result = await registerSchoolTenant(payload);
      setLoading(false);

      if (result.success) {
        setSuccessResult({
          message: result.message,
          email: (result as any).adminEmail || adminEmail,
        });
      } else {
        setError(result.message || "Onboarding failed.");
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "An unexpected system error occurred.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-orange-500 selection:text-white">
      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 px-8 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 via-amber-600 to-yellow-500 flex items-center justify-center shadow-lg shadow-orange-600/20">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-white">
              SchoolMitra ERP
            </span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
              Tenant Onboarding Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" /> Existing School? Sign In →
          </Link>
        </div>
      </header>

      {/* ── Main Layout Body ───────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Sidebar Navigation (Steps Menu) ────────────────────────── */}
        <aside className="w-80 border-r border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between shrink-0 hidden md:flex">
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-slate-200">School Onboarding Setup</h2>
              <p className="text-xs text-slate-400 mt-1">
                Takes about 3 minutes to provision your school tenant.
              </p>
            </div>

            {/* Vertical Step Tracker */}
            <div className="space-y-2">
              {[
                { id: 1, label: "Academic Session", sub: "The year everything hangs off" },
                { id: 2, label: "School Profile", sub: "Logo, contact & currency" },
                { id: 3, label: "Classes & Sections", sub: "Where students will live" },
                { id: 4, label: "Subjects", sub: "For timetables & marks" },
                { id: 5, label: "Grading & Fees", sub: "Report cards & fee heads" },
                { id: 6, label: "School Admin Security", sub: "Credentials & captcha" },
                { id: 7, label: "Finish & Launch", sub: "Review & launch" },
              ].map((stepItem) => {
                const isActive = activeStep === stepItem.id;
                const isDone = activeStep > stepItem.id;
                return (
                  <button
                    key={stepItem.id}
                    onClick={() => {
                      if (stepItem.id < activeStep) setActiveStep(stepItem.id);
                    }}
                    className={`w-full text-left p-3 rounded-2xl transition border flex items-start gap-3 ${
                      isActive
                        ? "bg-slate-800/90 border-orange-500/80 shadow-md shadow-orange-500/5 text-white"
                        : isDone
                        ? "bg-slate-900/40 border-slate-800/60 text-slate-300 hover:bg-slate-900"
                        : "border-transparent text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isActive
                          ? "bg-orange-600 text-white"
                          : isDone
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {isDone ? "✓" : stepItem.id}
                    </div>
                    <div>
                      <div className="text-xs font-semibold leading-tight">{stepItem.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{stepItem.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/80 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <UserCheck className="w-4 h-4 text-orange-400" />
              <span>Multi-Tenant Data Isolation Active</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Your schema will be isolated under tenant code.
            </p>
          </div>
        </aside>

        {/* ── Center Content Area ───────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6 md:p-12 flex justify-center">
          <div className="w-full max-w-2xl space-y-8">
            {error && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3 animate-shake">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                {error}
              </div>
            )}

            {successResult ? (
              <div className="space-y-6 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h2 className="text-3xl font-black text-white">School Provisioned Successfully!</h2>
                <p className="text-slate-300 text-sm leading-relaxed max-w-lg mx-auto">
                  {successResult.message}
                </p>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2 max-w-md mx-auto">
                  <div className="flex justify-between">
                    <span className="text-slate-400">School Name:</span>
                    <span className="font-bold text-white">{schoolName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">UDISE / Tenant Slug:</span>
                    <span className="font-mono text-orange-400">{udiseCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Admin Email:</span>
                    <span className="font-medium text-white">{successResult.email}</span>
                  </div>
                </div>
                <div className="pt-4">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 transition"
                  >
                    Proceed to Login Portal →
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* ── STEP 1: Academic Session ─────────────────────────────── */}
                {activeStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-2xl font-black text-white">Create your academic session</h1>
                      <p className="text-slate-400 text-xs mt-1">
                        Attendance, exams, fees and reports are all recorded against the current academic session.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900/80 space-y-6">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">Session Name</label>
                        <input
                          type="text"
                          value={academicSession}
                          onChange={(e) => setAcademicSession(e.target.value)}
                          placeholder="e.g. 2026-27"
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-orange-500 focus:outline-none"
                        />
                        <p className="text-[11px] text-slate-400 mt-1.5">Most Indian schools use the format "2026-27".</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {["2026-27", "2026-2027", "2026"].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setAcademicSession(tag)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                              academicSession === tag
                                ? "bg-orange-500/20 border-orange-500 text-white"
                                : "border-slate-800 text-slate-400 hover:border-slate-700"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Session Start Date</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Session End Date</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={validateAndNext}
                        className="px-8 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-xl shadow-orange-600/30 transition flex items-center gap-2"
                      >
                        Save & Continue <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 2: School Profile ──────────────────────────────── */}
                {activeStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-2xl font-black text-white">School profile</h1>
                      <p className="text-slate-400 text-xs mt-1">
                        Your logo and details appear on fee receipts, ID cards, report cards and parent app.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900/80 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-300 mb-1">School Name *</label>
                          <input
                            type="text"
                            required
                            value={schoolName}
                            onChange={(e) => setSchoolName(e.target.value)}
                            placeholder="e.g. Horizen Public School"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">UDISE Code (Tenant Slug) *</label>
                          <input
                            type="text"
                            required
                            value={udiseCode}
                            onChange={(e) => setUdiseCode(e.target.value)}
                            placeholder="e.g. 27251101905"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Affiliation Board *</label>
                          <select
                            value={board}
                            onChange={(e) => setBoard(e.target.value as any)}
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-orange-500"
                          >
                            <option value="CBSE">CBSE Board</option>
                            <option value="ICSE">ICSE Board</option>
                            <option value="STATE_BOARD">State Board</option>
                            <option value="IGCSE">IGCSE</option>
                            <option value="IB">IB International</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Street Address</label>
                          <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Street, City, State"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
                          <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="e.g. Pune"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Official Email *</label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="contact@school.edu.in"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                          <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Principal's Name</label>
                          <input
                            type="text"
                            value={principalName}
                            onChange={(e) => setPrincipalName(e.target.value)}
                            placeholder="e.g. Dr. A. Sharma"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={() => setActiveStep(1)}
                        className="px-6 py-3 rounded-2xl border border-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={validateAndNext}
                        className="px-8 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-xl shadow-orange-600/30 transition flex items-center gap-2"
                      >
                        Save & Continue <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Classes & Sections ──────────────────────────── */}
                {activeStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-2xl font-black text-white">Add your classes & sections</h1>
                      <p className="text-slate-400 text-xs mt-1">
                        Pick a preset to add a whole group at once, then fine-tune.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900/80 space-y-6">
                      <div>
                        <span className="text-xs font-bold text-slate-300">Quick Presets:</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {[
                            { name: "Pre-Primary", code: "PRE_PRIMARY" },
                            { name: "CBSE Primary (1-5)", code: "CBSE_PRIMARY" },
                            { name: "CBSE Middle (6-8)", code: "CBSE_MIDDLE" },
                            { name: "CBSE Secondary (9-10)", code: "CBSE_SECONDARY" },
                            { name: "CBSE Senior Sec (11-12)", code: "CBSE_SENIOR_SEC" },
                            { name: "Full K-12 (Nursery-12)", code: "FULL_K12" },
                          ].map((preset) => (
                            <button
                              key={preset.code}
                              type="button"
                              onClick={() => applyClassPreset(preset.code)}
                              className="px-3 py-1.5 rounded-xl border border-slate-800 hover:border-orange-500/50 bg-slate-950 text-xs font-semibold text-slate-300 hover:text-white transition"
                            >
                              ⚡ {preset.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Selected Classes Tags */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-300">Configured Classes ({classesList.length}):</label>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 rounded-2xl bg-slate-950 border border-slate-800">
                          {classesList.map((cls, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs text-orange-200"
                            >
                              <span>{cls.displayName} (Sec A)</span>
                              <button
                                type="button"
                                onClick={() => removeClass(idx)}
                                className="text-orange-400 hover:text-white"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Single Class Add Input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customClassInput}
                          onChange={(e) => setCustomClassInput(e.target.value)}
                          placeholder="Add a single class, e.g. Class 4"
                          className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={addCustomClass}
                          className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" /> Add
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={() => setActiveStep(2)}
                        className="px-6 py-3 rounded-2xl border border-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={validateAndNext}
                        className="px-8 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-xl shadow-orange-600/30 transition flex items-center gap-2"
                      >
                        Save & Continue <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 4: Subjects ────────────────────────────────────── */}
                {activeStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-2xl font-black text-white">Add your subjects</h1>
                      <p className="text-slate-400 text-xs mt-1">
                        Choose a preset bundle or add your own master subjects.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900/80 space-y-6">
                      <div>
                        <span className="text-xs font-bold text-slate-300">Quick Presets:</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {[
                            { name: "CBSE Primary", code: "CBSE_PRIMARY" },
                            { name: "CBSE Science (11-12)", code: "CBSE_SCIENCE_11_12" },
                            { name: "CBSE Commerce (11-12)", code: "CBSE_COMMERCE_11_12" },
                          ].map((preset) => (
                            <button
                              key={preset.code}
                              type="button"
                              onClick={() => applySubjectPreset(preset.code)}
                              className="px-3 py-1.5 rounded-xl border border-slate-800 hover:border-orange-500/50 bg-slate-950 text-xs font-semibold text-slate-300 hover:text-white transition"
                            >
                              📚 {preset.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Selected Subjects Tags */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-300">Selected Subjects ({subjectsList.length}):</label>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 rounded-2xl bg-slate-950 border border-slate-800">
                          {subjectsList.map((sub, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-200"
                            >
                              <span>{sub.name} ({sub.code})</span>
                              <button
                                type="button"
                                onClick={() => removeSubject(idx)}
                                className="text-blue-400 hover:text-white"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Single Subject Input */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customSubjectInput}
                          onChange={(e) => setCustomSubjectInput(e.target.value)}
                          placeholder="Add a subject, e.g. Robotics"
                          className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={addCustomSubject}
                          className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" /> Add
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={() => setActiveStep(3)}
                        className="px-6 py-3 rounded-2xl border border-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={validateAndNext}
                        className="px-8 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-xl shadow-orange-600/30 transition flex items-center gap-2"
                      >
                        Save & Continue <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 5: Fee Heads & Grading ─────────────────────────── */}
                {activeStep === 5 && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-2xl font-black text-white">Fee heads & grading scale</h1>
                      <p className="text-slate-400 text-xs mt-1">
                        Configure master fee structure categories and report card evaluation rules.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900/80 space-y-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-2">Selected Fee Heads ({feeHeadsList.length}):</label>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 rounded-2xl bg-slate-950 border border-slate-800">
                          {feeHeadsList.map((fh, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200"
                            >
                              <span>{fh.name} ({fh.category})</span>
                              <button
                                type="button"
                                onClick={() => removeFeeHead(idx)}
                                className="text-purple-400 hover:text-white"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customFeeHeadInput}
                          onChange={(e) => setCustomFeeHeadInput(e.target.value)}
                          placeholder="Add custom fee head, e.g. Swimming Pool Fee"
                          className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={addCustomFeeHead}
                          className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" /> Add
                        </button>
                      </div>

                      <div className="pt-4 border-t border-slate-800">
                        <label className="block text-xs font-semibold text-slate-300 mb-2">Grading System</label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: "CBSE_9_POINT", label: "CBSE 9-Point", desc: "A1 to E marks scale" },
                            { id: "PERCENTAGE", label: "Percentage", desc: "0-100% direct marks" },
                            { id: "GPA", label: "GPA (4.0/10.0)", desc: "Grade point average" },
                          ].map((scale) => (
                            <button
                              key={scale.id}
                              type="button"
                              onClick={() => setGradingScale(scale.id as any)}
                              className={`p-3 rounded-2xl border text-left transition ${
                                gradingScale === scale.id
                                  ? "bg-orange-500/20 border-orange-500 text-white"
                                  : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                              }`}
                            >
                              <div className="text-xs font-bold">{scale.label}</div>
                              <div className="text-[10px] text-slate-400 mt-1">{scale.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={() => setActiveStep(4)}
                        className="px-6 py-3 rounded-2xl border border-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={validateAndNext}
                        className="px-8 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-xl shadow-orange-600/30 transition flex items-center gap-2"
                      >
                        Save & Continue <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 6: School Admin Security Profile ───────────────── */}
                {activeStep === 6 && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-2xl font-black text-white">Finalize Your Security</h1>
                      <p className="text-slate-400 text-xs mt-1">
                        Create your master School Admin user credentials and verify captcha.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900/80 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Full Name *</label>
                        <input
                          type="text"
                          required
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          placeholder="e.g. Dr. Vaibhava B G"
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Login Email *</label>
                        <input
                          type="email"
                          required
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="admin@school.edu.in"
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-orange-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Secure Password *</label>
                          <input
                            type="password"
                            required
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Identity *</label>
                          <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white"
                          />
                        </div>
                      </div>

                      {/* Antispan Shield Captcha */}
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-center">
                        <span className="text-[10px] font-bold tracking-widest text-orange-400 uppercase">
                          ANTISPAN SHIELD VERIFICATION
                        </span>
                        <div className="flex items-center justify-center gap-3">
                          <div className="px-5 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 text-lg font-black text-white">
                            {num1} + {num2}
                          </div>
                          <span className="text-slate-400 font-bold text-lg">=</span>
                          <input
                            type="number"
                            value={captchaAnswer}
                            onChange={(e) => setCaptchaAnswer(e.target.value)}
                            placeholder="10"
                            className="w-24 text-center rounded-2xl border border-slate-700 bg-slate-900 py-2 text-lg font-bold text-white"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">Please solve this simple math to prove you are human.</p>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={() => setActiveStep(5)}
                        className="px-6 py-3 rounded-2xl border border-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={validateAndNext}
                        className="px-8 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-xl shadow-orange-600/30 transition flex items-center gap-2"
                      >
                        Proceed to Final Review →
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 7: Finish & Launch ─────────────────────────────── */}
                {activeStep === 7 && (
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-2xl font-black text-white">Review & Launch School Tenant</h1>
                      <p className="text-slate-400 text-xs mt-1">
                        Verify your institution setup details before executing atomic database provisioning.
                      </p>
                    </div>

                    <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900/80 space-y-4 text-xs">
                      <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-800">
                        <div>
                          <span className="text-slate-400">School Name:</span>
                          <div className="text-sm font-bold text-white mt-0.5">{schoolName}</div>
                        </div>
                        <div>
                          <span className="text-slate-400">UDISE / Tenant Code:</span>
                          <div className="text-sm font-bold text-orange-400 font-mono mt-0.5">{udiseCode}</div>
                        </div>
                        <div>
                          <span className="text-slate-400">Academic Session:</span>
                          <div className="font-semibold text-white mt-0.5">{academicSession}</div>
                        </div>
                        <div>
                          <span className="text-slate-400">Board:</span>
                          <div className="font-semibold text-white mt-0.5">{board}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-center py-2">
                        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                          <div className="text-xl font-black text-orange-400">{classesList.length}</div>
                          <div className="text-[10px] text-slate-400 mt-1">Classes</div>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                          <div className="text-xl font-black text-blue-400">{subjectsList.length}</div>
                          <div className="text-[10px] text-slate-400 mt-1">Subjects</div>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                          <div className="text-xl font-black text-purple-400">{feeHeadsList.length}</div>
                          <div className="text-[10px] text-slate-400 mt-1">Fee Heads</div>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-white">{adminName}</div>
                          <div className="text-[11px] text-slate-400">{adminEmail}</div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px]">
                          SCHOOL_ADMIN
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={() => setActiveStep(6)}
                        className="px-6 py-3 rounded-2xl border border-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleSubmitOnboard}
                        className="px-10 py-4 rounded-2xl bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-500 hover:from-orange-500 hover:to-yellow-400 text-white font-extrabold text-base shadow-2xl shadow-orange-600/40 transition flex items-center gap-3"
                      >
                        {loading ? "Provisioning Database Schema..." : "Complete Registration & Launch ERP"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* ── Right Panel Sidebar (Dynamic Tips & Setup Summary) ────────────── */}
        <aside className="w-80 border-l border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-6 shrink-0 hidden lg:flex">
          {/* Card 1: Contextual Info */}
          <div className="p-5 rounded-3xl border border-slate-800 bg-slate-900/90 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-orange-400">
              <HelpCircle className="w-4 h-4" /> Why this matters
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {activeStep === 1 && "One session = one academic year. Attendance, exams, and fees are all recorded inside it."}
              {activeStep === 2 && "Your logo, address, and board print on fee receipts, student ID cards, and report cards."}
              {activeStep === 3 && "Classes & sections define classroom structures where students reside and teachers submit marks."}
              {activeStep === 4 && "Master subjects populate subject allocations, class timetables, and report card grading."}
              {activeStep === 5 && "Fee heads define itemized charges on receipts (Tuition, Transport, Admission, Caution Deposit)."}
              {activeStep === 6 && "School Admin credentials unlock full institution management control."}
              {activeStep === 7 && "Review setup before schema creation. Data isolation ensures zero cross-school data leak."}
            </p>
          </div>

          {/* Card 2: Live Setup Summary */}
          <div className="p-5 rounded-3xl border border-slate-800 bg-slate-900/90 space-y-3">
            <div className="text-xs font-bold text-slate-200">Your setup so far</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Academic session</span>
                <span className="font-semibold text-white">{academicSession}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Classes</span>
                <span className="font-semibold text-white">{classesList.length} configured</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Subjects</span>
                <span className="font-semibold text-white">{subjectsList.length} master items</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Fee heads</span>
                <span className="font-semibold text-white">{feeHeadsList.length} heads</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Admin email</span>
                <span className="font-mono text-[11px] text-orange-400 truncate max-w-[120px]">{adminEmail || "Not set"}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Don't Worry */}
          <div className="p-5 rounded-3xl border border-slate-800 bg-slate-900/90 space-y-2">
            <div className="text-xs font-bold text-slate-300">💡 Don't worry</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Nothing here is final — everything can be changed or expanded later directly from your School Admin Settings dashboard.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
