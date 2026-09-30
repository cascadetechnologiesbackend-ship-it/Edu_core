"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  Layers,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import {
  saveCalendarEvent,
  archiveCalendarEvent,
  saveAcademicTerm,
  deleteAcademicTerm,
} from "../../actions/calendar.actions";

type Term = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  sortOrder: number;
  isActive: boolean;
};

type CalendarEvent = {
  id: string;
  termId: string | null;
  title: string;
  eventType:
    | "HOLIDAY"
    | "EVENT"
    | "EXAM"
    | "PTM"
    | "SPORTS"
    | "CULTURAL"
    | "WORKING_SATURDAY"
    | "VACATION";
  startDate: string;
  endDate: string;
  description: string | null;
  isWorkingDay: boolean;
  term?: { name: string } | null;
};

const DEFAULT_EVENT_COLOR = {
  bg: "bg-blue-50 dark:bg-blue-950/40",
  text: "text-blue-700 dark:text-blue-300",
  border: "border-blue-200 dark:border-blue-800",
};

const getTodayDateStr = () => new Date().toISOString().slice(0, 10);

const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  HOLIDAY: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  EVENT: DEFAULT_EVENT_COLOR,
  EXAM: { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  PTM: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  SPORTS: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  CULTURAL: { bg: "bg-pink-50 dark:bg-pink-950/40", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
  WORKING_SATURDAY: { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  VACATION: { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
};

export default function CalendarClient({
  initialTerms,
  initialEvents,
  activeYearName,
  isAdmin,
}: {
  initialTerms: Term[];
  initialEvents: CalendarEvent[];
  activeYearName: string;
  isAdmin: boolean;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [terms, setTerms] = useState<Term[]>(initialTerms);
  const [isPending, startTransition] = useTransition();

  // Event modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventFormData, setEventFormData] = useState({
    title: "",
    eventType: "HOLIDAY" as CalendarEvent["eventType"],
    startDate: getTodayDateStr(),
    endDate: getTodayDateStr(),
    termId: "",
    description: "",
    isWorkingDay: false,
  });

  // Term modal state
  const [showTermModal, setShowTermModal] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [termFormData, setTermFormData] = useState({
    name: "",
    startDate: getTodayDateStr(),
    endDate: getTodayDateStr(),
    sortOrder: 1,
  });

  // Month navigation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Format date helper: YYYY-MM-DD
  const formatDateStr = (d: number) => {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  };

  // Open event creation modal for a specific day
  const handleOpenAddEvent = (dayStr?: string) => {
    const selectedDate = dayStr || formatDateStr(new Date().getDate());
    setEditingEvent(null);
    setEventFormData({
      title: "",
      eventType: "HOLIDAY",
      startDate: selectedDate,
      endDate: selectedDate,
      termId: terms[0]?.id || "",
      description: "",
      isWorkingDay: false,
    });
    setShowEventModal(true);
  };

  const handleEditEvent = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setEventFormData({
      title: ev.title,
      eventType: ev.eventType,
      startDate: ev.startDate,
      endDate: ev.endDate,
      termId: ev.termId || "",
      description: ev.description || "",
      isWorkingDay: ev.isWorkingDay,
    });
    setShowEventModal(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await saveCalendarEvent({
          ...(editingEvent ? { id: editingEvent.id } : {}),
          title: eventFormData.title,
          eventType: eventFormData.eventType,
          startDate: eventFormData.startDate,
          endDate: eventFormData.endDate,
          termId: eventFormData.termId || null,
          description: eventFormData.description || null,
          isWorkingDay: eventFormData.isWorkingDay,
        });

        // Update local events state optimistically
        const selectedTerm = terms.find((t) => t.id === eventFormData.termId);
        const termPayload = selectedTerm ? { name: selectedTerm.name } : null;

        if (editingEvent) {
          setEvents((prev) =>
            prev.map((ev) =>
              ev.id === editingEvent.id
                ? {
                    ...ev,
                    title: eventFormData.title,
                    eventType: eventFormData.eventType,
                    startDate: eventFormData.startDate,
                    endDate: eventFormData.endDate,
                    termId: eventFormData.termId || null,
                    description: eventFormData.description || null,
                    isWorkingDay: eventFormData.isWorkingDay,
                    term: termPayload,
                  }
                : ev,
            ),
          );
        } else {
          setEvents((prev) => [
            ...prev,
            {
              id: `evt-${Date.now()}`,
              title: eventFormData.title,
              eventType: eventFormData.eventType,
              startDate: eventFormData.startDate,
              endDate: eventFormData.endDate,
              termId: eventFormData.termId || null,
              description: eventFormData.description || null,
              isWorkingDay: eventFormData.isWorkingDay,
              term: termPayload,
            },
          ]);
        }
        setShowEventModal(false);
      } catch (err: any) {
        alert(err?.message || "Failed to save event");
      }
    });
  };

  const handleDeleteEvent = (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    startTransition(async () => {
      await archiveCalendarEvent(id);
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      setShowEventModal(false);
    });
  };

  // Term creation / edit handlers
  const handleOpenAddTerm = () => {
    setEditingTerm(null);
    setTermFormData({
      name: `Term ${terms.length + 1}`,
      startDate: getTodayDateStr(),
      endDate: getTodayDateStr(),
      sortOrder: terms.length + 1,
    });
    setShowTermModal(true);
  };

  const handleSaveTerm = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await saveAcademicTerm({
          ...(editingTerm ? { id: editingTerm.id } : {}),
          name: termFormData.name,
          startDate: termFormData.startDate,
          endDate: termFormData.endDate,
          sortOrder: termFormData.sortOrder,
        });

        if (editingTerm) {
          setTerms((prev) =>
            prev.map((t) =>
              t.id === editingTerm.id
                ? {
                    ...t,
                    name: termFormData.name,
                    startDate: termFormData.startDate,
                    endDate: termFormData.endDate,
                    sortOrder: termFormData.sortOrder,
                  }
                : t,
            ),
          );
        } else {
          setTerms((prev) => [
            ...prev,
            {
              id: `term-${Date.now()}`,
              name: termFormData.name,
              startDate: termFormData.startDate,
              endDate: termFormData.endDate,
              sortOrder: termFormData.sortOrder,
              isActive: true,
            },
          ]);
        }
        setShowTermModal(false);
      } catch (err: any) {
        alert(err?.message || "Failed to save term");
      }
    });
  };

  const handleDeleteTerm = (id: string) => {
    if (!confirm("Are you sure you want to delete this term?")) return;
    startTransition(async () => {
      await deleteAcademicTerm(id);
      setTerms((prev) => prev.filter((t) => t.id !== id));
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb & Top Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/academics" className="hover:text-primary transition flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Academics Hub
            </Link>
            <span>/</span>
            <span>Setup</span>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">Academic Calendar</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Academic Calendar & Terms
          </h1>
          <p className="text-xs text-gray-500">
            Configure terms, holidays, exam dates, vacations, and PTM schedules for {activeYearName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={handleOpenAddTerm}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 text-gray-700 dark:text-gray-200 transition shadow-xs"
              >
                + Add Term
              </button>
              <button
                onClick={() => handleOpenAddEvent()}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/95 text-white transition shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Event
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Terms Horizontal Strip ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Academic Terms ({terms.length})
            </h3>
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenAddTerm}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Configure Terms
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {terms.map((t) => (
            <div
              key={t.id}
              className="p-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  {t.name}
                </span>
                <span className="text-[11px] text-gray-400">
                  {t.startDate} to {t.endDate}
                </span>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleDeleteTerm(t.id)}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {terms.length === 0 && (
            <div className="col-span-full text-center py-4 text-xs text-gray-400">
              No academic terms configured yet. Click "+ Add Term" above.
            </div>
          )}
        </div>
      </div>

      {/* ─── Calendar Grid with Month Controls ─────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Month Header */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {monthNames[month]} {year}
            </h2>
            <button
              onClick={goToToday}
              className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white px-2 py-0.5 rounded-md border border-gray-200 dark:border-slate-700"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-800 text-center text-[11px] font-bold uppercase text-gray-400 bg-gray-50/50 dark:bg-slate-800/20 py-2.5">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Calendar Day Cells */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-gray-100 dark:divide-slate-800/80 border-b border-gray-100 dark:border-slate-800">
          {/* Empty cells before month starts */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[110px] bg-gray-50/20 dark:bg-slate-900/40 p-2" />
          ))}

          {/* Days of current month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = formatDateStr(dayNum);
            const isToday =
              new Date().toISOString().split("T")[0] === dateStr;

            // Find events for this date
            const dayEvents = events.filter(
              (ev) => dateStr >= ev.startDate && dateStr <= ev.endDate,
            );

            return (
              <div
                key={dayNum}
                onClick={() => isAdmin && handleOpenAddEvent(dateStr)}
                className={`min-h-[110px] p-2 transition cursor-pointer hover:bg-gray-50/80 dark:hover:bg-slate-800/50 flex flex-col justify-between ${
                  isToday ? "bg-primary/5 dark:bg-primary/10" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday
                        ? "bg-primary text-white"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {dayNum}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-semibold text-gray-400">
                      {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                {/* Day events pills */}
                <div className="space-y-1 overflow-hidden">
                  {dayEvents.slice(0, 3).map((ev) => {
                    const style =
                      EVENT_TYPE_COLORS[ev.eventType] ?? DEFAULT_EVENT_COLOR;
                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAdmin) handleEditEvent(ev);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate border ${style.bg} ${style.text} ${style.border}`}
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-gray-400 font-semibold pl-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Event Creation / Edit Modal ───────────────────────────────────── */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEvent}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editingEvent ? "Edit Calendar Event" : "Create Calendar Event"}
              </h3>
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Event Title
              </label>
              <input
                type="text"
                required
                value={eventFormData.title}
                onChange={(e) =>
                  setEventFormData({ ...eventFormData, title: e.target.value })
                }
                placeholder="e.g. Independence Day, Term 1 Exams"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Event Type
                </label>
                <select
                  value={eventFormData.eventType}
                  onChange={(e) =>
                    setEventFormData({
                      ...eventFormData,
                      eventType: e.target.value as any,
                    })
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="HOLIDAY">Holiday</option>
                  <option value="EVENT">School Event</option>
                  <option value="EXAM">Examination</option>
                  <option value="PTM">Parent-Teacher Meeting</option>
                  <option value="SPORTS">Sports Day</option>
                  <option value="CULTURAL">Cultural Event</option>
                  <option value="WORKING_SATURDAY">Working Saturday</option>
                  <option value="VACATION">Vacation / Break</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Academic Term
                </label>
                <select
                  value={eventFormData.termId}
                  onChange={(e) =>
                    setEventFormData({
                      ...eventFormData,
                      termId: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="">No specific term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={eventFormData.startDate}
                  onChange={(e) =>
                    setEventFormData({
                      ...eventFormData,
                      startDate: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={eventFormData.endDate}
                  onChange={(e) =>
                    setEventFormData({
                      ...eventFormData,
                      endDate: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Description / Notes
              </label>
              <textarea
                rows={2}
                value={eventFormData.description}
                onChange={(e) =>
                  setEventFormData({
                    ...eventFormData,
                    description: e.target.value,
                  })
                }
                placeholder="Optional details or instructions..."
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isWorkingDay"
                checked={eventFormData.isWorkingDay}
                onChange={(e) =>
                  setEventFormData({
                    ...eventFormData,
                    isWorkingDay: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300"
              />
              <label htmlFor="isWorkingDay" className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                Counts as a Working Day for attendance & timetable
              </label>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
              {editingEvent ? (
                <button
                  type="button"
                  onClick={() => handleDeleteEvent(editingEvent.id)}
                  className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/95 text-white disabled:opacity-50 flex items-center gap-1"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Event
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ─── Term Creation Modal ───────────────────────────────────────────── */}
      {showTermModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTerm}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Add Academic Term
              </h3>
              <button
                type="button"
                onClick={() => setShowTermModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Term Name
              </label>
              <input
                type="text"
                required
                value={termFormData.name}
                onChange={(e) =>
                  setTermFormData({ ...termFormData, name: e.target.value })
                }
                placeholder="e.g. Term 1, Semester 1"
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={termFormData.startDate}
                  onChange={(e) =>
                    setTermFormData({
                      ...termFormData,
                      startDate: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={termFormData.endDate}
                  onChange={(e) =>
                    setTermFormData({
                      ...termFormData,
                      endDate: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Sort Order
              </label>
              <input
                type="number"
                required
                value={termFormData.sortOrder}
                onChange={(e) =>
                  setTermFormData({
                    ...termFormData,
                    sortOrder: parseInt(e.target.value) || 1,
                  })
                }
                className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowTermModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary text-white disabled:opacity-50"
              >
                Save Term
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
