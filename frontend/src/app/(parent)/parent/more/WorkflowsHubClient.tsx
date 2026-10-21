"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  HelpCircle,
  Bus,
  FileText,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Filter,
  ArrowRight,
  Receipt,
  ShieldCheck,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  UnifiedWorkflowItem,
  WorkflowType,
  StatusCategory,
} from "./actions";

interface WorkflowsHubClientProps {
  initialItems: UnifiedWorkflowItem[];
  wards: Array<{ id: string; name: string }>;
  locale?: string;
}

const TYPE_ICONS: Record<WorkflowType, React.ReactNode> = {
  leave: <CalendarCheck className="w-4 h-4 text-emerald-400" />,
  fee_query: <HelpCircle className="w-4 h-4 text-amber-400" />,
  stop_change: <Bus className="w-4 h-4 text-amber-400" />,
  document: <FileText className="w-4 h-4 text-blue-400" />,
  profile: <User className="w-4 h-4 text-indigo-400" />,
  ptm: <Calendar className="w-4 h-4 text-purple-400" />,
};

const ARCHIVAL_SERVICES = [
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
        title: "Apply for Leave",
        description: "Submit planned absence and track teacher approval",
        href: "/parent/more/leave",
        icon: CalendarCheck,
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
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

export function WorkflowsHubClient({
  initialItems,
  wards,
  locale = "en",
}: WorkflowsHubClientProps) {
  const isHi = locale === "hi";

  const [statusFilter, setStatusFilter] = useState<"ALL" | StatusCategory>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | WorkflowType>("ALL");
  const [wardFilter, setWardFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Counts for status tabs
  const pendingCount = initialItems.filter((i) => i.statusCategory === "PENDING").length;
  const approvedCount = initialItems.filter((i) => i.statusCategory === "APPROVED").length;
  const rejectedCount = initialItems.filter((i) => i.statusCategory === "REJECTED").length;

  // Filter items
  const filteredItems = initialItems.filter((item) => {
    if (statusFilter !== "ALL" && item.statusCategory !== statusFilter) return false;
    if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
    if (wardFilter !== "ALL" && item.studentId !== wardFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.studentName.toLowerCase().includes(q) ||
        item.typeName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 py-2" data-testid="workflows-hub">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 tracking-tight">
          {isHi ? "अनुरोध एवं रिकॉर्ड्स" : "Requests & Records"}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          {isHi
            ? "आपके द्वारा शुरू किए गए सभी अनुरोधों और स्कूल सेवाओं की स्थिति एक स्थान पर ट्रैक करें।"
            : "One unified hub tracking all parent-initiated requests, applications, and decisions."}
        </p>
      </div>

      {/* ─── WORKFLOWS LIST SECTION ─── */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>{isHi ? "सक्रिय अनुरोध इतिहास" : "Request History"}</span>
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
              {filteredItems.length}
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isHi ? "अनुरोध खोजें..." : "Filter requests..."}
              className="text-xs pl-8 pr-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 w-full sm:w-48"
            />
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" data-testid="workflows-status-tabs">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 border",
              statusFilter === "ALL"
                ? "bg-indigo-600/30 text-indigo-200 border-indigo-500/50"
                : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200"
            )}
          >
            {isHi ? "सभी" : "All"} ({initialItems.length})
          </button>
          <button
            onClick={() => setStatusFilter("PENDING")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 border",
              statusFilter === "PENDING"
                ? "bg-amber-500/20 text-amber-200 border-amber-500/40"
                : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200"
            )}
          >
            {isHi ? "लंबित" : "Pending"} ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter("APPROVED")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 border",
              statusFilter === "APPROVED"
                ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200"
            )}
          >
            {isHi ? "स्वीकृत / पूर्ण" : "Approved"} ({approvedCount})
          </button>
          <button
            onClick={() => setStatusFilter("REJECTED")}
            className={cn(
              "text-xs px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 border",
              statusFilter === "REJECTED"
                ? "bg-rose-500/20 text-rose-200 border-rose-500/40"
                : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200"
            )}
          >
            {isHi ? "अस्वीकृत" : "Rejected"} ({rejectedCount})
          </button>
        </div>

        {/* Type & Ward Secondary Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
          {/* Ward filter if multi-ward */}
          {wards.length > 1 && (
            <div className="flex items-center gap-1 shrink-0 mr-2" data-testid="workflows-ward-filter">
              <span className="text-[10px] text-slate-500 font-medium mr-1">
                {isHi ? "बच्चा:" : "Ward:"}
              </span>
              <button
                onClick={() => setWardFilter("ALL")}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors border",
                  wardFilter === "ALL"
                    ? "bg-indigo-600/40 text-indigo-200 border-indigo-500/50"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                )}
              >
                All
              </button>
              {wards.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWardFilter(w.id)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors border",
                    wardFilter === w.id
                      ? "bg-indigo-600/40 text-indigo-200 border-indigo-500/50"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                  )}
                >
                  {w.name.split(" ")[0]}
                </button>
              ))}
            </div>
          )}

          {/* Type filter */}
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
            <span className="text-[10px] text-slate-500 font-medium mr-1">
              {isHi ? "प्रकार:" : "Type:"}
            </span>
            {(
              [
                ["ALL", "All"],
                ["leave", "Leave"],
                ["fee_query", "Fees"],
                ["stop_change", "Bus Stop"],
                ["document", "Documents"],
                ["profile", "Profile"],
                ["ptm", "PTM"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t as any)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors border",
                  typeFilter === t
                    ? "bg-slate-700 text-slate-100 border-slate-600"
                    : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Requests List */}
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs">
              {isHi
                ? "चयनित फिल्टर के लिए कोई अनुरोध नहीं मिला।"
                : "No workflow requests found matching your filter."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 overflow-hidden" data-testid="workflows-items-list">
            {filteredItems.map((item) => {
              const icon = TYPE_ICONS[item.type];
              const dateStr = new Date(item.createdAt).toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
              });

              const statusBadgeClass =
                item.statusCategory === "APPROVED"
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : item.statusCategory === "REJECTED"
                  ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                  : "bg-amber-500/10 text-amber-300 border-amber-500/30";

              return (
                <div
                  key={item.id}
                  data-workflow-id={item.id}
                  data-workflow-type={item.type}
                  className="p-3.5 sm:p-4 hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {icon}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {item.studentName.split(" ")[0]}
                        </span>
                        <h3 className="text-sm font-semibold text-slate-100 tracking-tight">
                          {item.title}
                        </h3>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                            statusBadgeClass
                          )}
                        >
                          {item.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2">
                        {item.description}
                      </p>

                      {item.note && (
                        <p className="text-[11px] text-slate-400 italic bg-slate-800/60 px-2 py-1 rounded border border-slate-700/50 mt-1">
                          Note: {item.note}
                        </p>
                      )}

                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span>{item.typeName}</span>
                        <span>•</span>
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  </div>

                  {item.actionHref && (
                    <div className="shrink-0 self-end sm:self-center">
                      <Link
                        href={item.actionHref}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        <span>{item.actionLabel || "View"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── QUICK SERVICES & ARCHIVAL DIRECTORY ─── */}
      <div className="space-y-6 pt-2">
        <div>
          <h2 className="text-sm font-bold text-slate-200 tracking-tight">
            {isHi ? "त्वरित सेवाएं एवं रिकॉर्ड्स" : "Quick Services & Archival Records"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isHi
              ? "शुल्क रसीदें, उपस्थिति लॉग, परिवहन कार्यक्रम और गोपनीयता पोर्टल।"
              : "Past term payments, bus transit details, academic records, and DPDP privacy."}
          </p>
        </div>

        <div className="space-y-6">
          {ARCHIVAL_SERVICES.map((group) => (
            <div key={group.category} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
                {group.category}
              </h3>

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
    </div>
  );
}
