"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  BellPlus,
  CheckCircle2,
  CalendarCheck,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { DerivedFeedCard } from "./FeedCard";
import type {
  AvailablePTMSlot,
  PTMEventsDetails,
} from "@/app/(parent)/parent/actions/ptmActions";

interface PTMCardProps {
  card: DerivedFeedCard;
  locale?: string;
}

export function PTMCard({ card, locale = "en" }: PTMCardProps) {
  const router = useRouter();
  const isHi = locale === "hi";
  const {
    eventId,
    ptmEventId,
    title = "Parent-Teacher Meeting",
    startDate = new Date().toISOString(),
    endDate = null,
    venue = "School Campus",
    daysUntil = 3,
    booking = null,
    canBook = false,
    bookingWindow = null,
  } = card.payload || {};

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slots, setSlots] = useState<AvailablePTMSlot[]>([]);
  const [eventDetails, setEventDetails] = useState<PTMEventsDetails | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dateObj = new Date(startDate);
  const dayNumber = dateObj.getDate();
  const monthStr = dateObj.toLocaleDateString([], { month: "short" }).toUpperCase();
  const timeStr = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let countdownText = isHi ? `${daysUntil} दिनों में` : `In ${daysUntil} days`;
  if (daysUntil === 0) countdownText = isHi ? "आज" : "Today";
  else if (daysUntil === 1) countdownText = isHi ? "कल" : "Tomorrow";

  // Open booking modal and load slots (Click 1)
  const handleOpenBooking = async () => {
    if (!ptmEventId) return;
    setIsModalOpen(true);
    setLoadingSlots(true);
    setErrorMessage(null);
    setSelectedSlotId(null);

    try {
      const { getAvailablePTMSlots } = await import("@/app/(parent)/parent/actions/ptmActions");
      const res = await getAvailablePTMSlots(ptmEventId);
      if (res.success && res.slots) {
        setSlots(res.slots);
        if (res.event) setEventDetails(res.event);
      } else {
        setErrorMessage(res.error || (isHi ? "स्लॉट लोड करने में विफल।" : "Failed to load slots."));
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isHi ? "त्रुटि हुई।" : "An error occurred."));
    } finally {
      setLoadingSlots(false);
    }
  };

  // Submit slot booking (Click 3: Confirm Slot)
  const handleConfirmBooking = async () => {
    if (!ptmEventId || !selectedSlotId || !card.studentId) return;
    const chosenSlot = slots.find((s) => s.id === selectedSlotId);
    if (!chosenSlot) return;

    setSubmittingBooking(true);
    setErrorMessage(null);

    try {
      const { bookPTMSlot, getAvailablePTMSlots } = await import("@/app/(parent)/parent/actions/ptmActions");
      const res = await bookPTMSlot(ptmEventId, chosenSlot.id, card.studentId, chosenSlot.version);
      if (res.success) {
        toast.success(
          isHi ? "पीटीएम स्लॉट सफलतापूर्वक बुक किया गया!" : "PTM slot booked successfully!"
        );
        setIsModalOpen(false);
        router.refresh();
      } else {
        setErrorMessage(res.error || (isHi ? "स्लॉट बुक करने में विफल।" : "Failed to book slot."));
        // Under concurrency conflict (AC-P17), refresh slot inventory
        if (res.conflict) {
          toast.error(res.error);
          const reload = await getAvailablePTMSlots(ptmEventId);
          if (reload.success && reload.slots) {
            setSlots(reload.slots);
            setSelectedSlotId(null);
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isHi ? "त्रुटि हुई।" : "An error occurred."));
    } finally {
      setSubmittingBooking(false);
    }
  };

  // Cancel booking
  const handleCancelBooking = async () => {
    if (!booking?.id) return;
    const confirmCancel = window.confirm(
      isHi
        ? "क्या आप वाकई इस पीटीएम बुकिंग को रद्द करना चाहते हैं?"
        : "Are you sure you want to cancel this PTM booking?"
    );
    if (!confirmCancel) return;

    setCancellingBooking(true);
    try {
      const { cancelPTMBooking } = await import("@/app/(parent)/parent/actions/ptmActions");
      const res = await cancelPTMBooking(booking.id);
      if (res.success) {
        toast.success(
          isHi ? "बुकिंग रद्द कर दी गई है।" : "Booking cancelled successfully."
        );
        router.refresh();
      } else {
        toast.error(res.error || (isHi ? "रद्द करने में विफल।" : "Failed to cancel booking."));
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setCancellingBooking(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border ${
        booking
          ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20"
          : "border-purple-200 dark:border-purple-900/60 bg-white dark:bg-slate-900"
      } p-4 sm:p-5 shadow-sm transition-all`}
      data-testid="ptm-card"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3">
          {/* Calendar Day Badge */}
          <div
            className={`w-11 h-11 rounded-2xl ${
              booking
                ? "bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : "bg-purple-50 dark:bg-purple-950/70 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
            } border flex flex-col items-center justify-center shrink-0 shadow-sm`}
          >
            <span className="text-[10px] font-bold leading-none">{monthStr}</span>
            <span className="text-base font-black leading-tight">{dayNumber}</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isHi ? card.title.hi : card.title.en}
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  booking
                    ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                    : "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                }`}
              >
                {booking ? (isHi ? "स्लॉट तय" : "Booked") : countdownText}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeStr}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1" data-testid="ptm-venue">
                <MapPin className="w-3 h-3" />
                {venue}
              </span>
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
        {isHi ? card.summary.hi : card.summary.en}
      </p>

      {/* Confirmed Booking Banner if booked */}
      {booking && (
        <div className="mt-3 p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <CalendarCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {new Date(booking.startAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                -{" "}
                {new Date(booking.endAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-slate-500 dark:text-slate-400 ml-1.5">
                ({booking.teacherName || (isHi ? "कक्षा शिक्षक" : "Class Teacher")})
              </span>
              {booking.status === "HELD" && (
                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 dark:bg-green-950 text-green-700">
                  {isHi ? "सम्पन्न" : "Completed"}
                </span>
              )}
            </div>
          </div>

          {booking.status === "BOOKED" && (
            <button
              onClick={handleCancelBooking}
              disabled={cancellingBooking}
              className="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline shrink-0"
              data-testid="cancel-ptm-booking-btn"
            >
              {cancellingBooking
                ? isHi
                  ? "रद्द हो रहा है..."
                  : "Cancelling..."
                : isHi
                ? "रद्द करें"
                : "Cancel Slot"}
            </button>
          )}
        </div>
      )}

      {/* Actions footer */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {venue ? `${venue}` : isHi ? "कक्षा शिक्षक के साथ व्यक्तिगत सत्र" : "Individual 10-min session"}
        </span>

        <div className="flex items-center gap-2">
          {canBook && !booking && (
            <button
              onClick={handleOpenBooking}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm transition-colors"
              data-testid="book-ptm-slot-btn"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{isHi ? "स्लॉट बुक करें" : "Book a Slot"}</span>
            </button>
          )}

          <button
            onClick={() => {
              if ("Notification" in window && Notification.permission === "default") {
                Notification.requestPermission();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold shadow-sm transition-colors"
          >
            <BellPlus className="w-3.5 h-3.5" />
            <span>{isHi ? "रिमाइंडर" : "Reminder"}</span>
          </button>
        </div>
      </div>

      {/* 3-Click PTM Slot Booking Modal (AC-P24: Click 1 open -> Click 2 slot -> Click 3 confirm) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          data-testid="ptm-booking-modal"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 w-full max-w-md shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {isHi ? "पीटीएम स्लॉट चुनें" : "Select PTM Slot"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {eventDetails?.teacherName ? `With ${eventDetails.teacherName}` : title} &bull;{" "}
                  {eventDetails?.slotMinutes || 10} mins
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="my-4 max-h-60 overflow-y-auto pr-1">
              {loadingSlots ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600 mb-2" />
                  <span className="text-xs">{isHi ? "स्लॉट लोड हो रहे हैं..." : "Loading available slots..."}</span>
                </div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  {isHi ? "कोई स्लॉट उपलब्ध नहीं है।" : "No available slots left for this PTM."}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot) => {
                    const start = new Date(slot.startAt);
                    const isSelected = selectedSlotId === slot.id;
                    const timeFormatted = start.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                          isSelected
                            ? "bg-purple-600 border-purple-600 text-white shadow-sm"
                            : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-purple-300"
                        }`}
                        data-testid={`slot-${slot.id}`}
                      >
                        <Clock className="w-3.5 h-3.5 mb-1 opacity-70" />
                        <span>{timeFormatted}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {isHi ? "रद्द करें" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleConfirmBooking}
                disabled={!selectedSlotId || submittingBooking}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white shadow-sm transition-colors inline-flex items-center gap-1.5"
                data-testid="confirm-ptm-slot-btn"
              >
                {submittingBooking && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isHi ? "स्लॉट पक्का करें" : "Confirm Slot"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
