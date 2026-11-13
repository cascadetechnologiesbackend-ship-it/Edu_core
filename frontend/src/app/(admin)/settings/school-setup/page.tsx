"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Building2,
  BookOpen,
  Palette,
  Globe,
  Upload,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Save,
  Loader2,
  ExternalLink,
  Sparkles,
  Layers,
  GraduationCap,
  Calendar,
  Wallet,
  Clock,
  ArrowUpRight,
  FileSpreadsheet,
  Users,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  getSchoolProfile,
  updateSchoolProfile,
  uploadSchoolLogo,
  getSchoolConfigurationHealthAction,
  type ConfigurationHealthStats,
} from "./actions";
import type { CompletenessResult } from "@/lib/profileCompleteness";
import { ImportExportModal } from "@/components/ui/ImportExportModal";

export default function SchoolSetupPage() {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [logoUploading, setLogoUploading] = useState(false);

  const [activeTab, setActiveTab] = useState<"hub" | "profile">("hub");
  const [schoolData, setSchoolData] = useState<any>(null);
  const [completeness, setCompleteness] = useState<CompletenessResult | null>(null);
  const [healthStats, setHealthStats] = useState<ConfigurationHealthStats | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    email: "",
    principalName: "",
    establishedYear: new Date().getFullYear(),
    board: "CBSE",
    udiseCode: "",
    website: "",
    motto: "",
    about: "",
    socialTwitter: "",
    socialInstagram: "",
    socialFacebook: "",
    socialLinkedin: "",
    socialYoutube: "",
    themeLight: "#4f46e5",
    themeDark: "#6366f1",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [res, health] = await Promise.all([
        getSchoolProfile(),
        getSchoolConfigurationHealthAction(),
      ]);
      setSchoolData(res.school);
      setCompleteness(res.completeness);
      setHealthStats(health);

      const social = (res.school.socialHandles as any) || {};
      const theme = (res.school.themeColors as any) || {};

      setFormData({
        name: res.school.name || "",
        address: res.school.address || "",
        city: res.school.city || "",
        state: res.school.state || "",
        pincode: res.school.pincode || "",
        phone: res.school.phone || "",
        email: res.school.email || "",
        principalName: res.school.principalName || "",
        establishedYear: res.school.establishedYear || new Date().getFullYear(),
        board: res.school.board || "CBSE",
        udiseCode: res.school.udiseCode || "",
        website: res.school.website || "",
        motto: res.school.motto || "",
        about: res.school.about || "",
        socialTwitter: social.twitter || "",
        socialInstagram: social.instagram || "",
        socialFacebook: social.facebook || "",
        socialLinkedin: social.linkedin || "",
        socialYoutube: social.youtube || "",
        themeLight: theme.light || "#4f46e5",
        themeDark: theme.dark || "#6366f1",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to load school profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "establishedYear" ? parseInt(value) || 0 : value,
    }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const socialHandles: Record<string, string> = {};
        if (formData.socialTwitter) socialHandles.twitter = formData.socialTwitter;
        if (formData.socialInstagram) socialHandles.instagram = formData.socialInstagram;
        if (formData.socialFacebook) socialHandles.facebook = formData.socialFacebook;
        if (formData.socialLinkedin) socialHandles.linkedin = formData.socialLinkedin;
        if (formData.socialYoutube) socialHandles.youtube = formData.socialYoutube;

        const payload = {
          name: formData.name,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          phone: formData.phone,
          email: formData.email,
          principalName: formData.principalName,
          establishedYear: Number(formData.establishedYear),
          board: formData.board as any,
          udiseCode: formData.udiseCode,
          website: formData.website || null,
          motto: formData.motto || null,
          about: formData.about || null,
          socialHandles,
          themeColors: {
            light: formData.themeLight,
            dark: formData.themeDark,
          },
        };

        const res = await updateSchoolProfile(payload);
        setSchoolData(res.school);
        setCompleteness(res.completeness);
        toast.success("School profile updated successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to update school profile");
      }
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo file size must be less than 2MB");
      return;
    }

    const data = new FormData();
    data.append("logo", file);

    setLogoUploading(true);
    try {
      const res = await uploadSchoolLogo(data);
      setSchoolData(res.school);
      setCompleteness(res.completeness);
      toast.success("School logo uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload school logo");
    } finally {
      setLogoUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-gray-500">Loading school profile details...</p>
      </div>
    );
  }

  const percent = completeness?.percent ?? 0;

  // ─── Dual-Score & Operational Health Extraction ───────────────────────────
  const configurationScore = healthStats?.configurationScore ?? healthStats?.overallScore ?? 0;
  const operationalScore = healthStats?.operationalScore ?? 0;
  const isOperationallyReady = healthStats?.isOperationallyReady ?? (operationalScore === 100);

  // Entities & Live Counts
  const classesCount = healthStats?.classesCount ?? 0;
  const sectionsCount = healthStats?.sectionsCount ?? (healthStats as any)?.totalActiveSections ?? 0;
  const subjectsCount = healthStats?.subjectsCount ?? 0;
  const feeHeadsCount = healthStats?.feeHeadsCount ?? 0;
  const salaryTemplatesCount = healthStats?.salaryTemplatesCount ?? 0;
  const holidaysCount = healthStats?.holidaysCount ?? 0;
  const hasActiveYear = healthStats?.hasActiveAcademicYear ?? false;

  const bellPeriodsCount = (healthStats as any)?.bellScheduleCount ?? (healthStats as any)?.bellSchedulePeriodsCount ?? 0;
  const sectionsWithTimetableCount = (healthStats as any)?.sectionsWithTimetableCount ?? 0;
  const pricedFeeHeadsCount = (healthStats as any)?.pricedFeeHeadsCount ?? 0;
  const unpricedFeeHeadsCount =
    (healthStats as any)?.unpricedFeeHeadsCount ?? Math.max(0, feeHeadsCount - pricedFeeHeadsCount);
  const activeTeacherAllocationsCount = (healthStats as any)?.activeTeacherAllocationsCount ?? 0;
  const enrolledStudentsCount = (healthStats as any)?.enrolledStudentsCount ?? 0;

  // 5 Operational Readiness Gates Status
  const isBellScheduleComplete = bellPeriodsCount > 0;
  const isTimetableComplete = sectionsCount > 0 && sectionsWithTimetableCount === sectionsCount;
  const isFeePricingComplete = feeHeadsCount > 0 && pricedFeeHeadsCount === feeHeadsCount && unpricedFeeHeadsCount === 0;
  const isTeacherAllocationsComplete = activeTeacherAllocationsCount > 0;
  const isEnrollmentComplete = enrolledStudentsCount > 0;

  // Synthesize Unified Category Cards (8 cards, ensuring F15 and F16 invariants)
  const rawCategories = healthStats?.categories || [];

  const categories = [
    // 1. Academic Calendar
    rawCategories.find((c) => c.key === "academic-calendar") || {
      key: "academic-calendar",
      title: "Academic Calendar & Terms",
      description: "Active academic session, term boundaries, and calendar schedule.",
      href: "/settings/calendar",
      status: hasActiveYear ? "COMPLETE" : "NOT_STARTED",
      metric: hasActiveYear ? "Active Session Set" : "Session Missing",
    },
    // 2. Classes & Sections
    rawCategories.find((c) => c.key === "classes-sections") || {
      key: "classes-sections",
      title: "Classes & Sections",
      description: "Grade hierarchy, class names, and active sections.",
      href: "/settings/classes",
      status: classesCount > 0 ? (sectionsCount > 0 ? "COMPLETE" : "PARTIAL") : "NOT_STARTED",
      metric: `${classesCount} Classes • ${sectionsCount} Sections`,
    },
    // 3. Curriculum & Subjects
    rawCategories.find((c) => c.key === "curriculum-subjects") || {
      key: "curriculum-subjects",
      title: "Curriculum & Subjects",
      description: "Class-wise theory, practical, language, and co-scholastic subjects.",
      href: "/settings/subjects",
      status: subjectsCount > 0 ? "COMPLETE" : "NOT_STARTED",
      metric: `${subjectsCount} Subjects Configured`,
    },
    // 4. Timetable & Bell Schedule (NEW - F15)
    {
      key: "timetable-bell-schedule",
      title: "Timetable & Bell Schedule",
      description: "Bell period timings, master schedule matrix, and section timetable coverage.",
      href: "/academics/timetable",
      status:
        isBellScheduleComplete && isTimetableComplete
          ? ("COMPLETE" as const)
          : isBellScheduleComplete || sectionsWithTimetableCount > 0
          ? ("PARTIAL" as const)
          : ("NOT_STARTED" as const),
      metric: `${bellPeriodsCount} Periods • ${sectionsWithTimetableCount}/${sectionsCount || 0} Timetabled`,
    },
    // 5. Enrollment & Allocations (NEW - F15)
    {
      key: "enrollment-allocations",
      title: "Enrollment & Allocations",
      description: "Student admissions placement and subject-teacher classroom assignments.",
      href: "/students",
      secondaryHref: "/academics",
      secondaryLabel: "Allocations",
      status:
        isEnrollmentComplete && isTeacherAllocationsComplete
          ? ("COMPLETE" as const)
          : isEnrollmentComplete || isTeacherAllocationsComplete
          ? ("PARTIAL" as const)
          : ("NOT_STARTED" as const),
      metric: `${enrolledStudentsCount} Students • ${activeTeacherAllocationsCount} Allocations`,
    },
    // 6. Fee Structures & Heads (UPDATED - F16: Zero-price heads clamp strictly to PARTIAL)
    {
      key: "fee-structures",
      title: "Fee Structures & Heads",
      description: "Tuition, transport, lab fees and chart-of-accounts mapping.",
      href: "/school/fee-structures",
      status:
        isFeePricingComplete
          ? ("COMPLETE" as const)
          : feeHeadsCount > 0
          ? ("PARTIAL" as const)
          : ("NOT_STARTED" as const),
      metric: `${pricedFeeHeadsCount}/${feeHeadsCount} Heads Priced (${unpricedFeeHeadsCount} Unpriced)`,
      nextBestAction:
        unpricedFeeHeadsCount > 0
          ? {
              label: "Configure Pricing at /finance/fees",
              href: "/finance/fees",
            }
          : undefined,
    },
    // 7. HR Salary Grades
    rawCategories.find((c) => c.key === "hr-payroll") || {
      key: "hr-payroll",
      title: "HR Salary Grades",
      description: "Salary templates, standard allowances, and deductions.",
      href: "/settings/hr/salary-grades",
      status: salaryTemplatesCount > 0 ? "COMPLETE" : "NOT_STARTED",
      metric: `${salaryTemplatesCount} Templates Defined`,
    },
    // 8. Holidays & Closures
    rawCategories.find((c) => c.key === "calendar-holidays") || {
      key: "calendar-holidays",
      title: "Holidays & Closures",
      description: "National, gazetted, and school-specific holiday schedule.",
      href: "/settings/calendar",
      status: holidaysCount > 0 ? "COMPLETE" : "NOT_STARTED",
      metric: `${holidaysCount} Holidays Scheduled`,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <Building2 className="w-3.5 h-3.5" /> Institution Identity & Branding
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mt-2">
            School Profile Manager
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Maintain your official institutional data, accreditation, digital identity, and brand styling.
          </p>
        </div>

        {/* System Badges (Protected) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 text-xs font-mono font-medium rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Status: {schoolData?.status || "ACTIVE"}
          </span>
          <span className="px-3 py-1 text-xs font-mono font-medium rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
            Tier: {schoolData?.subscriptionTier || "STANDARD"}
          </span>
          {schoolData?.slug && (
            <span className="px-3 py-1 text-xs font-mono font-medium rounded-lg bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300">
              /{schoolData.slug}
            </span>
          )}
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("hub")}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap min-h-[44px] ${
            activeTab === "hub"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" /> Setup Hub & Digital Twin
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap min-h-[44px] ${
            activeTab === "profile"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Building2 className="w-4 h-4" /> Institution Identity & Branding
        </button>
      </div>

      {activeTab === "hub" ? (
        /* Digital Twin Configuration Hub */
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* Provenance & Status Banner */}
          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-white dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-900 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    {healthStats?.isProvisioned
                      ? "School Digital Twin Active"
                      : "Standard Configuration Workspace"}
                  </h2>
                  {healthStats?.isProvisioned && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      v{healthStats.blueprintVersion || "1.0.0"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-xl leading-relaxed">
                  {healthStats?.isProvisioned
                    ? `Configured from canonical blueprint with ${classesCount} classes, ${subjectsCount} curriculum subjects, and ${feeHeadsCount} fee heads.`
                    : "Configure common academic, fee, and HR templates. Coordinate with platform super-admin to apply a certified board blueprint."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsImportOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[40px] rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs shadow-sm transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Universal Data Import
              </button>
            </div>
          </div>

          {/* Dual-Score Display: Configuration Completeness vs Operational Readiness (F14) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Score Card 1: Configuration Completeness */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base shrink-0 ${
                        configurationScore >= 80
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : configurationScore >= 50
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                      }`}
                    >
                      {configurationScore}%
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Blueprint Foundations
                      </span>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                        Configuration Completeness
                      </h3>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 shrink-0">
                    {Math.round((configurationScore / 100) * 6)}/6 Defined
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Core structural entities provisioned: Academic Year, Classes, Subjects, Fee Heads, Salary Grades, and Calendar Holidays.
                </p>

                {/* Configuration Progress Bar */}
                <div className="w-full bg-gray-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      configurationScore >= 80
                        ? "bg-emerald-500"
                        : configurationScore >= 50
                        ? "bg-indigo-600"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${configurationScore}%` }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>Digital Twin Schema Health</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {configurationScore === 100 ? "All Foundations Set" : "Foundations In Progress"}
                </span>
              </div>
            </div>

            {/* Score Card 2: Operational Readiness */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base shrink-0 ${
                        operationalScore === 100
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : operationalScore >= 60
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                      }`}
                    >
                      {operationalScore}%
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        Day-One Execution
                      </span>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                        Operational Readiness
                      </h3>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                      isOperationallyReady
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {isOperationallyReady ? "Day-One Ready" : `${Math.round((operationalScore / 100) * 5)}/5 Milestones`}
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Day-One execution gates: Bell schedule active, 100% timetable coverage, fee heads priced, teachers assigned, and students enrolled.
                </p>

                {/* Operational Progress Bar */}
                <div className="w-full bg-gray-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      operationalScore === 100
                        ? "bg-emerald-500"
                        : operationalScore >= 60
                        ? "bg-indigo-600"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${operationalScore}%` }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Honest Setup Law
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {isOperationallyReady ? "100% Operational" : "Action Required Before Opening"}
                </span>
              </div>
            </div>
          </div>

          {/* 5 Day-One Operational Readiness Gates (Live Checklist Strip) */}
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Day-One Operational Readiness Gates (5 Strict Milestones)
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Every milestone must be verified green before first-period attendance and student Day Engine can resolve.
                </p>
              </div>
              <span className="text-[11px] font-mono font-medium text-gray-500 dark:text-slate-400 self-start sm:self-auto">
                {isOperationallyReady
                  ? "All 5 Gates Cleared"
                  : `${5 - Math.round((operationalScore / 100) * 5)} Gates Incomplete`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              {/* Gate 1: Bell Schedule */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between gap-1 text-xs ${
                  isBellScheduleComplete
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300"
                    : "bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Bell Schedule
                  </span>
                  {isBellScheduleComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                </div>
                <span className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                  {bellPeriodsCount > 0 ? `${bellPeriodsCount} Periods Set` : "No Bell Schedule"}
                </span>
              </div>

              {/* Gate 2: Timetable Coverage */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between gap-1 text-xs ${
                  isTimetableComplete
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300"
                    : "bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Timetable
                  </span>
                  {isTimetableComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                </div>
                <span className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                  {sectionsCount > 0
                    ? `${sectionsWithTimetableCount}/${sectionsCount} Sections`
                    : "0 Sections"}
                </span>
              </div>

              {/* Gate 3: Fee Pricing */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between gap-1 text-xs ${
                  isFeePricingComplete
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300"
                    : "bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" /> Fee Pricing
                  </span>
                  {isFeePricingComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                </div>
                <span className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                  {feeHeadsCount > 0
                    ? `${pricedFeeHeadsCount}/${feeHeadsCount} Priced`
                    : "0 Fee Heads"}
                </span>
              </div>

              {/* Gate 4: Teacher Allocations */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between gap-1 text-xs ${
                  isTeacherAllocationsComplete
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300"
                    : "bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Allocations
                  </span>
                  {isTeacherAllocationsComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                </div>
                <span className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                  {activeTeacherAllocationsCount > 0
                    ? `${activeTeacherAllocationsCount} Active`
                    : "None Assigned"}
                </span>
              </div>

              {/* Gate 5: Student Enrollment */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between gap-1 text-xs ${
                  isEnrollmentComplete
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300"
                    : "bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5" /> Enrollment
                  </span>
                  {isEnrollmentComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                </div>
                <span className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                  {enrolledStudentsCount > 0 ? `${enrolledStudentsCount} Enrolled` : "0 Students"}
                </span>
              </div>
            </div>
          </div>

          {/* Next-Best-Action Card: Unpriced Fee Heads (F16) */}
          {unpricedFeeHeadsCount > 0 && (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-gradient-to-r from-amber-50 via-amber-50/40 to-white dark:from-amber-950/40 dark:via-amber-950/20 dark:to-slate-900 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                      Next Best Action
                    </span>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      Configure Fee Structure Pricing
                    </h4>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                    {unpricedFeeHeadsCount} active fee head{unpricedFeeHeadsCount > 1 ? "s have" : " has"} zero pricing set. Fee heads without price entries remain PARTIAL and block Day-One student fee collection.
                  </p>
                </div>
              </div>
              <div className="flex items-center shrink-0">
                <Link
                  href="/finance/fees"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[38px] rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-semibold text-xs shadow-sm transition"
                >
                  <span>Set Pricing at /finance/fees</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}

          {/* Grouped Setup Category Cards (8 Category Cards - F15, F16) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((cat: any) => (
              <div
                key={cat.key}
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 hover:border-indigo-500/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        cat.status === "COMPLETE"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : cat.status === "PARTIAL"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20"
                      }`}
                    >
                      {cat.status === "COMPLETE"
                        ? "CONFIGURED"
                        : cat.status === "PARTIAL"
                        ? "IN PROGRESS"
                        : "NOT STARTED"}
                    </span>
                    <span className="text-[11px] font-mono text-gray-500 dark:text-slate-400 truncate">
                      {cat.metric}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                      {cat.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">Operational Module</span>
                    <div className="flex items-center gap-2">
                      {cat.secondaryHref && (
                        <Link
                          href={cat.secondaryHref as any}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-indigo-500 min-h-[38px] transition-colors"
                        >
                          {cat.secondaryLabel || "Workspace"} <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <Link
                        href={cat.href as any}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 min-h-[38px] transition-colors"
                      >
                        Open Workspace <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Contextual Next-Best-Action on Card (Fee Structures) */}
                  {cat.key === "fee-structures" && unpricedFeeHeadsCount > 0 && (
                    <Link
                      href="/finance/fees"
                      className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 min-h-[38px] transition"
                    >
                      <span>Configure Pricing at /finance/fees</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Institution Profile & Branding Form */
        <>
          {/* Completeness Card */}
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base ${
                    percent >= 90
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                      : percent >= 70
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                  }`}
                >
                  {percent}%
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    School Profile Completeness
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {percent >= 90
                      ? "Great job! Your institution profile has comprehensive institutional and digital presence details."
                      : "Complete all sections to unlock customized receipts, parent portal branding, and website badges."}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 self-start sm:self-auto">
                {completeness?.completedWeight ?? 0} / {completeness?.totalWeight ?? 100} Points
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  percent >= 90
                    ? "bg-emerald-500"
                    : percent >= 70
                    ? "bg-indigo-600"
                    : "bg-amber-500"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>

            {/* Missing Items Chips */}
            {completeness?.missing && completeness.missing.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Missing fields:
                </span>
                {completeness.missing.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  >
                    <AlertCircle className="w-3 h-3 text-amber-600" /> {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Main Profile Form */}
          <form onSubmit={handleSaveProfile} className="space-y-8">
            {/* Section 1: Basic Information */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-slate-800">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  1. Basic Institutional Details
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Official School Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Postal Address *
                  </label>
                  <input
                    type="text"
                    name="address"
                    required
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    required
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    name="state"
                    required
                    value={formData.state}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    required
                    value={formData.pincode}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Official Contact Phone *
                  </label>
                  <input
                    type="text"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Official Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Principal / Head of Institution *
                  </label>
                  <input
                    type="text"
                    name="principalName"
                    required
                    value={formData.principalName}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Established Year *
                  </label>
                  <input
                    type="number"
                    name="establishedYear"
                    required
                    min={1800}
                    max={new Date().getFullYear()}
                    value={formData.establishedYear}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Affiliation & Board */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-slate-800">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  2. Board Affiliation & Accreditation
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Education Board *
                  </label>
                  <select
                    name="board"
                    value={formData.board}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="CBSE">Central Board of Secondary Education (CBSE)</option>
                    <option value="ICSE">Council for the Indian School Certificate Examinations (ICSE)</option>
                    <option value="STATE_BOARD">State Secondary Education Board</option>
                    <option value="IGCSE">Cambridge Assessment (IGCSE)</option>
                    <option value="IB">International Baccalaureate (IB)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    UDISE+ Code *
                  </label>
                  <input
                    type="text"
                    name="udiseCode"
                    required
                    maxLength={11}
                    value={formData.udiseCode}
                    onChange={handleInputChange}
                    placeholder="11-digit national UDISE code"
                    className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Branding & Theme */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-slate-800">
                <Palette className="w-5 h-5 text-pink-600" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  3. Visual Identity & Brand Styling
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo Upload Card */}
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-950/60 border border-dashed border-gray-300 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-5">
                  <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                    {schoolData?.logoUrl ? (
                      <img
                        src={schoolData.logoUrl}
                        alt="School Logo"
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <Building2 className="w-10 h-10 text-gray-400" />
                    )}
                  </div>

                  <div className="space-y-2 text-center sm:text-left flex-1">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      Institutional Emblem / Logo
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      PNG, JPEG, WebP or SVG under 2MB. Appears on fee receipts, student IDs, and portal headers.
                    </p>
                    <div>
                      <label
                        htmlFor="logo-upload"
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer shadow-sm transition"
                      >
                        {logoUploading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            {schoolData?.logoUrl ? "Change Logo" : "Upload Logo"}
                          </>
                        )}
                      </label>
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoUpload}
                        disabled={logoUploading}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Brand Colors */}
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-slate-950/60 border border-gray-200 dark:border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Theme Colors (Hex Codes)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        Light Theme Primary
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          name="themeLight"
                          value={formData.themeLight}
                          onChange={handleInputChange}
                          className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
                        />
                        <input
                          type="text"
                          name="themeLight"
                          value={formData.themeLight}
                          onChange={handleInputChange}
                          className="w-full px-2.5 py-1.5 text-xs font-mono uppercase rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        Dark Theme Primary
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          name="themeDark"
                          value={formData.themeDark}
                          onChange={handleInputChange}
                          className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
                        />
                        <input
                          type="text"
                          name="themeDark"
                          value={formData.themeDark}
                          onChange={handleInputChange}
                          className="w-full px-2.5 py-1.5 text-xs font-mono uppercase rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Digital Presence & Motto */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-slate-800">
                <Globe className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  4. Digital Presence & Mission Statement
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Official Website URL
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      name="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      placeholder="https://www.example.edu"
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 pr-10"
                    />
                    {formData.website && (
                      <a
                        href={formData.website}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    School Motto / Tagline
                  </label>
                  <input
                    type="text"
                    name="motto"
                    maxLength={250}
                    value={formData.motto}
                    onChange={handleInputChange}
                    placeholder="e.g., Knowledge is Power • Tamaso Ma Jyotirgamaya"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    About the Institution
                  </label>
                  <textarea
                    name="about"
                    rows={3}
                    maxLength={2000}
                    value={formData.about}
                    onChange={handleInputChange}
                    placeholder="Brief narrative about the institution's history, vision, and pedagogy..."
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Twitter / X Handle
                  </label>
                  <input
                    type="text"
                    name="socialTwitter"
                    value={formData.socialTwitter}
                    onChange={handleInputChange}
                    placeholder="@SchoolHandle"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Instagram Handle
                  </label>
                  <input
                    type="text"
                    name="socialInstagram"
                    value={formData.socialInstagram}
                    onChange={handleInputChange}
                    placeholder="@school_official"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Facebook Page URL
                  </label>
                  <input
                    type="text"
                    name="socialFacebook"
                    value={formData.socialFacebook}
                    onChange={handleInputChange}
                    placeholder="facebook.com/SchoolOfficial"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    LinkedIn Page URL
                  </label>
                  <input
                    type="text"
                    name="socialLinkedin"
                    value={formData.socialLinkedin}
                    onChange={handleInputChange}
                    placeholder="linkedin.com/school/example"
                    className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Action Save Bar */}
            <div className="flex flex-col sm:flex-row justify-end pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </>
      )}

      {/* Universal Data Import & Onboarding Modal */}
      <ImportExportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onCommitSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
}
