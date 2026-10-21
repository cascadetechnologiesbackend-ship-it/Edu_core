"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  User,
  CheckCircle,
  MapPin,
  FileText,
  Loader2,
  CalendarCheck,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  TeacherPTMSlotItem,
  markPTMSlotHeld,
  publishPTMSlots,
} from "./actions";

interface PTMEventSummary {
  id: string;
  title: string;
  venue: string | null;
  startDate: string;
  bookingOpensAt: string;
  bookingClosesAt: string;
}

interface TeacherPTMClientProps {
  events: PTMEventSummary[];
  initialEventId: string;
  initialSlots: TeacherPTMSlotItem[];
}

export function TeacherPTMClient({
  events,
  initialEventId,
  initialSlots,
}: TeacherPTMClientProps) {
  const router = useRouter();
  const [selectedEventId, setSelectedEventId] = useState(initialEventId);
  const [slots, setSlots] = useState<TeacherPTMSlotItem[]>(initialSlots);
  const [holdingBookingId, setHoldingBookingId] = useState<string | null>(null);
  const [noteModalBookingId, setNoteModalBookingId] = useState<string | null>(null);
  const [teacherNote, setTeacherNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];

  const handleMarkHeld = async (bookingId: string, note?: string) => {
    setIsSubmitting(true);
    try {
      const res = await markPTMSlotHeld(bookingId, note);
      if (res.success) {
        toast.success("Meeting marked as completed.");
        setSlots((prev) =>
          prev.map((s) => {
            if (s.booking?.id === bookingId) {
              return {
                ...s,
                booking: {
                  ...s.booking,
                  status: "HELD",
                  teacherNote: note || null,
                },
              };
            }
            return s;
          })
        );
        setNoteModalBookingId(null);
        setTeacherNote("");
      } else {
        toast.error(res.error || "Failed to mark meeting held.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const bookedSlots = slots.filter((s) => s.booking && s.booking.status === "BOOKED");
  const heldSlots = slots.filter((s) => s.booking && s.booking.status === "HELD");
  const freeSlots = slots.filter((s) => s.status === "FREE");

  return (
    <div className="space-y-6">
      {/* Event Header Card */}
      {selectedEvent ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-900/60 text-purple-300 border border-purple-800">
                PTM Event
              </span>
              <h2 className="text-lg font-bold text-white">{selectedEvent.title}</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(selectedEvent.startDate).toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              {selectedEvent.venue && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedEvent.venue}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700">
              <span className="text-slate-400">Booked: </span>
              <span className="font-bold text-purple-400">{bookedSlots.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700">
              <span className="text-slate-400">Completed: </span>
              <span className="font-bold text-emerald-400">{heldSlots.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700">
              <span className="text-slate-400">Available: </span>
              <span className="font-bold text-slate-300">{freeSlots.length}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-sm">
          No upcoming PTM events found.
        </div>
      )}

      {/* Slots Schedule */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 sm:p-5">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <span>Slot Schedule ({slots.length} Total Slots)</span>
        </h3>

        {slots.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            No slot inventory generated for this event yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {slots.map((slot) => {
              const startFormatted = new Date(slot.startAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              const endFormatted = new Date(slot.endAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              const isBooked = slot.booking && slot.booking.status === "BOOKED";
              const isHeld = slot.booking && slot.booking.status === "HELD";

              return (
                <div
                  key={slot.id}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                    isHeld
                      ? "bg-emerald-950/20 border-emerald-900/60"
                      : isBooked
                      ? "bg-purple-950/20 border-purple-800/80"
                      : "bg-slate-950/40 border-slate-800/80 text-slate-400"
                  }`}
                  data-testid={`teacher-slot-${slot.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-24 text-xs font-bold text-white shrink-0">
                      {startFormatted} - {endFormatted}
                    </span>

                    {slot.booking ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-purple-900/60 text-purple-300 flex items-center justify-center text-xs font-bold shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">
                            {slot.booking.studentName}
                          </p>
                          {slot.booking.teacherNote && (
                            <p className="text-[11px] text-slate-400 italic">
                              &ldquo;{slot.booking.teacherNote}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Available (Free)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isHeld && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-900/50 text-emerald-300 border border-emerald-800">
                        <CheckCircle className="w-3 h-3" />
                        <span>Completed</span>
                      </span>
                    )}

                    {isBooked && (
                      <button
                        onClick={() => {
                          setNoteModalBookingId(slot.booking!.id);
                          setTeacherNote(slot.booking?.teacherNote || "");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-colors"
                        data-testid={`mark-held-btn-${slot.booking!.id}`}
                      >
                        <CalendarCheck className="w-3.5 h-3.5" />
                        <span>Mark Held</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Note & Mark Held Modal */}
      {noteModalBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 sm:p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Mark Meeting as Completed
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Add optional teacher notes or feedback for this meeting.
            </p>

            <textarea
              value={teacherNote}
              onChange={(e) => setTeacherNote(e.target.value)}
              placeholder="Discussion points, homework advice, or next steps..."
              rows={3}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 mb-4 resize-none"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteModalBookingId(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleMarkHeld(noteModalBookingId, teacherNote)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm inline-flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save & Complete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
