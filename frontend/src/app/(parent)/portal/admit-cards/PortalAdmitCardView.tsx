"use client";

import React, { useState } from "react";
import {
  FileCheck2,
  Calendar,
  Clock,
  MapPin,
  Lock,
  AlertTriangle,
  Printer,
  ChevronRight,
  ShieldAlert,
  Info,
  CheckCircle2,
  Download,
  School,
  User,
} from "lucide-react";

export interface StudentAdmitCardData {
  student: {
    id: string;
    name: string;
    rollNumber: string | null;
    admissionNumber: string;
    className: string;
  };
  school: {
    name: string;
    board: string;
    address: string;
    city: string;
  };
  exam: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  settings: {
    availableFrom: string | null;
    availableUntil: string | null;
    feeLockMode: "OFF" | "SOFT" | "HARD";
    feeLockThresholdAmount: string;
    instructions: string | null;
    examCentre: string | null;
    reportingTime: string | null;
  } | null;
  isHeld: boolean;
  holdReason: string | null;
  dueAmount: number;
  schedules: Array<{
    subjectName: string;
    subjectCode: string;
    date: string;
    startTime: string;
    endTime: string;
    room: string | null;
  }>;
}

export function PortalAdmitCardView({
  cards,
}: {
  cards: StudentAdmitCardData[];
}) {
  const [selectedCard, setSelectedCard] = useState<StudentAdmitCardData | null>(
    cards[0] || null,
  );
  const [showPrintModal, setShowPrintModal] = useState(false);

  const now = new Date();

  return (
    <div className="space-y-6">
      {/* List of cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card, idx) => {
          const settings = card.settings;
          const threshold = parseFloat(settings?.feeLockThresholdAmount || "0");
          const feeExceeded = card.dueAmount > threshold;

          // Status calculation
          let status: "ACTIVE" | "HELD" | "NOT_OPEN" | "CLOSED" | "FEE_BLOCKED" =
            "ACTIVE";
          let statusLabel = "Available for Download";
          let statusColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";

          if (card.isHeld) {
            status = "HELD";
            statusLabel = "Withheld by Office";
            statusColor = "text-rose-400 bg-rose-500/10 border-rose-500/30";
          } else if (
            settings?.availableFrom &&
            now < new Date(settings.availableFrom)
          ) {
            status = "NOT_OPEN";
            statusLabel = `Opens ${new Date(settings.availableFrom).toLocaleDateString()}`;
            statusColor = "text-amber-400 bg-amber-500/10 border-amber-500/30";
          } else if (
            settings?.availableUntil &&
            now > new Date(settings.availableUntil)
          ) {
            status = "CLOSED";
            statusLabel = "Download Window Closed";
            statusColor = "text-slate-400 bg-slate-800 border-slate-700";
          } else if (settings?.feeLockMode === "HARD" && feeExceeded) {
            status = "FEE_BLOCKED";
            statusLabel = "Fee Clearance Required";
            statusColor = "text-rose-400 bg-rose-500/10 border-rose-500/30";
          }

          const isDownloadable = status === "ACTIVE";
          const hasSoftFeeWarning =
            !card.isHeld &&
            settings?.feeLockMode === "SOFT" &&
            feeExceeded &&
            status === "ACTIVE";

          return (
            <div
              key={`${card.student.id}-${card.exam.id}-${idx}`}
              className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm p-5 space-y-4 shadow-lg hover:border-slate-700 transition"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <FileCheck2 className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-white text-base">
                      {card.exam.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    Student: <span className="text-slate-200 font-medium">{card.student.name}</span> (Class: {card.student.className})
                  </p>
                </div>

                <span
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border ${statusColor}`}
                >
                  {statusLabel}
                </span>
              </div>

              {/* Roster details */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-500">Roll Number:</span>
                  <p className="text-slate-200 font-medium">
                    {card.student.rollNumber || "Not Assigned"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Admission No:</span>
                  <p className="text-slate-200 font-medium">
                    {card.student.admissionNumber}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Exam Window:</span>
                  <p className="text-slate-200 font-medium">
                    {card.exam.startDate ? new Date(card.exam.startDate).toLocaleDateString() : "TBD"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Papers Scheduled:</span>
                  <p className="text-slate-200 font-medium">
                    {card.schedules.length} Subjects
                  </p>
                </div>
              </div>

              {/* Warnings and messages */}
              {card.isHeld && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Admit Card Withheld</p>
                    <p className="text-[11px] text-rose-300/80 mt-0.5">
                      {card.holdReason || "Withheld by school administration. Please visit the school office."}
                    </p>
                  </div>
                </div>
              )}

              {status === "FEE_BLOCKED" && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Fee Clearance Required</p>
                    <p className="text-[11px] text-rose-300/80 mt-0.5">
                      Outstanding fee dues of ₹{card.dueAmount.toLocaleString("en-IN")} exceed the clearance threshold (₹{threshold.toLocaleString("en-IN")}). Please clear pending dues at the accounts office to unlock your admit card.
                    </p>
                  </div>
                </div>
              )}

              {hasSoftFeeWarning && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Fee Dues Notice</p>
                    <p className="text-[11px] text-amber-300/80 mt-0.5">
                      Outstanding balance ₹{card.dueAmount.toLocaleString("en-IN")}. Please settle pending dues before the examinations begin.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={!isDownloadable}
                  onClick={() => {
                    setSelectedCard(card);
                    setShowPrintModal(true);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-md ${
                    isDownloadable
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 cursor-pointer"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span>View &amp; Print Hall Ticket</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Printable Modal */}
      {showPrintModal && selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl my-8 print:border-none print:shadow-none print:p-0 print:m-0 print:bg-white print:text-black">
            {/* Modal Controls (Hidden in Print) */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-800 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">
                  Official Admit Card Preview
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-600/30 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="space-y-6 pt-6 print:pt-0 font-sans text-slate-100 print:text-black">
              {/* Document Header */}
              <div className="text-center border-b-2 border-slate-700 print:border-black pb-4 space-y-1">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider text-white print:text-black">
                  {selectedCard.school.name}
                </h2>
                <p className="text-xs text-slate-400 print:text-gray-700">
                  Affiliated to {selectedCard.school.board} • {selectedCard.school.address}, {selectedCard.school.city}
                </p>
                <div className="pt-2">
                  <span className="inline-block px-3 py-1 rounded bg-indigo-500/20 text-indigo-300 print:bg-gray-200 print:text-black font-bold text-xs uppercase tracking-widest border border-indigo-500/30 print:border-gray-400">
                    HALL TICKET / ADMIT CARD — {selectedCard.exam.name}
                  </span>
                </div>
              </div>

              {/* Student Metadata Box */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-800 bg-slate-950/60 print:bg-gray-50 print:border-gray-400 text-xs">
                <div>
                  <span className="text-slate-500 print:text-gray-600 uppercase text-[10px] font-bold">
                    Student Name
                  </span>
                  <p className="font-bold text-white print:text-black text-sm">
                    {selectedCard.student.name}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 print:text-gray-600 uppercase text-[10px] font-bold">
                    Roll Number
                  </span>
                  <p className="font-bold text-white print:text-black text-sm">
                    {selectedCard.student.rollNumber || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 print:text-gray-600 uppercase text-[10px] font-bold">
                    Admission No
                  </span>
                  <p className="font-bold text-white print:text-black text-sm">
                    {selectedCard.student.admissionNumber}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 print:text-gray-600 uppercase text-[10px] font-bold">
                    Class &amp; Section
                  </span>
                  <p className="font-bold text-white print:text-black text-sm">
                    {selectedCard.student.className}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 print:text-gray-600 uppercase text-[10px] font-bold">
                    Exam Centre
                  </span>
                  <p className="font-medium text-slate-200 print:text-black">
                    {selectedCard.settings?.examCentre || "Main School Campus"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 print:text-gray-600 uppercase text-[10px] font-bold">
                    Reporting Time
                  </span>
                  <p className="font-medium text-slate-200 print:text-black">
                    {selectedCard.settings?.reportingTime || "09:00 AM"}
                  </p>
                </div>
              </div>

              {/* Timetable Schedule Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-black">
                  Examination Datesheet
                </h4>
                <div className="border border-slate-800 print:border-black rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 print:bg-gray-200 text-slate-400 print:text-black font-semibold uppercase text-[10px] border-b border-slate-800 print:border-black">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Timing</th>
                        <th className="py-2.5 px-3">Room / Hall</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-black">
                      {selectedCard.schedules.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-500 print:text-gray-600">
                            No subjects scheduled yet.
                          </td>
                        </tr>
                      ) : (
                        selectedCard.schedules.map((sc, sIdx) => (
                          <tr key={sIdx} className="hover:bg-slate-800/20 print:hover:bg-transparent">
                            <td className="py-2 px-3 font-medium text-slate-300 print:text-black">
                              {sc.date ? new Date(sc.date).toLocaleDateString() : "TBD"}
                            </td>
                            <td className="py-2 px-3 font-semibold text-white print:text-black">
                              {sc.subjectName} ({sc.subjectCode})
                            </td>
                            <td className="py-2 px-3 text-slate-400 print:text-black">
                              {sc.startTime || "09:30 AM"} – {sc.endTime || "12:30 PM"}
                            </td>
                            <td className="py-2 px-3 text-slate-400 print:text-black">
                              {sc.room || "Assigned Hall"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Guidelines / Instructions */}
              <div className="p-4 rounded-xl border border-slate-800 print:border-black bg-slate-950/40 print:bg-white text-xs space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-400 print:text-black">
                  Important Candidate Instructions:
                </h4>
                <p className="text-[11px] text-slate-300 print:text-black leading-relaxed whitespace-pre-line">
                  {selectedCard.settings?.instructions ||
                    "1. Candidates must arrive at the examination centre at least 30 minutes before commencement.\n2. Electronic items, smart watches, and unauthorized material are strictly prohibited inside the examination hall.\n3. This hall ticket must be presented to the invigilator for verification alongside a valid student identity card."}
                </p>
              </div>

              {/* Signatures Row */}
              <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs">
                <div className="border-t border-slate-700 print:border-black pt-2">
                  <p className="text-[11px] font-medium text-slate-400 print:text-black">
                    Candidate's Signature
                  </p>
                </div>
                <div className="border-t border-slate-700 print:border-black pt-2">
                  <p className="text-[11px] font-medium text-slate-400 print:text-black">
                    Invigilator's Signature
                  </p>
                </div>
                <div className="border-t border-slate-700 print:border-black pt-2">
                  <p className="text-[11px] font-semibold text-white print:text-black">
                    Controller of Examinations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
