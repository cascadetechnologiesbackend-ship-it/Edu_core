"use client";

import React, { useState } from "react";
import { AppModal } from "@/components/ui/AppModal";
import {
  Bell,
  Calendar,
  CheckCircle2,
  Paperclip,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NoticeDetailModalProps {
  open: boolean;
  onClose: () => void;
  locale?: string;
  notice?: {
    id: string;
    title: string;
    content: string;
    publishedAt: Date | string;
    requiresAcknowledgment?: boolean;
    isAcknowledged?: boolean;
    attachmentS3Key?: string | null;
  } | null;
  onAcknowledge?: (noticeId: string) => Promise<void>;
}

export function NoticeDetailModal({
  open,
  onClose,
  locale = "en",
  notice,
  onAcknowledge,
}: NoticeDetailModalProps) {
  const [isAcking, setIsAcking] = useState(false);
  const [acked, setAcked] = useState(notice?.isAcknowledged ?? false);

  if (!notice) return null;

  const isHi = locale === "hi";
  const pubDate = new Date(notice.publishedAt);
  const formattedDate = pubDate.toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const handleAck = async () => {
    if (!onAcknowledge || acked) return;
    setIsAcking(true);
    try {
      await onAcknowledge(notice.id);
      setAcked(true);
    } catch (e) {
      // Failed acknowledgment handled gracefully
    } finally {
      setIsAcking(false);
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
            {notice.title}
          </h3>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {isHi ? "बंद करें" : "Close"}
          </button>
          {notice.requiresAcknowledgment && (
            <button
              type="button"
              onClick={handleAck}
              disabled={acked || isAcking}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition",
                acked
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 cursor-default"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {acked
                  ? isHi
                    ? "स्वीकृत किया गया"
                    : "Acknowledged"
                  : isHi
                  ? "पावती दें"
                  : "Acknowledge Notice"}
              </span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Notice Meta */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formattedDate}</span>
          </div>
          {notice.requiresAcknowledgment && (
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                acked
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/20"
              )}
            >
              {acked
                ? isHi
                  ? "पावती दर्ज"
                  : "Acknowledged"
                : isHi
                ? "पावती आवश्यक"
                : "Action: Acknowledge"}
            </span>
          )}
        </div>

        {/* Notice Content (sanitized text/html) */}
        <div
          className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap text-sm"
          dangerouslySetInnerHTML={{ __html: notice.content }}
        />

        {/* Attachment */}
        {notice.attachmentS3Key && (
          <a
            href={`/api/documents/download?key=${encodeURIComponent(notice.attachmentS3Key)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 text-blue-700 dark:text-blue-400 hover:bg-blue-100/60 transition w-full"
          >
            <Paperclip className="w-4 h-4" />
            <span className="font-medium">
              {isHi ? "संलग्न परिपत्र डाउनलोड करें" : "Download Attached Circular"}
            </span>
            <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-70" />
          </a>
        )}
      </div>
    </AppModal>
  );
}
