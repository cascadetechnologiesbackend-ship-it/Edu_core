"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Clock,
  CheckCircle2,
  Award,
  AlertCircle,
  FileText,
  Filter,
  Send,
  RotateCw,
  Eye,
  Languages,
  Calendar,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";
import { SubmitHomeworkSheet } from "./SubmitHomeworkSheet";
import { HomeworkViewModal } from "./HomeworkViewModal";
import type {
  StudentHomeworkItem,
  StudentHomeworkData,
  SubmitHomeworkResult,
} from "@/app/(student)/student/homework/homeworkActions";

export interface HomeworkCenterClientProps {
  initialData: StudentHomeworkData;
  locale?: string;
}

export function HomeworkCenterClient({
  initialData,
  locale: initialLocale = "en",
}: HomeworkCenterClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [locale, setLocale] = useState(initialLocale);
  const isHi = locale === "hi";

  const [activeTab, setActiveTab] = useState<"pending" | "submitted" | "graded">("pending");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");

  // Homework item state
  const [pendingList, setPendingList] = useState<StudentHomeworkItem[]>(initialData.pending || []);
  const [submittedList, setSubmittedList] = useState<StudentHomeworkItem[]>(initialData.submitted || []);
  const [gradedList, setGradedList] = useState<StudentHomeworkItem[]>(initialData.graded || []);

  // Modals state
  const [sheetHomework, setSheetHomework] = useState<StudentHomeworkItem | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const [viewHomework, setViewHomework] = useState<StudentHomeworkItem | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Success notification
  const [successToast, setSuccessToast] = useState<{
    message: string;
    isLate?: boolean;
  } | null>(null);

  // Deep-link from Feed: ?id=...&action=submit
  useEffect(() => {
    const targetId = searchParams.get("id");
    const action = searchParams.get("action");

    if (targetId) {
      const match =
        pendingList.find((p) => p.id === targetId) ||
        submittedList.find((s) => s.id === targetId) ||
        gradedList.find((g) => g.id === targetId);

      if (match) {
        if (action === "submit" && !match.submission?.isGraded) {
          setSheetHomework(match);
          setIsSheetOpen(true);
        } else {
          setViewHomework(match);
          setIsViewOpen(true);
        }
      }
    }
  }, [searchParams, pendingList, submittedList, gradedList]);

  // Extract distinct subjects
  const subjects = useMemo(() => {
    const set = new Set<string>();
    [...pendingList, ...submittedList, ...gradedList].forEach((item) => {
      if (item.subjectName) set.add(item.subjectName);
    });
    return Array.from(set).sort();
  }, [pendingList, submittedList, gradedList]);

  // Filter current tab list by subject
  const currentItems = useMemo(() => {
    let list: StudentHomeworkItem[] = [];
    if (activeTab === "pending") list = pendingList;
    else if (activeTab === "submitted") list = submittedList;
    else if (activeTab === "graded") list = gradedList;

    if (selectedSubject !== "ALL") {
      return list.filter((i) => i.subjectName === selectedSubject);
    }
    return list;
  }, [activeTab, pendingList, submittedList, gradedList, selectedSubject]);

  const handleOpenSubmit = (item: StudentHomeworkItem) => {
    setSheetHomework(item);
    setIsSheetOpen(true);
  };

  const handleOpenView = (item: StudentHomeworkItem) => {
    setViewHomework(item);
    setIsViewOpen(true);
  };

  const handleSubmissionSuccess = (res: SubmitHomeworkResult) => {
    // Show success message
    const msg = res.resubmitted
      ? isHi
        ? "गृहकार्य सफलतापूर्वक अपडेट किया गया!"
        : "Submission updated successfully!"
      : isHi
      ? "गृहकार्य सफलतापूर्वक जमा किया गया!"
      : "Homework submitted successfully!";

    setSuccessToast({
      message: msg,
      ...(res.isLate !== undefined ? { isLate: res.isLate } : {}),
    });

    setTimeout(() => {
      setSuccessToast(null);
    }, 5000);

    // Refresh route so server action data updates
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <BookOpen className="w-4 h-4" />
              </div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {isHi ? "गृहकार्य एवं असाइनमेंट" : "Homework Center"}
              </h1>
            </div>

            {initialData.studentInfo && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-300">
                  {initialData.studentInfo.className} - {initialData.studentInfo.sectionName}
                </span>
                {initialData.studentInfo.rollNumber && (
                  <>
                    <span>•</span>
                    <span>
                      {isHi ? "क्रमांक" : "Roll"}: {initialData.studentInfo.rollNumber}
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="text-indigo-400 font-semibold">
                  {pendingList.length}{" "}
                  {isHi ? "लंबित असाइनमेंट" : "pending assignments"}
                </span>
              </p>
            )}
          </div>

          {/* Bilingual Language Switcher */}
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "hi" : "en")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white transition self-start sm:self-auto"
            title="Toggle Language"
          >
            <Languages className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isHi ? "English" : "हिंदी"}</span>
          </button>
        </div>

        {/* 3-Tab Pill Switcher */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-950/70 border border-slate-800/80 mt-4">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition",
              activeTab === "pending"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isHi ? "लंबित" : "Pending"}</span>
            <span
              className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                activeTab === "pending"
                  ? "bg-indigo-800 text-indigo-100"
                  : "bg-slate-800 text-slate-400"
              )}
            >
              {pendingList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("submitted")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition",
              activeTab === "submitted"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isHi ? "जमा किए" : "Submitted"}</span>
            <span
              className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                activeTab === "submitted"
                  ? "bg-indigo-800 text-indigo-100"
                  : "bg-slate-800 text-slate-400"
              )}
            >
              {submittedList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("graded")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition",
              activeTab === "graded"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            )}
          >
            <Award className="w-3.5 h-3.5" />
            <span>{isHi ? "जांचे गए" : "Graded"}</span>
            <span
              className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                activeTab === "graded"
                  ? "bg-indigo-800 text-indigo-100"
                  : "bg-slate-800 text-slate-400"
              )}
            >
              {gradedList.length}
            </span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successToast && (
        <div
          className={cn(
            "p-3.5 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300",
            successToast.isLate
              ? "bg-amber-950/40 border-amber-800/60 text-amber-200"
              : "bg-emerald-950/40 border-emerald-800/60 text-emerald-200"
          )}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2
              className={cn(
                "w-5 h-5 shrink-0",
                successToast.isLate ? "text-amber-400" : "text-emerald-400"
              )}
            />
            <span className="text-xs font-semibold">{successToast.message}</span>
            {successToast.isLate && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {isHi ? "देरी से जमा" : "Marked Late"}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Subject Filter Pills (if more than 1 subject) */}
      {subjects.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3 h-3 text-slate-500" />
            <span>{isHi ? "विषय:" : "Subject:"}</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedSubject("ALL")}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition",
              selectedSubject === "ALL"
                ? "bg-indigo-600 text-white"
                : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
            )}
          >
            {isHi ? "सभी विषय" : "All Subjects"}
          </button>
          {subjects.map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() => setSelectedSubject(subj)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition",
                selectedSubject === subj
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
              )}
            >
              {subj}
            </button>
          ))}
        </div>
      )}

      {/* Empty State Handlers */}
      {currentItems.length === 0 ? (
        activeTab === "pending" ? (
          <EmptyStateCTA
            icon={<Sparkles className="w-8 h-8 text-emerald-400" />}
            title={
              isHi
                ? "कोई गृहकार्य लंबित नहीं है"
                : "No homework pending. Enjoy the evening."
            }
            hint={
              isHi
                ? "आपकी कक्षा के लिए सभी असाइनमेंट समय पर पूरे कर लिए गए हैं।"
                : "All assignments for your subjects have been completed. Great job staying on top of your studies!"
            }
            className="bg-slate-900/60 border-slate-800 text-slate-300"
          />
        ) : activeTab === "submitted" ? (
          <EmptyStateCTA
            icon={<CheckCircle2 className="w-8 h-8 text-blue-400" />}
            title={
              isHi
                ? "जांच के लिए कोई जमा कार्य लंबित नहीं है"
                : "No submissions awaiting grading."
            }
            hint={
              isHi
                ? "जब आप गृहकार्य जमा करेंगे, तो वह शिक्षक द्वारा जांचे जाने तक यहाँ दिखाई देगा।"
                : "When you submit homework, it will appear here until your teacher reviews and grades it."
            }
            className="bg-slate-900/60 border-slate-800 text-slate-300"
          />
        ) : (
          <EmptyStateCTA
            icon={<Award className="w-8 h-8 text-amber-400" />}
            title={
              isHi
                ? "अभी तक कोई जाँचा गया गृहकार्य नहीं है"
                : "No graded homework yet."
            }
            hint={
              isHi
                ? "शिक्षक द्वारा आपके उत्तरों की समीक्षा और अंक प्रदान करने के बाद वे यहाँ दिखेंगे।"
                : "Once your teachers evaluate your submissions and provide feedback, your grades will be displayed here."
            }
            className="bg-slate-900/60 border-slate-800 text-slate-300"
          />
        )
      ) : (
        /* Homework List */
        <div className="space-y-3">
          {currentItems.map((item) => {
            const dueDate = new Date(item.dueDate);
            const formattedDueDate = dueDate.toLocaleDateString(
              isHi ? "hi-IN" : "en-IN",
              {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }
            );

            const isLate = Boolean(item.submission?.isLate);
            const marksAwarded = item.submission?.marksAwarded;
            const isGraded = Boolean(item.submission?.isGraded);

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 transition shadow-md group"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {/* Header Chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {item.subjectName}
                      </span>
                      {item.maxMarks && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {isHi ? `${item.maxMarks} अंक` : `${item.maxMarks} marks`}
                        </span>
                      )}
                      {isLate && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {isHi ? "देरी से जमा" : "Late"}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-slate-100 leading-snug group-hover:text-indigo-300 transition">
                      {item.title}
                    </h3>

                    {/* Excerpt */}
                    {item.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    {/* Timing and Teacher Info */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 pt-1 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Clock
                          className={cn(
                            "w-3.5 h-3.5",
                            item.isPastDue && !item.isSubmitted
                              ? "text-rose-400"
                              : "text-slate-400"
                          )}
                        />
                        <span
                          className={cn(
                            item.isPastDue && !item.isSubmitted
                              ? "text-rose-300 font-semibold"
                              : "text-slate-400"
                          )}
                        >
                          {isHi ? "अंतिम:" : "Due:"} {formattedDueDate}
                        </span>
                      </div>
                      <span>•</span>
                      <span>{item.teacherName}</span>
                    </div>

                    {/* Graded Remarks Excerpt */}
                    {isGraded && item.submission?.remarks && (
                      <div className="mt-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs italic text-slate-300">
                        <span className="text-emerald-400 font-semibold not-italic mr-1.5">
                          {isHi ? "शिक्षक टिप्पणी:" : "Feedback:"}
                        </span>
                        "{item.submission.remarks}"
                      </div>
                    )}
                  </div>

                  {/* Actions & Score Area */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 shrink-0">
                    {/* Graded Score badge */}
                    {isGraded && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                          {isHi ? "प्राप्त अंक" : "Score"}
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-white">
                            {marksAwarded ?? "--"}
                          </span>
                          {item.maxMarks && (
                            <span className="text-xs font-semibold text-slate-400">
                              / {item.maxMarks}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons (Strict Click Budget: 2-3 clicks) */}
                    {activeTab === "pending" ? (
                      <button
                        type="button"
                        onClick={() => handleOpenSubmit(item)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25 transition min-h-[38px]"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isHi ? "जमा करें" : "Submit"}</span>
                      </button>
                    ) : activeTab === "submitted" ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenView(item)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSubmit(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600/90 hover:bg-indigo-600 text-white transition"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>{isHi ? "बदलें" : "Resubmit"}</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenView(item)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{isHi ? "विवरण देखें" : "View Details"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit / Resubmit Sheet Modal */}
      <SubmitHomeworkSheet
        open={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setSheetHomework(null);
        }}
        homework={sheetHomework}
        locale={locale}
        onSuccess={handleSubmissionSuccess}
      />

      {/* View Graded / Submitted Details Modal */}
      <HomeworkViewModal
        open={isViewOpen}
        onClose={() => {
          setIsViewOpen(false);
          setViewHomework(null);
        }}
        homework={viewHomework}
        locale={locale}
        onResubmit={handleOpenSubmit}
      />
    </div>
  );
}
