export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  CalendarCheck,
  UserCheck,
  Users,
  Receipt,
  User,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export const metadata = {
  title: "More Workspace Services | SchoolMitra ERP",
  description: "Secondary services, leave queue, PTM, payroll, and faculty profile.",
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
    category: "Operations & Attendance",
    items: [
      {
        title: "Attendance Register",
        description: "Full classroom roll call register and monthly attendance logs.",
        href: "/teacher/attendance",
        icon: CalendarCheck,
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      },
      {
        title: "Student Leave Queue",
        description: "Approve or decline medical and casual leave requests from parents.",
        href: "/teacher/attendance?tab=leaves",
        icon: UserCheck,
        color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        badge: "P10 Queue",
      },
      {
        title: "Absence Substitutions",
        description: "Request absence coverage and respond to incoming substitution requests.",
        href: "/teacher/classes/substitutions",
        icon: Users,
        color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      },
    ],
  },
  {
    category: "Communication & Community",
    items: [
      {
        title: "Parent-Teacher Meetings (PTM)",
        description: "View booked consultation slots, notes, and mark sessions held.",
        href: "/teacher/ptm",
        icon: Users,
        color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
        badge: "P11 Landed",
      },
      {
        title: "Parent Messages",
        description: "Direct academic inquiry threads with enrolled student guardians.",
        href: "/teacher/messages",
        icon: MessageSquare,
        color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
      },
    ],
  },
  {
    category: "Faculty Self-Service",
    items: [
      {
        title: "Payroll & Payslips",
        description: "Monthly salary statements, breakdown components, and tax deductions.",
        href: "/teacher/payroll",
        icon: Receipt,
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      },
      {
        title: "Educator Profile",
        description: "Personal details, credentials, biometric ID, and notification preferences.",
        href: "/teacher/profile",
        icon: User,
        color: "text-slate-400 bg-slate-500/10 border-slate-500/20",
      },
    ],
  },
];

export default function TeacherMorePage() {
  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Workspace Services
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Access leave approvals, PTM consultations, staff payroll, and operational tools.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {MORE_SECTIONS.map((section) => (
          <div key={section.category} className="space-y-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              {section.category}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 hover:bg-slate-850 hover:border-slate-700 transition flex items-start justify-between gap-3 group shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${item.color}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                            {item.title}
                          </h3>
                          {item.badge && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
