"use client";

import { useState } from "react";
import Link from "next/link";
import {
  User,
  CalendarCheck,
  Bus,
  CreditCard,
  FolderCheck,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";

interface ChildProfileProps {
  student: {
    id: string;
    fullName: string;
    admissionNumber: string;
    rollNumber?: string | null;
    className: string;
    sectionName: string;
    attendanceRate: number;
    bloodGroup?: string | null;
    dateOfBirth?: string | null;
  };
  availableStudents: Array<{ id: string; fullName: string; className: string }>;
  attendanceSummary: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    recentLogs: Array<{ date: string; status: string; remarks?: string | null }>;
  };
  busPass?: {
    routeName: string;
    stopName: string;
    scheduledTime?: string | null;
    busNumber?: string | null;
  } | null;
  feesSummary: {
    totalPending: number;
    invoices: Array<{ id: string; termName: string; amount: number; status: string; dueDate: string }>;
  };
  documentsSummary: {
    totalUploaded: number;
    documents: Array<{ id: string; title: string; verified: boolean }>;
  };
  guardian: {
    name: string;
    email: string;
    phone?: string | null;
  };
}

export function ChildProfileView({
  student,
  availableStudents,
  attendanceSummary,
  busPass,
  feesSummary,
  documentsSummary,
  guardian,
}: ChildProfileProps) {
  // Collapsible section states (Progressive Disclosure)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    attendance: true,
    transport: true,
    fees: false,
    documents: false,
    consent: false,
    guardian: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const initials = student.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-5 pb-24">
      {/* ── 1. Student Identity Header (Law L12: People Render as People) ─────── */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md">
              {initials}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {student.fullName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {student.className} - {student.sectionName}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>Adm No: <strong className="text-slate-700 dark:text-slate-200">{student.admissionNumber}</strong></span>
                {student.rollNumber && (
                  <>
                    <span>&bull;</span>
                    <span>Roll No: <strong className="text-slate-700 dark:text-slate-200">{student.rollNumber}</strong></span>
                  </>
                )}
                {student.bloodGroup && (
                  <>
                    <span>&bull;</span>
                    <span>Blood: <strong className="text-rose-600 dark:text-rose-400">{student.bloodGroup}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Attendance Sparkline / Rate Chip */}
          <div className="flex items-center sm:flex-col sm:items-end justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 shrink-0">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              30-Day Attendance
            </span>
            <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
              {student.attendanceRate.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Multi-child switcher if parent has more than one ward */}
        {availableStudents.length > 1 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-slate-400 shrink-0">Switch Ward:</span>
            {availableStudents.map((w) => (
              <Link
                key={w.id}
                href={`/parent/profile?studentId=${w.id}`}
                className={`px-3 py-1 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                  w.id === student.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {w.fullName} ({w.className})
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── 2. Collapsible Group: Attendance Record (Max 7 rows) ─────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <button
          onClick={() => toggleSection("attendance")}
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Attendance & Regularity Record
              </h3>
              <p className="text-xs text-slate-400">
                {attendanceSummary.presentDays} of {attendanceSummary.totalDays} sessions present &bull; {attendanceSummary.absentDays} absences
              </p>
            </div>
          </div>
          {openSections.attendance ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {openSections.attendance && (
          <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {attendanceSummary.recentLogs.slice(0, 7).map((log, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        log.status === "PRESENT"
                          ? "bg-emerald-500"
                          : log.status === "ABSENT"
                          ? "bg-rose-500"
                          : "bg-amber-500"
                      }`}
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{log.date}</span>
                    {log.remarks && <span className="text-slate-400 italic">({log.remarks})</span>}
                  </div>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      log.status === "PRESENT"
                        ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950"
                        : log.status === "ABSENT"
                        ? "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950"
                        : "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950"
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <Link
                href={`/parent/more/leave?studentId=${student.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                <CalendarCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Apply for Leave</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. Collapsible Group: Transport & Bus Route ──────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <button
          onClick={() => toggleSection("transport")}
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Bus className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                School Bus & Transit Route
              </h3>
              <p className="text-xs text-slate-400">
                {busPass ? `${busPass.routeName} • ${busPass.stopName}` : "No bus pass active"}
              </p>
            </div>
          </div>
          {openSections.transport ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {openSections.transport && (
          <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800">
            {busPass ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div>
                    <span className="text-slate-400">Assigned Route:</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{busPass.routeName}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Designated Stop:</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{busPass.stopName}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-500">Scheduled: {busPass.scheduledTime || "07:30 AM"}</span>
                  <Link
                    href="/parent/bus"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <span>View Bus Timetable & Map</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-2">
                No active transport subscription linked to this ward.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── 4. Collapsible Group: Fee Ledger (Max 7 rows) ────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <button
          onClick={() => toggleSection("fees")}
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Fee Ledger & Invoices
              </h3>
              <p className="text-xs text-slate-400">
                {feesSummary.totalPending > 0
                  ? `₹${feesSummary.totalPending.toLocaleString("en-IN")} pending payment`
                  : "All accounts in good standing"}
              </p>
            </div>
          </div>
          {openSections.fees ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {openSections.fees && (
          <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {feesSummary.invoices.slice(0, 7).map((inv) => (
                <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{inv.termName}</div>
                    <div className="text-slate-400 text-[11px]">Due: {inv.dueDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      ₹{inv.amount.toLocaleString("en-IN")}
                    </div>
                    <span
                      className={`text-[10px] font-bold ${
                        inv.status === "PAID"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : inv.status === "OVERDUE"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <Link
                href="/parent/fees"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <span>Open Full Fee Ledger & Receipts</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Collapsible Group: Documents & Certificates ─────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <button
          onClick={() => toggleSection("documents")}
          className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FolderCheck className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Statutory Documents & Certificates
              </h3>
              <p className="text-xs text-slate-400">
                {documentsSummary.totalUploaded} documents on file
              </p>
            </div>
          </div>
          {openSections.documents ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {openSections.documents && (
          <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {documentsSummary.documents.slice(0, 7).map((doc) => (
                <div key={doc.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{doc.title}</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <Link
                href="/parent/documents"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>Upload or Download Documents</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── 6. DPDP Statutory Consent Portal Deep-Link (Zero Duplication) ────── */}
      <div className="rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10 p-4 sm:p-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
              DPDP Privacy & Consent Portal
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Manage statutory data processing consents, access records, or submit data rights requests.
            </p>
          </div>
        </div>

        <Link
          href="/portal/consent"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition-colors shrink-0"
        >
          <span>Open Portal</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
