"use client";

import React, { useState } from "react";
import {
  FileText,
  Upload,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { DerivedFeedCard } from "@/lib/parentEventEngine/types";

interface DocumentRequestCardProps {
  card: DerivedFeedCard;
  studentName?: string;
  locale?: string;
}

export function DocumentRequestCard({
  card,
  studentName,
  locale = "en",
}: DocumentRequestCardProps) {
  const isHi = locale === "hi";
  const payload = card.payload || {};

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localStatus, setLocalStatus] = useState<string>(payload.status || "PENDING");
  const [showPicker, setShowPicker] = useState(false);

  const isPending = localStatus === "PENDING";
  const isSubmitted = localStatus === "SUBMITTED";
  const isRejected = localStatus === "REJECTED";
  const isExpired = localStatus === "EXPIRED" || Boolean(payload.isExpired);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast.error(isHi ? "फ़ाइल 10MB से छोटी होनी चाहिए।" : "File must be under 10MB.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      toast.error(isHi ? "कृपया पहले एक फ़ाइल चुनें।" : "Please select a file to upload.");
      return;
    }

    setIsSubmitting(true);
    try {
      // In production/simulated flow: encrypted s3 key generated with timestamp
      const s3Key = `docs/${card.studentId}/${payload.requestId}/${Date.now()}-${selectedFile.name}`;

      const { submitDocumentRequest } = await import(
        "@/app/(parent)/parent/actions/documentActions"
      );

      const res = await submitDocumentRequest({
        requestId: payload.requestId || card.id.replace("doc-", ""),
        studentId: card.studentId,
        fileKey: s3Key,
        filename: selectedFile.name,
        mimeType: selectedFile.type || "application/pdf",
        sizeBytes: selectedFile.size,
      });

      if (res.success) {
        setLocalStatus("SUBMITTED");
        setShowPicker(false);
        toast.success(
          isHi
            ? "दस्तावेज़ सफलतापूर्वक अपलोड किया गया।"
            : "Document uploaded successfully for review."
        );
      } else {
        toast.error(res.error || (isHi ? "अपलोड विफल रहा" : "Upload failed."));
      }
    } catch (err: any) {
      toast.error(err?.message || (isHi ? "अपलोड में त्रुटि" : "Error uploading file."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition-all ${
        isRejected
          ? "border-l-4 border-l-rose-500 border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/20"
          : isSubmitted
          ? "border-l-4 border-l-blue-500 border-blue-200 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/20"
          : isExpired
          ? "border-l-4 border-l-red-500 border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/20"
          : "border-l-4 border-l-amber-500 border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/20"
      }`}
      data-testid="document-request-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isRejected
                ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                : isSubmitted
                ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                : isExpired
                ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
            }`}
          >
            {isSubmitted ? (
              <FileCheck className="w-5 h-5" />
            ) : isRejected ? (
              <AlertCircle className="w-5 h-5" />
            ) : isExpired ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isHi ? card.title.hi : card.title.en}
              </h3>
              {card.wardName && (
                <span
                  data-testid="ward-chip"
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                >
                  {card.wardName}
                </span>
              )}
            </div>
            {studentName && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {studentName} • {payload.documentType || "Official Record"}
              </p>
            )}
          </div>
        </div>

        {/* Status chip */}
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            isSubmitted
              ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800"
              : isRejected
              ? "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800"
              : isExpired
              ? "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800"
              : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
          }`}
        >
          {isSubmitted ? (
            <>
              <Clock className="w-3 h-3" />
              {isHi ? "सत्यापन प्रक्रियाधीन" : "In Verification"}
            </>
          ) : isRejected ? (
            <>
              <AlertCircle className="w-3 h-3" />
              {isHi ? "पुनः अपलोड आवश्यक" : "Resubmission Needed"}
            </>
          ) : isExpired ? (
            <>
              <AlertTriangle className="w-3 h-3" />
              {isHi ? "वैधता समाप्त" : "Expired"}
            </>
          ) : (
            <>
              <Upload className="w-3 h-3" />
              {isHi ? "अपलोड आवश्यक" : "Action Required"}
            </>
          )}
        </span>
      </div>

      {/* Summary */}
      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
        {isHi ? card.summary.hi : card.summary.en}
      </p>

      {/* Rejection / verification notes */}
      {payload.rejectionReason && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div>
            <span className="font-semibold">{isHi ? "स्कूल की टिप्पणी: " : "School Note: "}</span>
            {payload.rejectionReason}
          </div>
        </div>
      )}

      {/* Previous file notice */}
      {payload.fileName && (
        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          {isHi ? "पूर्व अपलोड: " : "Uploaded File: "}
          <span className="font-mono text-slate-700 dark:text-slate-300">{payload.fileName}</span>
        </div>
      )}

      {/* Actions (Under 3-Click Budget AC-P24) */}
      <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {payload.dueAt
            ? `${isHi ? "अंतिम तिथि: " : "Due: "}${new Date(payload.dueAt).toLocaleDateString("en-IN")}`
            : isHi
            ? "पीडीएफ या छवि प्रारूप (अधिकतम 10MB)"
            : "PDF or Image format (Max 10MB)"}
        </span>

        {isSubmitted ? (
          <div className="inline-flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isHi ? "विद्यालय समीक्षाधीन है" : "School is reviewing this document"}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!showPicker ? (
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-colors"
                data-testid="upload-document-btn"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isHi ? "दस्तावेज़ अपलोड करें" : "Upload Document"}</span>
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200 cursor-pointer"
                  data-testid="document-file-input"
                />
                <button
                  type="button"
                  onClick={handleUploadSubmit}
                  disabled={!selectedFile || isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-colors"
                  data-testid="confirm-upload-btn"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{isHi ? "जमा करें" : "Submit"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
