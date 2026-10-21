"use client";

import React, { useState } from "react";
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Clock,
  Calendar,
  BookOpen,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  TeacherSubstitutionItem,
  acceptSubstitutionAction,
  declineSubstitutionAction,
  requestAbsenceCoverageAction,
  cancelAbsenceRequestAction,
  getTeacherTimetablePeriodsForDate,
} from "@/app/(teacher)/teacher/classes/substitutionsActions";

export interface SubstitutionCardProps {
  incoming: TeacherSubstitutionItem[];
  outgoing: TeacherSubstitutionItem[];
  locale?: string | undefined;
  onRefresh?: (() => Promise<void> | void) | undefined;
}

export function SubstitutionCard({
  incoming,
  outgoing,
  locale = "en",
  onRefresh,
}: SubstitutionCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"INCOMING" | "OUTGOING">(
    incoming.length > 0 ? "INCOMING" : "OUTGOING"
  );
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Request Cover Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requestDate, setRequestDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [availablePeriods, setAvailablePeriods] = useState<
    Array<{
      id: string;
      periodNumber: number;
      startTime: string;
      endTime: string;
      className: string;
      sectionName: string;
      subjectName: string;
    }>
  >([]);
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const openRequestModal = async () => {
    setIsModalOpen(true);
    setLoadingPeriods(true);
    try {
      const periods = await getTeacherTimetablePeriodsForDate(requestDate);
      setAvailablePeriods(periods);
      setSelectedPeriodIds([]);
    } catch {
      toast.error(
        locale === "hi"
          ? "समय सारिणी लोड करने में विफल"
          : "Failed to load periods for date"
      );
    } finally {
      setLoadingPeriods(false);
    }
  };

  const handleDateChange = async (newDate: string) => {
    setRequestDate(newDate);
    setLoadingPeriods(true);
    try {
      const periods = await getTeacherTimetablePeriodsForDate(newDate);
      setAvailablePeriods(periods);
      setSelectedPeriodIds([]);
    } catch {
      toast.error(
        locale === "hi"
          ? "अवधि लोड करने में विफल"
          : "Failed to load periods for date"
      );
    } finally {
      setLoadingPeriods(false);
    }
  };

  const togglePeriodSelection = (id: string) => {
    setSelectedPeriodIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmitAbsenceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPeriodIds.length === 0) {
      toast.error(
        locale === "hi"
          ? "कृपया कम से कम एक पीरियड चुनें"
          : "Please select at least one period"
      );
      return;
    }
    setSubmittingRequest(true);
    try {
      const res = await requestAbsenceCoverageAction({
        date: requestDate,
        timetablePeriodIds: selectedPeriodIds,
        reason: reason.trim() || "Absence cover requested",
      });
      toast.success(
        locale === "hi"
          ? `${res.createdCount} पीरियड के लिए स्थानापन्न अनुरोध दर्ज किया गया`
          : `Requested cover for ${res.createdCount} period(s)`
      );
      setIsModalOpen(false);
      setReason("");
      setSelectedPeriodIds([]);
      if (onRefresh) await onRefresh();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to request absence cover");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleAccept = async (sub: TeacherSubstitutionItem) => {
    setActionLoadingId(sub.id);
    try {
      await acceptSubstitutionAction(sub.id);
      toast.success(
        locale === "hi"
          ? "कवर स्वीकार किया गया! My Day समय सारिणी अपडेट हो गई है।"
          : "Cover accepted! My Day timeline updated with this period."
      );
      if (onRefresh) await onRefresh();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to accept substitution");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (sub: TeacherSubstitutionItem) => {
    setActionLoadingId(sub.id);
    try {
      await declineSubstitutionAction(sub.id);
      toast.info(
        locale === "hi"
          ? "अनुरोध अस्वीकार किया गया। व्यवस्थापक को सूचित किया गया।"
          : "Substitution declined. Admin notified to reassign."
      );
      if (onRefresh) await onRefresh();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to decline substitution");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (sub: TeacherSubstitutionItem) => {
    setActionLoadingId(sub.id);
    try {
      await cancelAbsenceRequestAction(sub.id);
      toast.success(
        locale === "hi"
          ? "अनुरोध सफलतापूर्वक रद्द कर दिया गया"
          : "Absence cover request cancelled"
      );
      if (onRefresh) await onRefresh();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel request");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Request CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-sm">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            {locale === "hi" ? "स्थानापन्न प्रबंधन" : "Substitutions & Cover"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {locale === "hi"
              ? "अपनी अनुपस्थिति के लिए कवर का अनुरोध करें या साथी शिक्षकों के लिए पीरियड स्वीकार करें"
              : "Manage proxy requests, timetable covers, and request absence coverage"}
          </p>
        </div>
        <button
          onClick={openRequestModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          {locale === "hi" ? "कवर का अनुरोध करें" : "Request Cover"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("INCOMING")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "INCOMING"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          {locale === "hi" ? "आने वाले अनुरोध" : "Incoming Requests"}
          {incoming.filter((i) => i.status === "PENDING").length > 0 && (
            <span className="px-1.5 py-0.2 bg-emerald-500 text-slate-950 font-bold rounded-full text-[10px]">
              {incoming.filter((i) => i.status === "PENDING").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("OUTGOING")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "OUTGOING"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          {locale === "hi" ? "मेरे अनुरोध" : "My Outgoing Requests"}
          {outgoing.length > 0 && (
            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded-full text-[10px]">
              {outgoing.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Incoming Substitutions */}
      {activeTab === "INCOMING" && (
        <div className="space-y-3">
          {incoming.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">
                {locale === "hi"
                  ? "कोई लंबित आने वाला कवर अनुरोध नहीं है"
                  : "No pending incoming cover requests"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {locale === "hi"
                  ? "जब कोई साथी शिक्षक आपके लिए पीरियड असाइन करेगा, वह यहाँ दिखाई देगा।"
                  : "When a colleague or admin assigns you a proxy cover, it will appear here."}
              </p>
            </div>
          ) : (
            incoming.map((sub) => {
              const isPending = sub.status === "PENDING";
              const isConfirmed = sub.status === "CONFIRMED";
              const isActionLoading = actionLoadingId === sub.id;

              return (
                <div
                  key={sub.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    sub.hasConflict
                      ? "bg-amber-950/20 border-amber-500/40"
                      : isConfirmed
                      ? "bg-slate-900/40 border-slate-800"
                      : "bg-slate-900/70 border-slate-800"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 text-xs font-semibold">
                          Period {sub.periodNumber}
                        </span>
                        <span className="text-xs text-slate-400">
                          {sub.startTime} - {sub.endTime}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-300 font-medium">
                          {sub.date}
                        </span>
                        {isConfirmed && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {locale === "hi" ? "स्वीकृत" : "Confirmed"}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <span>
                          {sub.className}-{sub.sectionName}
                        </span>
                        <span className="text-slate-500 font-normal">|</span>
                        <span className="text-emerald-400">{sub.subjectName}</span>
                      </div>

                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <span>
                          {locale === "hi" ? "कवर अनुरोधकर्ता:" : "Cover for:"}{" "}
                          <strong className="text-slate-200 font-medium">
                            {sub.otherTeacherName}
                          </strong>
                        </span>
                        {sub.reason && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="italic text-slate-400">
                              "{sub.reason}"
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Actions: 2-tap budget */}
                    {isPending && (
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          onClick={() => handleDecline(sub)}
                          disabled={isActionLoading}
                          className="px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {isActionLoading
                            ? "..."
                            : locale === "hi"
                            ? "अस्वीकार करें"
                            : "Decline"}
                        </button>
                        <button
                          onClick={() => handleAccept(sub)}
                          disabled={isActionLoading}
                          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {isActionLoading
                            ? "..."
                            : locale === "hi"
                            ? "स्वीकार करें"
                            : "Accept Cover"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Clash Warning Banner */}
                  {sub.hasConflict && isPending && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold block text-amber-300">
                          {locale === "hi" ? "समय टकराव" : "Schedule Conflict Detected"}
                        </strong>
                        <span>
                          {sub.conflictReason ||
                            (locale === "hi"
                              ? "यह अवधि आपकी मौजूदा कक्षा के साथ टकरा सकती है।"
                              : "This period conflicts with your assigned timetable.")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Outgoing Substitutions */}
      {activeTab === "OUTGOING" && (
        <div className="space-y-3">
          {outgoing.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
              <Calendar className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">
                {locale === "hi"
                  ? "कोई अनुपस्थिति कवर अनुरोध नहीं है"
                  : "No outgoing absence cover requests"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {locale === "hi"
                  ? "यदि आप अनुपस्थित रहने वाले हैं, तो ऊपर दिए गए बटन से कवर का अनुरोध करें।"
                  : "If you will be away, tap 'Request Cover' above to request substitute coverage."}
              </p>
            </div>
          ) : (
            outgoing.map((sub) => {
              const isPending = sub.status === "PENDING";
              const isConfirmed = sub.status === "CONFIRMED";
              const isCancelled = sub.status === "CANCELLED";
              const isActionLoading = actionLoadingId === sub.id;

              return (
                <div
                  key={sub.id}
                  className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 text-xs font-semibold">
                        Period {sub.periodNumber}
                      </span>
                      <span className="text-xs text-slate-400">
                        {sub.startTime} - {sub.endTime}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-300 font-medium">
                        {sub.date}
                      </span>

                      {/* Status Badges */}
                      {isPending && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium">
                          {locale === "hi" ? "असाइनमेंट लंबित" : "Awaiting Assignment"}
                        </span>
                      )}
                      {isConfirmed && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {locale === "hi" ? "कवर असाइन किया गया" : "Cover Assigned"}
                        </span>
                      )}
                      {isCancelled && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium">
                          {locale === "hi" ? "रद्द किया गया" : "Cancelled"}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <span>
                        {sub.className}-{sub.sectionName}
                      </span>
                      <span className="text-slate-500 font-normal">|</span>
                      <span className="text-slate-300">{sub.subjectName}</span>
                    </div>

                    <p className="text-xs text-slate-400">
                      {isConfirmed ? (
                        <span>
                          {locale === "hi" ? "स्थानापन्न शिक्षक:" : "Assigned Cover:"}{" "}
                          <strong className="text-emerald-400 font-medium">
                            {sub.otherTeacherName}
                          </strong>
                        </span>
                      ) : (
                        <span>
                          {locale === "hi"
                            ? "प्रशासक द्वारा स्थानापन्न सौंपा जाएगा"
                            : "Awaiting administrator proxy assignment"}
                        </span>
                      )}
                    </p>
                  </div>

                  {isPending && (
                    <button
                      onClick={() => handleCancel(sub)}
                      disabled={isActionLoading}
                      className="px-3 py-1.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-300 text-xs font-medium transition-colors self-end sm:self-auto disabled:opacity-50"
                    >
                      {isActionLoading
                        ? "..."
                        : locale === "hi"
                        ? "अनुरोध रद्द करें"
                        : "Cancel Request"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Request Absence Coverage Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {locale === "hi" ? "अनुपस्थिति कवर का अनुरोध" : "Request Absence Cover"}
                </h3>
                <p className="text-xs text-slate-400">
                  {locale === "hi"
                    ? "तिथि और अपनी कक्षाएं चुनें जिन्हें स्थानापन्न की आवश्यकता है"
                    : "Select date and scheduled periods requiring substitute cover"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAbsenceRequest} className="space-y-4">
              {/* Date Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {locale === "hi" ? "अनुपस्थिति की तिथि" : "Absence Date"}
                </label>
                <input
                  type="date"
                  value={requestDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {/* Periods List */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {locale === "hi"
                    ? "कवर के लिए पीरियड चुनें"
                    : "Select Periods Requiring Coverage"}
                </label>

                {loadingPeriods ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800">
                    {locale === "hi" ? "अवधि लोड हो रही है..." : "Loading timetable..."}
                  </div>
                ) : availablePeriods.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800">
                    {locale === "hi"
                      ? "इस तिथि पर कोई अनुसूचित कक्षाएं नहीं मिलीं"
                      : "No scheduled periods found for your timetable on this date"}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {availablePeriods.map((p) => {
                      const isSelected = selectedPeriodIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => togglePeriodSelection(p.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-colors ${
                            isSelected
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                              : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                          }`}
                        >
                          <div>
                            <span className="font-semibold text-white">
                              Period {p.periodNumber}
                            </span>{" "}
                            ({p.startTime} - {p.endTime}) • {p.className}-
                            {p.sectionName} ({p.subjectName})
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {locale === "hi" ? "कारण (वैकल्पिक)" : "Reason (Optional)"}
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    locale === "hi"
                      ? "जैसे: चिकित्सा अवकाश, व्यक्तिगत कार्य"
                      : "e.g. Medical emergency, School event duty"
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-800 transition-colors"
                >
                  {locale === "hi" ? "रद्द करें" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={
                    submittingRequest || selectedPeriodIds.length === 0
                  }
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingRequest
                    ? locale === "hi"
                      ? "दर्ज हो रहा है..."
                      : "Submitting..."
                    : locale === "hi"
                    ? "अनुरोध भेजें"
                    : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubstitutionCard;
