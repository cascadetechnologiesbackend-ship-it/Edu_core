"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Award,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  IndianRupee,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import type { PrincipalConsoleMetrics } from "@/lib/roleConsoleEngine";
import {
  approvePendingMarksAction,
  decideStaffLeaveAction,
  decideStudentLeaveAction,
  returnPendingMarksAction,
} from "./actions";

type ApprovalQueueData = NonNullable<PrincipalConsoleMetrics["approvalQueue"]>;
type OversightData = NonNullable<PrincipalConsoleMetrics["oversight"]>;

interface PrincipalDashboardClientProps {
  initialApprovalQueue: ApprovalQueueData;
  initialOversight: OversightData;
}

const formatInr = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatShortDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

export function PrincipalDashboardClient({
  initialApprovalQueue,
  initialOversight,
}: PrincipalDashboardClientProps) {
  const [isPending, startTransition] = useTransition();
  const [marksQueue, setMarksQueue] = useState(initialApprovalQueue.pendingMarksApprovals);
  const [staffLeaves, setStaffLeaves] = useState(initialApprovalQueue.pendingStaffLeaves);
  const [studentLeaves, setStudentLeaves] = useState(initialApprovalQueue.pendingStudentLeaves);

  const [returningMarkId, setReturningMarkId] = useState<string | null>(null);
  const [markReturnReason, setMarkReturnReason] = useState("");
  const [rejectingLeaveKey, setRejectingLeaveKey] = useState<string | null>(null);
  const [leaveRejectReason, setLeaveRejectReason] = useState("");
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const totalQueueCount =
    marksQueue.length +
    staffLeaves.length +
    studentLeaves.length +
    initialApprovalQueue.pendingFeeConcessionsCount +
    initialApprovalQueue.pendingFeeRefundsCount;

  const handleApproveMark = (item: ApprovalQueueData["pendingMarksApprovals"][number]) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await approvePendingMarksAction({
        examId: item.examId,
        classId: item.classId,
        subjectId: item.subjectId,
      });
      if (res.success) {
        setMarksQueue((prev) => prev.filter((x) => x.id !== item.id));
        setFeedback({
          type: "ok",
          text: `Approved & locked ${item.className} · ${item.subjectName} (${item.examName}).`,
        });
      } else {
        setFeedback({ type: "err", text: (res as any).message || (res as any).error || "Approval failed." });
      }
    });
  };

  const handleReturnMark = (item: ApprovalQueueData["pendingMarksApprovals"][number]) => {
    const trimmed = markReturnReason.trim();
    if (!trimmed) {
      setFeedback({ type: "err", text: "Please enter a clear reason before returning marks for revision." });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const res = await returnPendingMarksAction({
        examId: item.examId,
        classId: item.classId,
        subjectId: item.subjectId,
        reason: trimmed,
      });
      if (res.success) {
        setMarksQueue((prev) => prev.filter((x) => x.id !== item.id));
        setReturningMarkId(null);
        setMarkReturnReason("");
        setFeedback({
          type: "ok",
          text: `Returned ${item.className} · ${item.subjectName} for revision.`,
        });
      } else {
        setFeedback({ type: "err", text: (res as any).message || (res as any).error || "Return failed." });
      }
    });
  };

  const handleStaffLeaveDecision = (
    leaveId: string,
    decision: "APPROVE" | "REJECT",
    reason?: string
  ) => {
    if (decision === "REJECT" && !reason?.trim()) {
      setFeedback({ type: "err", text: "A rejection reason is required." });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const res = await decideStaffLeaveAction({
        leaveRequestId: leaveId,
        decision,
        ...(reason !== undefined ? { reason } : {}),
      });
      if (res.success) {
        setStaffLeaves((prev) => prev.filter((x) => x.id !== leaveId));
        setRejectingLeaveKey(null);
        setLeaveRejectReason("");
        setFeedback({
          type: "ok",
          text: decision === "APPROVE" ? "Staff leave approved." : "Staff leave rejected.",
        });
      } else {
        setFeedback({ type: "err", text: res.error || "Leave decision failed." });
      }
    });
  };

  const handleStudentLeaveDecision = (
    leaveId: string,
    decision: "APPROVE" | "REJECT",
    note?: string
  ) => {
    if (decision === "REJECT" && !note?.trim()) {
      setFeedback({ type: "err", text: "A rejection note is required." });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const res = await decideStudentLeaveAction({
        leaveRequestId: leaveId,
        decision,
        ...(note !== undefined ? { note } : {}),
      });
      if (res.success) {
        setStudentLeaves((prev) => prev.filter((x) => x.id !== leaveId));
        setRejectingLeaveKey(null);
        setLeaveRejectReason("");
        setFeedback({
          type: "ok",
          text: decision === "APPROVE" ? "Student leave approved." : "Student leave rejected.",
        });
      } else {
        setFeedback({ type: "err", text: res.error || "Student leave decision failed." });
      }
    });
  };

  const {
    examProgress,
    attendanceExceptions,
    teacherCoverageToday,
    financeOverview,
  } = initialOversight;

  return (
    <div className="space-y-6">
      {/* Inline Approval Queue */}
      <section
        data-testid="principal-approval-queue"
        className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-level-1 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-semantic-attention/15 text-semantic-attention-foreground">
                <Clock className="w-3.5 h-3.5" /> Inline Approval Queue
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {totalQueueCount} pending items
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground tracking-tight mt-1">
              Academic Marks, Leaves &amp; Financial Sign-offs
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/school/fees"
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted font-medium text-foreground transition"
            >
              Concessions Pending: {initialApprovalQueue.pendingFeeConcessionsCount}
            </Link>
            <Link
              href="/school/due-fees"
              className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted font-medium text-foreground transition"
            >
              Refunds Pending: {initialApprovalQueue.pendingFeeRefundsCount} (
              {formatInr(initialApprovalQueue.pendingFeeRefundsAmount)})
            </Link>
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-xl px-4 py-2.5 text-xs font-medium border ${
              feedback.type === "ok"
                ? "bg-semantic-money-in/10 border-semantic-money-in/30 text-semantic-money-in-foreground"
                : "bg-semantic-money-owed/10 border-semantic-money-owed/30 text-semantic-money-owed-foreground"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {marksQueue.length === 0 && staffLeaves.length === 0 && studentLeaves.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
            <CheckCircle2 className="w-6 h-6 text-semantic-money-in mx-auto mb-1.5" />
            <p className="text-sm font-medium text-foreground">All marks and leave queues are clear</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Submitted exam mark sheets and pending leave applications will appear here for one-click action.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Exam Marks Approvals */}
            <div className="rounded-xl border border-border/70 bg-background/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-semantic-exam" /> Submitted Exam Marks ({marksQueue.length})
                </h3>
                <Link
                  href="/exams"
                  className="text-xs font-medium text-semantic-interactive hover:underline"
                >
                  Open Exam Console
                </Link>
              </div>
              {marksQueue.length === 0 ? (
                <p className="text-xs text-muted-foreground">No submitted mark sheets awaiting lock.</p>
              ) : (
                <div className="space-y-2.5">
                  {marksQueue.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-card p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {item.className} · {item.subjectName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.examName} · Submitted by {item.submittedByName}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleApproveMark(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-semantic-interactive text-semantic-interactive-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => {
                              setReturningMarkId(returningMarkId === item.id ? null : item.id);
                              setMarkReturnReason("");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:bg-muted disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Return
                          </button>
                        </div>
                      </div>
                      {returningMarkId === item.id && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={markReturnReason}
                            onChange={(e) => setMarkReturnReason(e.target.value)}
                            placeholder="Reason for returning marks for revision..."
                            className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive"
                          />
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleReturnMark(item)}
                            className="px-3 py-1.5 rounded-lg bg-semantic-attention text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                          >
                            Send Back
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Staff & Student Leave Approvals */}
            <div className="rounded-xl border border-border/70 bg-background/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-semantic-interactive" /> Leave Requests (
                  {staffLeaves.length + studentLeaves.length})
                </h3>
                <Link
                  href="/hr"
                  className="text-xs font-medium text-semantic-interactive hover:underline"
                >
                  Staff HR
                </Link>
              </div>
              {staffLeaves.length === 0 && studentLeaves.length === 0 ? (
                <p className="text-xs text-muted-foreground">No pending leave approvals.</p>
              ) : (
                <div className="space-y-2.5">
                  {staffLeaves.map((lr) => {
                    const key = `staff:${lr.id}`;
                    return (
                      <div key={key} className="rounded-lg border border-border bg-card p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              {lr.staffName}{" "}
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                Staff · {lr.leaveTypeName}
                              </span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatShortDate(lr.startDate)} – {formatShortDate(lr.endDate)} ({lr.totalDays}d) ·{" "}
                              {lr.reason}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleStaffLeaveDecision(lr.id, "APPROVE")}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-semantic-money-in text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => {
                                setRejectingLeaveKey(rejectingLeaveKey === key ? null : key);
                                setLeaveRejectReason("");
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-semantic-money-owed-foreground text-xs font-medium hover:bg-muted disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        </div>
                        {rejectingLeaveKey === key && (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={leaveRejectReason}
                              onChange={(e) => setLeaveRejectReason(e.target.value)}
                              placeholder="Reason for rejecting staff leave..."
                              className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
                            />
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                handleStaffLeaveDecision(lr.id, "REJECT", leaveRejectReason)
                              }
                              className="px-3 py-1.5 rounded-lg bg-semantic-money-owed text-white text-xs font-semibold"
                            >
                              Confirm
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {studentLeaves.map((sl) => {
                    const key = `student:${sl.id}`;
                    return (
                      <div key={key} className="rounded-lg border border-border bg-card p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              {sl.studentName}{" "}
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                Student · {sl.leaveType}
                              </span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {sl.admissionNumber ? `#${sl.admissionNumber} · ` : ""}
                              {formatShortDate(sl.startDate)} – {formatShortDate(sl.endDate)} · {sl.reason}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleStudentLeaveDecision(sl.id, "APPROVE")}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-semantic-money-in text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => {
                                setRejectingLeaveKey(rejectingLeaveKey === key ? null : key);
                                setLeaveRejectReason("");
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-semantic-money-owed-foreground text-xs font-medium hover:bg-muted disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        </div>
                        {rejectingLeaveKey === key && (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={leaveRejectReason}
                              onChange={(e) => setLeaveRejectReason(e.target.value)}
                              placeholder="Reason for rejecting student leave..."
                              className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
                            />
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                handleStudentLeaveDecision(sl.id, "REJECT", leaveRejectReason)
                              }
                              className="px-3 py-1.5 rounded-lg bg-semantic-money-owed text-white text-xs font-semibold"
                            >
                              Confirm
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Oversight Panels */}
      <section
        data-testid="principal-oversight-panels"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6"
      >
        {/* Exam Progress */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-level-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Award className="w-4 h-4 text-semantic-exam" /> Exam Progress &amp; Lock Status
            </h3>
            <Link href="/exams/reports" className="text-xs font-medium text-semantic-interactive hover:underline">
              Result Reports
            </Link>
          </div>
          {examProgress.length === 0 ? (
            <p className="text-xs text-muted-foreground">No examinations scheduled yet.</p>
          ) : (
            <div className="space-y-2">
              {examProgress.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-semibold text-foreground">{ex.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatShortDate(ex.startDate)} – {formatShortDate(ex.endDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-foreground">
                      {ex.lockedCount} locked / {ex.submittedCount} pending
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      {ex.totalTrackedCount} subject sheets
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance Exceptions Today */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-level-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-semantic-attention" /> Attendance Exceptions Today
            </h3>
            <Link href="/attendance" className="text-xs font-medium text-semantic-interactive hover:underline">
              Attendance Register
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-muted-foreground">Unmarked Sections</p>
              <p className="text-xl font-bold text-foreground mt-0.5">
                {attendanceExceptions.unmarkedSectionsCount}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-muted-foreground">Below 75% Today</p>
              <p className="text-xl font-bold text-semantic-attention-foreground mt-0.5">
                {attendanceExceptions.lowAttendanceSections.length}
              </p>
            </div>
          </div>
          {attendanceExceptions.unmarkedSectionNames.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Pending roll call:{" "}
              <span className="font-medium text-foreground">
                {attendanceExceptions.unmarkedSectionNames.join(", ")}
              </span>
            </p>
          )}
          {attendanceExceptions.lowAttendanceSections.length > 0 && (
            <div className="space-y-1">
              {attendanceExceptions.lowAttendanceSections.map((sec) => (
                <div key={sec.sectionId} className="flex items-center justify-between text-xs">
                  <span className="text-foreground font-medium">{sec.sectionLabel}</span>
                  <span className="text-semantic-money-owed-foreground font-semibold">
                    {sec.ratePercent.toFixed(1)}% ({sec.presentCount}/{sec.totalMarked})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Teacher Absence & Substitution Coverage */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-level-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <UserX className="w-4 h-4 text-semantic-interactive" /> Teacher Absence &amp; Substitutions
            </h3>
            <Link
              href="/academics/mapping"
              className="text-xs font-medium text-semantic-interactive hover:underline"
            >
              Assign Coverage
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-muted-foreground">On Approved Leave</p>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {teacherCoverageToday.onLeaveCount}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-muted-foreground">Uncovered Periods</p>
              <p className="text-lg font-bold text-semantic-attention-foreground mt-0.5">
                {teacherCoverageToday.pendingSubstitutionsCount}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-muted-foreground">Covered Periods</p>
              <p className="text-lg font-bold text-semantic-money-in-foreground mt-0.5">
                {teacherCoverageToday.coveredSubstitutionsCount}
              </p>
            </div>
          </div>
          {teacherCoverageToday.staffOnLeaveNames.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Staff on leave today:{" "}
              <span className="font-medium text-foreground">
                {teacherCoverageToday.staffOnLeaveNames.join(", ")}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No staff on approved leave today.</p>
          )}
        </div>

        {/* Finance Overview & Dues Aging */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-level-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-semantic-money-in" /> Finance Overview &amp; Dues Aging
            </h3>
            <Link
              href="/school/due-fees"
              className="text-xs font-medium text-semantic-interactive hover:underline"
            >
              Due Fees Ledger
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-muted-foreground">Collected Today</p>
              <p className="text-base font-bold text-semantic-money-in-foreground mt-0.5">
                {formatInr(financeOverview.collectedToday)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-muted-foreground">Last 30 Days</p>
              <p className="text-base font-bold text-foreground mt-0.5">
                {formatInr(financeOverview.collectedLast30Days)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-muted-foreground">Total Outstanding</p>
              <p className="text-base font-bold text-semantic-money-owed-foreground mt-0.5">
                {formatInr(financeOverview.totalOutstanding)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-[11px]">
            <div className="rounded-lg bg-muted/40 px-2.5 py-2">
              <span className="text-muted-foreground block">0–30d</span>
              <span className="font-semibold text-foreground">
                {formatInr(financeOverview.agingBuckets.days0to30)}
              </span>
            </div>
            <div className="rounded-lg bg-muted/40 px-2.5 py-2">
              <span className="text-muted-foreground block">31–60d</span>
              <span className="font-semibold text-foreground">
                {formatInr(financeOverview.agingBuckets.days31to60)}
              </span>
            </div>
            <div className="rounded-lg bg-muted/40 px-2.5 py-2">
              <span className="text-muted-foreground block">61–90d</span>
              <span className="font-semibold text-semantic-attention-foreground">
                {formatInr(financeOverview.agingBuckets.days61to90)}
              </span>
            </div>
            <div className="rounded-lg bg-muted/40 px-2.5 py-2">
              <span className="text-muted-foreground block">90d+</span>
              <span className="font-semibold text-semantic-money-owed-foreground">
                {formatInr(financeOverview.agingBuckets.days90Plus)}
              </span>
            </div>
          </div>
          <div className="pt-1 flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground font-medium">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Exports &amp; Registers:
            </span>
            <Link href="/exams/reports" className="text-semantic-interactive hover:underline">
              Marksheets &amp; Results
            </Link>
            <Link href="/attendance" className="text-semantic-interactive hover:underline">
              Daily Attendance
            </Link>
            <Link href="/school/due-fees" className="text-semantic-interactive hover:underline">
              Dues Aging
            </Link>
            <Link href="/academics/mapping" className="text-semantic-interactive hover:underline">
              Workload &amp; Coverage
            </Link>
          </div>
        </div>

        {/* Syllabus Pacing & Grading SLA */}
        <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-level-1 space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-semantic-interactive" /> Syllabus Pacing &amp; Grading SLA
            </h3>
            <Link
              href="/academics/curriculum"
              className="text-xs font-medium text-semantic-interactive hover:underline"
            >
              Curriculum Overview
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-muted-foreground">Syllabus Completion</p>
              <p className="text-lg font-bold text-semantic-money-in-foreground mt-0.5">
                {initialOversight.syllabusPacing?.completionPercent ?? 0}%
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {initialOversight.syllabusPacing?.completedTopics ?? 0} of{" "}
                {initialOversight.syllabusPacing?.totalTopics ?? 0} topics
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-muted-foreground">Topics In Progress</p>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {initialOversight.syllabusPacing?.inProgressTopics ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Active lesson plans</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-muted-foreground">Grading SLA (&gt;7 Days)</p>
              <p
                className={`text-lg font-bold mt-0.5 ${
                  (initialOversight.gradingSla?.overdueUngradedCount ?? 0) > 0
                    ? "text-semantic-attention-foreground"
                    : "text-semantic-money-in-foreground"
                }`}
              >
                {initialOversight.gradingSla?.overdueUngradedCount ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Overdue ungraded submissions
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-3">
              <p className="text-muted-foreground">Total Ungraded</p>
              <p className="text-lg font-bold text-foreground mt-0.5">
                {initialOversight.gradingSla?.totalUngradedCount ?? 0}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting teacher review</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
