"use client";

import React, { useState, useTransition } from "react";
import {
  MessageSquare,
  Plus,
  Send,
  User,
  ArrowLeft,
  CheckCheck,
  Check,
  Clock,
  ShieldAlert,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppModal } from "@/components/ui/AppModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyStateCTA } from "@/components/ui/EmptyStateCTA";
import {
  sendParentTeacherMessage,
  markThreadReadAction,
  getThreadMessagesAction,
  getParentConversationsAction,
  type ComposableTeacherRecipient,
  type ConversationThreadSummary,
  type ThreadMessageItem,
} from "./actions";

interface ParentMessagesClientProps {
  initialThreads: ConversationThreadSummary[];
  availableTeachers: ComposableTeacherRecipient[];
  currentUserId: string;
}

export function ParentMessagesClient({
  initialThreads,
  availableTeachers,
  currentUserId,
}: ParentMessagesClientProps) {
  const [threads, setThreads] = useState<ConversationThreadSummary[]>(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<ThreadMessageItem[]>([]);
  const [activeSubject, setActiveSubject] = useState<string>("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Compose State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedRecipientKey, setSelectedRecipientKey] = useState<string>("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeContent, setComposeContent] = useState("");
  const [isSending, startTransition] = useTransition();

  // Reply State
  const [replyContent, setReplyContent] = useState("");

  // PII Warning State
  const [piiConfirmationPending, setPiiConfirmationPending] = useState<{
    detectedTypes: string[];
    isReply: boolean;
  } | null>(null);

  // Refresh thread list
  const refreshThreads = async () => {
    const res = await getParentConversationsAction();
    if (res.success) {
      setThreads(res.threads);
    }
  };

  // Open a conversation thread
  const handleOpenThread = async (thread: ConversationThreadSummary) => {
    setActiveThreadId(thread.threadId);
    setActiveSubject(thread.subject);
    setIsLoadingMessages(true);

    // Fetch messages
    const res = await getThreadMessagesAction(thread.threadId);
    if (res.success) {
      setActiveMessages(res.messages);
      if (res.subject) setActiveSubject(res.subject);
    } else {
      toast.error(res.error || "Failed to load messages");
    }
    setIsLoadingMessages(false);

    // Mark as read if there are unread messages
    if (thread.unreadCount > 0) {
      await markThreadReadAction(thread.threadId);
      setThreads((prev) =>
        prev.map((t) =>
          t.threadId === thread.threadId ? { ...t, unreadCount: 0 } : t
        )
      );
    }
  };

  // Send a new message (root opener)
  const handleSendCompose = async (decisionOverride?: "CONFIRMED_SEND" | "MASKED") => {
    if (!selectedRecipientKey) {
      toast.error("Please select a teacher to message");
      return;
    }
    if (!composeContent.trim()) {
      toast.error("Please write a message");
      return;
    }

    const [studentId, teacherUserId] = selectedRecipientKey.split(":");
    if (!studentId || !teacherUserId) {
      toast.error("Invalid recipient selection");
      return;
    }

    startTransition(async () => {
      const res = await sendParentTeacherMessage({
        recipientUserId: teacherUserId,
        studentId,
        subject: composeSubject.trim() || "Message to Teacher",
        content: composeContent.trim(),
        decisionOverride,
      });

      if ("blocked" in res && res.blocked) {
        toast.error(res.error || "Message blocked due to critical personal data");
        return;
      }

      if ("requiresConfirmation" in res && res.requiresConfirmation) {
        setPiiConfirmationPending({
          detectedTypes: res.detectedTypes || [],
          isReply: false,
        });
        return;
      }

      if (res.success) {
        toast.success("Message sent to teacher");
        setIsComposeOpen(false);
        setComposeSubject("");
        setComposeContent("");
        setSelectedRecipientKey("");
        setPiiConfirmationPending(null);
        await refreshThreads();
      } else if ("error" in res) {
        toast.error(res.error || "Failed to send message");
      }
    });
  };

  // Send a reply in an existing thread
  const handleSendReply = async (decisionOverride?: "CONFIRMED_SEND" | "MASKED") => {
    if (!activeThreadId || !replyContent.trim()) return;

    const currentThread = threads.find((t) => t.threadId === activeThreadId);
    if (!currentThread) return;

    startTransition(async () => {
      const res = await sendParentTeacherMessage({
        recipientUserId: currentThread.counterpartUserId,
        studentId: currentThread.studentId,
        subject: `Re: ${activeSubject}`,
        content: replyContent.trim(),
        parentMessageId: activeThreadId,
        decisionOverride,
      });

      if ("blocked" in res && res.blocked) {
        toast.error(res.error || "Reply blocked due to critical personal data");
        return;
      }

      if ("requiresConfirmation" in res && res.requiresConfirmation) {
        setPiiConfirmationPending({
          detectedTypes: res.detectedTypes || [],
          isReply: true,
        });
        return;
      }

      if (res.success) {
        toast.success("Reply sent");
        setReplyContent("");
        setPiiConfirmationPending(null);
        // Refresh active messages
        const msgRes = await getThreadMessagesAction(activeThreadId);
        if (msgRes.success) {
          setActiveMessages(msgRes.messages);
        }
        await refreshThreads();
      } else if ("error" in res) {
        toast.error(res.error || "Failed to send reply");
      }
    });
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <span>Teacher Communication</span>
            <span className="text-xs font-normal text-slate-400">शिक्षक संवाद</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Direct, moderated messages with your child's teachers. DPDP privacy protected.
          </p>
        </div>

        {!activeThreadId && (
          <button
            type="button"
            data-testid="compose-message-button"
            onClick={() => setIsComposeOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors min-h-[38px] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Compose Message / नया संदेश</span>
          </button>
        )}
      </div>

      {/* ── View: Active Thread vs Thread List ── */}
      {activeThreadId ? (
        /* ── Thread Detail View ── */
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 sticky top-0 z-10 backdrop-blur">
            <button
              type="button"
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
            </div>
            <div className="w-12 text-right">
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                Active
              </span>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="p-4 space-y-3 min-h-[300px] max-h-[500px] overflow-y-auto">
            {isLoadingMessages ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Loading conversation messages...
              </div>
            ) : activeMessages.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No messages found in this thread.
              </div>
            ) : (
              activeMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.isMe ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs space-y-1.5 ${
                      msg.isMe
                        ? "bg-indigo-600 text-white rounded-tr-sm"
                        : "bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-tl-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] opacity-80 pb-0.5">
                      <span className="font-semibold">
                        {msg.isMe ? "You" : msg.senderName}
                      </span>
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                    <div className="flex items-center justify-end gap-1 text-[9px] opacity-70 pt-0.5">
                      {msg.isMe && (
                        msg.isRead ? (
                          <span className="flex items-center gap-0.5 text-indigo-200">
                            <CheckCheck className="w-3 h-3" /> Read
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Sent
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sticky Reply Bar */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/95 sticky bottom-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendReply();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                data-testid="parent-reply-input"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Type your reply to teacher... / उत्तर लिखें..."
                disabled={isSending}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[38px]"
              />
              <button
                type="submit"
                data-testid="parent-send-reply-btn"
                disabled={isSending || !replyContent.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors min-h-[38px] active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ── Conversation Threads List ── */
        <div className="space-y-3">
          {threads.length === 0 ? (
            <div data-testid="messages-empty-state">
              <EmptyStateCTA
                icon={<MessageSquare className="w-6 h-6 text-indigo-400" />}
                title="No Messages Yet"
                hint="Direct, authenticated messaging with your child's teachers. When a teacher sends an update or note, it will appear here."
                ctaLabel="Send Note to Teacher / संदेश भेजें"
                onCta={() => setIsComposeOpen(true)}
              />
            </div>
          ) : (
            threads.map((thread) => (
              <div
                key={thread.threadId}
                data-testid={`thread-item-${thread.threadId}`}
                onClick={() => handleOpenThread(thread)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.99] ${
                  thread.unreadCount > 0
                    ? "bg-slate-900/90 border-indigo-500/40 hover:border-indigo-500/70 shadow-sm"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-100 truncate">
                          {thread.counterpartName}
                        </span>
                        <span className="text-[10px] font-medium text-indigo-300 bg-indigo-950/60 border border-indigo-800/40 px-1.5 py-0.5 rounded-md">
                          {thread.counterpartRole}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded-md">
                          {thread.studentName} ({thread.className}-{thread.sectionName})
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-300 mt-1 truncate">
                        {thread.subject}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 leading-relaxed">
                        {thread.lastMessageSnippet}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(thread.lastMessageAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    {thread.unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold text-white bg-indigo-600 rounded-full shadow-sm">
                        {thread.unreadCount} new
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Compose Message Modal ── */}
      <AppModal
        open={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        title="Compose Message to Teacher"
      >
        <div className="space-y-4 pt-1">
          {availableTeachers.length === 0 ? (
            <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-950/20 text-amber-300 text-xs text-center">
              No teachers are currently assigned to your child's section. Please contact school administration.
            </div>
          ) : (
            <>
              {/* Recipient Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select Recipient / शिक्षक चुनें <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedRecipientKey}
                  onChange={(e) => setSelectedRecipientKey(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[38px]"
                >
                  <option value="">-- Choose teacher / शिक्षक चुनें --</option>
                  {availableTeachers.map((t) => (
                    <option
                      key={`${t.studentId}:${t.teacherUserId}`}
                      value={`${t.studentId}:${t.teacherUserId}`}
                    >
                      {t.studentName} ({t.className}-{t.sectionName}) — {t.teacherName} ({t.roleTitle})
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Subject / विषय
                </label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="e.g. Question regarding syllabus or attendance"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[38px]"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Message Content / संदेश <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={composeContent}
                  onChange={(e) => setComposeContent(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3 text-indigo-400" />
                  Protected by DPDP Act 2023. Do not paste national ID numbers.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition min-h-[38px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSendCompose()}
                  disabled={isSending || !selectedRecipientKey || !composeContent.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors min-h-[38px] active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? "Sending..." : "Send Message"}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </AppModal>

      {/* ── DPDP High-Risk PII Confirmation Dialog ── */}
      {piiConfirmationPending && (
        <ConfirmDialog
          open={true}
          onClose={() => setPiiConfirmationPending(null)}
          title="Sensitive Contact Information Detected"
          description={`Your message contains contact details (${piiConfirmationPending.detectedTypes.join(
            ", "
          )}). Under DPDP Act guidelines, choose whether to mask these contact details before sending or proceed as-is.`}
          confirmText="Send Masked (Recommended)"
          cancelText="Send As-Is"
          confirmVariant="primary"
          onConfirm={() => {
            if (piiConfirmationPending.isReply) {
              handleSendReply("MASKED");
            } else {
              handleSendCompose("MASKED");
            }
          }}
        />
      )}
    </div>
  );
}
