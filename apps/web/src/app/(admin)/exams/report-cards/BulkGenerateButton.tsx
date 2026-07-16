"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface BulkGenerateButtonProps {
  examId: string;
  classId: string;
  className: string;
}

export function BulkGenerateButton({ examId, classId, className }: BulkGenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ batchJobId: string; totalStudents: number } | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/report-cards/generate-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, classId }),
      });
      const data = await res.json() as { success?: boolean; message?: string; batchJobId?: string; totalStudents?: number; error?: string };

      if (data.success) {
        setResult({ batchJobId: data.batchJobId!, totalStudents: data.totalStudents! });
        router.refresh();
      } else {
        setError(data.error ?? data.message ?? "Failed to queue jobs");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
      >
        {loading ? "Queuing..." : `Generate All PDFs — ${className}`}
      </button>

      {result && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
          ✓ Queued {result.totalStudents} report card generation jobs!
          <br />
          <span className="text-xs text-green-600">
            Job ID: {result.batchJobId} — PDFs will be ready shortly.
          </span>
        </div>
      )}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          ✗ {error}
        </div>
      )}
    </div>
  );
}
