"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignClassTeacherAction } from "./class-teacher-actions";

type Teacher = {
  id: string;
  email: string;
  name?: string;
  displayName?: string;
};

type SectionOption = {
  id: string;
  name: string;
  classDisplayName: string;
  classTeacherId: string | null;
};

export default function ClassTeacherPanel({
  sections,
  teachers,
  isAdmin,
}: {
  sections: SectionOption[];
  teachers: Teacher[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0]?.id || "");
  const [selectedTeacherId, setSelectedTeacherId] = useState(
    sections[0]?.classTeacherId || "",
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [conflictPrompt, setConflictPrompt] = useState<string | null>(null);

  if (!isAdmin || sections.length === 0) return null;

  const handleAssign = (forceTransfer = false) => {
    setStatusMessage(null);
    setConflictPrompt(null);
    startTransition(async () => {
      const res = await assignClassTeacherAction({
        sectionId: selectedSectionId,
        teacherId: selectedTeacherId || null,
        forceTransfer,
      });

      if (!res.success) {
        if ("conflict" in res && res.conflict) {
          setConflictPrompt(res.conflict.message);
        } else {
          setStatusMessage(res.error || "Failed to update class teacher.");
        }
        return;
      }

      setStatusMessage("Class teacher assignment updated.");
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Class Teacher Assignment
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Assign or transfer primary class teachers with conflict checks and history preservation.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          value={selectedSectionId}
          onChange={(e) => {
            const nextId = e.target.value;
            setSelectedSectionId(nextId);
            const found = sections.find((s) => s.id === nextId);
            setSelectedTeacherId(found?.classTeacherId || "");
            setConflictPrompt(null);
            setStatusMessage(null);
          }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.classDisplayName} - {s.name}
            </option>
          ))}
        </select>

        <select
          value={selectedTeacherId}
          onChange={(e) => {
            setSelectedTeacherId(e.target.value);
            setConflictPrompt(null);
            setStatusMessage(null);
          }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        >
          <option value="">-- Unassigned --</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName || t.name || t.email}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={isPending || !selectedSectionId}
          onClick={() => handleAssign(false)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Assign Class Teacher"}
        </button>
      </div>

      {conflictPrompt && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200">
          <span>{conflictPrompt}</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleAssign(true)}
            className="rounded-md bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700"
          >
            Confirm Transfer
          </button>
        </div>
      )}

      {statusMessage && (
        <p className="text-xs text-gray-600 dark:text-gray-300">{statusMessage}</p>
      )}
    </div>
  );
}
