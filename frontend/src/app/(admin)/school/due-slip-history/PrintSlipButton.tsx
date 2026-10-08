"use client";

import { Printer } from "lucide-react";

export default function PrintSlipButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-slate-200 font-medium transition"
    >
      <Printer className="w-3.5 h-3.5" /> Print Batch
    </button>
  );
}
