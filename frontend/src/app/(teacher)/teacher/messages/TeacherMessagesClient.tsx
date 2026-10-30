"use client";

import React, { useState, useTransition } from "react";
import {
  MessageSquare,
  Send,
  User,
  ArrowLeft,
  CheckCheck,
  Check,
  Clock,
  ShieldAlert,
  GraduationCap,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";
import {
  sendParentTeacherMessage,
  markThreadReadAction,
  getThreadMessagesAction,
  getTeacherConversationsAction,
  type ConversationThreadSummary,
  type ThreadMessageItem,
} from "./messagesActions";

interface TeacherMessagesClientProps {
  initialThreads: ConversationThreadSummary[];
  currentUserId: string;
}

export function TeacherMessagesClient({
  initialThreads,
  currentUserId,
}: TeacherMessagesClientProps) {
  const [threads, setThreads] = useState<ConversationThreadSummary[]>(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ThreadMessageItem[]>([]);
  const [activeSubject, setActiveSubject] = useState<string>("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reply State
  const [replyContent, setReplyContent] = useState("");
  const [isSending, startTransition] = useTransition();

  // PII Warning State
  const [piiConfirmationPending, setPiiConfirmationPending] = useState<{
    detectedTypes: string[];
  } | null>(null);

  // Active thread object
  const activeThread = threads.find((t) => t.threadId === activeThreadId) || null;

  // Refresh thread list
  const refreshThreads = async () => {
    setIsRefreshing(true);
    const res = await getTeacherConversationsAction();
    if (res.success) {
      setThreads(res.threads);
    } else {
      toast.error(res.error || "Failed to refresh conversations");
    }
    setIsRefreshing(false);
  };

  // Open a conversation thread
  const handleOpenThread = async (thread: ConversationThreadSummary) => {
    setActiveThreadId(thread.threadId);
    setActiveSubject(thread.subject);
    setIsLoadingMessages(true);

    const res = await getThreadMessagesAction(thread.threadId);
    if (res.success) {
      setActiveMessages(res.messages);
      if (res.subject) setActiveSubject(res.subject);
    } else {
      toast.error(res.error || "Failed to load thread messages");
    }
    setIsLoadingMessages(false);

    // Mark as read if there are unread messages for this teacher
    if (thread.unreadCount > 0) {
      await markThreadReadAction(thread.threadId);
      setThreads((prev) =>
        prev.map((t) =>
          t.threadId === thread.threadId ? { ...t, unreadCount: 0 } : t
        )
      );
    }
  };

  // Send a reply in the active thread
  const handleSendReply = async (decisionOverride?: "CONFIRMED_SEND" | "MASKED") => {
    if (!activeThread || !replyContent.trim()) return;

    startTransition(async () => {
      const res = await sendParentTeacherMessage({
        recipientUserId: activeThread.counterpartUserId,
        studentId: activeThread.studentId,
        subject: `Re: ${activeSubject}`,
        content: replyContent.trim(),
        parentMessageId: activeThread.threadId,
        decisionOverride,
      });

      if ("blocked" in res && res.blocked) {
        toast.error(res.error || "Reply blocked due to critical personal data");
        return;
      }

      if ("requiresConfirmation" in res && res.requiresConfirmation) {
        setPiiConfirmationPending({
          detectedTypes: res.detectedTypes || [],
        });
        return;
      }

      if (res.success) {
        toast.success("Reply sent to parent");
        setReplyContent("");
        setPiiConfirmationPending(null);

        // Refresh thread messages
        const msgRes = await getThreadMessagesAction(activeThread.threadId);
        if (msgRes.success) {
          setActiveMessages(msgRes.messages);
        }
        await refreshThreads();
      } else if ("error" in res) {
        toast.error(res.error || "Failed to send reply");
      }
    });
  };

  const totalUnread = threads.reduce((acc, t) => acc + t.unreadCount, 0);

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <span>Parent Inquiries</span>
            <span className="text-xs font-normal text-slate-400">अभिभावक संवाद</span>
            {totalUnread > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {totalUnread} new
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Direct academic inquiry threads with enrolled student guardians. Allocation-scoped & DPDP protected.
          </p>
        </div>

        {!activeThreadId && (
          <button
            type="button"
            data-testid="refresh-threads-button"
            onClick={refreshThreads}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition min-h-[38px] active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* ── Active Thread vs Thread List ── */}
      {activeThreadId && activeThread ? (
        /* ── Thread Detail View ── */
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 sticky top-0 z-10 backdrop-blur">
            <button
              type="button"
              data-testid="back-to-threads-button"
              onClick={() => {
                setActiveThreadId(null);
                setActiveMessages([]);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-100 transition min-h-[38px] px-2 rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back / वापस</span>
            </button>
            <div className="text-center truncate flex-1">
              <h2 className="text-xs font-bold text-slate-200 truncate">
                {activeSubject || "Conversation"}
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {activeThread.counterpartName} (Parent of {activeThread.studentName} · {activeThread.className} - {activeThread.sectionName})
              </p>
            </div>
            <div className="w-12 text-right">
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
          </div>

          {/* Messages Timeline */}
          <div className="p-4 space-y-3 min-h-[280px] max-h-[500px] overflow-y-auto">
            {isLoadingMessages ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
                <Clock className="w-5 h-5 animate-spin text-emerald-400" />
                <span className="text-xs">Loading message history...</span>
              </div>
            ) : activeMessages.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No message content found.
              </div>
            ) : (
              activeMessages.map((msg) => {
                const isMe = msg.senderUserId === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-full`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {isMe ? "You (Teacher)" : msg.senderName}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div
                      className={`rounded-2xl px-4 py-2.5 text-xs max-w-[85%] sm:max-w-[75%] break-words border ${
                        isMe
                          ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-100 rounded-tr-sm"
                          : "bg-slate-800/90 border-slate-700/80 text-slate-200 rounded-tl-sm shadow-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                      {isMe && (
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-emerald-400/80">
                          {msg.isRead ? (
                            <span className="inline-flex items-center gap-0.5 text-cyan-400">
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>Seen</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-slate-400">
                              <Check className="w-3.5 h-3.5" />
                              <span>Sent</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sticky Reply Box */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/95 sticky bottom-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendReply();
              }}
              className="flex items-end gap-2"
            >
              <div className="flex-1">
                <label htmlFor="teacher-reply-input" className="sr-only">
                  Write Reply
                </label>
                <textarea
                  id="teacher-reply-input"
                  data-testid="teacher-reply-input"
                  rows={2}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write reply to guardian... / उत्तर लिखें..."
                  disabled={isSending}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none min-h-[38px]"
                />
              </div>

              <button
                type="submit"
                data-testid="teacher-send-reply-btn"
                disabled={isSending || !replyContent.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-40 min-h-[38px] min-w-[70px] active:scale-95"
              >
                {isSending ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ── Conversation Thread List ── */
        <div className="space-y-3">
          {threads.length === 0 ? (
            <EmptyStateCTA
              title="No Parent Messages Yet"
              hint="When parents of students in your assigned classes or subjects send academic inquiries, they will appear here."
              ctaLabel="Refresh / ताज़ा करें"
              onCta={refreshThreads}
            />
          ) : (
            threads.map((thread) => (
              <div
                key={thread.threadId}
                data-testid={`teacher-thread-${thread.threadId}`}
                onClick={() => handleOpenThread(thread)}
                className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700/80 transition-all cursor-pointer shadow-sm gap-3 min-h-[64px]"
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center shrink-0 text-emerald-400 group-hover:scale-105 transition-transform">
                    <User className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-200 truncate">
                        {thread.counterpartName}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                        <GraduationCap className="w-3 h-3 text-emerald-400" />
                        <span>
                          {thread.studentName} ({thread.className} - {thread.sectionName})
                        </span>
                      </span>

                      {thread.unreadCount > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {thread.unreadCount} new
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs font-medium text-slate-300 mt-1 truncate">
                      {thread.subject}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                      {thread.lastMessageSnippet}
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center text-slate-500 shrink-0 text-[11px] border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/50">
                  <span>
                    {new Date(thread.lastMessageAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-[10px] text-slate-500 sm:mt-0.5">
                    {thread.totalMessages} {thread.totalMessages === 1 ? "note" : "notes"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── DPDP PII Intercept Dialog ── */}
      <ConfirmDialog
        open={Boolean(piiConfirmationPending)}
        title="Privacy Advisory: Sensitive Data Detected"
        description={`Your message contains potential sensitive information (${piiConfirmationPending?.detectedTypes.join(
          ", "
        )}). Under the DPDP Act 2023, personal data shared in academic communication must be intentional. How would you like to proceed?`}
        confirmText="Send Masked / छुपाकर भेजें"
        cancelText="Send As-Is / ऐसे ही भेजें"
        confirmVariant="primary"
        onConfirm={() => handleSendReply("MASKED")}
        onClose={() => handleSendReply("CONFIRMED_SEND")}
      />
    </div>
  );
}
