"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  Copy,
  ChevronLeft,
  RefreshCw,
  ExternalLink,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import {
  enableStudentAccessAction,
  disableStudentAccessAction,
  resendStudentClaimAction,
  fetchStudentAccessQueueAction,
} from "./actions";
import type { StudentAccessQueueItem } from "@schoolmitra/backend/lib/studentAccess";

interface StudentAccessClientProps {
  initialItems: StudentAccessQueueItem[];
}

export function StudentAccessClient({ initialItems }: StudentAccessClientProps) {
  const [items, setItems] = useState<StudentAccessQueueItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNPROVISIONED" | "ACTIVE" | "DISABLED">("ALL");
  const [isPending, startTransition] = useTransition();
  const [activeClaimUrl, setActiveClaimUrl] = useState<string | null>(null);

  const refreshList = (newSearch?: string, newStatus?: typeof statusFilter) => {
    startTransition(async () => {
      const res = await fetchStudentAccessQueueAction({
        search: newSearch !== undefined ? newSearch : search,
        status: newStatus !== undefined ? newStatus : statusFilter,
      });
      if (res.success) {
        setItems(res.items);
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleEnable = async (studentId: string) => {
    startTransition(async () => {
      const res = await enableStudentAccessAction(studentId);
      if (res.success) {
        toast.success(res.message);
        if ("claimUrl" in res && res.claimUrl) {
          setActiveClaimUrl(res.claimUrl);
        }
        refreshList();
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleDisable = async (studentId: string) => {
    startTransition(async () => {
      const res = await disableStudentAccessAction(studentId);
      if (res.success) {
        toast.success(res.message);
        refreshList();
      } else {
        toast.error(res.message);
      }
    });
  };

  const handleResendClaim = async (studentId: string) => {
    startTransition(async () => {
      const res = await resendStudentClaimAction(studentId);
      if (res.success && "claimUrl" in res && res.claimUrl) {
        setActiveClaimUrl(res.claimUrl);
        toast.success("New claim link generated!");
      } else {
        toast.error(res.message);
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Claim URL copied to clipboard!");
  };

  const activeCount = items.filter((i) => i.accessStatus === "ACTIVE").length;
  const unprovisionedCount = items.filter((i) => i.accessStatus === "UNPROVISIONED").length;
  const disabledCount = items.filter((i) => i.accessStatus === "DISABLED").length;

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div>
        <Link
          href="/students"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Students Directory / छात्र सूची</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Student Access & Claim Queue</span>
              <span className="text-xs font-medium text-gray-400 font-sans">विद्यार्थी पोर्टल पहुँच</span>
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Authoritative student login provisioning with DPDP-compliant minor-safe DOB verification.
            </p>
          </div>
          <button
            onClick={() => refreshList()}
            disabled={isPending}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{activeCount}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Active Logins / सक्रिय</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{unprovisionedCount}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Unprovisioned / अपंजीकृत</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{disabledCount}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Disabled / निष्क्रिय</div>
          </div>
        </div>
      </div>

      {/* Claim URL Banner if Active */}
      {activeClaimUrl && (
        <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Student Account Claim Link Generated</span>
            </div>
            <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-mono mt-0.5 truncate">
              {activeClaimUrl}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              The student will verify their Admission Number + Date of Birth to set their initial password.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => copyToClipboard(activeClaimUrl)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1.5 shadow-xs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Link</span>
            </button>
            <button
              onClick={() => setActiveClaimUrl(null)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-200/50 dark:hover:bg-slate-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Controls Bar: Search & Status Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") refreshList(search);
            }}
            placeholder="Search student name or admission number..."
            className="w-full pl-9 pr-4 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["ALL", "UNPROVISIONED", "ACTIVE", "DISABLED"] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                refreshList(search, st);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
            >
              {st === "ALL" && "All / सभी"}
              {st === "UNPROVISIONED" && "Needs Provisioning"}
              {st === "ACTIVE" && "Active"}
              {st === "DISABLED" && "Disabled"}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/40 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Class & Section</th>
                <th className="py-3 px-4">Login Access Status</th>
                <th className="py-3 px-4">Enrolled On</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 font-medium">
                    No students matching filter.
                  </td>
                </tr>
              ) : (
                items.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900 dark:text-white">{student.studentName}</div>
                      <div className="text-[11px] font-mono text-gray-400">{student.admissionNumber}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      {student.className} • {student.sectionName}
                    </td>
                    <td className="py-3 px-4">
                      {student.accessStatus === "ACTIVE" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active / सक्रिय</span>
                        </span>
                      )}
                      {student.accessStatus === "UNPROVISIONED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Needs Provisioning</span>
                        </span>
                      )}
                      {student.accessStatus === "DISABLED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          <XCircle className="w-3 h-3" />
                          <span>Disabled / निष्क्रिय</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                      {new Date(student.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {student.accessStatus === "UNPROVISIONED" && (
                          <button
                            onClick={() => handleEnable(student.id)}
                            disabled={isPending}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs flex items-center gap-1"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Provision Login</span>
                          </button>
                        )}
                        {student.accessStatus === "ACTIVE" && (
                          <>
                            <button
                              onClick={() => handleResendClaim(student.id)}
                              disabled={isPending}
                              title="Generate new claim link"
                              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                            >
                              Claim Link
                            </button>
                            <button
                              onClick={() => handleDisable(student.id)}
                              disabled={isPending}
                              title="Disable portal access"
                              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                            >
                              Disable
                            </button>
                          </>
                        )}
                        {student.accessStatus === "DISABLED" && (
                          <button
                            onClick={() => handleEnable(student.id)}
                            disabled={isPending}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Re-enable</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
