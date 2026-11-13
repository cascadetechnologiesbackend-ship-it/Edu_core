"use client";

import React, { useState } from "react";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowLeft,
  CalendarCheck,
} from "lucide-react";
import Link from "next/link";

export default function TeacherLeavesPage() {
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [leaveType, setLeaveType] = useState("CASUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const balances = [
    { type: "Casual Leave (CL)", remaining: 8, total: 12, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
    { type: "Medical Leave (ML)", remaining: 10, total: 10, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
    { type: "Earned Leave (EL)", remaining: 14, total: 15, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  ];

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setShowApplyModal(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/teacher/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Podium
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Faculty Leave Applications
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your statutory leave balances, substitute allocations, and absence requests.
          </p>
        </div>

        <button
          data-tour="teacher-leave-apply-btn"
          onClick={() => setShowApplyModal(true)}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Apply for Leave
        </button>
      </div>

      {submitted && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Leave request submitted successfully. Principal and HR manager notified for substitution assignment.
        </div>
      )}

      {/* Leave Balances Grid */}
      <div
        data-tour="teacher-leave-balance"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {balances.map((b) => (
          <div
            key={b.type}
            className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-2"
          >
            <span className="text-xs font-semibold text-muted-foreground">
              {b.type}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-foreground">
                {b.remaining}
              </span>
              <span className="text-xs text-muted-foreground">
                / {b.total} days remaining
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${(b.remaining / b.total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Recent Leave Requests */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-primary" /> Recent Absence History
        </h3>
        <p className="text-xs text-muted-foreground">
          No unexcused absences recorded for the current academic session.
        </p>
      </div>

      {/* Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h2 className="text-base font-bold text-foreground">
              Submit Absence Application
            </h2>
            <form onSubmit={handleApply} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">
                  Leave Type
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground"
                >
                  <option value="CASUAL">Casual Leave (CL)</option>
                  <option value="MEDICAL">Medical Leave (ML)</option>
                  <option value="EARNED">Earned Leave (EL)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-semibold mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">
                  Reason for Absence
                </label>
                <textarea
                  required
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide brief details for substitute allocation..."
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

