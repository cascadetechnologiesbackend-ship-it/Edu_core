"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Trash2,
  Clock,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppModal } from "@/components/ui/AppModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NextBestAction } from "@/components/ui/NextBestAction";
import {
  saveTimetablePeriod,
  deleteTimetablePeriod,
  copyMondayToAllDays,
  copyTimetableToSection,
  clearSectionTimetable,
  generateSectionTimetablePreview,
  commitSectionTimetable,
} from "@/app/(admin)/academics/actions/timetable.actions";
import type {
  ScheduleSlot,
  WorkloadFitResult,
  TimetableClash,
} from "@/lib/timetableEngine";

export const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export interface TimetableRecord {
  id: string;
  sectionId: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  periodType: string;
  subjectId: string | null;
  teacherId: string | null;
  roomNumber: string | null;
  isManualOverride?: boolean | undefined;
  subject?: {
    id: string;
    name: string;
    code?: string | undefined;
  } | null | undefined;
  teacher?: {
    id: string;
    email: string;
    name?: string | undefined;
  } | null | undefined;
}

export interface QuickTimetableProps {
  classId: string;
  sectionId: string;
  sections: Array<{ id: string; name: string }>;
  classSubjects: Array<{
    id: string;
    subjectId: string;
    assignedTeacherId?: string | null | undefined;
    subject: { id: string; name: string; code?: string | undefined; subjectType?: string | undefined };
    teacher?: { id: string; email: string } | null | undefined;
  }>;
  teachers: Array<{ id: string; email: string; name?: string | undefined }>;
  bellPeriods?: Array<{
    id: string;
    periodNumber: number;
    name: string;
    startTime: string;
    endTime: string;
    periodType?: string | undefined;
  }> | undefined;
  timetable: TimetableRecord[];
  isAdmin: boolean;
  onSectionChange?: ((newSectionId: string) => void) | undefined;
  onTimetableChanged?: (() => void) | undefined;
}

const DEFAULT_PERIODS = [
  { periodNumber: 1, name: "Period 1", startTime: "08:00", endTime: "08:45", periodType: "REGULAR" },
  { periodNumber: 2, name: "Period 2", startTime: "08:45", endTime: "09:30", periodType: "REGULAR" },
  { periodNumber: 3, name: "Period 3", startTime: "09:30", endTime: "10:15", periodType: "REGULAR" },
  { periodNumber: 4, name: "Period 4", startTime: "10:30", endTime: "11:15", periodType: "REGULAR" },
  { periodNumber: 5, name: "Period 5", startTime: "11:15", endTime: "12:00", periodType: "REGULAR" },
  { periodNumber: 6, name: "Period 6", startTime: "12:00", endTime: "12:45", periodType: "REGULAR" },
  { periodNumber: 7, name: "Period 7", startTime: "13:30", endTime: "14:15", periodType: "REGULAR" },
  { periodNumber: 8, name: "Period 8", startTime: "14:15", endTime: "15:00", periodType: "REGULAR" },
];

export function QuickTimetable({
  classId,
  sectionId,
  sections,
  classSubjects,
  teachers,
  bellPeriods,
  timetable,
  isAdmin,
  onSectionChange,
  onTimetableChanged,
}: QuickTimetableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Active periods list
  const effectivePeriods = useMemo(() => {
    if (bellPeriods && bellPeriods.length > 0) {
      return [...bellPeriods].sort((a, b) => a.periodNumber - b.periodNumber);
    }
    return DEFAULT_PERIODS;
  }, [bellPeriods]);

  // Target section for "Copy to section" tool
  const otherSections = useMemo(
    () => sections.filter((s) => s.id !== sectionId),
    [sections, sectionId],
  );
  const [targetSectionId, setTargetSectionId] = useState<string>(
    otherSections[0]?.id || "",
  );

  // Mobile active day tab state (Universal Scroll-and-Click Law: 390px zero overflow)
  const [activeMobileDay, setActiveMobileDay] = useState<DayOfWeek>("MONDAY");

  // Modals & confirmation dialog states
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [deleteSlotConfirmOpen, setDeleteSlotConfirmOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clashError, setClashError] = useState<string | null>(null);

  // Timetable Generator Preview Modal states (F13)
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    fits: boolean;
    fitReport: WorkloadFitResult;
    slots: ScheduleSlot[];
    clashes: TimetableClash[];
    needsAssignmentReport: Array<{
      subjectId: string;
      subjectName: string;
      unassignedCount: number;
    }>;
    unassignedPeriodsCount: number;
  } | null>(null);

  // Active slot editing data
  const [activeSlot, setActiveSlot] = useState<{
    day: DayOfWeek;
    periodNumber: number;
    startTime: string;
    endTime: string;
    existingEntry?: TimetableRecord | undefined;
  } | null>(null);

  const [formData, setFormData] = useState({
    subjectId: "",
    teacherId: "",
    roomNumber: "",
    periodType: "REGULAR",
  });

  // Post-mutation feedback strip state
  const [lastActionOutcome, setLastActionOutcome] = useState<string | null>(null);

  const currentSection = sections.find((s) => s.id === sectionId);

  // Open slot editor
  const handleOpenSlot = (day: DayOfWeek, period: (typeof effectivePeriods)[0]) => {
    if (!isAdmin) return;
    const existing = timetable.find(
      (t) =>
        t.sectionId === sectionId &&
        t.dayOfWeek === day &&
        t.periodNumber === period.periodNumber,
    );

    setActiveSlot({
      day,
      periodNumber: period.periodNumber,
      startTime: period.startTime,
      endTime: period.endTime,
      existingEntry: existing,
    });

    setFormData({
      subjectId: existing?.subjectId || "",
      teacherId: existing?.teacherId || "",
      roomNumber: existing?.roomNumber || "",
      periodType: existing?.periodType || period.periodType || "REGULAR",
    });

    setClashError(null);
    setShowAdvanced(false);
    setSlotModalOpen(true);
  };

  // Quick select a subject chip
  const handleSelectSubjectChip = (subjId: string) => {
    if (!subjId) {
      setFormData((prev) => ({
        ...prev,
        subjectId: "",
        teacherId: "",
      }));
      return;
    }

    const cs = classSubjects.find((c) => c.subjectId === subjId);
    setFormData((prev) => ({
      ...prev,
      subjectId: subjId,
      // Auto-suggest assigned teacher for this subject
      teacherId: cs?.assignedTeacherId || prev.teacherId,
    }));
  };

  // Save period (manually edited slots are tagged as isManualOverride: true)
  const handleSavePeriod = () => {
    if (!activeSlot || !sectionId) return;
    setClashError(null);

    startTransition(async () => {
      try {
        await saveTimetablePeriod({
          sectionId,
          dayOfWeek: activeSlot.day,
          periodNumber: activeSlot.periodNumber,
          startTime: activeSlot.startTime,
          endTime: activeSlot.endTime,
          periodType: formData.periodType as any,
          subjectId: formData.subjectId || null,
          teacherId: formData.teacherId || null,
          roomNumber: formData.roomNumber || null,
          isManualOverride: true,
        });

        toast.success(
          `Period ${activeSlot.periodNumber} (${activeSlot.day.slice(0, 3)}) saved`,
        );
        setSlotModalOpen(false);
        setLastActionOutcome(
          `Saved Period ${activeSlot.periodNumber} for ${activeSlot.day.slice(0, 3)}`,
        );

        if (onTimetableChanged) {
          onTimetableChanged();
        } else {
          router.refresh();
        }
      } catch (err: any) {
        setClashError(err?.message || "Conflict saving timetable period.");
      }
    });
  };

  // Remove single period
  const handleDeletePeriod = () => {
    if (!activeSlot?.existingEntry) return;

    startTransition(async () => {
      try {
        await deleteTimetablePeriod(activeSlot.existingEntry!.id);
        toast.success(`Removed Period ${activeSlot.periodNumber}`);
        setDeleteSlotConfirmOpen(false);
        setSlotModalOpen(false);
        setLastActionOutcome(`Cleared Period ${activeSlot.periodNumber}`);

        if (onTimetableChanged) {
          onTimetableChanged();
        } else {
          router.refresh();
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to remove period");
      }
    });
  };

  // Copy Monday to all days
  const handleCopyMonday = () => {
    if (!sectionId) return;

    startTransition(async () => {
      try {
        const res = await copyMondayToAllDays(sectionId);
        if (res.conflictCount > 0) {
          toast.warning(
            `Copied ${res.copiedCount} periods across Tue-Sat. ${res.conflictCount} periods skipped due to teacher clashes.`,
          );
        } else {
          toast.success(
            `Successfully copied Monday schedule to all days (${res.copiedCount} periods updated).`,
          );
        }
        setLastActionOutcome(`Copied Monday schedule across all days`);

        if (onTimetableChanged) {
          onTimetableChanged();
        } else {
          router.refresh();
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to copy Monday schedule");
      }
    });
  };

  // Copy to another section
  const handleCopySection = () => {
    if (!sectionId || !targetSectionId) return;

    startTransition(async () => {
      try {
        const res = await copyTimetableToSection(sectionId, targetSectionId);
        const targetName =
          sections.find((s) => s.id === targetSectionId)?.name || "target section";

        if (res.conflictCount > 0) {
          toast.warning(
            `Copied ${res.copiedCount} periods to Section ${targetName}. ${res.conflictCount} periods skipped due to teacher clashes.`,
          );
        } else {
          toast.success(
            `Successfully copied timetable to Section ${targetName} (${res.copiedCount} periods).`,
          );
        }
        setLastActionOutcome(`Copied timetable to Section ${targetName}`);

        if (onTimetableChanged) {
          onTimetableChanged();
        } else {
          router.refresh();
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to copy timetable to section");
      }
    });
  };

  // Clear full week
  const handleClearWeek = () => {
    if (!sectionId) return;

    startTransition(async () => {
      try {
        await clearSectionTimetable(sectionId);
        toast.success(
          `Weekly timetable for Section ${currentSection?.name || ""} cleared.`,
        );
        setClearConfirmOpen(false);
        setLastActionOutcome(`Cleared timetable for Section ${currentSection?.name || ""}`);

        if (onTimetableChanged) {
          onTimetableChanged();
        } else {
          router.refresh();
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to clear timetable");
      }
    });
  };

  // Open Timetable Generator Preview Modal (F13)
  const handleOpenGenerateModal = () => {
    if (!sectionId) {
      toast.error("Please select a section first.");
      return;
    }
    setGenerateModalOpen(true);
    setIsPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);

    startTransition(async () => {
      try {
        const result = await generateSectionTimetablePreview(sectionId);
        setPreviewData(result);
      } catch (err: any) {
        setPreviewError(err?.message || "Failed to generate timetable preview.");
      } finally {
        setIsPreviewLoading(false);
      }
    });
  };

  // Confirm and Apply Generated Timetable (F13)
  const handleConfirmGenerate = () => {
    if (!sectionId || !previewData?.slots) return;
    setIsCommitting(true);

    startTransition(async () => {
      try {
        const result = await commitSectionTimetable(sectionId, previewData.slots);
        if (result.success) {
          toast.success(
            `Timetable committed! ${result.upsertedCount} periods updated${
              result.deactivatedCount > 0 ? `, ${result.deactivatedCount} deactivated` : ""
            }${
              result.preservedOverridesCount ? `, ${result.preservedOverridesCount} manual overrides preserved` : ""
            }.`,
          );
          setGenerateModalOpen(false);
          setLastActionOutcome(
            `Generated and applied timetable for Section ${currentSection?.name || ""} (${result.upsertedCount} periods)`,
          );
          if (onTimetableChanged) {
            onTimetableChanged();
          } else {
            router.refresh();
          }
        } else {
          toast.error("Failed to commit generated timetable.");
        }
      } catch (err: any) {
        toast.error(err?.message || "Error committing timetable.");
      } finally {
        setIsCommitting(false);
      }
    });
  };

  const selectedClassSubject = classSubjects.find(
    (cs) => cs.subjectId === formData.subjectId,
  );
  const selectedTeacher = teachers.find((t) => t.id === formData.teacherId);

  return (
    <div className="space-y-4">
      {/* ─── TOOLBAR & CONTROLS ───────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
        {/* Left: Section switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-500 uppercase">
            Section:
          </span>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
            {sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => onSectionChange?.(sec.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition min-h-[36px] ${
                  sectionId === sec.id
                    ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Section {sec.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Generation, Copy & Clear tools (Admin only) */}
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tool: Generate Timetable (F13) */}
            <button
              type="button"
              disabled={isPending || isPreviewLoading}
              onClick={handleOpenGenerateModal}
              title="Generate deterministic timetable with workload & clash check"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/95 transition min-h-[38px] shadow-sm disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Timetable</span>
            </button>

            {/* Tool: Copy Monday */}
            <button
              type="button"
              disabled={isPending}
              onClick={handleCopyMonday}
              title="Copy Monday's periods to Tue-Sat"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition min-h-[38px] disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Copy Monday to Week</span>
              <span className="sm:hidden">Copy Mon</span>
            </button>

            {/* Tool: Copy to Section */}
            {otherSections.length > 0 && (
              <div className="inline-flex items-center gap-1 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 p-1 rounded-xl">
                <select
                  value={targetSectionId}
                  onChange={(e) => setTargetSectionId(e.target.value)}
                  className="bg-transparent text-xs font-medium text-gray-700 dark:text-gray-200 px-2 py-1 focus:outline-hidden"
                >
                  {otherSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      To Sec {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isPending || !targetSectionId}
                  onClick={handleCopySection}
                  className="px-2.5 py-1 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/95 disabled:opacity-50 transition"
                >
                  Copy
                </button>
              </div>
            )}

            {/* Tool: Clear week */}
            <button
              type="button"
              disabled={isPending}
              onClick={() => setClearConfirmOpen(true)}
              title="Clear all periods for this section"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition min-h-[38px] disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── NEXT BEST ACTION FEEDBACK STRIP ──────────────────────────────── */}
      {lastActionOutcome && (
        <NextBestAction
          outcome={lastActionOutcome}
          suggestion={
            otherSections.length > 0
              ? {
                  label: `Copy to Section ${otherSections[0]?.name}`,
                  onClick: () => {
                    if (otherSections[0]?.id) {
                      setTargetSectionId(otherSections[0].id);
                      handleCopySection();
                    }
                  },
                  primary: true,
                }
              : {
                  label: "Open Class Hub Overview",
                  href: `/academics/classes/${classId}?tab=overview`,
                  primary: true,
                }
          }
          alternates={[
            {
              label: "Review Subject Mappings",
              href: "/academics/mapping",
            },
          ]}
        />
      )}

      {/* ─── DESKTOP TIMETABLE GRID (md:block >= 768px) ───────────────────── */}
      <div className="hidden md:block bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50/75 dark:bg-slate-800/40 border-b border-gray-200 dark:border-slate-800 text-[11px] font-bold uppercase text-gray-500">
              <th className="p-3 w-32 sticky left-0 bg-gray-50 dark:bg-slate-800/90 z-10">
                Period
              </th>
              {DAYS_OF_WEEK.map((d) => (
                <th key={d} className="p-3 min-w-[140px]">
                  {d.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {effectivePeriods.map((period) => (
              <tr key={period.periodNumber} className="hover:bg-gray-50/40 dark:hover:bg-slate-800/20">
                {/* Period timing column (Sticky Left) */}
                <td className="p-3 font-semibold text-gray-700 dark:text-gray-300 bg-gray-50/50 dark:bg-slate-800/30 sticky left-0 z-10 border-r border-gray-100 dark:border-slate-800">
                  <div className="font-bold text-gray-900 dark:text-white">
                    {period.name}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                    {period.startTime} - {period.endTime}
                  </div>
                  {period.periodType && period.periodType !== "REGULAR" && (
                    <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-md">
                      {period.periodType}
                    </span>
                  )}
                </td>

                {/* Days of week */}
                {DAYS_OF_WEEK.map((day) => {
                  const entry = timetable.find(
                    (t) =>
                      t.sectionId === sectionId &&
                      t.dayOfWeek === day &&
                      t.periodNumber === period.periodNumber,
                  );

                  return (
                    <td
                      key={day}
                      onClick={() => handleOpenSlot(day, period)}
                      className={`p-2 transition align-top ${
                        isAdmin
                          ? "cursor-pointer hover:bg-primary/5 group"
                          : ""
                      }`}
                    >
                      {entry ? (
                        <div
                          className={`p-2.5 rounded-xl border transition group-hover:border-primary/40 group-hover:shadow-xs ${
                            entry.isManualOverride
                              ? "border-purple-300 dark:border-purple-800/60 bg-purple-50/50 dark:bg-purple-950/20"
                              : "border-primary/20 bg-primary/5 dark:bg-primary/10"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-gray-900 dark:text-white block truncate">
                              {entry.subject?.name || "Free Period"}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {entry.isManualOverride && (
                                <span className="text-[9px] font-bold px-1 py-0.2 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded">
                                  Manual
                                </span>
                              )}
                              {isAdmin && (
                                <span className="text-[10px] text-primary font-bold opacity-0 group-hover:opacity-100 transition">
                                  Edit
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate mt-0.5">
                            {entry.teacher?.email || "No teacher"}
                          </span>
                          {entry.roomNumber && (
                            <span className="text-[10px] text-gray-400 block font-mono mt-0.5">
                              Rm {entry.roomNumber}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="min-h-[56px] border border-dashed border-gray-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-[11px] text-gray-400 group-hover:border-primary/40 group-hover:text-primary transition">
                          {isAdmin ? (
                            <span className="inline-flex items-center gap-1 font-medium">
                              <Plus className="w-3 h-3" />
                              Add
                            </span>
                          ) : (
                            "—"
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── MOBILE REFLOW: DAY TABS & SINGLE-DAY COLUMN (< md / 390px) ───── */}
      <div className="block md:hidden space-y-3">
        {/* Day Tabs Navigation (Universal Scroll-and-Click Law: zero overflow at 390px) */}
        <div className="grid grid-cols-6 gap-1 bg-gray-100 dark:bg-slate-800/80 p-1.5 rounded-2xl">
          {DAYS_OF_WEEK.map((d) => {
            const isSelected = activeMobileDay === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setActiveMobileDay(d)}
                className={`py-2 text-xs font-bold rounded-xl transition min-h-[38px] text-center ${
                  isSelected
                    ? "bg-white dark:bg-slate-900 text-primary shadow-xs"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>

        {/* Day Header Status */}
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
            {activeMobileDay} Schedule
          </span>
          <span className="text-[11px] text-gray-400 font-medium">
            {timetable.filter((t) => t.sectionId === sectionId && t.dayOfWeek === activeMobileDay).length} of {effectivePeriods.length} periods set
          </span>
        </div>

        {/* Single-Day Vertical Period Cards */}
        <div className="space-y-2">
          {effectivePeriods.map((period) => {
            const entry = timetable.find(
              (t) =>
                t.sectionId === sectionId &&
                t.dayOfWeek === activeMobileDay &&
                t.periodNumber === period.periodNumber,
            );

            return (
              <div
                key={period.periodNumber}
                onClick={() => handleOpenSlot(activeMobileDay, period)}
                className={`p-3 rounded-2xl border transition ${
                  isAdmin ? "cursor-pointer active:scale-[0.99]" : ""
                } ${
                  entry
                    ? entry.isManualOverride
                      ? "bg-purple-50/30 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40 shadow-xs"
                      : "bg-white dark:bg-slate-900 border-primary/20 hover:border-primary/40 shadow-xs"
                    : "bg-gray-50/50 dark:bg-slate-900/40 border-dashed border-gray-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-gray-900 dark:text-white">
                      {period.name}
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">
                      {period.startTime} - {period.endTime}
                    </span>
                    {period.periodType && period.periodType !== "REGULAR" && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-md">
                        {period.periodType}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {entry?.isManualOverride && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded">
                        Manual
                      </span>
                    )}
                    {isAdmin && (
                      <span className="text-[11px] font-bold text-primary">
                        {entry ? "Edit" : "+ Add"}
                      </span>
                    )}
                  </div>
                </div>

                {entry ? (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-gray-800 dark:text-gray-100 block truncate">
                        {entry.subject?.name || "Free Period"}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 block truncate">
                        {entry.teacher?.email || "No teacher assigned"}
                      </span>
                    </div>
                    {entry.roomNumber && (
                      <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-lg shrink-0">
                        Rm {entry.roomNumber}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-400 italic">
                    Unscheduled / Free Period
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── QUICK-FILL SLOT MODAL (AppModal size="sm") ────────────────────── */}
      <AppModal
        open={slotModalOpen}
        onClose={() => setSlotModalOpen(false)}
        size="sm"
        title={
          activeSlot
            ? `Schedule ${activeSlot.day} • Period ${activeSlot.periodNumber}`
            : "Schedule Period"
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {activeSlot?.existingEntry && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setDeleteSlotConfirmOpen(true)}
                  className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition min-h-[38px] disabled:opacity-50"
                >
                  Remove Slot
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSlotModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSavePeriod}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/95 disabled:opacity-50 min-h-[38px] shadow-sm flex items-center gap-1.5"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Period</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          {/* Timing preview */}
          {activeSlot && (
            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-gray-100 dark:border-slate-800">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>
                {activeSlot.startTime} – {activeSlot.endTime}
              </span>
            </div>
          )}

          {/* Conflict Alert Banner */}
          {clashError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Scheduling Conflict</span>
                <span>{clashError}</span>
              </div>
            </div>
          )}

          {/* Quick Subject Chips */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-2">
              Select Subject (Quick-Fill)
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
              {/* Free Period Chip */}
              <button
                type="button"
                onClick={() => handleSelectSubjectChip("")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 min-h-[34px] ${
                  formData.subjectId === ""
                    ? "bg-gray-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                }`}
              >
                {formData.subjectId === "" && <Check className="w-3 h-3" />}
                <span>None / Free Period</span>
              </button>

              {/* Class Subjects Chips */}
              {classSubjects.map((cs) => {
                const isSelected = formData.subjectId === cs.subjectId;
                return (
                  <button
                    key={cs.subjectId}
                    type="button"
                    onClick={() => handleSelectSubjectChip(cs.subjectId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 min-h-[34px] ${
                      isSelected
                        ? "bg-primary text-white shadow-xs"
                        : "border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:border-primary/50"
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{cs.subject.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto-suggested Teacher Indicator */}
          {formData.subjectId && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                <strong>Assigned Teacher:</strong>{" "}
                {selectedClassSubject?.teacher?.email ||
                  selectedTeacher?.email ||
                  "None configured (set in Advanced below)"}
              </span>
            </div>
          )}

          {/* Advanced toggle */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
            >
              <span>{showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings (Teacher, Room, Type)"}</span>
              {showAdvanced ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 p-3 bg-gray-50/70 dark:bg-slate-800/40 rounded-xl border border-gray-100 dark:border-slate-800 animate-fade-in">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
                    Teacher
                  </label>
                  <select
                    value={formData.teacherId}
                    onChange={(e) =>
                      setFormData({ ...formData, teacherId: e.target.value })
                    }
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary min-h-[38px]"
                  >
                    <option value="">No Teacher / Free</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name ? `${t.name} (${t.email})` : t.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
                    Room Number
                  </label>
                  <input
                    type="text"
                    value={formData.roomNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, roomNumber: e.target.value })
                    }
                    placeholder="e.g. Rm 101, Lab 2"
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary min-h-[38px]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
                    Period Type
                  </label>
                  <select
                    value={formData.periodType}
                    onChange={(e) =>
                      setFormData({ ...formData, periodType: e.target.value })
                    }
                    className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary min-h-[38px]"
                  >
                    <option value="REGULAR">Regular Class</option>
                    <option value="LAB">Laboratory</option>
                    <option value="PT">Physical Training / Sports</option>
                    <option value="LIBRARY">Library</option>
                    <option value="ASSEMBLY">Assembly</option>
                    <option value="FREE">Free Period</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </AppModal>

      {/* ─── TIMETABLE GENERATION PREVIEW MODAL (AppModal size="2xl") ─────── */}
      <AppModal
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        size="2xl"
        title={
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary shrink-0" />
            <span>Generate Timetable Preview</span>
          </div>
        }
        description={`Deterministic automated schedule preview for Section ${currentSection?.name || ""}`}
        footer={
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 w-full">
            <button
              type="button"
              disabled={isCommitting}
              onClick={() => setGenerateModalOpen(false)}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition min-h-[38px]"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                disabled={isPreviewLoading || isCommitting}
                onClick={handleOpenGenerateModal}
                title="Re-run preview calculation"
                className="px-3 py-2 text-xs font-bold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition min-h-[38px] flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPreviewLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                type="button"
                disabled={
                  isPreviewLoading ||
                  isCommitting ||
                  !previewData ||
                  !previewData.fits
                }
                onClick={handleConfirmGenerate}
                className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/95 disabled:opacity-50 min-h-[38px] shadow-sm flex items-center justify-center gap-1.5"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Persisting Schedule...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Apply</span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          {/* Loading State */}
          {isPreviewLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Generating Deterministic Timetable...
                </p>
                <p className="text-xs text-gray-500 max-w-sm">
                  Evaluating weekly workload feasibility, anti-fatigue dispersion, unique teacher allocations, and concurrency clash checks.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {previewError && !isPreviewLoading && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block mb-0.5">Generation Failed</span>
                <span>{previewError}</span>
              </div>
            </div>
          )}

          {/* Preview Content */}
          {previewData && !isPreviewLoading && (
            <div className="space-y-4">
              {/* 1. WORKLOAD FIT REPORT */}
              <div className="rounded-2xl border border-gray-200 dark:border-slate-800 p-3.5 bg-gray-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      1. Workload Feasibility Fit
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        previewData.fits
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                          : "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                      }`}
                    >
                      {previewData.fits ? "Feasible Fit" : "Workload Deficit"}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {previewData.fitReport.message}
                </p>

                {/* Fit Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-gray-200/80 dark:border-slate-700/80">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">
                      Available Periods
                    </span>
                    <span className="text-base font-extrabold text-gray-900 dark:text-white">
                      {previewData.fitReport.availableWeeklyPeriods}
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      periods / week
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-gray-200/80 dark:border-slate-700/80">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">
                      Required Periods
                    </span>
                    <span className="text-base font-extrabold text-gray-900 dark:text-white">
                      {previewData.fitReport.totalRequiredPeriods}
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      from subject quotas
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-gray-200/80 dark:border-slate-700/80">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">
                      {previewData.fitReport.slackOrDeficit >= 0 ? "Slack / Free" : "Deficit"}
                    </span>
                    <span
                      className={`text-base font-extrabold ${
                        previewData.fitReport.slackOrDeficit >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {previewData.fitReport.slackOrDeficit >= 0
                        ? `+${previewData.fitReport.slackOrDeficit}`
                        : previewData.fitReport.slackOrDeficit}
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      periods
                    </span>
                  </div>
                </div>

                {/* Subject Quota Breakdown Table */}
                {previewData.fitReport.subjectBreakdown.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200/80 dark:border-slate-700/80 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800 text-[11px] font-bold text-gray-600 dark:text-gray-300">
                      Subject Quota Breakdown
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-slate-800/80 max-h-36 overflow-y-auto">
                      {previewData.fitReport.subjectBreakdown.map((sb) => (
                        <div
                          key={sb.subjectId}
                          className="px-3 py-1.5 flex items-center justify-between text-xs"
                        >
                          <span className="font-medium text-gray-800 dark:text-gray-200 truncate pr-2">
                            {sb.subjectName}
                          </span>
                          <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                            <span className="text-gray-500">
                              {sb.weeklyPeriods} periods/wk
                            </span>
                            <span className="font-bold text-gray-700 dark:text-gray-300 w-10 text-right">
                              {sb.percentageOfSchedule}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. CONCURRENCY CLASH REPORT */}
              <div className="rounded-2xl border border-gray-200 dark:border-slate-800 p-3.5 bg-gray-50/50 dark:bg-slate-800/30 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    2. Concurrency Clash Checks
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      previewData.clashes.length === 0
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                        : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                    }`}
                  >
                    {previewData.clashes.length === 0
                      ? "0 Clashes Detected"
                      : `${previewData.clashes.length} Clash${previewData.clashes.length > 1 ? "es" : ""}`}
                  </span>
                </div>

                {previewData.clashes.length === 0 ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Zero clashes: No teacher double-bookings or room overlaps detected across sections.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {previewData.clashes.map((c, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 font-bold mb-0.5">
                            <span>{c.type}</span>
                            <span className="text-[10px] font-mono font-normal bg-amber-200/60 dark:bg-amber-900/60 px-1.5 py-0.2 rounded">
                              Day {c.dayOfWeek} • Period {c.periodNumber}
                            </span>
                          </div>
                          <span className="text-[11px] leading-relaxed block">
                            {c.message}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. TEACHER ALLOCATION & NEEDS-ASSIGNMENT REPORT */}
              <div className="rounded-2xl border border-gray-200 dark:border-slate-800 p-3.5 bg-gray-50/50 dark:bg-slate-800/30 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    3. Teacher Allocations
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      previewData.needsAssignmentReport.length === 0
                        ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                        : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    }`}
                  >
                    {previewData.needsAssignmentReport.length === 0
                      ? "Fully Allocated"
                      : `${previewData.needsAssignmentReport.length} Need Manual Assignment`}
                  </span>
                </div>

                {previewData.needsAssignmentReport.length === 0 ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      All scheduled subjects have unique active teacher allocations and were auto-assigned.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      Subjects with 0 or multiple active teacher allocations cannot be auto-assigned uniquely. They will be scheduled with the subject assigned, but teachers must be mapped manually:
                    </p>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200/80 dark:border-slate-700/80 divide-y divide-gray-100 dark:divide-slate-800/80 max-h-36 overflow-y-auto">
                      {previewData.needsAssignmentReport.map((na) => (
                        <div
                          key={na.subjectId}
                          className="p-2.5 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                              {na.subjectName}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            {na.unassignedCount} period{na.unassignedCount > 1 ? "s" : ""} unassigned
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. SUMMARY OF SLOTS TO BE PERSISTED */}
              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>{previewData.slots.length} periods</strong> ready to apply for Section {currentSection?.name || ""}
                  </span>
                </div>
                {previewData.slots.filter((s) => s.isManualOverride).length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded shrink-0">
                    {previewData.slots.filter((s) => s.isManualOverride).length} Overrides Retained
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </AppModal>

      {/* ─── CONFIRM CLEAR TIMETABLE ──────────────────────────────────────── */}
      <ConfirmDialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={handleClearWeek}
        title="Clear Weekly Timetable?"
        itemName={`Section ${currentSection?.name || ""}`}
        consequences={[
          "All scheduled periods for this section across all days will be deleted.",
          "Any assigned teachers and rooms for these periods will be unbooked.",
          "You can re-add periods or copy from another section at any time.",
        ]}
        confirmText="Clear Timetable"
        isLoading={isPending}
      />

      {/* ─── CONFIRM DELETE SINGLE SLOT ───────────────────────────────────── */}
      <ConfirmDialog
        open={deleteSlotConfirmOpen}
        onClose={() => setDeleteSlotConfirmOpen(false)}
        onConfirm={handleDeletePeriod}
        title="Remove Timetable Period?"
        itemName={
          activeSlot
            ? `${activeSlot.day} Period ${activeSlot.periodNumber}`
            : "Period"
        }
        consequences={[
          "The assigned subject and teacher will be removed from this slot.",
          "The slot will revert to empty/unscheduled.",
        ]}
        confirmText="Remove Slot"
        isLoading={isPending}
      />
    </div>
  );
}
