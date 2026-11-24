"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import {
  getAssignedSections,
  getSectionStudents,
  markSectionAttendance,
} from "./actions";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

type Section = {
  id: string;
  name: string;
  class?: {
    displayName: string;
  } | null;
};

type StudentRecord = {
  studentId: string;
  rollNumber: string | null;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  attendanceStatus:
    "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE" | "HOLIDAY" | null;
  remarks: string;
};

interface AttendanceManagerProps {
  initialSections?: Section[];
  initialStudents?: StudentRecord[];
  initialSelectedSection?: string;
  initialSelectedDate?: string;
}

export default function AttendanceManager({
  initialSections,
  initialStudents,
  initialSelectedSection,
  initialSelectedDate,
}: AttendanceManagerProps = {}) {
  const [sectionsList, setSectionsList] = useState<Section[]>(initialSections || []);
  const [selectedSection, setSelectedSection] = useState<string>(
    initialSelectedSection || (initialSections && initialSections[0]?.id) || "",
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    initialSelectedDate || new Date().toISOString().split("T")[0] || "",
  );
  const [students, setStudents] = useState<StudentRecord[]>(initialStudents || []);

  const [isPending, startTransition] = useTransition();
  const [loadingSections, setLoadingSections] = useState(!initialSections || initialSections.length === 0);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const isFirstRender = useRef(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load sections on mount only if not already provided by server
  useEffect(() => {
    if (initialSections && initialSections.length > 0) return;

    getAssignedSections()
      .then((data) => {
        setSectionsList(data as any);
        if (data.length > 0 && data[0]) {
          setSelectedSection(data[0].id);
        }
      })
      .catch((err) => {
        console.error(err);
        setMessage({
          type: "error",
          text: "Failed to load sections. Make sure you are authenticated.",
        });
      })
      .finally(() => {
        setLoadingSections(false);
      });
  }, [initialSections]);

  // Fetch students when section or date changes (skip on first render if already provided)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (initialStudents && initialStudents.length > 0) {
        return;
      }
    }

    if (!selectedSection || !selectedDate) return;

    setLoadingStudents(true);
    setMessage(null);
    getSectionStudents(selectedSection, selectedDate)
      .then((data) => {
        setStudents(data as any);
      })
      .catch((err) => {
        console.error(err);
        setMessage({ type: "error", text: "Failed to fetch students list." });
      })
      .finally(() => {
        setLoadingStudents(false);
      });
  }, [selectedSection, selectedDate]);

  const handleStatusChange = (
    studentId: string,
    status: StudentRecord["attendanceStatus"],
  ) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.studentId === studentId ? { ...s, attendanceStatus: status } : s,
      ),
    );
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, remarks } : s)),
    );
  };

  const handleMarkAll = (status: "PRESENT" | "ABSENT") => {
    setStudents((prev) =>
      prev.map((s) => ({ ...s, attendanceStatus: status })),
    );
  };

  const handleSave = () => {
    setMessage(null);
    const incomplete = students.some((s) => s.attendanceStatus === null);
    if (incomplete) {
      setMessage({
        type: "error",
        text: "Please select attendance status for all students before saving.",
      });
      return;
    }

    startTransition(async () => {
      try {
        await markSectionAttendance(
          selectedSection,
          selectedDate,
          students.map((s) => ({
            studentId: s.studentId,
            status: s.attendanceStatus!,
            remarks: s.remarks,
          })),
        );
        setMessage({
          type: "success",
          text: "Attendance marked successfully! Logs written to compliance trail.",
        });
      } catch (err: any) {
        setMessage({
          type: "error",
          text: err.message || "Failed to save attendance.",
        });
      }
    });
  };

  if (loadingSections) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-gray-500">Loading classrooms…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-card p-5 rounded-2xl shadow-level-1 border border-border/40">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Classroom / Section
          </label>
          {sectionsList.length === 0 ? (
            <p className="text-sm text-semantic-attention bg-semantic-attention/10 p-2.5 rounded-xl border border-semantic-attention/20">
              No classrooms assigned.
            </p>
          ) : (
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-muted/40 hover:bg-muted/60 text-foreground px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-[44px] transition"
            >
              {sectionsList.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.class?.displayName ? `${sec.class.displayName} - ` : ""}Section {sec.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Attendance Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-muted/40 hover:bg-muted/60 text-foreground px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-h-[44px] transition"
            />
            <Calendar className="absolute right-3.5 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div className="flex items-end gap-2.5">
          <button
            onClick={() => handleMarkAll("PRESENT")}
            disabled={students.length === 0 || loadingStudents}
            className="flex-1 bg-semantic-money-in/12 text-semantic-money-in border border-semantic-money-in/25 font-semibold py-2.5 rounded-xl hover:bg-semantic-money-in/20 active:scale-[0.98] transition text-xs sm:text-sm min-h-[44px] disabled:opacity-50"
          >
            Mark All Present
          </button>
          <button
            onClick={() => handleMarkAll("ABSENT")}
            disabled={students.length === 0 || loadingStudents}
            className="flex-1 bg-semantic-money-owed/12 text-semantic-money-owed border border-semantic-money-owed/25 font-semibold py-2.5 rounded-xl hover:bg-semantic-money-owed/20 active:scale-[0.98] transition text-xs sm:text-sm min-h-[44px] disabled:opacity-50"
          >
            Mark All Absent
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border ${
            message.type === "success"
              ? "bg-semantic-money-in/12 text-semantic-money-in border-semantic-money-in/25"
              : "bg-semantic-money-owed/12 text-semantic-money-owed border-semantic-money-owed/25"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Student List */}
      <div className="bg-card rounded-2xl shadow-level-1 border border-border/40 overflow-hidden">
        {loadingStudents ? (
          <div className="flex flex-col justify-center items-center py-20 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-sm text-muted-foreground">
              Retrieving classroom register…
            </span>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground/60" />
            <p className="text-sm">No students found enrolled in this section.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/30 text-muted-foreground uppercase text-[11px] font-semibold tracking-wider border-b border-border/40">
                  <tr>
                    <th className="px-6 py-3.5 w-16">Roll No</th>
                    <th className="px-6 py-3.5">Student Name</th>
                    <th className="px-6 py-3.5">Admission No</th>
                    <th className="px-6 py-3.5 w-[450px]">Attendance Status</th>
                    <th className="px-6 py-3.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {students.map((student) => (
                    <tr
                      key={student.studentId}
                      className="hover:bg-muted/30 transition"
                    >
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {student.rollNumber || "—"}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {student.admissionNumber}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {[
                            {
                              value: "PRESENT",
                              label: "Present",
                              color:
                                "peer-checked:bg-semantic-money-in peer-checked:text-white",
                            },
                            {
                              value: "ABSENT",
                              label: "Absent",
                              color:
                                "peer-checked:bg-semantic-money-owed peer-checked:text-white",
                            },
                            {
                              value: "LATE",
                              label: "Late",
                              color:
                                "peer-checked:bg-semantic-attention peer-checked:text-white",
                            },
                            {
                              value: "HALF_DAY",
                              label: "Half Day",
                              color:
                                "peer-checked:bg-semantic-attention peer-checked:text-white",
                            },
                            {
                              value: "LEAVE",
                              label: "Leave",
                              color:
                                "peer-checked:bg-semantic-interactive peer-checked:text-white",
                            },
                            {
                              value: "HOLIDAY",
                              label: "Holiday",
                              color:
                                "peer-checked:bg-muted-foreground peer-checked:text-white",
                            },
                          ].map((opt) => (
                            <label
                              key={opt.value}
                              className="relative flex-1 text-center cursor-pointer select-none"
                            >
                              <input
                                type="radio"
                                name={`attendance-${student.studentId}`}
                                value={opt.value}
                                checked={student.attendanceStatus === opt.value}
                                onChange={() =>
                                  handleStatusChange(
                                    student.studentId,
                                    opt.value as any,
                                  )
                                }
                                className="peer sr-only"
                              />
                              <span
                                className={`block px-2.5 py-1 text-xs font-semibold rounded-md border border-border/40 text-muted-foreground bg-transparent hover:bg-muted/40 transition ${opt.color}`}
                              >
                                {opt.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={student.remarks}
                          onChange={(e) =>
                            handleRemarksChange(student.studentId, e.target.value)
                          }
                          placeholder="Optional remarks"
                          className="w-full text-xs rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-semantic-interactive"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (< 768px per UX-R47: Card Morphology & UX-R21: 44px tap targets) */}
            <div className="block md:hidden divide-y divide-border/40 p-2 sm:p-3 space-y-3">
              {students.map((student) => (
                <div
                  key={student.studentId}
                  className="p-3.5 bg-card rounded-xl border border-border/40 space-y-3 shadow-xs"
                >
                  {/* Student Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-shrink-0 px-2 py-0.5 text-xs font-bold rounded-md bg-semantic-interactive/10 text-semantic-interactive border border-semantic-interactive/20">
                        #{student.rollNumber || "—"}
                      </span>
                      <h4 className="font-semibold text-sm text-foreground truncate">
                        {student.firstName} {student.lastName}
                      </h4>
                    </div>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0 font-mono">
                      {student.admissionNumber}
                    </span>
                  </div>

                  {/* Attendance Status Buttons: 44px height tap targets */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      {
                        value: "PRESENT",
                        label: "Present",
                        activeClass: "bg-semantic-money-in text-white border-semantic-money-in font-bold shadow-xs",
                      },
                      {
                        value: "ABSENT",
                        label: "Absent",
                        activeClass: "bg-semantic-money-owed text-white border-semantic-money-owed font-bold shadow-xs",
                      },
                      {
                        value: "LATE",
                        label: "Late",
                        activeClass: "bg-semantic-attention text-white border-semantic-attention font-bold shadow-xs",
                      },
                      {
                        value: "HALF_DAY",
                        label: "Half Day",
                        activeClass: "bg-semantic-attention text-white border-semantic-attention font-bold shadow-xs",
                      },
                      {
                        value: "LEAVE",
                        label: "Leave",
                        activeClass: "bg-semantic-interactive text-white border-semantic-interactive font-bold shadow-xs",
                      },
                      {
                        value: "HOLIDAY",
                        label: "Holiday",
                        activeClass: "bg-muted-foreground text-white border-muted-foreground font-bold shadow-xs",
                      },
                    ].map((opt) => {
                      const isSelected = student.attendanceStatus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            handleStatusChange(
                              student.studentId,
                              opt.value as any,
                            )
                          }
                          className={`min-h-[44px] flex items-center justify-center text-xs rounded-xl border transition-all active:scale-95 ${
                            isSelected
                              ? opt.activeClass
                              : "border-border/40 bg-card text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Remarks input */}
                  <div>
                    <input
                      type="text"
                      value={student.remarks}
                      onChange={(e) =>
                        handleRemarksChange(student.studentId, e.target.value)
                      }
                      placeholder="Optional remarks…"
                      className="w-full text-sm rounded-lg border border-border/40 bg-muted/40 px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-semantic-interactive/40"
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Desktop Footer Actions */}
        {students.length > 0 && !loadingStudents && (
          <div className="hidden md:flex bg-muted/20 px-6 py-4 justify-end border-t border-border/40">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="bg-semantic-interactive hover:bg-semantic-interactive/90 active:scale-[0.98] text-white font-semibold py-2.5 px-6 rounded-xl shadow-xs min-h-[44px] transition-all disabled:opacity-60 flex items-center gap-2 text-sm"
            >
              {isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving Attendance…
                </>
              ) : (
                "Save Attendance"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Mobile Sticky Action Bar (UX-R20: Bottom Thumb Zone) */}
      {students.length > 0 && !loadingStudents && (
        <div className="md:hidden sticky bottom-16 left-0 right-0 p-3.5 bg-card/85 backdrop-blur-xl border border-border/40 rounded-2xl shadow-level-3 flex items-center justify-between gap-3 z-30">
          <div className="text-xs">
            <p className="font-semibold text-foreground">
              {students.filter((s) => s.attendanceStatus === "PRESENT").length} Present /{" "}
              {students.filter((s) => s.attendanceStatus === "ABSENT").length} Absent
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Total {students.length} students
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={isPending}
            className="min-h-[44px] bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
          >
            {isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Register"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
