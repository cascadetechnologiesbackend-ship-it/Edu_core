"use client";

import React, { useState, useTransition } from "react";
import {
  Bell,
  Pin,
  CheckCircle2,
  Download,
  Search,
  Filter,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import type { StudentNoticeItem } from "@/app/(student)/student/notices/noticesActions";
import { acknowledgeStudentNoticeAction } from "@/app/(student)/student/notices/noticesActions";

export interface StudentNoticesClientProps {
  initialNotices: StudentNoticeItem[];
  studentName?: string | undefined;
  className?: string | undefined;
  sectionName?: string | undefined;
  studentIdParam?: string | undefined;
}

export function StudentNoticesClient({
  initialNotices,
  studentName,
  className,
  sectionName,
  studentIdParam,
}: StudentNoticesClientProps) {
  const [noticesList, setNoticesList] = useState<StudentNoticeItem[]>(initialNotices);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "REQUIRED" | "PINNED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isHindi, setIsHindi] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAcknowledge = async (noticeId: string) => {
    setActionError(null);
    setAcknowledgingId(noticeId);

    // Optimistic update
    setNoticesList((prev) =>
      prev.map((n) =>
        n.id === noticeId
          ? { ...n, isAcknowledged: true, acknowledgedAt: new Date().toISOString() }
          : n
      )
    );

    startTransition(async () => {
      const res = await acknowledgeStudentNoticeAction(noticeId, studentIdParam);
      setAcknowledgingId(null);
      if (!res.success) {
        // Rollback on failure
        setNoticesList((prev) =>
          prev.map((n) =>
            n.id === noticeId
              ? { ...n, isAcknowledged: false, acknowledgedAt: null }
              : n
          )
        );
        setActionError(res.error || "Failed to record acknowledgment.");
      }
    });
  };

  const filteredNotices = noticesList.filter((notice) => {
    // Tab filter
    if (activeFilter === "REQUIRED" && (!notice.requiresAcknowledgment || notice.isAcknowledged)) {
      return false;
    }
    if (activeFilter === "PINNED" && !notice.isPinned) {
      return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = notice.title.toLowerCase().includes(q);
      const matchContent = notice.content.toLowerCase().includes(q);
      if (!matchTitle && !matchContent) return false;
    }

    return true;
  });

  const pendingAcksCount = noticesList.filter(
    (n) => n.requiresAcknowledgment && !n.isAcknowledged
  ).length;

  return (
    <div className="space-y-5 pb-8">
      {/* Top Banner & Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold shrink-0">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">
                  {isHindi ? "विद्यालय सूचनाएं एवं परिपत्र" : "School Notices & Circulars"}
                </h1>
                {pendingAcksCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {pendingAcksCount} {isHindi ? "बाकी" : "Action Required"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {studentName && `${studentName} • `}
                {className && sectionName ? `${className} - ${sectionName}` : "Official student circulars"}
              </p>
            </div>
          </div>

          {/* Bilingual Toggle */}
          <button
            type="button"
            onClick={() => setIsHindi(!isHindi)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            {isHindi ? "English" : "हिंदी"}
          </button>
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isHindi
                ? "सूचना खोजें (शीर्षक या विवरण)..."
                : "Search notices by title or content..."
            }
            className="w-full bg-slate-950/70 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeFilter === "ALL"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                : "bg-slate-800/80 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            {isHindi ? "सभी सूचनाएं" : "All Notices"} ({noticesList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("REQUIRED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeFilter === "REQUIRED"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-slate-800/80 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <span>{isHindi ? "पावती आवश्यक" : "Needs Acknowledgment"}</span>
            {pendingAcksCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                {pendingAcksCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("PINNED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${
              activeFilter === "PINNED"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "bg-slate-800/80 text-slate-400 border border-slate-800 hover:text-slate-200"
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
            <span>{isHindi ? "पिन किए गए" : "Pinned"}</span>
          </button>
        </div>
      </div>

      {/* Action Error Alert */}
      {actionError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3.5 flex items-center gap-2.5 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Notices List */}
      {filteredNotices.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              {isHindi ? "कोई सूचना नहीं मिली" : "No notices found"}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? isHindi
                  ? "आपकी खोज से मेल खाती कोई सूचना नहीं है।"
                  : "No notices match your search criteria."
                : isHindi
                ? "आपके विद्यालय या कक्षा के लिए अभी कोई नई सूचना उपलब्ध नहीं है।"
                : "There are currently no active notices published for your class."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotices.map((notice) => {
            const formattedDate = notice.publishedAt
              ? format(new Date(notice.publishedAt), "dd MMMM yyyy, h:mm a")
              : null;
            const ackDate = notice.acknowledgedAt
              ? format(new Date(notice.acknowledgedAt), "dd MMM yyyy, h:mm a")
              : null;
            const isBusy = acknowledgingId === notice.id;

            return (
              <div
                key={notice.id}
                className={`bg-slate-900 border rounded-3xl p-5 shadow-lg transition-all relative overflow-hidden ${
                  notice.isPinned
                    ? "border-sky-500/40 bg-gradient-to-b from-sky-950/20 to-slate-900"
                    : "border-slate-800/80"
                }`}
              >
                {/* Pinned Marker */}
                {notice.isPinned && (
                  <div className="flex items-center gap-1 text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-2">
                    <Pin className="w-3.5 h-3.5" />
                    <span>{isHindi ? "महत्वपूर्ण पिन" : "Important Notice"}</span>
                  </div>
                )}

                {/* Header: Title and Published Date */}
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-bold text-white leading-snug">
                    {notice.title}
                  </h2>
                </div>

                {formattedDate && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{formattedDate}</span>
                  </div>
                )}

                {/* Body Content */}
                <div className="text-xs text-slate-300 leading-relaxed mt-3.5 whitespace-pre-line bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60 font-sans">
                  {notice.content}
                </div>

                {/* Footer Section: Attachments & Acknowledgment */}
                <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between gap-3 flex-wrap">
                  {/* Attachment Link */}
                  {notice.attachmentS3Key ? (
                    <a
                      href={`/api/documents/download?key=${encodeURIComponent(
                        notice.attachmentS3Key
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isHindi ? "संलग्न दस्तावेज" : "View Attachment"}</span>
                    </a>
                  ) : (
                    <div />
                  )}

                  {/* Acknowledgment Action */}
                  {notice.requiresAcknowledgment && (
                    <div>
                      {notice.isAcknowledged ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>
                            {isHindi ? "पावती स्वीकृत" : "Acknowledged"}
                            {ackDate && ` • ${ackDate}`}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAcknowledge(notice.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {isBusy
                              ? isHindi
                                ? "पुष्टि की जा रही है..."
                                : "Confirming..."
                              : isHindi
                              ? "पावती दें (Acknowledge)"
                              : "Acknowledge Receipt"}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
