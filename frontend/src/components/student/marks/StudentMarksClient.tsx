"use client";

import React, { useState } from "react";
import {
  Award,
  Calendar,
  Clock,
  Download,
  FileCheck2,
  Lock,
  Hourglass,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import {
  StudentMarksData,
  StudentExamResultItem,
  StudentDatesheetItem,
} from "@/app/(student)/student/marks/marksActions";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";

export function StudentMarksClient({ data }: { data: StudentMarksData }) {
  const [activeTab, setActiveTab] = useState<"results" | "datesheet">("results");
  const [expandedExamId, setExpandedExamId] = useState<string | null>(
    data.results[0]?.examId || null
  );

  const toggleExpand = (examId: string) => {
    setExpandedExamId((prev) => (prev === examId ? null : examId));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Marks & Examinations
              </h1>
              <p className="text-xs text-slate-400">
                परीक्षा परिणाम एवं समय-सारणी • {data.student.className} - {data.student.sectionName}
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("results")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "results"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Results / परिणाम
            </button>
            <button
              onClick={() => setActiveTab("datesheet")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "datesheet"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Datesheet & Admit Card / समय-सारणी
            </button>
          </div>
        </div>
      </div>

      {/* RESULTS TAB */}
      {activeTab === "results" ? (
        <div className="space-y-4">
          {data.results.length === 0 ? (
            <EmptyStateCTA
              icon={Award}
              title="No Examination Results"
              hint="No examinations have been scheduled or recorded for your class yet this academic year."
              className="border-slate-800 bg-slate-900/40"
            />
          ) : (
            <div className="space-y-4">
              {data.results.map((res) => {
                const isExpanded = expandedExamId === res.examId;

                return (
                  <div
                    key={res.examId}
                    className="rounded-3xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden transition"
                  >
                    {/* Header bar */}
                    <div
                      onClick={() => toggleExpand(res.examId)}
                      className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition select-none"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-base font-bold text-white truncate">
                            {res.examName}
                          </h2>
                          {res.isLocked ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              <Hourglass className="w-3 h-3 animate-spin" />
                              Results awaited / प्रतीक्षित
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              Published / घोषित
                            </span>
                          )}
                        </div>

                        {res.percentage !== null && !res.isLocked && (
                          <div className="flex items-center gap-3 text-xs text-slate-300 pt-0.5">
                            <span className="font-semibold text-amber-400">
                              {res.percentage}% Overall
                            </span>
                            <span>•</span>
                            <span>
                              {res.totalMarksObtained} / {res.totalMaxMarks} Marks
                            </span>
                            {res.reportCard?.overallGrade && (
                              <>
                                <span>•</span>
                                <span className="font-bold text-indigo-400">
                                  Grade: {res.reportCard.overallGrade}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          className="p-1 rounded-lg text-slate-400 hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Body */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 border-t border-slate-800/80">
                        {res.isLocked ? (
                          /* Locked State (BR5, AC-10) — Zero Leaks! */
                          <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-6 text-center space-y-2 mt-2">
                            <Lock className="w-8 h-8 text-amber-400/80 mx-auto" />
                            <h3 className="text-sm font-bold text-amber-200">
                              Results Under Evaluation
                            </h3>
                            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                              Marks for this examination are currently being compiled, verified, and locked by the academic administration. Official marks will be revealed here once publication lock is approved.
                            </p>
                          </div>
                        ) : (
                          /* Unlocked / Published State */
                          <div className="space-y-4 mt-2">
                            {/* Marks breakdown table */}
                            <div className="overflow-x-auto rounded-2xl border border-slate-800">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                                  <tr>
                                    <th className="py-2.5 px-3 font-semibold">Subject</th>
                                    <th className="py-2.5 px-3 font-semibold text-right">Max</th>
                                    <th className="py-2.5 px-3 font-semibold text-right">Obtained</th>
                                    <th className="py-2.5 px-3 font-semibold text-center">Grade</th>
                                    <th className="py-2.5 px-3 font-semibold">Remarks</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 font-medium">
                                  {res.marks.map((m) => (
                                    <tr
                                      key={m.subjectId}
                                      className="hover:bg-slate-800/30 transition"
                                    >
                                      <td className="py-3 px-3 text-white">
                                        <div className="font-bold">{m.subjectName}</div>
                                        {m.subjectCode && (
                                          <div className="text-[10px] text-slate-500 font-mono">
                                            {m.subjectCode}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-3 px-3 text-right text-slate-400">
                                        {m.maxMarks}
                                      </td>
                                      <td className="py-3 px-3 text-right">
                                        {m.isAbsent ? (
                                          <span className="text-rose-400 font-bold">
                                            Absent / अनुपस्थित
                                          </span>
                                        ) : (
                                          <span className="text-white font-bold">
                                            {m.marksObtained !== null ? m.marksObtained : "—"}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-3 px-3 text-center">
                                        {m.grade ? (
                                          <span className="px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                            {m.grade}
                                          </span>
                                        ) : (
                                          <span className="text-slate-600">—</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-3 text-slate-400 italic">
                                        {m.remarks || "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Report card download strip */}
                            {res.reportCard && (
                              <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-0.5">
                                  <div className="text-xs font-bold text-indigo-200">
                                    Official Digital Report Card
                                  </div>
                                  <div className="text-[11px] text-indigo-300/80">
                                    {res.reportCard.attendancePercent !== null && (
                                      <span>Attendance: {res.reportCard.attendancePercent}% • </span>
                                    )}
                                    {res.reportCard.teacherRemarks && (
                                      <span>Teacher: &ldquo;{res.reportCard.teacherRemarks}&rdquo;</span>
                                    )}
                                  </div>
                                </div>

                                {res.reportCard.pdfS3Key ? (
                                  <Link
                                    href={`/api/report-cards/download?id=${res.reportCard.id}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition self-start sm:self-auto shrink-0 shadow-md shadow-indigo-600/30"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    Download PDF / डाउनलोड
                                  </Link>
                                ) : (
                                  <span className="text-xs text-indigo-400 font-medium">
                                    Report Card Generated
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* DATESHEET & ADMIT CARD TAB */
        <div className="space-y-6">
          {/* Admit Card Banner Section */}
          {data.admitCards.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-200 px-1">
                Admit Card Status / प्रवेश पत्र
              </h2>

              <div className="space-y-3">
                {data.admitCards.map((admit) => {
                  return (
                    <div
                      key={admit.examId}
                      className="rounded-2xl border p-4 transition bg-slate-900 border-slate-800"
                    >
                      {admit.status === "HELD" ? (
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <h3 className="text-sm font-bold text-rose-300">
                              Admit Card Withheld ({admit.examName})
                            </h3>
                            <p className="text-xs text-slate-300">
                              Reason: {admit.holdReason || "Administrative withhold."} Please contact the examination department.
                            </p>
                          </div>
                        </div>
                      ) : admit.status === "FEE_BLOCKED" ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <CreditCard className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <h3 className="text-sm font-bold text-rose-300">
                                Fee Clearance Required ({admit.examName})
                              </h3>
                              <p className="text-xs text-slate-400">
                                Outstanding balance: ₹{admit.dueAmount}. Clear pending dues to unlock your examination hall ticket.
                              </p>
                            </div>
                          </div>
                          <Link
                            href="/student/fees"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition self-start sm:self-auto shrink-0"
                          >
                            Pay Fees Online
                          </Link>
                        </div>
                      ) : admit.status === "AVAILABLE" ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <h3 className="text-sm font-bold text-emerald-300">
                                Admit Card Ready ({admit.examName})
                              </h3>
                              <p className="text-xs text-slate-400">
                                Exam Centre: {admit.examCentre || "Main School Campus"} • Reporting: {admit.reportingTime || "30 mins before"}
                              </p>
                              {admit.softFeeWarning && (
                                <p className="text-[11px] text-amber-400 font-medium pt-0.5">
                                  Notice: Outstanding fee balance of ₹{admit.dueAmount}. Please settle soon.
                                </p>
                              )}
                            </div>
                          </div>
                          <Link
                            href={`/parent/portal/admit-cards?studentId=${data.student.studentId}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition self-start sm:self-auto shrink-0 shadow-md shadow-emerald-600/30"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            View Admit Card
                          </Link>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3 text-slate-400">
                          <Clock className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
                          <div>
                            <div className="text-xs font-semibold text-slate-300">
                              {admit.examName} Admit Card
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Hall ticket download window has not yet been opened by the school.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Datesheet Schedule List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-slate-200">
                Examination Datesheet / परीक्षा समय-सारणी
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                {data.datesheet.length} Papers Scheduled
              </span>
            </div>

            {data.datesheet.length === 0 ? (
              <EmptyStateCTA
                icon={Calendar}
                title="No Exam Schedules Published"
                hint="Your examination datesheet has not been announced yet. Check back closer to the term test window."
                className="border-slate-800 bg-slate-900/40"
              />
            ) : (
              <div className="space-y-2.5">
                {data.datesheet.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex items-center justify-between gap-4 hover:border-slate-700 transition"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">
                          {item.subjectName}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {item.examName}
                        </span>
                        {item.roomNumber && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            Room {item.roomNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Max: {item.maxMarks}</span>
                        <span>•</span>
                        <span>Pass: {item.passingMarks}</span>
                        <span>•</span>
                        <span>{item.durationMinutes} mins</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-0.5 font-mono">
                      <div className="text-xs font-bold text-amber-400">
                        {item.examDate}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.startTime.slice(0, 5)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
