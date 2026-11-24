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
            className="p-4 border border-border/40 rounded-xl bg-card flex flex-col justify-between space-y-3 shadow-xs"
          >
            <div className="flex items-start space-x-3">
              <span className="text-3xl">📄</span>
              <div className="overflow-hidden flex-1">
                <p className="font-semibold text-sm text-foreground mb-1">
                  {doc.documentType.replace(/_/g, " ")}
                </p>
                <p
                  className="text-xs text-muted-foreground truncate"
                  title={doc.originalFileName}
                >
                  {doc.originalFileName}
                </p>
                <div className="mt-2">
                  {doc.isVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-[#34C759]/15 text-[#1B6A2E] dark:text-[#30D158] border border-[#34C759]/25 rounded-md">
                      <CheckCircle2 className="w-3 h-3 text-[#34C759] dark:text-[#30D158]" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/25 rounded-md">
                      Pending Verification
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
              {!doc.isVerified && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleVerify(doc.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#34C759] dark:bg-[#30D158] text-white hover:bg-[#248A3D] disabled:opacity-50 transition min-h-[36px] cursor-pointer"
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
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg min-h-[36px] cursor-pointer transition ${
                  doc.isVerified
                    ? "w-full border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    : "border border-border text-muted-foreground hover:bg-muted/40"
                } disabled:opacity-50`}
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
