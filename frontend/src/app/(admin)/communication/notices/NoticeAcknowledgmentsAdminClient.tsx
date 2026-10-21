"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  Search,
  Users,
  ShieldCheck,
  ChevronLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  type NoticeAcknowledgmentReport,
  type NoticeParentRecipient,
} from "@/lib/noticeAcknowledgmentEngine";
import { bulkRemindUnacknowledgedParents } from "./actions";

interface NoticeAcknowledgmentsAdminClientProps {
  report: NoticeAcknowledgmentReport;
}

export function NoticeAcknowledgmentsAdminClient({
  report: initialReport,
}: NoticeAcknowledgmentsAdminClientProps) {
  const [report, setReport] = useState<NoticeAcknowledgmentReport>(initialReport);
  const [activeTab, setActiveTab] = useState<"UNACKNOWLEDGED" | "ACKNOWLEDGED">("UNACKNOWLEDGED");
  const [search, setSearch] = useState("");
  const [isReminding, setIsReminding] = useState(false);

  const displayedList =
    activeTab === "UNACKNOWLEDGED"
      ? report.unacknowledgedList
      : report.acknowledgedList;

  const filteredList = displayedList.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.parentEmail?.toLowerCase().includes(q) ||
      item.parentUserId.toLowerCase().includes(q) ||
      item.studentId.toLowerCase().includes(q)
    );
  });

  const handleBulkRemind = async () => {
    if (isReminding || report.unacknowledgedList.length === 0) return;
    setIsReminding(true);

    try {
      const res = await bulkRemindUnacknowledgedParents(report.noticeId);
      if (res.success) {
        let msg = `Sent ${res.remindedCount} reminders.`;
        if (res.queuedForMorningCount > 0) {
          msg += ` ${res.queuedForMorningCount} queued for 07:00 morning quiet hours.`;
        }
        if (res.skippedDailyCapCount > 0) {
          msg += ` ${res.skippedDailyCapCount} skipped (daily 3-push cap reached).`;
        }
        toast.success(msg);
      } else {
        toast.error(res.error || "Failed to dispatch reminders.");
      }
    } catch (err: any) {
      console.error("[handleBulkRemind] Error:", err);
      toast.error("Technical error while dispatching reminders.");
    } finally {
      setIsReminding(false);
    }
  };

  const pubDateFormatted = new Date(report.publishedAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" data-testid="notice-ack-admin-view">
      {/* Back button & Title Header */}
      <div>
        <Link
          href="/admin/communication/notices"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Notices</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                CIRCULAR COMPLIANCE
              </span>
              <span className="text-xs text-slate-400">Published {pubDateFormatted}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {report.title}
            </h1>
          </div>

          {/* 1-Tap Bulk Reminder Action (surface_p8, AC-P20) */}
          {report.unacknowledgedList.length > 0 && (
            <button
              onClick={handleBulkRemind}
              disabled={isReminding}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50"
              data-testid="bulk-remind-btn"
            >
              {isReminding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Evaluating Push Caps...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Remind Unacknowledged ({report.unacknowledgedList.length})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1: Percentage */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Acknowledgment Rate
            </span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100"
              data-testid="acknowledgment-percentage"
            >
              {report.percentage}%
            </span>
            <span className="text-xs text-slate-500">
              ({report.acknowledgedCount} / {report.totalTargeted} parents)
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                report.percentage >= 80
                  ? "bg-emerald-500"
                  : report.percentage >= 50
                  ? "bg-amber-500"
                  : "bg-blue-600"
              }`}
              style={{ width: `${report.percentage}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Acknowledged Households */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Acknowledged
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {report.acknowledgedCount}
            </span>
            <span className="text-xs text-slate-500">households confirmed</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Single confirmation per household (OP7)</p>
        </div>

        {/* Metric 3: Pending Households */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Pending Action
            </span>
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-amber-600 dark:text-amber-400">
              {report.unacknowledgedList.length}
            </span>
            <span className="text-xs text-slate-500">awaiting confirmation</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">T1 push reminders sent at 24h & 48h</p>
        </div>
      </div>

      {/* Drill-down Section with Tabs and Search */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Tab & Search Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("UNACKNOWLEDGED")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "UNACKNOWLEDGED"
                  ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              data-testid="tab-unacknowledged"
            >
              Pending ({report.unacknowledgedList.length})
            </button>
            <button
              onClick={() => setActiveTab("ACKNOWLEDGED")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "ACKNOWLEDGED"
                  ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              data-testid="tab-acknowledged"
            >
              Confirmed ({report.acknowledgedCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search parent email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Drill-down Table */}
        <div className="overflow-x-auto">
          {filteredList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No parent records match your criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Parent User</th>
                  <th className="px-4 py-3">Student Ward ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Details / Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredList.map((item) => (
                  <tr key={item.parentUserId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {item.parentEmail}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {item.studentId.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">
                      {item.acknowledged ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Acknowledged</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                          <Clock className="w-3 h-3" />
                          <span>Pending ({item.hoursSinceNotice || 0}h)</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.acknowledged && item.acknowledgedAt ? (
                        <span>
                          {new Date(item.acknowledgedAt).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          via {item.source || "FEED"}
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Awaiting confirmation
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
