"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  AlertCircle,
  Save,
  Check,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Sun,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppModal } from "@/components/ui/AppModal";
import {
  getTeacherAttendanceRoster,
  saveTeacherAttendanceRoster,
  getTeacherAssignedSections,
  type WorkbenchStudent,
  type AttendanceStatus,
} from "@/app/(teacher)/teacher/attendance/attendanceActions";

export interface AttendanceWorkbenchProps {
  initialSectionId?: string | undefined;
  initialDate?: string | undefined;
  periodId?: string | null | undefined;
  isModal?: boolean | undefined;
  isOpen?: boolean | undefined;
  onClose?: (() => void) | undefined;
  onSaved?: ((summary: string) => void) | undefined;
  locale?: string | undefined;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  {
    label: { en: string; hi: string };
    short: string;
    bg: string;
    text: string;
    border: string;
    ring: string;
  }
> = {
  PRESENT: {
    label: { en: "Present", hi: "उपस्थित" },
    short: "P",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    ring: "ring-emerald-500/40",
  },
  ABSENT: {
    label: { en: "Absent", hi: "अनुपस्थित" },
    short: "A",
    bg: "bg-rose-500/20",
    text: "text-rose-400",
    border: "border-rose-500/40",
    ring: "ring-rose-500/50",
  },
  LATE: {
    label: { en: "Late", hi: "देरी से" },
    short: "L",
    bg: "bg-amber-500/20",
    text: "text-amber-400",
    border: "border-amber-500/40",
    ring: "ring-amber-500/50",
  },
  HALF_DAY: {
    label: { en: "Half Day", hi: "आधा दिन" },
    short: "H",
    bg: "bg-purple-500/20",
    text: "text-purple-400",
    border: "border-purple-500/40",
    ring: "ring-purple-500/50",
  },
  LEAVE: {
    label: { en: "Leave", hi: "अवकाश" },
    short: "Lv",
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    border: "border-blue-500/40",
    ring: "ring-blue-500/50",
  },
  HOLIDAY: {
    label: { en: "Holiday", hi: "छुट्टी" },
    short: "Hl",
    bg: "bg-slate-500/20",
    text: "text-slate-400",
    border: "border-slate-500/40",
    ring: "ring-slate-500/50",
  },
};

// Tap cycle for single click on student card:
// PRESENT -> ABSENT -> LATE -> HALF_DAY -> LEAVE -> PRESENT
const STATUS_CYCLE: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "LEAVE",
];

export function AttendanceWorkbench({
  initialSectionId,
  initialDate,
  periodId,
  isModal = false,
  isOpen = false,
  onClose,
  onSaved,
  locale = "en",
}: AttendanceWorkbenchProps) {
  const isHi = locale === "hi";
  const todayStr = new Date().toISOString().split("T")[0] || "";

  const [sectionsList, setSectionsList] = useState<
    Array<{ id: string; name: string; className: string; displayName: string }>
  >([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    initialSectionId || ""
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || todayStr
  );
  const [students, setStudents] = useState<WorkbenchStudent[]>([]);
  const [sectionTitle, setSectionTitle] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isAlreadyMarked, setIsAlreadyMarked] = useState<boolean>(false);
  const [filter, setFilter] = useState<"ALL" | "EXCEPTIONS" | AttendanceStatus>(
    "ALL"
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSaving, startTransition] = useTransition();

  // Load sections on mount
  useEffect(() => {
    async function loadSections() {
      try {
        const secs = await getTeacherAssignedSections();
        setSectionsList(secs);
        if (!selectedSectionId && secs[0]?.id) {
          setSelectedSectionId(secs[0].id);
        }
      } catch (err: any) {
        console.error("Failed to load sections", err);
      }
    }
    loadSections();
  }, []);

  // Update selectedSectionId if initialSectionId changes
  useEffect(() => {
    if (initialSectionId) {
      setSelectedSectionId(initialSectionId);
    }
  }, [initialSectionId]);

  // Load roster when selectedSectionId or selectedDate changes
  useEffect(() => {
    if (!selectedSectionId) return;

    let isMounted = true;
    async function fetchRoster() {
      setLoading(true);
      try {
        const data = await getTeacherAttendanceRoster(
          selectedSectionId,
          selectedDate
        );
        if (isMounted) {
          setStudents(data.students);
          setSectionTitle(`${data.className} - Section ${data.sectionName}`);
          setIsAlreadyMarked(data.isAlreadyMarked);
        }
      } catch (err: any) {
        if (isMounted) {
          toast.error(err?.message || "Failed to load attendance roster");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchRoster();
    return () => {
      isMounted = false;
    };
  }, [selectedSectionId, selectedDate]);

  // Cycle student status on card click: PRESENT -> ABSENT -> LATE -> HALF_DAY -> LEAVE -> PRESENT
  const cycleStudentStatus = (studentId: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;
        const currentIndex = STATUS_CYCLE.indexOf(s.status);
        const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
        const nextStatus = STATUS_CYCLE[nextIndex] || "PRESENT";
        return { ...s, status: nextStatus };
      })
    );
  };

  // Direct status tap
  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
  };

  // Quick reset: Mark all non-leave students PRESENT
  const handleMarkAllPresent = () => {
    setStudents((prev) =>
      prev.map((s) =>
        s.isPreApprovedLeave ? s : { ...s, status: "PRESENT" }
      )
    );
    toast.info(
      isHi
        ? "सभी विद्यार्थियों को उपस्थित चिह्नित किया गया"
        : "Reset all non-leave students to Present"
    );
  };

  // Save attendance handler
  const handleSave = () => {
    if (!selectedSectionId || students.length === 0) return;

    startTransition(async () => {
      try {
        const result = await saveTeacherAttendanceRoster({
          sectionId: selectedSectionId,
          dateStr: selectedDate,
          periodId: periodId || null,
          records: students.map((s) => ({
            studentId: s.studentId,
            status: s.status,
            remarks: s.remarks,
          })),
        });

        if (result.success) {
          toast.success(result.summaryToast);
          setIsAlreadyMarked(true);
          if (onSaved) onSaved(result.summaryToast);
          if (isModal && onClose) onClose();
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to submit roll call");
      }
    });
  };

  // Live count computations
  const totalStudents = students.length;
  const presentCount = students.filter((s) => s.status === "PRESENT").length;
  const absentCount = students.filter((s) => s.status === "ABSENT").length;
  const lateCount = students.filter((s) => s.status === "LATE").length;
  const halfDayCount = students.filter((s) => s.status === "HALF_DAY").length;
  const leaveCount = students.filter((s) => s.status === "LEAVE").length;
  const exceptionCount = totalStudents - presentCount;

  // Filtered student list
  const filteredStudents = students.filter((s) => {
    // Search matching
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    const roll = (s.rollNumber || "").toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) ||
      roll.includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Tab filter matching
    if (filter === "ALL") return true;
    if (filter === "EXCEPTIONS") return s.status !== "PRESENT";
    return s.status === filter;
  });

  // Inner workbench UI content
  const content = (
    <div className="flex flex-col h-full space-y-4" data-testid="attendance-workbench">
      {/* ─── 1. Controls Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-sm shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {/* Section Dropdown */}
          <div className="relative flex-1 sm:max-w-xs">
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-xs font-bold appearance-none pr-8 focus:outline-none focus:border-emerald-500 shadow-xs"
              data-testid="section-select"
            >
              {sectionsList.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.displayName}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Date Input */}
          <div className="relative shrink-0">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500 shadow-xs"
              data-testid="date-picker"
            />
          </div>
        </div>

        {/* Quick Reset Button */}
        <button
          type="button"
          onClick={handleMarkAllPresent}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all shrink-0 active:scale-95 shadow-xs"
          data-testid="mark-all-present-btn"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isHi ? "सभी उपस्थित" : "All Present"}</span>
        </button>
      </div>

      {/* ─── 2. Real-time Counter Pills ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 shrink-0">
        <div
          onClick={() => setFilter("ALL")}
          className={cn(
            "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-xs",
            filter === "ALL"
              ? "bg-slate-800 border-slate-600 text-white ring-1 ring-slate-500/50"
              : "bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60"
          )}
          data-testid="counter-total"
        >
          <div className="flex items-center gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">{isHi ? "कुल" : "Total"}</span>
          </div>
          <span className="text-sm font-black">{totalStudents}</span>
        </div>

        <div
          onClick={() => setFilter("PRESENT")}
          className={cn(
            "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-xs",
            filter === "PRESENT"
              ? "bg-emerald-500/25 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-400/50"
              : "bg-emerald-950/20 border-emerald-900/40 text-emerald-400 hover:bg-emerald-950/40"
          )}
          data-testid="counter-present"
        >
          <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">{isHi ? "उपस्थित" : "Present"}</span>
          </div>
          <span className="text-sm font-black">{presentCount}</span>
        </div>

        <div
          onClick={() => setFilter("ABSENT")}
          className={cn(
            "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-xs",
            filter === "ABSENT"
              ? "bg-rose-500/25 border-rose-500/50 text-rose-300 ring-1 ring-rose-400/50"
              : "bg-rose-950/20 border-rose-900/40 text-rose-400 hover:bg-rose-950/40"
          )}
          data-testid="counter-absent"
        >
          <div className="flex items-center gap-1.5 text-xs">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-semibold">{isHi ? "अनुपस्थित" : "Absent"}</span>
          </div>
          <span className="text-sm font-black">{absentCount}</span>
        </div>

        <div
          onClick={() => setFilter("LATE")}
          className={cn(
            "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between shadow-xs",
            filter === "LATE"
              ? "bg-amber-500/25 border-amber-500/50 text-amber-300 ring-1 ring-amber-400/50"
              : "bg-amber-950/20 border-amber-900/40 text-amber-400 hover:bg-amber-950/40"
          )}
          data-testid="counter-late"
        >
          <div className="flex items-center gap-1.5 text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">{isHi ? "देरी" : "Late"}</span>
          </div>
          <span className="text-sm font-black">{lateCount}</span>
        </div>

        <div
          onClick={() => setFilter("LEAVE")}
          className={cn(
            "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between col-span-2 sm:col-span-1 shadow-xs",
            filter === "LEAVE"
              ? "bg-blue-500/25 border-blue-500/50 text-blue-300 ring-1 ring-blue-400/50"
              : "bg-blue-950/20 border-blue-900/40 text-blue-400 hover:bg-blue-950/40"
          )}
          data-testid="counter-leave"
        >
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold">{isHi ? "अवकाश" : "Leave"}</span>
          </div>
          <span className="text-sm font-black">{leaveCount}</span>
        </div>
      </div>

      {/* ─── 3. Filter and Fast Search Bar ──────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={cn(
              "text-xs px-2.5 py-1 rounded-lg font-bold transition-all shrink-0",
              filter === "ALL"
                ? "bg-white text-slate-900"
                : "text-slate-400 hover:text-white bg-slate-900/80"
            )}
          >
            {isHi ? "सभी" : "All"} ({totalStudents})
          </button>
          <button
            type="button"
            onClick={() => setFilter("EXCEPTIONS")}
            className={cn(
              "text-xs px-2.5 py-1 rounded-lg font-bold transition-all shrink-0",
              filter === "EXCEPTIONS"
                ? "bg-amber-500 text-slate-950"
                : "text-amber-400 hover:text-amber-300 bg-amber-500/10"
            )}
            data-testid="filter-exceptions"
          >
            {isHi ? "अपवाद" : "Exceptions"} ({exceptionCount})
          </button>
        </div>

        <input
          type="text"
          placeholder={isHi ? "नाम या रोल नंबर खोजें..." : "Search name or roll..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-1.5 w-36 sm:w-48 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500 shadow-xs"
        />
      </div>

      {/* ─── 4. Student Roster Grid ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-[300px] max-h-[50vh]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">
              {isHi ? "रोस्टर लोड हो रहा है..." : "Loading student roster..."}
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            {isHi ? "कोई विद्यार्थी नहीं मिला।" : "No students found matching filter."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredStudents.map((student) => {
              const cfg = STATUS_CONFIG[student.status];
              const initials = `${student.firstName[0] || ""}${
                student.lastName[0] || ""
              }`.toUpperCase();

              return (
                <div
                  key={student.studentId}
                  onClick={() => cycleStudentStatus(student.studentId)}
                  className={cn(
                    "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 relative select-none shadow-xs group",
                    cfg.bg,
                    cfg.border,
                    "hover:shadow-md hover:border-slate-600 active:scale-[0.99]"
                  )}
                  data-testid={`student-row-${student.studentId}`}
                >
                  {/* Left: Avatar & Info */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-800/90 border border-slate-700/80 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate">
                          {student.firstName} {student.lastName}
                        </span>
                        {student.rollNumber && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 shrink-0">
                            #{student.rollNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {student.isPreApprovedLeave && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                            <Calendar className="w-2.5 h-2.5" />
                            {isHi ? "स्वीकृत अवकाश" : "Planned Leave"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Direct Tap Selector Chips */}
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()} // Don't trigger card cycle when tapping direct chips
                  >
                    {(["PRESENT", "ABSENT", "LATE"] as AttendanceStatus[]).map(
                      (st) => {
                        const stCfg = STATUS_CONFIG[st];
                        const isSelected = student.status === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              setStudentStatus(student.studentId, st)
                            }
                            className={cn(
                              "w-7 h-7 rounded-lg text-xs font-black transition-all flex items-center justify-center",
                              isSelected
                                ? `${stCfg.bg} ${stCfg.text} border ${stCfg.border} ring-1 ${stCfg.ring} shadow-xs scale-105`
                                : "bg-slate-950/50 text-slate-500 hover:text-slate-300 border border-slate-800/60"
                            )}
                            data-testid={`student-${student.studentId}-chip-${st}`}
                          >
                            {stCfg.short}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 5. Sticky Footer / Save Bar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80 shrink-0">
        <div className="text-xs text-slate-400 font-medium">
          {sectionTitle && <span className="text-white font-bold">{sectionTitle}</span>}
          <span className="mx-2">•</span>
          <span>
            {isHi
              ? `${totalStudents} विद्यार्थी: ${presentCount} उपस्थित, ${absentCount} अनुपस्थित`
              : `${totalStudents} students: ${presentCount} Present, ${absentCount} Absent, ${lateCount} Late`}
          </span>
          {isAlreadyMarked && (
            <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <Check className="w-3 h-3" /> {isHi ? "दर्ज" : "Saved"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              {isHi ? "रद्द करें" : "Cancel"}
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || loading || totalStudents === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-md shadow-emerald-950/40"
            data-testid="save-attendance-btn"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isHi ? "सहेजा जा रहा है..." : "Saving..."}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>
                  {isHi ? "उपस्थिति सहेजें" : "Save Section Attendance"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // If rendered as AppModal
  if (isModal) {
    return (
      <AppModal
        open={isOpen}
        onClose={onClose || (() => {})}
        size="xl"
        title={
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="font-bold text-white text-base">
              {isHi ? "दैनिक उपस्थिति रजिस्टर" : "Daily Attendance Workbench"}
            </span>
          </div>
        }
        description={
          isHi
            ? "कक्षा के लिए उपस्थिति दर्ज करें। अनुपस्थित या लेट विद्यार्थियों पर टैप करें।"
            : "Mark section roll call. Tap on students to record exceptions."
        }
      >
        {content}
      </AppModal>
    );
  }

  // Rendered embedded/inline
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-4 sm:p-5 shadow-lg">
      {content}
    </div>
  );
}

export default AttendanceWorkbench;
