"use client";

import { useState } from "react";
import { updateApplicationStatus } from "./actions";
import { useRouter } from "next/navigation";

export function StatusUpdater({ currentStatus, applicationId }: { currentStatus: string, applicationId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const statuses = ["APPLIED", "SCREENING", "OFFER_LETTER", "ENROLLED", "REJECTED"];

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;

    if (newStatus === "ENROLLED") {
      const confirmEnroll = confirm("Enrolling this application will generate a new Student Profile and Admission Number. Are you sure?");
      if (!confirmEnroll) {
        e.target.value = currentStatus;
        return;
      }
    }

    setLoading(true);
    const res = await updateApplicationStatus(applicationId, newStatus);
    setLoading(false);

    if (res.success) {
      router.refresh();
    } else {
      alert("Failed to update status: " + res.message);
      e.target.value = currentStatus;
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status:</span>
      <select 
        defaultValue={currentStatus} 
        onChange={handleStatusChange}
        disabled={loading || currentStatus === "ENROLLED"}
        className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
      >
        {statuses.map(s => (
          <option key={s} value={s}>{s.replace("_", " ")}</option>
        ))}
      </select>
      {loading && <span className="text-sm text-blue-500">Updating...</span>}
    </div>
  );
}
