"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Compass,
  GraduationCap,
  BookOpen,
  IndianRupee,
  Users,
  CalendarCheck,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  ExternalLink,
  RotateCcw,
} from "lucide-react";

export interface TutorialCardItem {
  id: string;
  tag: string;
  tagColor: string;
  title: string;
  summary: string;
  whatItIs: string;
  whyItMatters: string;
  ctaText: string;
  ctaHref: string;
  icon: React.ElementType;
  iconColor: string;
  bgGradient: string;
}

export const TUTORIAL_FLASH_CARDS: TutorialCardItem[] = [
  {
    id: "day-one-cockpit",
    tag: "System Setup",
    tagColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    title: "Day One Cockpit",
    summary: "Real-time command center verifying the 8 operational readiness milestones before school opens.",
    whatItIs: "An automated diagnostic board that evaluates curriculum seeding, faculty roster, student enrollments, fee structures, and attendance readiness.",
    whyItMatters: "Eliminates empty-dashboard confusion and ensures your school opens with zero Excel registers on Day One.",
    ctaText: "Open Day One Cockpit",
    ctaHref: "/admin/day-one",
    icon: Compass,
    iconColor: "text-blue-400",
    bgGradient: "from-blue-600/20 via-indigo-600/10 to-transparent",
  },
  {
    id: "admissions-enrolment",
    tag: "Student Lifecycle",
    tagColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    title: "Admissions & Student Enrolment",
    summary: "End-to-end student registration with Aadhaar encryption and DPDP 2023 parent consent.",
    whatItIs: "A streamlined admission pipeline for enrolling students, assigning admission numbers, and auto-mapping class sections.",
    whyItMatters: "Instantly initializes each student's fee ledger, parent communication link, and academic profile in one step.",
    ctaText: "Open Admissions Hub",
    ctaHref: "/admissions",
    icon: GraduationCap,
    iconColor: "text-emerald-400",
    bgGradient: "from-emerald-600/20 via-teal-600/10 to-transparent",
  },
  {
    id: "academics-timetable",
    tag: "Curriculum",
    tagColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    title: "Academics & Timetable",
    summary: "Multi-board class structures, subject allocations, and weekly master timetable grids.",
    whatItIs: "Your school's structural backbone for organizing grade levels, sections, compulsory subjects, and classroom schedules.",
    whyItMatters: "Guarantees no teacher double-booking, links subjects directly to statutory report cards, and provides daily schedules for students.",
    ctaText: "Configure Academics",
    ctaHref: "/academics",
    icon: BookOpen,
    iconColor: "text-purple-400",
    bgGradient: "from-purple-600/20 via-violet-600/10 to-transparent",
  },
  {
    id: "fee-structures",
    tag: "Financials",
    tagColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    title: "Fee Structures & Collection",
    summary: "Class-wise fee templates, installment plans, digital receipts, and monthly audit reconciliation.",
    whatItIs: "A transparent billing engine that manages admission fees, tuition installments, transport charges, and concessions.",
    whyItMatters: "Ensures zero fee leaks, closes your monthly fee cycles smoothly, and supports instant online UPI as well as offline counter receipts.",
    ctaText: "Manage Fee Structures",
    ctaHref: "/fees",
    icon: IndianRupee,
    iconColor: "text-amber-400",
    bgGradient: "from-amber-600/20 via-orange-600/10 to-transparent",
  },
  {
    id: "staff-faculty",
    tag: "Human Resources",
    tagColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    title: "Staff & Faculty Allocation",
    summary: "Teaching and non-teaching faculty directory, salary structures, and class teacher assignments.",
    whatItIs: "The operational hub for tracking teacher credentials, subject specializations, leaves, and biometric punch IDs.",
    whyItMatters: "Empowers teachers to record daily attendance, enter exam marks, and communicate directly with parents through their Teacher PWA.",
    ctaText: "Access Staff & HR",
    ctaHref: "/hr",
    icon: Users,
    iconColor: "text-cyan-400",
    bgGradient: "from-cyan-600/20 via-sky-600/10 to-transparent",
  },
  {
    id: "daily-attendance",
    tag: "Daily Operations",
    tagColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    title: "Daily Attendance",
    summary: "Rapid section-wise student attendance completed in under 4 minutes with instant parent SMS/push alerts.",
    whatItIs: "An intuitive daily attendance matrix optimized for morning roll calls with one-tap status toggling.",
    whyItMatters: "Guarantees child safety, ensures compliance with board attendance mandates, and alerts parents immediately if a student is absent.",
    ctaText: "Mark Attendance",
    ctaHref: "/attendance",
    icon: CalendarCheck,
    iconColor: "text-rose-400",
    bgGradient: "from-rose-600/20 via-red-600/10 to-transparent",
  },
  {
    id: "examinations-reports",
    tag: "Examinations",
    tagColor: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    title: "Examinations & Report Cards",
    summary: "Term exam schedules, subject mark entries, 9-point CBSE / Percentage grading, and printable report cards.",
    whatItIs: "A statutory examination suite supporting periodic tests, half-yearly, and final board evaluation rules.",
    whyItMatters: "Saves hundreds of faculty hours by automating grade conversions, ranking, co-scholastic remarks, and beautiful bilingual report cards.",
    ctaText: "Manage Examinations",
    ctaHref: "/exams",
    icon: Sparkles,
    iconColor: "text-yellow-400",
    bgGradient: "from-yellow-600/20 via-amber-600/10 to-transparent",
  },
];

const STORAGE_KEY = "schoolmitra_tutorial_flashcards_dismissed";

export function FeatureTutorialFlashCards({
  className = "",
  initialOpen = true,
}: {
  className?: string;
  initialOpen?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY) === "true";
      setIsVisible(initialOpen && !dismissed);
    } catch {
      setIsVisible(initialOpen);
    }

    const handleOpenTutorial = () => {
      setIsVisible(true);
      setCurrentIndex(0);
    };

    window.addEventListener("open-tutorial-flashcards", handleOpenTutorial);
    return () => {
      window.removeEventListener("open-tutorial-flashcards", handleOpenTutorial);
    };
  }, [initialOpen]);

  if (isVisible === null || !isVisible) {
    return null;
  }

  const currentCard = TUTORIAL_FLASH_CARDS[currentIndex] ?? TUTORIAL_FLASH_CARDS[0];
  if (!currentCard) {
    return null;
  }
  const totalCards = TUTORIAL_FLASH_CARDS.length;
  const IconComponent = currentCard.icon;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % totalCards);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + totalCards) % totalCards);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Ignored if local storage disabled
    }
    setIsVisible(false);
  };

  return (
    <section
      data-testid="feature-tutorial-flashcards"
      aria-label="Feature Setup Tutorial"
      className={`relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br ${currentCard.bgGradient} bg-slate-950/90 backdrop-blur-xl p-5 sm:p-7 shadow-xl transition-all duration-300 ${className}`}
    >
      {/* Background Subtle Pattern */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-white/[0.04] to-transparent pointer-events-none rounded-full blur-2xl" />

      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                SchoolMitra Feature Tutorial
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentCard.tagColor}`}>
                {currentCard.tag}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Card {currentIndex + 1} of {totalCards} · Explore key modules and jump straight to setup
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss Tutorial"
            className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Got it, dismiss</span>
          </button>
        </div>
      </div>

      {/* Main Flash Card Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Visual Icon & Title */}
        <div className="lg:col-span-5 space-y-3.5">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700/80 ${currentCard.iconColor} flex items-center justify-center shadow-lg shadow-black/40`}>
              <IconComponent className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                Module #{currentIndex + 1}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {currentCard.title}
              </h3>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            {currentCard.summary}
          </p>

          <div className="pt-1">
            <Link
              href={currentCard.ctaHref}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs inline-flex items-center justify-center gap-2 shadow-lg shadow-orange-600/25 transition active:scale-95"
            >
              <span>{currentCard.ctaText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Right Column: "What It Is" & "Why It Matters" Explanation Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-left space-y-2">
            <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>What it is</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {currentCard.whatItIs}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-left space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Why it matters</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {currentCard.whyItMatters}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Navigation & Step Dots */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-5 border-t border-slate-800/80">
        {/* Step Dots */}
        <div className="flex items-center gap-1.5">
          {TUTORIAL_FLASH_CARDS.map((card, idx) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Jump to tutorial card ${idx + 1}: ${card.title}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? "w-7 bg-orange-500"
                  : "w-2 bg-slate-700 hover:bg-slate-500"
              }`}
            />
          ))}
        </div>

        {/* Next / Previous Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            className="px-3.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1 transition shadow-xs"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
