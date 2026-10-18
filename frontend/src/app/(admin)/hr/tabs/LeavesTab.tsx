"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  PlusCircle,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  User,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppModal } from "@/components/ui/AppModal";
import { Combobox, type ComboboxOption } from "@/components/forms/Combobox";
import { getAvatarColor, getInitials } from "@/lib/utils";
import { createLeaveRequest, approveLeaveRequest } from "../actions";

interface LeavesTabProps {
  leaveRequests: any[];
  leaveTypes: any[];
  staffList: any[];
  isAuthorizedHR: boolean;
  onRefresh?: () => void;
}

export function LeavesTab({
  leaveRequests,
  leaveTypes,
  staffList,
  isAuthorizedHR,
  onRefresh,
}: LeavesTabProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; staffName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Leave Application Form State
  const [leaveForm, setLeaveForm] = useState({
    staffId: "",
    leaveTypeId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    totalDays: 1,
    reason: "",
  });

  // Staff options for Combobox
  const staffOptions: ComboboxOption[] = useMemo(() => {
    return staffList.map((s) => ({
      value: s.id,
      label: `${s.firstName} ${s.lastName}`,
      subLabel: `${s.employeeCode || "No Code"} • ${s.designation?.name || "Staff"}`,
      searchTerms: [s.employeeCode || "", s.department?.name || ""],
    }));
  }, [staffList]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((r) => {
      // Status filter
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;

      // Type filter
      if (typeFilter !== "ALL" && r.leaveTypeId !== typeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const staffName = `${r.staff?.firstName || ""} ${r.staff?.lastName || ""}`.toLowerCase();
        const empCode = (r.staff?.employeeCode || "").toLowerCase();
        const reason = (r.reason || "").toLowerCase();
        const typeName = (r.leaveType?.name || "").toLowerCase();

        return staffName.includes(q) || empCode.includes(q) || reason.includes(q) || typeName.includes(q);
      }

      return true;
    });
  }, [leaveRequests, statusFilter, typeFilter, searchQuery]);

  // Counts for status pills
  const counts = useMemo(() => {
    return {
      all: leaveRequests.length,
      pending: leaveRequests.filter((r) => r.status === "PENDING").length,
      approved: leaveRequests.filter((r) => r.status === "APPROVED").length,
      rejected: leaveRequests.filter((r) => r.status === "REJECTED").length,
    };
  }, [leaveRequests]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.staffId || !leaveForm.leaveTypeId) {
      toast.error("Please select both staff member and leave category");
      return;
    }
    setLoading(true);
    const res = await createLeaveRequest(leaveForm);
    setLoading(false);
    if (res.success) {
      toast.success("Leave application submitted successfully!");
      setIsApplyModalOpen(false);
      setLeaveForm({
        staffId: "",
        leaveTypeId: "",
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        totalDays: 1,
        reason: "",
      });
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to submit leave application");
    }
  };

  const handleApprove = async (requestId: string) => {
    setLoading(true);
    const res = await approveLeaveRequest(requestId, "HR", true);
    setLoading(false);
    if (res.success) {
      toast.success("Leave application approved!");
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to approve leave request");
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    setLoading(true);
    const res = await approveLeaveRequest(rejectTarget.id, "HR", false, rejectReason);
    setLoading(false);
    if (res.success) {
      toast.success("Leave application rejected.");
      setRejectTarget(null);
      setRejectReason("");
      router.refresh();
      onRefresh?.();
    } else {
      toast.error(res.message || "Failed to reject leave request");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Leave Management & Approvals
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track absence requests, manage approval workflows, and audit faculty leaves
          </p>
        </div>

        {isAuthorizedHR && (
          <button
            type="button"
            onClick={() => setIsApplyModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors min-h-[40px] shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Apply for Leave</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              statusFilter === "ALL"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <span>All</span>
            <span className="text-[10px] opacity-75 font-mono">{counts.all}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              statusFilter === "PENDING"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
            <span className="text-[10px] font-mono font-bold">{counts.pending}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("APPROVED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              statusFilter === "APPROVED"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved</span>
            <span className="text-[10px] font-mono">{counts.approved}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("REJECTED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              statusFilter === "REJECTED"
                ? "bg-rose-600 text-white"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Rejected</span>
            <span className="text-[10px] font-mono">{counts.rejected}</span>
          </button>
        </div>

        {/* Search & Type filter */}
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">All Leave Types</option>
            {leaveTypes.map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.name}
              </option>
            ))}
          </select>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leaves..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <CalendarDays className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {searchQuery || statusFilter !== "ALL" || typeFilter !== "ALL"
              ? "No leave applications match your filters"
              : "No leave applications submitted yet"}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Faculty and staff leave applications will appear here for review and principal approvals.
          </p>
          {isAuthorizedHR && statusFilter === "ALL" && !searchQuery && (
            <button
              type="button"
              onClick={() => setIsApplyModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Apply for Leave
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
          {filteredRequests.map((r) => {
            const fullName = `${r.staff?.firstName || ""} ${r.staff?.lastName || ""}`.trim() || "Staff Member";
            const initials = getInitials(fullName);
            const avatarBg = getAvatarColor(fullName);

            return (
              <div
                key={r.id}
                className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition-colors"
              >
                {/* Staff & Leave details */}
                <div className="flex items-start gap-3.5">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                    style={{ backgroundColor: avatarBg }}
                  >
                    {initials}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {fullName}
                      </span>
                      {r.staff?.employeeCode && (
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {r.staff.employeeCode}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                        {r.leaveType?.name || "General Leave"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          r.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : r.status === "REJECTED"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {r.startDate} to {r.endDate}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {r.totalDays} day{r.totalDays > 1 ? "s" : ""}
                      </span>
                      {r.reason && (
                        <>
                          <span>•</span>
                          <span className="italic text-slate-600 dark:text-slate-400">
                            &ldquo;{r.reason}&rdquo;
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {r.status === "PENDING" && isAuthorizedHR && (
                    <>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleApprove(r.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors min-h-[36px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setRejectTarget({ id: r.id, staffName: fullName });
                          setRejectReason("");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors min-h-[36px]"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Apply for Leave */}
      <AppModal
        open={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Apply for Leave"
      >
        <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
          {/* Staff Combobox */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Staff Member *
            </label>
            <Combobox
              options={staffOptions}
              value={leaveForm.staffId}
              onChange={(val) => setLeaveForm({ ...leaveForm, staffId: val })}
              placeholder="Search faculty / staff by name or code..."
              searchPlaceholder="Type name or employee code..."
              disabled={loading}
              isHindi={false}
              className="w-full"
            />
          </div>

          {/* Leave Type */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Leave Category *
            </label>
            <select
              required
              value={leaveForm.leaveTypeId}
              onChange={(e) =>
                setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value })
              }
              className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">-- Choose Leave Category --</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} (Code: {lt.code})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={leaveForm.startDate}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, startDate: e.target.value })
                }
                className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                End Date *
              </label>
              <input
                type="date"
                required
                value={leaveForm.endDate}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, endDate: e.target.value })
                }
                className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Total Days */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Total Days Count *
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              required
              value={leaveForm.totalDays}
              onChange={(e) =>
                setLeaveForm({ ...leaveForm, totalDays: Number(e.target.value) })
              }
              className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Reason / Justification *
            </label>
            <textarea
              rows={3}
              required
              placeholder="State clear purpose for leave (medical, personal, family event, etc.)..."
              value={leaveForm.reason}
              onChange={(e) =>
                setLeaveForm({ ...leaveForm, reason: e.target.value })
              }
              className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsApplyModalOpen(false)}
              className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors min-h-[38px] disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        </form>
      </AppModal>

      {/* Modal: Reject Reason Dialog */}
      <AppModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Reject Leave Application"
      >
        <form onSubmit={handleReject} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-900/40 text-rose-850 dark:text-rose-200">
            <p className="font-semibold">
              Rejecting application for {rejectTarget?.staffName}
            </p>
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
              Please state an objective reason for rejection so the faculty member is clearly informed.
            </p>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Rejection Reason *
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Prior examination invigilation duties scheduled on requested dates..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setRejectTarget(null)}
              className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !rejectReason.trim()}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-colors min-h-[38px] disabled:opacity-50"
            >
              {loading ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        </form>
      </AppModal>
    </div>
  );
}
