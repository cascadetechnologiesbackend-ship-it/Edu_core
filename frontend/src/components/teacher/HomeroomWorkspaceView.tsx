"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  GraduationCap,
  Users,
  FileSpreadsheet,
  CalendarCheck,
  Award,
  CheckCircle2,
  Clock,
  Search,
  ExternalLink,
  Save,
  Loader2,
  Lock,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getTeacherWorkspaceScope,
  getCompiledReportCardMatrix,
  saveHomeroomRemarks,
  getTeacherSectionRosters,
  getTeacherStudent360Drawer,
  type TeacherWorkspaceScopeResult,
  type CompiledReportCardMatrixResult,
  type StudentRosterRow,
  type Student360Data,
} from "@/app/(teacher)/teacher/classes/classesActions";
import Student360Drawer from "./Student360Drawer";
import { AttendanceWorkbench } from "./AttendanceWorkbench";

interface HomeroomWorkspaceViewProps {
  homeroomSection: NonNullable<TeacherWorkspaceScopeResult["homeroomSection"]>;
}

export default function HomeroomWorkspaceView({
  homeroomSection,
}: HomeroomWorkspaceViewProps) {
  const [subTab, setSubTab] = useState<"matrix" | "roster" | "rollcall">("matrix");
  const [isPending, startTransition] = useTransition();

  // ─── 1. Report Card Matrix State ──────────────────────────────────────────
  const [matrixData, setMatrixData] = useState<CompiledReportCardMatrixResult | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixSearch, setMatrixSearch] = useState("");

  // Remarks draft state: studentId -> { remarks: string; conductGrade: string }
  const [remarksDrafts, setRemarksDrafts] = useState<
    Record<string, { remarks: string; conductGrade: string }>
  >({});
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);

  const fetchMatrix = async (termId?: string) => {
    setMatrixLoading(true);
    try {
      const data = await getCompiledReportCardMatrix(homeroomSection.sectionId, termId);
      setMatrixData(data);
      if (data.currentTerm && !selectedTermId) {
        setSelectedTermId(data.currentTerm.id);
      }
      // Populate drafts from existing remarks
      const drafts: Record<string, { remarks: string; conductGrade: string }> = {};
      for (const st of data.students) {
        drafts[st.studentId] = {
          remarks: st.remarks || "",
          conductGrade: st.conductGrade || "A",
        };
      }
      setRemarksDrafts(drafts);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load report card matrix");
    } finally {
      setMatrixLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrix(selectedTermId || undefined);
  }, [homeroomSection.sectionId, selectedTermId]);

  const handleSaveRemarks = async (studentId: string) => {
    const draft = remarksDrafts[studentId];
    if (!draft || !draft.remarks.trim()) {
      toast.error("Please enter holistic remarks before signing off.");
      return;
    }
    const termId = selectedTermId || matrixData?.currentTerm?.id;
    if (!termId) {
      toast.error("Academic term is required.");
      return;
    }

    setSavingStudentId(studentId);
    try {
      const res = await saveHomeroomRemarks({
        studentId,
        academicTermId: termId,
        remarks: draft.remarks,
        conductGrade: draft.conductGrade,
      });
      if (res.success) {
        toast.success(res.message);
        // Refresh matrix row
        await fetchMatrix(termId);
      } else {
        toast.error("Failed to save remarks.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to sign off remarks");
    } finally {
      setSavingStudentId(null);
    }
  };

  // ─── 2. Homeroom Roster & Student 360 State ──────────────────────────────
  const [rosterStudents, setRosterStudents] = useState<StudentRosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [selectedStudent360, setSelectedStudent360] = useState<Student360Data | null>(null);
  const [is360Open, setIs360Open] = useState(false);
  const [loading360Id, setLoading360Id] = useState<string | null>(null);

  const fetchRoster = async () => {
    setRosterLoading(true);
    try {
      const data = await getTeacherSectionRosters(homeroomSection.sectionId);
      setRosterStudents(data.students);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load homeroom roster");
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === "roster" && rosterStudents.length === 0) {
      fetchRoster();
    }
  }, [subTab, homeroomSection.sectionId]);

  const handleOpen360 = async (studentId: string) => {
    setLoading360Id(studentId);
    try {
      const data = await getTeacherStudent360Drawer(studentId);
      setSelectedStudent360(data);
      setIs360Open(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to open Student 360 profile");
    } finally {
      setLoading360Id(null);
    }
  };

  // Filtered matrix students
  const filteredMatrixStudents = matrixData?.students.filter(
    (st) =>
      st.name.toLowerCase().includes(matrixSearch.toLowerCase()) ||
      st.admissionNumber.toLowerCase().includes(matrixSearch.toLowerCase())
  );

  // Filtered roster students
  const filteredRosterStudents = rosterStudents.filter(
    (st) =>
      st.name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      st.admissionNumber.toLowerCase().includes(rosterSearch.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* ─── Homeroom Banner ──────────────────────────────────────────────── */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 border border-emerald-500/30 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">
                  Class {homeroomSection.className} &bull; Section {homeroomSection.sectionName}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                  Homeroom Lead
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {homeroomSection.studentCount} Enrolled Students &bull; {homeroomSection.roomNumber || "Main Wing"} &bull; Administrative &amp; Holistic Oversight
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => setSubTab("rollcall")}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                subTab === "rollcall"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/50"
                  : "bg-slate-800/80 text-emerald-400 hover:bg-slate-800 border border-emerald-500/30"
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Morning Roll-Call</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Homeroom Sub-Tabs ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-900 border border-slate-800 w-full sm:w-auto self-start overflow-x-auto shadow-sm">
        <button
          type="button"
          onClick={() => setSubTab("matrix")}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            subTab === "matrix"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Compiled Report Cards</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("roster")}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            subTab === "roster"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Homeroom Roster &amp; 360</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("rollcall")}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            subTab === "rollcall"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Daily Roll-Call Register</span>
        </button>
      </div>

      {/* ─── Sub-Tab 1: Compiled Report Card Matrix ───────────────────────── */}
      {subTab === "matrix" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">Term:</span>
              <select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
              >
                {matrixData?.terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                placeholder="Search students..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {matrixLoading ? (
            <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span>Loading compiled scholastic report cards...</span>
            </div>
          ) : !matrixData || matrixData.students.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">
              No students enrolled in this homeroom section.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3 sticky left-0 bg-slate-950 z-10">Student</th>
                    <th className="p-3">Adm No</th>
                    {matrixData.subjects.map((sub) => (
                      <th
                        key={sub.id}
                        className={`p-3 text-center ${
                          sub.isMySubject
                            ? "bg-indigo-950/40 text-indigo-300 border-x border-indigo-500/20"
                            : ""
                        }`}
                      >
                        <div>{sub.name}</div>
                        {sub.isMySubject && (
                          <div className="text-[9px] font-black text-indigo-400 lowercase">
                            (my subject)
                          </div>
                        )}
                      </th>
                    ))}
                    <th className="p-3 text-center">Total</th>
                    <th className="p-3 text-center">%</th>
                    <th className="p-3 min-w-[240px]">Class Teacher Remarks &amp; Sign-Off</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredMatrixStudents?.map((st) => {
                    const draft = remarksDrafts[st.studentId] || {
                      remarks: st.remarks || "",
                      conductGrade: st.conductGrade || "A",
                    };
                    const isSaving = savingStudentId === st.studentId;

                    return (
                      <tr key={st.studentId} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-bold text-white sticky left-0 bg-slate-900 z-10 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpen360(st.studentId)}
                            className="text-left hover:text-emerald-400 transition"
                          >
                            {st.name}
                          </button>
                        </td>
                        <td className="p-3 font-mono text-slate-400">{st.admissionNumber}</td>
                        {matrixData.subjects.map((sub) => {
                          const mark = st.marks[sub.id];
                          return (
                            <td
                              key={sub.id}
                              className={`p-3 text-center font-mono ${
                                sub.isMySubject
                                  ? "bg-indigo-950/20 border-x border-indigo-500/10 font-bold text-indigo-200"
                                  : "text-slate-300"
                              }`}
                            >
                              {mark?.isAbsent ? (
                                <span className="text-rose-400 font-bold text-[10px]">ABS</span>
                              ) : mark?.marksObtained !== null && mark?.marksObtained !== undefined ? (
                                `${mark.marksObtained}`
                              ) : (
                                <span className="text-slate-400">&mdash;</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-3 text-center font-mono font-bold text-emerald-400">
                          {st.totalMarksObtained} / {st.maxTotalMarks}
                        </td>
                        <td className="p-3 text-center font-mono font-black text-white">
                          {st.percentage}%
                        </td>
                        <td className="p-3">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <select
                                value={draft.conductGrade}
                                onChange={(e) =>
                                  setRemarksDrafts((prev) => ({
                                    ...prev,
                                    [st.studentId]: {
                                      ...draft,
                                      conductGrade: e.target.value,
                                    },
                                  }))
                                }
                                className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-bold text-white"
                              >
                                <option value="A+">A+ (Exceptional)</option>
                                <option value="A">A (Excellent)</option>
                                <option value="B">B (Good)</option>
                                <option value="C">C (Satisfactory)</option>
                                <option value="Needs Improvement">Needs Improvement</option>
                              </select>

                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => handleSaveRemarks(st.studentId)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[11px] transition flex items-center gap-1 shadow-sm"
                              >
                                {isSaving ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Save className="w-3 h-3" />
                                )}
                                <span>Sign Off</span>
                              </button>
                            </div>

                            <input
                              type="text"
                              value={draft.remarks}
                              onChange={(e) =>
                                setRemarksDrafts((prev) => ({
                                  ...prev,
                                  [st.studentId]: {
                                    ...draft,
                                    remarks: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Holistic progress remarks..."
                              className="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                            />

                            {st.signedOffAt && (
                              <div className="text-[10px] text-emerald-400/90 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>
                                  Signed off by {st.signedOffByName || "Class Teacher"}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Sub-Tab 2: Homeroom Roster & 360 Profiles ─────────────────────── */}
      {subTab === "roster" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search homeroom students..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="text-xs text-slate-400 font-semibold">
              {filteredRosterStudents.length} Students Listed
            </div>
          </div>

          {rosterLoading ? (
            <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span>Loading classroom roster...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredRosterStudents.map((st) => (
                <div
                  key={st.studentId}
                  onClick={() => handleOpen360(st.studentId)}
                  className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition cursor-pointer space-y-2.5 group shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition">
                        {st.name}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Adm: {st.admissionNumber} {st.rollNumber ? `· Roll: ${st.rollNumber}` : ""}
                      </p>
                    </div>

                    {/* Fee Status Badge (Condition B full access) */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        st.feeStatus === "PAID"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : st.feeStatus === "DUE"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {st.feeStatus}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                    <span className="text-slate-400 text-[11px]">30-Day Attendance:</span>
                    <span
                      className={`font-mono font-bold ${
                        st.attendanceRate30d >= 85
                          ? "text-emerald-400"
                          : st.attendanceRate30d >= 75
                          ? "text-amber-400"
                          : "text-rose-400"
                      }`}
                    >
                      {st.attendanceRate30d}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Sub-Tab 3: Daily Morning Roll-Call Register ───────────────────── */}
      {subTab === "rollcall" && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Homeroom Lead Roll-Call: Submitting morning attendance for Class {homeroomSection.className}-{homeroomSection.sectionName} with Class Teacher statutory override.
            </span>
          </div>

          <AttendanceWorkbench
            initialSectionId={homeroomSection.sectionId}
            isModal={false}
          />
        </div>
      )}

      {/* ─── Student 360 Profile Drawer ───────────────────────────────────── */}
      <Student360Drawer
        data={selectedStudent360}
        isOpen={is360Open}
        onClose={() => setIs360Open(false)}
      />
    </div>
  );
}
