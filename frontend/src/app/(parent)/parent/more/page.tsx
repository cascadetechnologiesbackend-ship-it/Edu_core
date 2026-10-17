export const dynamic = "force-dynamic";

import React from "react";
import Link from "next/link";
import {
  Receipt,
  Bus,
  FileText,
  CalendarCheck,
  ShieldCheck,
  Bell,
  ChevronRight,
  User,
  HelpCircle,
} from "lucide-react";

export const metadata = {
  title: "More Services | SchoolMitra ERP",
  description: "Access fee history, bus tracking, school documents, and data privacy portal.",
};

const MORE_LINKS = [
  {
    category: "Academic & Records",
    items: [
      {
        title: "Attendance History",
        description: "View month-wise attendance logs and leave records",
        href: "/parent/attendance",
        icon: CalendarCheck,
        color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
      },
      {
        title: "Documents & Report Cards",
        description: "Exams, term report cards, and homework submissions",
        href: "/parent/documents",
        icon: FileText,
        color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      },
    ],
  },
  {
    category: "Services & Logistics",
    items: [
      {
        title: "Fee History & Receipts",
        description: "Past term payments, invoices, and download tax receipts",
        href: "/parent/fees",
        icon: Receipt,
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      },
      {
        title: "Bus Route & Schedule",
        description: "Vehicle transit details, stops, and driver contact",
        href: "/parent/bus",
        icon: Bus,
        color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      },
    ],
  },
  {
    category: "Account & Privacy",
    items: [
      {
        title: "Parent Profile",
        description: "Guardian contact details and relationship records",
        href: "/parent/profile",
        icon: User,
        color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      },
      {
        title: "DPDP Privacy & Consent Portal",
        description: "Manage digital personal data consent and legal rights",
        href: "/portal/consent",
        icon: ShieldCheck,
        color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
      },
    ],
  },
];

export default function ParentMorePage() {
  return (
    <div className="space-y-6 py-2">
      <div>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">
          School Services & Records
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Access archival records, fee receipts, transport schedules, and data rights.
        </p>
      </div>

      <div className="space-y-6">
        {MORE_LINKS.map((group) => (
          <div key={group.category} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
              {group.category}
            </h2>

            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden shadow-sm">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${item.color}`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {item.description}
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
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
