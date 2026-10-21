"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyAdmissionDocument, rejectAdmissionDocument } from "./actions";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface DocumentItem {
  id: string;
  documentType: string;
  originalFileName: string;
  isVerified: boolean;
  s3Key?: string;
}

export function AdmissionDocumentsList({
  documents,
}: {
  documents: DocumentItem[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (!documents || documents.length === 0) {
    return <p className="text-sm text-gray-500">No documents uploaded.</p>;
  }

  const handleVerify = async (docId: string) => {
    setLoadingId(docId);
    try {
      const res = await verifyAdmissionDocument(docId);
      if (res.success) {
        router.refresh();
      } else {
        alert("Failed to verify document: " + res.message);
      }
    } catch (e: any) {
      alert("Error verifying document: " + (e?.message || "Unknown error"));
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (docId: string) => {
    const reason = prompt("Enter rejection reason (optional):") ?? undefined;
    setLoadingId(docId);
    try {
      const res = await rejectAdmissionDocument(docId, reason);
      if (res.success) {
        router.refresh();
      } else {
        alert("Failed to reject document: " + res.message);
      }
    } catch (e: any) {
      alert("Error rejecting document: " + (e?.message || "Unknown error"));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {documents.map((doc) => {
        const isLoading = loadingId === doc.id;
        return (
          <div
            key={doc.id}
            className="p-4 border rounded-lg bg-gray-50 dark:bg-slate-800 flex flex-col justify-between space-y-3"
          >
            <div className="flex items-start space-x-3">
              <span className="text-3xl">📄</span>
              <div className="overflow-hidden flex-1">
                <p className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                  {doc.documentType.replace(/_/g, " ")}
                </p>
                <p
                  className="text-xs text-gray-500 truncate"
                  title={doc.originalFileName}
                >
                  {doc.originalFileName}
                </p>
                <div className="mt-2">
                  {doc.isVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 rounded">
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded">
                      Pending Verification
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-slate-700">
              {!doc.isVerified && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleVerify(doc.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Verify
                </button>
              )}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleReject(doc.id)}
                className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded ${
                  doc.isVerified
                    ? "w-full border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                    : "border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:hover:bg-amber-950/30"
                } disabled:opacity-50 transition`}
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
