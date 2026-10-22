export const dynamic = "force-dynamic";

import React from "react";
import Link from "next/link";
import { getCachedSession } from "@/lib/serverAuth";
import { resolveStudentScope } from "@/lib/studentEventEngine/scopeResolver";
import {
  Award,
  CalendarCheck,
  BookOpen,
  Bell,
  Receipt,
  User,
  ChevronRight,
  Sparkles,
  GraduationCap,
  ShieldAlert,
} from "lucide-react";

export const metadata = {
  title: "More Services | Student Companion",
  description: "Marks, attendance, notices, fee payments, syllabus tracker, and profile.",
};

interface MoreItem {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
  badge?: string;
}

const MORE_SECTIONS: { category: string; items: MoreItem[] }[] = [
  {
    category: "Academic Records",
    items: [
      {
        title: "Marks & Exam Results",
        description: "Datesheets, admit card status, published marks, and report cards.",
        href: "/student/marks",
        icon: Award,
        color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      },
      {
        title: "Attendance & Leave Record",
        description: "Monthly attendance logs, term percentage, and leave request statuses.",
        href: "/student/attendance",
        icon: CalendarCheck,
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      },
      {
        title: "Syllabus Progress",
        description: "Taught units, completed topics, and what is coming next in your subjects.",
        href: "/student/syllabus",
        icon: BookOpen,
        color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      },
    ],
  },
  {
    category: "Campus & Finance",
    items: [
      {
        title: "Official Notices",
        description: "School circulars, event announcements, and administrative updates.",
        href: "/student/notices",
        icon: Bell,
        color: "text-sky-400 bg-sky-500/10 border-sky-500/20",
      },
      {
        title: "Fees & Payment Receipts",
        description: "Term invoices, payment history, receipts, and online settlement.",
        href: "/student/fees",
        icon: Receipt,
        color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
      },
      {
        title: "My Student Profile",
        description: "Admission details, class section, roll number, and credentials.",
        href: "/student/profile",
        icon: User,
        color: "text-slate-400 bg-slate-500/10 border-slate-500/20",
      },
    ],
  },
];

export default async function StudentMorePage({
  searchParams,
}: {
  searchParams?: { studentId?: string };
}) {
  const session = await getCachedSession();
  const userId = session?.user?.id || "";
  const schoolId = session?.user?.schoolId || "";
  const role = session?.user?.role || "STUDENT";
  const studentIdParam = searchParams?.studentId;

  let scope: any = null;
  let scopeError: string | null = null;

  try {
    scope = await resolveStudentScope(userId, {
      schoolId,
      studentId: studentIdParam ?? null,
      role,
    });
  } catch (err: any) {
    scopeError = err.message || "Failed to resolve student identity";
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Student Identity Card */}
      {scope ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shrink-0">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-white truncate">{scope.studentName}</h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {scope.className} - {scope.sectionName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>Adm #{scope.admissionNumber}</span>
                {scope.rollNumber && (
                  <>
                    <span>•</span>
                    <span>Roll #{scope.rollNumber}</span>
                  </>
                )}
                <span>•</span>
                <span className="text-slate-500">{scope.academicYearLabel}</span>
              </p>
            </div>
          </div>
        </div>
      ) : scopeError ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200">{scopeError}</p>
        </div>
      ) : null}

      {/* Services List */}
      {MORE_SECTIONS.map((section) => (
        <div key={section.category} className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            {section.category}
          </h2>
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl divide-y divide-slate-800/60 overflow-hidden shadow-lg">
            {section.items.map((item) => {
              const Icon = item.icon;
              const targetHref = studentIdParam
                ? `${item.href}?studentId=${studentIdParam}`
                : item.href;

              return (
                <Link
                  key={item.href}
                  href={targetHref}
                  prefetch={false}
                  className="flex items-center gap-3.5 p-4 hover:bg-slate-800/50 transition-colors group"
                >
                  <div
                    className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${item.color}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors">
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{item.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
