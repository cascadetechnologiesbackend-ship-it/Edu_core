"use client";

import { useState } from "react";
import { updateApplicationStatus } from "./actions";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Section {
  id: string;
  name: string;
}

interface ClassItem {
  id: string;
  name: string;
  sections?: Section[];
}

export function StatusUpdater({
  currentStatus,
  applicationId,
  enrolledStudentId,
  availableClasses = [],
}: {
  currentStatus: string;
  applicationId: string;
  enrolledStudentId?: string | null;
  availableClasses?: ClassItem[];
}) {
  const [loading, setLoading] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const router = useRouter();

  const statuses = [
    "APPLIED",
    "SCREENING",
    "OFFER_LETTER",
    "ENROLLED",
    "REJECTED",
  ];

  const currentClassObj = availableClasses.find(
    (c) => c.id === selectedClassId,
  );
  const availableSections = currentClassObj?.sections || [];

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;

    if (newStatus === "ENROLLED") {
      // Revert dropdown temporarily and open enrollment modal
      const firstClass = availableClasses[0];
      if (firstClass) {
        setSelectedClassId(firstClass.id);
        const firstSection = firstClass.sections?.[0];
        if (firstSection) {
          setSelectedSectionId(firstSection.id);
        }
      }
      setShowEnrollModal(true);
      return;
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

  async function handleConfirmEnroll() {
    if (!selectedClassId || !selectedSectionId) {
      alert("Please select both a class and section for enrollment.");
      return;
    }

    setLoading(true);
    const res = await updateApplicationStatus(applicationId, "ENROLLED", {
      classId: selectedClassId,
      sectionId: selectedSectionId,
    });
    setLoading(false);

    if (res.success) {
      setShowEnrollModal(false);
      router.refresh();
    } else {
      alert("Enrollment failed: " + res.message);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {currentStatus === "ENROLLED" && enrolledStudentId ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            ✓ ENROLLED
          </span>
          <Link
            href={`/students/${enrolledStudentId}`}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-3 rounded shadow-sm transition-colors"
          >
            View Student 360 →
          </Link>
        </div>
      ) : (
        <>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Status:
          </span>
          <select
            defaultValue={currentStatus}
            onChange={handleStatusChange}
            disabled={loading || currentStatus === "ENROLLED"}
            className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          {loading && (
            <span className="text-sm text-blue-500">Updating...</span>
          )}
        </>
      )}

      {/* Enrollment Class & Section Selection Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Enroll Student
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Assign this applicant to an active Class and Section. This will
              atomically create their Student 360 profile, initial academic
              history, and fee structures.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Class
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setSelectedClassId(cid);
                    const c = availableClasses.find((x) => x.id === cid);
                    const firstSec = c?.sections?.[0];
                    if (firstSec) {
                      setSelectedSectionId(firstSec.id);
                    } else {
                      setSelectedSectionId("");
                    }
                  }}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white shadow-sm"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Section
                </label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white shadow-sm"
                >
                  {availableSections.length === 0 ? (
                    <option value="">No active sections in this class</option>
                  ) : (
                    availableSections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        Section {sec.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowEnrollModal(false)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEnroll}
                disabled={loading || !selectedClassId || !selectedSectionId}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow transition-colors disabled:opacity-50"
              >
                {loading ? "Enrolling..." : "Confirm & Enroll"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
