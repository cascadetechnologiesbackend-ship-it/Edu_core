"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Send,
  X,
  Search,
  Filter,
  User,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  answerAdminFeeQuery,
  escalateAdminFeeQuery,
  type AdminFeeQueryItem,
  type FeeQueryStatusFilter,
} from "./actions";

export interface FeeQueriesAdminClientProps {
  initialQueries: AdminFeeQueryItem[];
  counts: {
    all: number;
    open: number;
    slaBreached: number;
    answered: number;
    resolved: number;
    escalated: number;
  };
}

export function FeeQueriesAdminClient({
  initialQueries,
  counts,
}: FeeQueriesAdminClientProps) {
  const [queries, setQueries] = useState<AdminFeeQueryItem[]>(initialQueries);
  const [filter, setFilter] = useState<FeeQueryStatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [activeQuery, setActiveQuery] = useState<AdminFeeQueryItem | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const answerTemplates = [
    "Invoice breakdown verified: Tuition and activity fees are standard per term structure.",
    "Late fee has been reviewed and waived under special circumstances.",
    "Duplicate transaction identified; refund request submitted to accounts.",
    "Fee concession application received and pending committee approval.",
  ];

  const handleOpenAnswerModal = (q: AdminFeeQueryItem) => {
    setActiveQuery(q);
    setAnswerText(q.answer || "");
  };

  const handleSendAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuery || !answerText.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await answerAdminFeeQuery({
        queryId: activeQuery.id,
        answer: answerText.trim(),
      });

      if (res.success) {
        toast.success("Response recorded and notified to parent.");
        setQueries((prev) =>
          prev.map((item) =>
            item.id === activeQuery.id
              ? {
                  ...item,
                  status: "ANSWERED",
                  answer: answerText.trim(),
                  answeredAt: new Date().toISOString(),
                }
              : item
          )
        );
        setActiveQuery(null);
        setAnswerText("");
      } else {
        toast.error(res.error || "Failed to record answer.");
      }
    } catch {
      toast.error("Network error while recording response.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEscalateToPrincipal = async (queryId: string) => {
    try {
      setIsSubmitting(true);
      const res = await escalateAdminFeeQuery({ queryId });
      if (res.success) {
        toast.success("Query escalated to Principal.");
        setQueries((prev) =>
          prev.map((item) =>
            item.id === queryId
              ? { ...item, status: "ESCALATED", escalatedAt: new Date().toISOString() }
              : item
          )
        );
      } else {
        toast.error(res.error || "Failed to escalate.");
      }
    } catch {
      toast.error("Network error while escalating.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQueries = queries.filter((q) => {
    if (filter === "SLA_BREACHED") {
      if (q.status !== "OPEN" || q.hoursElapsed < 48) return false;
    } else if (filter !== "ALL" && q.status !== filter) {
      return false;
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      const matchName = q.studentName.toLowerCase().includes(s);
      const matchAdm = q.admissionNumber.toLowerCase().includes(s);
      const matchInv = q.invoiceNumber.toLowerCase().includes(s);
      const matchMsg = q.message.toLowerCase().includes(s);
      return matchName || matchAdm || matchInv || matchMsg;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header with Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Fee Query Inbox & SLA Management
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Parent inquiries, breakdown requests, concession questions, and 48-hour SLA tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {counts.slaBreached > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{counts.slaBreached} SLA Breached</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Target SLA: 48h</span>
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {[
          { id: "ALL", label: `All (${counts.all})` },
          { id: "OPEN", label: `Open (${counts.open})` },
          { id: "SLA_BREACHED", label: `SLA Overdue (${counts.slaBreached})` },
          { id: "ANSWERED", label: `Answered (${counts.answered})` },
          { id: "RESOLVED", label: `Resolved (${counts.resolved})` },
          { id: "ESCALATED", label: `Escalated (${counts.escalated})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as FeeQueryStatusFilter)}
            className={`text-xs px-3 py-1.5 rounded-xl font-medium border transition-colors ${
              filter === tab.id
                ? "bg-indigo-600 text-white border-indigo-500"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student name, admission number, invoice #..."
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Queries List */}
      <div className="space-y-3" data-testid="admin-fee-queries-list">
        {filteredQueries.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
            No fee inquiries found matching this criteria.
          </div>
        ) : (
          filteredQueries.map((q) => {
            const isBreached = q.status === "OPEN" && q.hoursElapsed >= 48;
            const isCritical = q.status === "OPEN" && q.hoursElapsed >= 120;

            return (
              <div
                key={q.id}
                data-testid={`fee-query-row-${q.id}`}
                className={`rounded-2xl bg-slate-900/90 border p-4 sm:p-5 shadow-sm space-y-3 transition-all ${
                  isCritical
                    ? "border-rose-600/80 border-l-4 border-l-rose-500"
                    : isBreached
                    ? "border-amber-600/60 border-l-4 border-l-amber-500"
                    : q.status === "ANSWERED"
                    ? "border-indigo-800/60 border-l-4 border-l-indigo-500"
                    : "border-slate-800"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-100">
                        {q.studentName}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({q.admissionNumber})
                      </span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className="text-xs text-indigo-300 font-semibold">
                        {q.invoiceNumber}
                      </span>
                      <span className="text-xs text-slate-400">
                        (Bal: ₹{q.invoiceBalance.toLocaleString("en-IN")})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-300">
                        Category: {q.category}
                      </span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className="text-slate-400">
                        Raised {new Date(q.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Status & SLA Badges */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                    {q.status === "OPEN" && (
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                          isCritical
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                            : isBreached
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>
                          {isCritical
                            ? `Critical (${q.hoursElapsed}h) - Auto-escalating soon`
                            : isBreached
                            ? `SLA Breached (${q.hoursElapsed}h)`
                            : `Age: ${q.hoursElapsed}h (Within SLA)`}
                        </span>
                      </span>
                    )}

                    <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        q.status === "ANSWERED"
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                          : q.status === "RESOLVED"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : q.status === "ESCALATED"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {q.status}
                    </span>
                  </div>
                </div>

                {/* Parent Question Message */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-200">
                  <div className="text-[11px] font-semibold text-slate-400 mb-0.5">
                    Parent Message:
                  </div>
                  <p className="leading-relaxed text-slate-300 italic">
                    "{q.message}"
                  </p>
                </div>

                {/* Response Block if answered */}
                {q.answer && (
                  <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-900/50 text-xs text-slate-200">
                    <div className="text-[11px] font-semibold text-indigo-300 mb-0.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>
                        Response by {q.answeredByName || "Accounts Staff"}
                        {q.answeredAt && ` (${new Date(q.answeredAt).toLocaleDateString("en-IN")})`}
                      </span>
                    </div>
                    <p className="leading-relaxed text-slate-300">{q.answer}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                  {q.status !== "ESCALATED" && q.status !== "RESOLVED" && (
                    <button
                      type="button"
                      onClick={() => handleEscalateToPrincipal(q.id)}
                      disabled={isSubmitting}
                      className="text-xs text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                      <span>Escalate to Principal</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    {q.status !== "RESOLVED" && (
                      <button
                        type="button"
                        onClick={() => handleOpenAnswerModal(q)}
                        data-testid={`answer-fee-query-${q.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{q.answer ? "Update Response" : "Respond to Parent"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Answer Modal */}
      {activeQuery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl relative text-left"
            data-testid="admin-answer-modal"
          >
            <button
              type="button"
              onClick={() => setActiveQuery(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
                Official Response
              </span>
              <h2 className="text-base font-bold text-slate-100 mt-0.5">
                Respond to {activeQuery.studentName}'s Parent
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Ref: {activeQuery.invoiceNumber} • Category: {activeQuery.category}
              </p>
            </div>

            {/* Parent question snippet */}
            <div className="mt-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
              <span className="font-semibold text-slate-400">Query: </span>
              "{activeQuery.message}"
            </div>

            <form onSubmit={handleSendAnswer} className="mt-4 space-y-4">
              {/* Quick templates */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Quick Templates
                </label>
                <div className="flex flex-col gap-1.5">
                  {answerTemplates.map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAnswerText(t)}
                      className="text-left text-xs p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-300 transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Response textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Official Answer to Parent
                </label>
                <textarea
                  rows={4}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Type official explanation or confirmation of fee adjustment..."
                  data-testid="admin-answer-textarea"
                  className="w-full rounded-xl bg-slate-800/90 border border-slate-700 p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveQuery(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !answerText.trim()}
                  data-testid="admin-submit-answer-button"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Sending..." : "Send Response"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FeeQueriesAdminClient;
