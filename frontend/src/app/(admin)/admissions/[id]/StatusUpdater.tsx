"use client";

import { useState } from "react";
import { updateApplicationStatus } from "./actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ADMISSION_STATUSES,
  LEGAL_ADMISSION_TRANSITIONS,
  AdmissionStatus,
  isAdmissionStatus,
} from "@schoolmitra/validators";

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

  const isTerminal =
    currentStatus === "ENROLLED" ||
    currentStatus === "REJECTED" ||
    currentStatus === "WITHDRAWN";

  const legalTransitions: readonly AdmissionStatus[] = isAdmissionStatus(currentStatus)
    ? LEGAL_ADMISSION_TRANSITIONS[currentStatus]
    : [];

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
      ) : currentStatus === "REJECTED" ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
            ✕ REJECTED (Terminal)
          </span>
        </div>
      ) : currentStatus === "WITHDRAWN" ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border/40">
            ⊘ WITHDRAWN (Terminal)
          </span>
        </div>
      ) : (
        <>
          <span className="text-sm font-medium text-foreground">
            Status:
          </span>
          <select
            defaultValue={currentStatus}
            onChange={handleStatusChange}
            disabled={loading || isTerminal || legalTransitions.length === 0}
            className="block w-48 rounded-xl border border-border bg-muted/30 text-foreground px-3 py-2 text-sm focus:border-[#007AFF] focus:ring-[#007AFF]/20 min-h-[40px]"
          >
            <option value={currentStatus} disabled>
              {currentStatus.replace("_", " ")} (Current)
            </option>
            {ADMISSION_STATUSES.filter((s) => s !== currentStatus).map((s) => {
              const allowed = legalTransitions.includes(s);
              return (
                <option key={s} value={s} disabled={!allowed}>
                  {s.replace("_", " ")} {!allowed ? "(Not Allowed)" : ""}
                </option>
              );
            })}
          </select>
          {loading && (
            <span className="text-sm text-[#007AFF] dark:text-[#0A84FF]">Updating...</span>
          )}
        </>
      )}

      {/* Enrollment Class & Section Selection Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card-elevated rounded-2xl shadow-level-3 border border-border/40 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-foreground">
              Enroll Student
            </h3>
            <p className="text-sm text-muted-foreground">
              Assign this applicant to an active Class and Section. This will
              atomically create their Student 360 profile, initial academic
              history, and fee structures.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
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
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground min-h-[44px]"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Target Section
                </label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground min-h-[44px]"
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

            <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowEnrollModal(false)}
                disabled={loading}
                className="px-4 py-2 text-sm font-semibold text-foreground bg-muted/40 hover:bg-muted/80 rounded-xl transition-colors min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEnroll}
                disabled={loading || !selectedClassId || !selectedSectionId}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#007AFF] dark:bg-[#0A84FF] hover:bg-[#0068DB] dark:hover:bg-[#0071E3] rounded-xl shadow-sm transition-colors disabled:opacity-50 min-h-[44px] cursor-pointer"
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
