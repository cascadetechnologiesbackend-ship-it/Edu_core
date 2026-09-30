"use client";

import { useState } from "react";
import { generateInvoicesForStudent } from "./actions";
import { useRouter } from "next/navigation";

export function GenerateInvoicesButton({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generateInvoicesForStudent(studentId);
      if (res.success) {
        alert(res.message);
        router.refresh();
      } else {
        alert("Error: " + res.message);
      }
    } catch (e: any) {
      alert("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50"
    >
      {loading ? "Generating..." : "Generate Missing Invoices"}
    </button>
  );
}
