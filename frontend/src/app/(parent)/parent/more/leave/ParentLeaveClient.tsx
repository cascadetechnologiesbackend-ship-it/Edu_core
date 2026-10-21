"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Plus,
  Send,
  Loader2,
  FileText,
  User,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { applyStudentLeave, cancelStudentLeave } from "../../actions/leaveActions";

interface Ward {
  id: string;
  name: string;
}

interface LeaveRequestItem {
  id: string;
  studentId: string;
  leaveType: "CASUAL" | "SICK" | "EMERGENCY" | "OTHER";
  startDate: string;
  endDate: string;
  reason: string;
  attachmentS3Key: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED_BY_PARENT";
  decisionNote: string | null;
  decidedAt: Date | string | null;
  createdAt: Date | string;
}

interface ParentLeaveClientProps {
  wards: Ward[];
  selectedStudentId: string;
  initialRequests: LeaveRequestItem[];
}

export function ParentLeaveClient({
  wards,
  selectedStudentId,
  initialRequests,
}: ParentLeaveClientProps) {
  const router = useRouter();
  const [currentStudentId, setCurrentStudentId] = useState(selectedStudentId);
  const [requests, setRequests] = useState<LeaveRequestItem[]>(initialRequests);
  const [isPending, startTransition] = useTransition();
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Form state (4-click budget flow)
  const [leaveType, setLeaveType] = useState<"CASUAL" | "SICK" | "EMERGENCY" | "OTHER">("CASUAL");
  const todayStr = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedWard = wards.find((w) => w.id === currentStudentId) || wards[0];

  const handleStudentChange = (studentId: string) => {
    setCurrentStudentId(studentId);
    router.push(`/parent/more/leave?studentId=${studentId}`);
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please enter a reason for the leave.");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Please specify both start date and end date.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("End date cannot be earlier than start date.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await applyStudentLeave(currentStudentId, {
        leaveType,
        startDate,
        endDate,
        reason: reason.trim(),
      });

      if (!res.success) {
        toast.error(res.error || "Failed to submit leave request.");
        return;
      }

      toast.success("Leave request submitted to the class teacher.");
      setShowApplyModal(false);
      setReason("");

      // Refresh data
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async (requestId: string) => {
    if (!confirm("Are you sure you want to cancel this pending leave request?")) {
      return;
    }

    try {
      const res = await cancelStudentLeave(requestId);
      if (!res.success) {
        toast.error(res.error || "Failed to cancel request.");
        return;
      }

      toast.success("Leave request cancelled.");
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: "CANCELLED_BY_PARENT" } : r
        )
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel request.");
    }
  };

  const getStatusBadge = (status: LeaveRequestItem["status"]) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case "CANCELLED_BY_PARENT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3 h-3" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Student Leave Requests
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Apply for planned leaves. Approved leaves automatically suppress absence alerts.
          </p>
        </div>

        <button
          onClick={() => setShowApplyModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all focus:ring-2 focus:ring-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* Ward Switcher if multiple wards */}
      {wards.length > 1 && (
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-2">
            Child:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {wards.map((w) => (
              <button
                key={w.id}
                onClick={() => handleStudentChange(w.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  w.id === currentStudentId
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {w.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal / Application Form */}
      {showApplyModal && (
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              New Leave Request for {selectedWard?.name}
            </h2>
            <button
              onClick={() => setShowApplyModal(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
            {/* 1. Leave Type */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Leave Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["CASUAL", "SICK", "EMERGENCY", "OTHER"] as const).map((type) => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setLeaveType(type)}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                      leaveType === type
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  min={todayStr}
                  value={startDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartDate(val);
                    if (val && endDate && new Date(val) > new Date(endDate)) {
                      setEndDate(val);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  min={startDate || todayStr}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>
            </div>

            {/* 3. Reason */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Leave
              </label>
              <textarea
                rows={3}
                placeholder="Please state the reason (e.g. Family wedding, high fever, doctor appointment)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>

            {/* 4. Submit */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApplyModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Leave Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History of Requests */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
          Request History
        </h2>

        {requests.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No leave requests on record
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              When you apply for planned leave, your request and class teacher approval status will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {req.startDate === req.endDate
                            ? req.startDate
                            : `${req.startDate} → ${req.endDate}`}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                          {req.leaveType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Applied on {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div>{getStatusBadge(req.status)}</div>
                </div>

                {/* Reason */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    Reason:{" "}
                  </span>
                  {req.reason}
                </div>

                {/* Teacher decision note */}
                {req.decisionNote && (
                  <div
                    className={`p-3 rounded-xl text-xs ${
                      req.status === "APPROVED"
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40"
                        : "bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40"
                    }`}
                  >
                    <span className="font-bold">Teacher Note: </span>
                    {req.decisionNote}
                  </div>
                )}

                {/* Actions */}
                {req.status === "PENDING" && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleCancelLeave(req.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Cancel Request</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
