"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  MessageSquare,
  Loader2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import {
  getTeacherPendingLeaveRequests,
  decideLeaveRequest,
  type TeacherPendingLeaveItem,
} from "./leaveActions";

export function TeacherLeaveQueue() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<TeacherPendingLeaveItem[]>([]);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const data = await getTeacherPendingLeaveRequests();
      setRequests(data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleDecision = async (
    requestId: string,
    decision: "APPROVED" | "REJECTED"
  ) => {
    setActionInProgress(requestId);
    try {
      const note = decisionNotes[requestId]?.trim() || undefined;
      const res = await decideLeaveRequest(requestId, decision, note);

      if (!res.success) {
        toast.error(res.error || "Failed to submit decision");
        return;
      }

      if (decision === "APPROVED") {
        toast.success("Leave approved. Attendance records updated to LEAVE.");
      } else {
        toast.success("Leave request rejected.");
      }

      // Remove from pending list
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred");
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              Leave Approval Queue
            </h2>
            <p className="text-[11px] text-slate-400">
              1-tap review for planned student absence requests
            </p>
          </div>
        </div>

        {requests.length > 0 && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {requests.length} Pending
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          <span>Loading leave requests...</span>
        </div>
      ) : requests.length === 0 ? (
        <div className="p-6 text-center rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400">
          <CalendarCheck className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
          No pending leave requests for your classroom.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isOver24h = req.hoursPending >= 24;
            const isBusy = actionInProgress === req.id;

            return (
              <div
                key={req.id}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">
                        {req.studentName}
                      </span>
                      {req.rollNumber && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          (Roll #{req.rollNumber})
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {req.className} - {req.sectionName}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                        {req.leaveType}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {req.startDate === req.endDate
                          ? req.startDate
                          : `${req.startDate} → ${req.endDate}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        Applied {req.hoursPending}h ago
                      </span>
                    </div>
                  </div>

                  {isOver24h && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                      <AlertTriangle className="w-3 h-3" />
                      &gt;24h SLA Reminder
                    </span>
                  )}
                </div>

                {/* Reason */}
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-xs text-slate-300">
                  <span className="font-semibold text-slate-400">Reason: </span>
                  &ldquo;{req.reason}&rdquo;
                </div>

                {/* Optional Teacher Note input */}
                <div>
                  <input
                    type="text"
                    placeholder="Optional note / feedback for parent..."
                    value={decisionNotes[req.id] || ""}
                    onChange={(e) =>
                      setDecisionNotes({
                        ...decisionNotes,
                        [req.id]: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>

                {/* 1-tap Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDecision(req.id, "REJECTED")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {isBusy ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    <span>Reject</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDecision(req.id, "APPROVED")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                  >
                    {isBusy ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
