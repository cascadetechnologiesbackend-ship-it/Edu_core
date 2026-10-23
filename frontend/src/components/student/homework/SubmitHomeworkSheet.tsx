"use client";

import React, { useState, useEffect } from "react";
import { AppModal } from "@/components/ui/AppModal";
import {
  FileText,
  Upload,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Loader2,
  Send,
  ShieldAlert,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  submitHomeworkAction,
  StudentHomeworkItem,
  SubmitHomeworkResult,
} from "@/app/(student)/student/homework/homeworkActions";
import { enqueueStudentSubmission } from "../../../lib/offline/studentSubmissionQueue";

export interface SubmitHomeworkSheetProps {
  open: boolean;
  onClose: () => void;
  homework: StudentHomeworkItem | null;
  locale?: string;
  onSuccess: (result: SubmitHomeworkResult) => void;
}

export function SubmitHomeworkSheet({
  open,
  onClose,
  homework,
  locale = "en",
  onSuccess,
}: SubmitHomeworkSheetProps) {
  const isHi = locale === "hi";

  const [studentContent, setStudentContent] = useState("");
  const [attachmentKey, setAttachmentKey] = useState("");
  const [attachmentFileName, setAttachmentFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPiiBlocked, setIsPiiBlocked] = useState(false);
  const [detectedTypes, setDetectedTypes] = useState<string[]>([]);

  // Initialize or reset with existing submission if resubmitting
  useEffect(() => {
    if (homework) {
      if (homework.submission) {
        setStudentContent(homework.submission.studentContent || "");
        setAttachmentKey(homework.submission.attachmentS3Key || "");
        if (homework.submission.attachmentS3Key) {
          const parts = homework.submission.attachmentS3Key.split("/");
          setAttachmentFileName(parts[parts.length - 1] || "Attached document");
        } else {
          setAttachmentFileName("");
        }
      } else {
        setStudentContent("");
        setAttachmentKey("");
        setAttachmentFileName("");
      }
      setErrorMsg(null);
      setIsPiiBlocked(false);
      setDetectedTypes([]);
    }
  }, [homework, open]);

  if (!homework) return null;

  const isResubmit = Boolean(homework.submission);
  const isPastDue = homework.isPastDue;
  const dueDate = new Date(homework.dueDate);
  const formattedDueDate = dueDate.toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setIsUploading(true);

    try {
      // 1. Request presigned upload URL from /api/upload
      const presignRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          prefix: "homework_submissions",
        }),
      });

      const presignData = await presignRes.json();
      if (!presignData.success || !presignData.url || !presignData.key) {
        throw new Error(
          presignData.message || "Failed to initialize file upload channel"
        );
      }

      // 2. Put file to presigned URL
      const uploadRes = await fetch(presignData.url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("File upload failed. Please try again.");
      }

      setAttachmentKey(presignData.key);
      setAttachmentFileName(file.name);
    } catch (err: any) {
      console.error("[SubmitHomeworkSheet] File upload error:", err);
      setErrorMsg(
        err?.message || (isHi ? "फ़ाइल अपलोड करने में विफल" : "Failed to upload file")
      );
    } finally {
      setIsUploading(false);
      // Reset input value so same file can be re-selected if removed
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = () => {
    setAttachmentKey("");
    setAttachmentFileName("");
  };

  const handleSubmit = async () => {
    const trimmed = studentContent.trim();
    if (!trimmed && !attachmentKey) {
      setErrorMsg(
        isHi
          ? "कृपया उत्तर लिखें या फ़ाइल संलग्न करें।"
          : "Please write your answer text or attach a file before submitting."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setIsPiiBlocked(false);
    setDetectedTypes([]);

    // Check if client is currently offline
    if (typeof window !== "undefined" && !window.navigator.onLine) {
      try {
        await enqueueStudentSubmission({
          assignmentId: homework.id,
          assignmentTitle: homework.title,
          subjectName: homework.subjectName,
          dueDate: homework.dueDate,
          studentContent: trimmed,
          attachmentS3Key: attachmentKey || undefined,
        });

        onSuccess({
          success: true,
          offlineQueued: true,
          isLate: Boolean(homework.isPastDue),
          submittedAt: new Date().toISOString(),
        });
        onClose();
        return;
      } catch (enqueueErr: any) {
        setErrorMsg(
          enqueueErr?.message ||
            (isHi ? "ऑफ़लाइन सहेजने में विफल" : "Failed to queue submission offline")
        );
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const result = await submitHomeworkAction({
        assignmentId: homework.id,
        studentContent: trimmed,
        ...(attachmentKey ? { attachmentS3Key: attachmentKey } : {}),
      });

      if (!result.success) {
        if (result.blocked) {
          setIsPiiBlocked(true);
          setDetectedTypes(result.detectedTypes || []);
        }
        setErrorMsg(result.error || (isHi ? "जमा करने में विफल" : "Submission failed"));
        return;
      }

      onSuccess(result);
      onClose();
    } catch (err: any) {
      console.error("[SubmitHomeworkSheet] Submit error:", err);

      // If network failure occurs during server action, queue locally
      if (
        typeof window !== "undefined" &&
        (!window.navigator.onLine ||
          err?.message?.toLowerCase().includes("fetch") ||
          err?.message?.toLowerCase().includes("network") ||
          err?.message?.toLowerCase().includes("failed to fetch"))
      ) {
        try {
          await enqueueStudentSubmission({
            assignmentId: homework.id,
            assignmentTitle: homework.title,
            subjectName: homework.subjectName,
            dueDate: homework.dueDate,
            studentContent: trimmed,
            attachmentS3Key: attachmentKey || undefined,
          });

          onSuccess({
            success: true,
            offlineQueued: true,
            isLate: Boolean(homework.isPastDue),
            submittedAt: new Date().toISOString(),
          });
          onClose();
          return;
        } catch (_) {}
      }

      setErrorMsg(err?.message || (isHi ? "त्रुटि उत्पन्न हुई" : "An error occurred"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {homework.subjectName}
              </span>
              {isResubmit && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {isHi ? "पुनः जमा" : "Resubmission"}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-100 leading-tight mt-0.5">
              {homework.title}
            </h3>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isUploading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
          >
            {isHi ? "रद्द करें" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isUploading || (!studentContent.trim() && !attachmentKey)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isHi ? "जमा हो रहा है..." : "Submitting..."}</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>
                  {isResubmit
                    ? isHi
                      ? "पुनः जमा करें"
                      : "Update Submission"
                    : isHi
                    ? "गृहकार्य जमा करें"
                    : "Submit Homework"}
                </span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Due date and Late Warning Strip */}
        <div
          className={cn(
            "p-3 rounded-xl border flex items-center justify-between gap-2",
            isPastDue
              ? "bg-amber-950/30 border-amber-800/40 text-amber-300"
              : "bg-slate-800/50 border-slate-700/50 text-slate-300"
          )}
        >
          <div className="flex items-center gap-2">
            <Clock className={cn("w-4 h-4 shrink-0", isPastDue ? "text-amber-400" : "text-slate-400")} />
            <span>
              {isHi ? "अंतिम तिथि:" : "Due:"}{" "}
              <strong className="font-semibold">{formattedDueDate}</strong>
            </span>
          </div>
          {isPastDue ? (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {isHi ? "देरी से जमा (Late)" : "Late Submission"}
            </span>
          ) : (
            homework.maxMarks && (
              <span className="text-[11px] font-semibold text-slate-400">
                {isHi ? `अधिकतम: ${homework.maxMarks} अंक` : `Max: ${homework.maxMarks} marks`}
              </span>
            )
          )}
        </div>

        {/* Resubmit notice */}
        {isResubmit && (
          <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-800/30 text-blue-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {isHi ? "पुनः जमा करने की अनुमति" : "Resubmission Allowed"}
              </p>
              <p className="text-[11px] text-blue-200/80 mt-0.5">
                {isHi
                  ? "जब तक शिक्षक आपकी जाँच नहीं करते, आप अपने उत्तर को अपडेट कर सकते हैं।"
                  : "You can update your text answer or attached file until your teacher grades it."}
              </p>
            </div>
          </div>
        )}

        {/* PII Block Warning Banner */}
        {isPiiBlocked && (
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-200 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-rose-300">
                {isHi ? "डेटा सुरक्षा अवरोध (DPDP Act 2023)" : "Privacy Policy Block"}
              </h4>
              <p className="text-xs text-rose-200/90 mt-1">
                {errorMsg}
              </p>
              {detectedTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {detectedTypes.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded bg-rose-900/60 text-[10px] font-mono font-semibold text-rose-300 border border-rose-700/50"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generic Error Banner */}
        {!isPiiBlocked && errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Assignment Brief Description */}
        {homework.description && (
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              {isHi ? "कार्य विवरण" : "Assignment Prompt"}
            </h4>
            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
              {homework.description}
            </p>
          </div>
        )}

        {/* Text Answer Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="studentContent"
              className="font-bold text-slate-200 flex items-center gap-1.5"
            >
              <span>{isHi ? "आपका उत्तर / नोट्स" : "Your Answer / Written Work"}</span>
            </label>
            <span className="text-[10px] text-slate-500 font-mono">
              {studentContent.length} {isHi ? "अक्षर" : "chars"}
            </span>
          </div>
          <textarea
            id="studentContent"
            rows={5}
            value={studentContent}
            onChange={(e) => setStudentContent(e.target.value)}
            placeholder={
              isHi
                ? "यहाँ अपना उत्तर लिखें या अभ्यास के मुख्य बिंदु दर्ज करें..."
                : "Type your answer, summary, or response here..."
            }
            className="w-full rounded-xl bg-slate-900/90 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder:text-slate-500 p-3 leading-relaxed transition resize-none outline-none"
          />
        </div>

        {/* File Attachment Upload */}
        <div>
          <label className="font-bold text-slate-200 block mb-1.5">
            {isHi ? "फ़ाइल या फोटो संलग्न करें (वैकल्पिक)" : "Attach File / Photo (Optional)"}
          </label>

          {attachmentKey ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-indigo-500/30">
              <div className="flex items-center gap-2.5 truncate">
                <Paperclip className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="font-medium text-slate-200 truncate">
                  {attachmentFileName || attachmentKey}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {isHi ? "अपलोड संपन्न" : "Uploaded"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveAttachment}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition shrink-0 ml-2"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-4 bg-slate-900/40 hover:bg-slate-900/70 cursor-pointer transition group">
              <input
                type="file"
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx"
                onChange={handleFileUpload}
                disabled={isUploading || isSubmitting}
              />
              {isUploading ? (
                <div className="flex items-center gap-2 text-indigo-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-semibold">
                    {isHi ? "अपलोड हो रहा है..." : "Uploading file..."}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition mb-1" />
                  <span className="font-semibold text-slate-300 group-hover:text-white transition">
                    {isHi ? "फ़ाइल चुनें या यहाँ खींचें" : "Choose file (PDF, Image, Docs)"}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    {isHi ? "अधिकतम आकार: 15MB" : "Max size: 15MB"}
                  </span>
                </div>
              )}
            </label>
          )}
        </div>

        {/* Privacy Note */}
        <p className="text-[11px] text-slate-500 leading-normal">
          {isHi
            ? "सुरक्षा सूचना: आधार या संवेदनशील व्यक्तिगत जानकारी न लिखें। जमा की गई सामग्री स्वचालित रूप से जाँची जाती है।"
            : "Notice: Do not paste Aadhaar, banking, or sensitive personal IDs. Content is scanned for student privacy protection (DPDP Act)."}
        </p>
      </div>
    </AppModal>
  );
}
