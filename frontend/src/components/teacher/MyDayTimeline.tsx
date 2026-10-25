"use client";

import React, { useState, useTransition } from "react";
import {
  Clock,
  CheckCircle2,
  BookOpen,
  MapPin,
  Sparkles,
  Repeat,
  Coffee,
  X,
  FileText,
  BookmarkCheck,
  AlertTriangle,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { AppModal } from "@/components/ui/AppModal";
import {
  MyDayPeriodItem,
  completeLessonPlanAction,
} from "@/app/(teacher)/teacher/classes/classesActions";

export interface SyllabusTopicRef {
  id: string;
  title: string;
  classSubjectId?: string;
}

interface MyDayTimelineProps {
  timeline: MyDayPeriodItem[];
  date: string;
  dayOfWeek: string;
  syllabusTopics?: SyllabusTopicRef[];
  onLessonCompleted?: (periodNumber: number) => void;
  locale?: string;
  dayType?: "INSTRUCTIONAL" | "REST_DAY" | "SETUP_MISSING" | undefined;
  holidayTitle?: string | undefined;
  isSetupMissing?: boolean | undefined;
  missingAllocationsSummary?: string[] | undefined;
}

export default function MyDayTimeline({
  timeline,
  date,
  dayOfWeek,
  syllabusTopics = [],
  onLessonCompleted,
  locale = "en",
  dayType = "INSTRUCTIONAL",
  holidayTitle,
  isSetupMissing = false,
  missingAllocationsSummary = [],
}: MyDayTimelineProps) {
  const isHi = locale === "hi";
  const [periods, setPeriods] = useState<MyDayPeriodItem[]>(timeline);
  const [modalPeriod, setModalPeriod] = useState<MyDayPeriodItem | null>(null);
  const [isPending, startTransition] = useTransition();

  // Modal form state
  const [formData, setFormData] = useState({
    title: "",
    chapterName: "",
    syllabusTopicId: "",
    objectives: "",
    homework: "",
  });

  const handleOpenCompleteModal = (period: MyDayPeriodItem) => {
    setModalPeriod(period);
    setFormData({
      title:
        period.lessonPlan?.title ||
        `${period.className || "Class"} ${period.subjectName || "Subject"} Lesson`,
      chapterName: period.lessonPlan?.chapterName || "Unit 1",
      syllabusTopicId: period.lessonPlan?.syllabusTopicId || "",
      objectives: period.lessonPlan?.objectives || "",
      homework: period.lessonPlan?.homework || "",
    });
  };

  const handleCloseModal = () => {
    setModalPeriod(null);
  };

  const handleSubmitClasswork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalPeriod) return;

    startTransition(async () => {
      try {
        const res = await completeLessonPlanAction({
          lessonPlanId: modalPeriod.lessonPlan?.id,
          classSubjectId: modalPeriod.classSubjectId,
          sectionId: modalPeriod.sectionId,
          title: formData.title.trim(),
          chapterName: formData.chapterName.trim(),
          syllabusTopicId: formData.syllabusTopicId || undefined,
          objectives: formData.objectives.trim() || undefined,
          homework: formData.homework.trim() || undefined,
        });

        if (res.success) {
          toast.success(
            isHi
              ? `पीरियड ${modalPeriod.periodNumber}: क्लासवर्क पूरा हुआ!`
              : `Period ${modalPeriod.periodNumber} (${modalPeriod.className}-${modalPeriod.sectionName}): Classwork marked complete!`
          );

          setPeriods((prev) =>
            prev.map((p) =>
              p.periodNumber === modalPeriod.periodNumber
                ? {
                    ...p,
                    lessonPlan: {
                      id: p.lessonPlan?.id || "temp-completed",
                      title: formData.title,
                      chapterName: formData.chapterName,
                      status: "COMPLETED",
                      objectives: formData.objectives || null,
                      homework: formData.homework || null,
                      syllabusTopicId: formData.syllabusTopicId || null,
                    },
                  }
                : p
            )
          );

          if (onLessonCompleted) {
            onLessonCompleted(modalPeriod.periodNumber);
          }
          handleCloseModal();
        } else {
          toast.error(res.message || "Failed to mark classwork complete.");
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to complete lesson.");
      }
    });
  };

  const handleCompleteLessonDirect = (period: MyDayPeriodItem) => {
    startTransition(async () => {
      try {
        const res = await completeLessonPlanAction({
          lessonPlanId: period.lessonPlan?.id,
          classSubjectId: period.classSubjectId,
          sectionId: period.sectionId,
          title:
            period.lessonPlan?.title ||
            `${period.className || "Class"} ${period.subjectName || "Subject"} Lesson`,
          chapterName: period.lessonPlan?.chapterName || "Unit 1",
          syllabusTopicId: period.lessonPlan?.syllabusTopicId || undefined,
          objectives: period.lessonPlan?.objectives || undefined,
          homework: period.lessonPlan?.homework || undefined,
        });

        if (res.success) {
          toast.success(
            isHi
              ? `पीरियड ${period.periodNumber}: पाठ पूरा हुआ!`
              : `Period ${period.periodNumber} (${period.className}-${period.sectionName}): Lesson marked complete!`
          );

          setPeriods((prev) =>
            prev.map((p) =>
              p.periodNumber === period.periodNumber
                ? {
                    ...p,
                    lessonPlan: {
                      id: p.lessonPlan?.id || "temp-completed",
                      title: p.lessonPlan?.title || "Lesson Plan",
                      chapterName: p.lessonPlan?.chapterName || "Unit 1",
                      status: "COMPLETED",
                      objectives: p.lessonPlan?.objectives || null,
                      homework: p.lessonPlan?.homework || null,
                      syllabusTopicId: p.lessonPlan?.syllabusTopicId || null,
                    },
                  }
                : p
            )
          );

          if (onLessonCompleted) {
            onLessonCompleted(period.periodNumber);
          }
        } else {
          toast.error(res.message || "Failed to mark lesson complete.");
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to complete lesson.");
      }
    });
  };

  if (dayType === "REST_DAY") {
    return (
      <div
        data-testid="timeline-rest-day-card"
        className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 p-6 sm:p-8 text-center space-y-3 shadow-lg"
      >
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mx-auto text-indigo-400">
          <Coffee className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {holidayTitle || (isHi ? "विश्राम दिवस" : "Rest Day")}
          </span>
          <h3 className="text-lg font-bold text-white pt-1">
            {isHi ? "आज कोई कक्षाएं निर्धारित नहीं हैं" : "No Classes Scheduled Today"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {isHi
              ? "विद्यालय आज बंद है। अपने दिन का आनंद लें और कल की कक्षाओं के लिए तरोताजा रहें।"
              : "School is closed for instructional activities. Rest up and recharge for the week ahead!"}
          </p>
        </div>
      </div>
    );
  }

  if (dayType === "SETUP_MISSING" || isSetupMissing) {
    return (
      <div
        data-testid="timeline-setup-missing-card"
        className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 p-6 space-y-4 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
              {isHi ? "समय सारिणी लंबित" : "Timetable Setup Pending"}
            </span>
            <h3 className="text-base font-bold text-white">
              {isHi ? "आपकी समय सारिणी अभी प्रकाशित नहीं हुई है" : "Your Timetable is Not Published"}
            </h3>
            <p className="text-xs text-slate-400">
              {isHi
                ? "आपके पास विषय आवंटन मौजूद हैं, लेकिन आज के लिए कोई पीरियड समय सारिणी में निर्धारित नहीं है।"
                : "You hold subject and class allocations, but no timetable periods have been published for today."}
            </p>
          </div>
        </div>

        {missingAllocationsSummary && missingAllocationsSummary.length > 0 && (
          <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
              {isHi ? "आवंटित कक्षाएं व विषय:" : "Your Allocated Class-Subjects:"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missingAllocationsSummary.map((alloc, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700/60"
                >
                  {alloc}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-1 flex items-center gap-2">
          <a
            href="/teacher/messages"
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 transition cursor-pointer shadow-md shadow-amber-950/30"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{isHi ? "प्रशासक को सूचित करें" : "Notify School Admin"}</span>
          </a>
        </div>
      </div>
    );
  }

  if (periods.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">
          {isHi ? "कोई समय सारणी निर्धारित नहीं है" : "No Timetable Periods Scheduled"}
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          {isHi
            ? `${dayOfWeek} के लिए कोई पीरियड या घंटी कार्यक्रम निर्धारित नहीं है।`
            : `There are no scheduled teaching periods or bell schedule entries for ${dayOfWeek}.`}
        </p>
      </div>
    );
  }

  // Filter topics relevant to the current period's classSubjectId (or show all if no match)
  const filteredTopics = modalPeriod?.classSubjectId
    ? syllabusTopics.filter(
        (t) => !t.classSubjectId || t.classSubjectId === modalPeriod.classSubjectId
      )
    : syllabusTopics;

  return (
    <div className="space-y-4">
      {/* ─── Timeline Date Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {isHi ? "आज का कार्यक्रम" : "Today's Schedule"} · {dayOfWeek} ({date})
          </h2>
          <p className="text-[11px] text-slate-400">
            {isHi
              ? "समय सारणी, लाइव क्लासवर्क और प्रतिस्थापन स्थिति।"
              : "Choreographed bell schedule with live lesson plan status and substitution overlays."}
          </p>
        </div>
      </div>

      {/* ─── Vertical Choreographed Timeline ─────────────────────────────── */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
        {periods.map((period) => {
          const isLessonDone = period.lessonPlan?.status === "COMPLETED";

          return (
            <div key={period.periodNumber} className="relative group">
              {/* Timeline Indicator Dot */}
              <div
                className={`absolute -left-6 top-3.5 w-4 h-4 rounded-full border-2 transition-all ${
                  period.isNow
                    ? "bg-emerald-500 border-slate-950 ring-4 ring-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    : isLessonDone
                    ? "bg-emerald-600 border-slate-900"
                    : period.isFree
                    ? "bg-slate-800 border-slate-700"
                    : "bg-slate-700 border-slate-900"
                }`}
              />

              {/* Period Card */}
              <div
                className={`rounded-2xl border p-4 transition-all shadow-sm ${
                  period.isNow
                    ? "border-emerald-500/50 bg-gradient-to-r from-emerald-950/20 via-slate-900/90 to-slate-900/90 ring-1 ring-emerald-500/30"
                    : period.isFree
                    ? "border-slate-800/60 bg-slate-950/40 text-slate-400"
                    : "border-slate-800 bg-slate-900/80 hover:border-slate-700"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Period Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-white font-mono">
                        {isHi ? `पीरियड ${period.periodNumber}` : `Period ${period.periodNumber}`}
                      </span>

                      <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {period.startTime} – {period.endTime}
                      </span>

                      {period.isNow && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          {isHi ? "प्रगति पर है" : "Running Now"}
                        </span>
                      )}

                      {period.substitution && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Repeat className="w-3 h-3" />
                          {period.substitution.type === "INCOMING_COVER"
                            ? isHi
                              ? "प्रतिस्थापन कक्षा"
                              : "Covering Class"
                            : isHi
                            ? "प्रतिस्थानी नियुक्त"
                            : "Substitute Assigned"}
                        </span>
                      )}

                      {period.isPast && !period.isFree && period.isAttendanceMarked === false && (
                        <a
                          href={period.sectionId ? `/teacher/attendance?sectionId=${period.sectionId}` : "/teacher/attendance"}
                          data-testid="pending-attendance-chip"
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 hover:bg-amber-500/30 transition cursor-pointer"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>{isHi ? "उपस्थिति लंबित" : "Attendance Pending"}</span>
                        </a>
                      )}
                    </div>

                    {period.isFree ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 pt-0.5">
                        <Coffee className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {period.periodType === "LUNCH"
                            ? isHi ? "दोपहर का भोजन अवकाश" : "Lunch Break"
                            : period.periodType === "BREAK"
                            ? isHi ? "अवकाश / विश्राम" : "Recess / Break"
                            : isHi ? `${period.endTime} तक खाली पीरियड` : `Free period until ${period.endTime}`}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>
                            {period.className} · {isHi ? "वर्ग" : "Section"} {period.sectionName}
                          </span>
                          <span className="text-slate-400 font-normal">|</span>
                          <span className="text-emerald-400">{period.subjectName}</span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500" />
                            {period.roomNumber || "Main Building"}
                          </span>

                          {period.lessonPlan && (
                            <span className="flex items-center gap-1 truncate max-w-xs">
                              <BookOpen className="w-3 h-3 text-slate-500" />
                              {period.lessonPlan.title}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Actions: Complete Lesson (1 tap) & Mark Classwork Done (modal) */}
                  {!period.isFree && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isLessonDone ? (
                        <button
                          type="button"
                          onClick={() => handleOpenCompleteModal(period)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          {isHi ? "कक्षा कार्य पूर्ण" : "Lesson Complete"}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCompleteLessonDirect(period)}
                            disabled={isPending}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                              period.isNow
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-emerald-900/40 shadow-md"
                                : "bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-600/50"
                            } disabled:opacity-50 cursor-pointer`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isHi ? "पाठ पूरा करें" : "Complete Lesson"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenCompleteModal(period)}
                            disabled={isPending}
                            title={isHi ? "कक्षा कार्य विवरण दर्ज करें" : "Record classwork details & homework"}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <BookmarkCheck className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{isHi ? "कक्षा कार्य दर्ज करें" : "Mark classwork done"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Mark Classwork Done Modal (AC-15) ────────────────────────────── */}
      {modalPeriod && (
        <AppModal
          open={!!modalPeriod}
          onClose={handleCloseModal}
          size="lg"
          title={
            <div className="flex items-center gap-2 text-white">
              <BookmarkCheck className="w-5 h-5 text-emerald-400" />
              <span>
                {isHi ? "कक्षा कार्य दर्ज करें" : "Mark Classwork Done"} · {modalPeriod.className} - {modalPeriod.sectionName}
              </span>
            </div>
          }
          description={
            isHi
              ? `पीरियड ${modalPeriod.periodNumber} (${modalPeriod.subjectName || "Subject"}) के लिए पाठ्यक्रम प्रगति और गृहकार्य दर्ज करें।`
              : `Record curriculum coverage and optional homework for Period ${modalPeriod.periodNumber} (${modalPeriod.subjectName || "Subject"}).`
          }
        >
          <form onSubmit={handleSubmitClasswork} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isHi ? "पाठ / अध्याय (Chapter / Unit)" : "Chapter / Unit"} *
              </label>
              <input
                type="text"
                required
                value={formData.chapterName}
                onChange={(e) => setFormData({ ...formData, chapterName: e.target.value })}
                placeholder="e.g. Unit 3: Linear Equations"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isHi ? "आज पढ़ाया गया विषय (Topic Taught)" : "Topic Taught"} *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Solving Equations with Variables on Both Sides"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {filteredTopics.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {isHi ? "पाठ्यक्रम विषय लिंक करें (Syllabus Link)" : "Link Syllabus Topic"}
                </label>
                <select
                  value={formData.syllabusTopicId}
                  onChange={(e) => setFormData({ ...formData, syllabusTopicId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">
                    {isHi ? "-- कोई विशिष्ट विषय नहीं --" : "-- Select syllabus curriculum topic (Optional) --"}
                  </option>
                  {filteredTopics.map((top) => (
                    <option key={top.id} value={top.id}>
                      {top.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isHi ? "शिक्षण उद्देश्य / मुख्य बिंदु (Objectives / Notes)" : "Objectives / Notes"}
              </label>
              <textarea
                rows={2}
                value={formData.objectives}
                onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                placeholder={isHi ? "कक्षा में क्या सिखाया गया..." : "Key learning objectives covered in this period..."}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                <span>{isHi ? "गृहकार्य विवरण (Homework Assigned)" : "Homework Assigned"}</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  {isHi ? "अभिभावक ऐप पर दिखाई देगा" : "Published to Parent Feed"}
                </span>
              </label>
              <textarea
                rows={3}
                value={formData.homework}
                onChange={(e) => setFormData({ ...formData, homework: e.target.value })}
                placeholder={isHi ? "उदा. अभ्यास 3.2 के प्रश्न 1 से 5 हल करें..." : "e.g. Exercise 3.2 Questions 1 to 5 in workbook. Due tomorrow."}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {isHi
                  ? "डीपीडीपी अनुपालन: व्यक्तिगत संवेदनशील जानकारी (फ़ोन नंबर, आधार) शामिल न करें।"
                  : "DPDP Compliance: Scanned for PII before publishing. Do not include phone numbers or sensitive student data."}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all"
              >
                {isHi ? "रद्द करें" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-900/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isPending
                  ? isHi ? "दर्ज हो रहा है..." : "Saving..."
                  : isHi ? "पुष्टि करें और पूर्ण करें" : "Confirm & Mark Done"}
              </button>
            </div>
          </form>
        </AppModal>
      )}
    </div>
  );
}
