"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  KeyRound,
  Users,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Send,
  Printer,
  Download,
  Copy,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Filter,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchClaimTrackingQueueAction,
  resendParentClaimAction,
  queueSmsClaimRemindersAction,
  fetchClassClaimSheetAction,
} from "../actions";
import type {
  ClaimTrackingQueueItem,
  ClaimTrackingSummary,
  StudentClaimStatus,
  ClaimSheetRow,
} from "@schoolmitra/backend/lib/claimDistribution";
import { AppModal } from "@/components/ui/AppModal";

interface ClaimTrackingClientProps {
  initialSummary: ClaimTrackingSummary;
  initialItems: ClaimTrackingQueueItem[];
}

export function ClaimTrackingClient({
  initialSummary,
  initialItems,
}: ClaimTrackingClientProps) {
  const [summary, setSummary] = useState<ClaimTrackingSummary>(initialSummary);
  const [items, setItems] = useState<ClaimTrackingQueueItem[]>(initialItems);
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<StudentClaimStatus | "ALL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  // Active claim modal state after resend
  const [latestResendUrl, setLatestResendUrl] = useState<string | null>(null);

  // Claim Sheet Modal State
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [sheetRows, setSheetRows] = useState<ClaimSheetRow[]>([]);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);

  const refreshQueue = (classId?: string, status?: StudentClaimStatus | "ALL", search?: string) => {
    startTransition(async () => {
      const cId = classId !== undefined ? classId : selectedClassId;
      const st = status !== undefined ? status : selectedStatus;
      const sTerm = search !== undefined ? search : searchTerm;

      const res = await fetchClaimTrackingQueueAction({
        classId: cId !== "ALL" ? cId : undefined,
        status: st !== "ALL" ? st : undefined,
        search: sTerm || undefined,
      });

      if (res.success && res.data) {
        setSummary(res.data.summary);
        setItems(res.data.items);
      } else {
        toast.error(res.message || "Failed to refresh claim tracking queue");
      }
    });
  };

  const handleResendClaim = (studentId: string, studentName: string) => {
    startTransition(async () => {
      const res = await resendParentClaimAction(studentId);
      if (res.success && "claimUrl" in res && res.claimUrl) {
        toast.success(`Fresh claim link generated for ${studentName}`);
        setLatestResendUrl(res.claimUrl);
        refreshQueue();
      } else {
        toast.error(res.message || "Failed to resend claim link");
      }
    });
  };

  const handleSendSmsReminders = () => {
    startTransition(async () => {
      const res = await queueSmsClaimRemindersAction(
        selectedClassId !== "ALL" ? selectedClassId : undefined,
      );
      if (res.success) {
        toast.success(res.message);
        refreshQueue();
      } else {
        toast.error(res.message || "Failed to dispatch SMS reminders");
      }
    });
  };

  const handleOpenClaimSheet = async () => {
    setIsLoadingSheet(true);
    setSheetModalOpen(true);
    const res = await fetchClassClaimSheetAction(
      selectedClassId !== "ALL" ? selectedClassId : undefined,
    );
    if (res.success && res.rows) {
      setSheetRows(res.rows);
    } else {
      toast.error(res.message || "Failed to load claim sheet");
    }
    setIsLoadingSheet(false);
  };

  const downloadCsv = () => {
    if (sheetRows.length === 0) return;
    const headers = [
      "Class",
      "Section",
      "Student Name",
      "Admission No",
      "Roll No",
      "Guardian Name",
      "Guardian Mobile",
      "Claim Code",
      "Claim Status",
      "Expiry Date",
    ];
    const csvContent = [
      headers.join(","),
      ...sheetRows.map((r) =>
        [
          `"${r.className}"`,
          `"${r.sectionName}"`,
          `"${r.studentName}"`,
          `"${r.admissionNumber}"`,
          `"${r.rollNumber}"`,
          `"${r.guardianName}"`,
          `"${r.guardianMobile}"`,
          `"${r.claimCode}"`,
          `"${r.claimStatus}"`,
          `"${r.expiryDate}"`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `claim-sheet-${selectedClassId !== "ALL" ? "class" : "school"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Claim sheet downloaded as CSV");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      {/* ── Finished State & Real-Time Readiness Banner ───────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-800/40 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 block">
              Day One Gate · J10 Check 8
            </span>
            <h3
              data-testid="claim-tracking-finished-state"
              className="text-base sm:text-lg font-black text-white mt-0.5"
            >
              Claims issued for {summary.totalEnrolled} students. {summary.totalClaimed} claimed,{" "}
              {summary.totalPending} pending.
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Distribute class claim sheets or dispatch SMS reminders to complete onboarding.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleOpenClaimSheet}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1.5 border border-slate-700 transition"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            <span>Class Claim Sheet</span>
          </button>
          <button
            onClick={handleSendSmsReminders}
            disabled={isPending || summary.totalPending === 0}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send reminders to pending claims</span>
          </button>
        </div>
      </div>

      {/* ── Summary Counters Strip ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 block">Total Enrolled</span>
          <span className="text-2xl font-black text-white font-mono mt-0.5 block">
            {summary.totalEnrolled}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800">
          <span className="text-[11px] font-semibold text-indigo-400 block">Claims Issued</span>
          <span className="text-2xl font-black text-indigo-300 font-mono mt-0.5 block">
            {summary.totalIssued}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-emerald-900/40">
          <span className="text-[11px] font-semibold text-emerald-400 block">Claimed</span>
          <span className="text-2xl font-black text-emerald-300 font-mono mt-0.5 block">
            {summary.totalClaimed}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-amber-900/40">
          <span className="text-[11px] font-semibold text-amber-400 block">Pending</span>
          <span className="text-2xl font-black text-amber-300 font-mono mt-0.5 block">
            {summary.totalPending}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-rose-900/40 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-rose-400 block">Expired</span>
          <span className="text-2xl font-black text-rose-300 font-mono mt-0.5 block">
            {summary.totalExpired}
          </span>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ───────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Class Selector */}
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              refreshQueue(e.target.value, selectedStatus, searchTerm);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
          >
            <option value="ALL">All Classes ({summary.classSummaries.length})</option>
            {summary.classSummaries.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className} ({c.enrolledCount} students)
              </option>
            ))}
          </select>

          {/* Status Filter Tabs */}
          {(["ALL", "ISSUED", "CLAIMED", "EXPIRED"] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setSelectedStatus(st);
                refreshQueue(selectedClassId, st, searchTerm);
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                selectedStatus === st
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-800/80 text-slate-400 hover:text-white"
              }`}
            >
              {st === "ALL" ? "All Statuses" : st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              refreshQueue(selectedClassId, selectedStatus, e.target.value);
            }}
            placeholder="Search student or mobile..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* ── Table Roster ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Class & Section</th>
                <th className="py-3 px-4">Guardian Contact</th>
                <th className="py-3 px-4">Claim State</th>
                <th className="py-3 px-4">Expiry / Claimed</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    No students matching filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.studentId} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <span className="font-bold text-white block">{item.studentName}</span>
                      <span className="font-mono text-[10px] text-slate-400 block">
                        {item.admissionNumber} {item.rollNumber ? `· Roll: ${item.rollNumber}` : ""}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-200">
                        {item.className} - {item.sectionName}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-white block font-medium">
                        {item.guardianName || "Guardian"}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono block">
                        {item.guardianMobile || item.guardianEmail || "No contact"}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge status={item.claimStatus} />
                    </td>

                    <td className="py-3 px-4 text-[11px] text-slate-400">
                      {item.claimStatus === "CLAIMED" && item.claimedAt ? (
                        <span className="text-emerald-400">
                          {new Date(item.claimedAt).toLocaleDateString("en-IN")}
                        </span>
                      ) : item.claimExpiry ? (
                        <span>Exp: {new Date(item.claimExpiry).toLocaleDateString("en-IN")}</span>
                      ) : (
                        <span>7 Days validity</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {item.claimStatus === "CLAIMED" ? (
                        <span className="text-[11px] text-emerald-400 font-semibold inline-flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Claimed</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleResendClaim(item.studentId, item.studentName)}
                          disabled={isPending}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700 transition inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3 text-indigo-400" />
                          <span>Resend</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Resend Link Modal ─────────────────────────────────────────────────── */}
      {latestResendUrl && (
        <AppModal
          open={Boolean(latestResendUrl)}
          onClose={() => setLatestResendUrl(null)}
          title="Parent Claim Link Generated"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              A fresh 7-day single-use claim link has been generated. You can share this link directly with the parent or dispatch via SMS:
            </p>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-indigo-300 break-all select-all flex items-center justify-between gap-2">
              <span>{latestResendUrl}</span>
              <button
                onClick={() => copyToClipboard(latestResendUrl)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white shrink-0"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setLatestResendUrl(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </AppModal>
      )}

      {/* ── Class Claim Sheet Modal ───────────────────────────────────────────── */}
      {sheetModalOpen && (
        <AppModal
          open={sheetModalOpen}
          onClose={() => setSheetModalOpen(false)}
          title="Printable Class Claim Sheet"
        >
          <div className="space-y-4 max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <p className="text-xs text-slate-300">
                Print or download credentials to distribute to classroom teachers for Day One orientation.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={downloadCsv}
                  disabled={sheetRows.length === 0}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1 border border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl printable-claim-sheet">
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  body * { visibility: hidden !important; }
                  .printable-claim-sheet, .printable-claim-sheet * { visibility: visible !important; color: black !important; background: white !important; }
                  .printable-claim-sheet { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
                  .printable-claim-sheet table { width: 100%; border-collapse: collapse; font-size: 10pt; }
                  .printable-claim-sheet th, .printable-claim-sheet td { border: 1px solid #ccc !important; padding: 6px !important; }
                }
              `}} />
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                    <th className="p-2.5">Class</th>
                    <th className="p-2.5">Student</th>
                    <th className="p-2.5">Adm No</th>
                    <th className="p-2.5">Roll No</th>
                    <th className="p-2.5">Guardian</th>
                    <th className="p-2.5">Mobile</th>
                    <th className="p-2.5">Claim Code</th>
                    <th className="p-2.5">State</th>
                    <th className="p-2.5">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
                  {isLoadingSheet ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-500">
                        Loading sheet...
                      </td>
                    </tr>
                  ) : sheetRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-500">
                        No rows available.
                      </td>
                    </tr>
                  ) : (
                    sheetRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/20">
                        <td className="p-2.5 font-sans font-medium">
                          {r.className} - {r.sectionName}
                        </td>
                        <td className="p-2.5 font-sans font-bold text-white">{r.studentName}</td>
                        <td className="p-2.5">{r.admissionNumber}</td>
                        <td className="p-2.5">{r.rollNumber}</td>
                        <td className="p-2.5 font-sans">{r.guardianName}</td>
                        <td className="p-2.5">{r.guardianMobile}</td>
                        <td className="p-2.5 text-indigo-400 font-bold">{r.claimCode}</td>
                        <td className="p-2.5">
                          <span
                            className={
                              r.claimStatus === "CLAIMED"
                                ? "text-emerald-400 font-bold"
                                : r.claimStatus === "EXPIRED"
                                ? "text-rose-400 font-bold"
                                : "text-amber-400 font-bold"
                            }
                          >
                            {r.claimStatus}
                          </span>
                        </td>
                        <td className="p-2.5">{r.expiryDate}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </AppModal>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: StudentClaimStatus }) {
  if (status === "CLAIMED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        <span>CLAIMED</span>
      </span>
    );
  }

  if (status === "ISSUED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
        <Clock className="w-3 h-3 text-amber-400" />
        <span>ISSUED</span>
      </span>
    );
  }

  if (status === "EXPIRED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
        <AlertTriangle className="w-3 h-3 text-rose-400" />
        <span>EXPIRED</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
      <span>UNPROVISIONED</span>
    </span>
  );
}
