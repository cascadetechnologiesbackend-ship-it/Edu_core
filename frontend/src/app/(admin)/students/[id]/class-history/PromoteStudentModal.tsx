"use client";

import React, { useState } from "react";
import { promoteStudent } from "./actions";
import { useRouter } from "next/navigation";
import { AppModal } from "@/components/ui/AppModal";
import { UserCheck, RefreshCw } from "lucide-react";

export interface YearOption {
  id: string;
  label: string;
}

export interface SectionOption {
  id: string;
  name: string;
}

export interface ClassOption {
  id: string;
  name: string;
  sections?: SectionOption[];
}

export function PromoteStudentModal({
  studentId,
  schoolId,
  availableYears = [],
  availableClasses = [],
}: {
  studentId: string;
  schoolId: string;
  availableYears?: YearOption[];
  availableClasses?: ClassOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const [selectedYearId, setSelectedYearId] = useState(
    availableYears[0]?.id || "",
  );
  const [selectedClassId, setSelectedClassId] = useState(
    availableClasses[0]?.id || "",
  );
  const [selectedSectionId, setSelectedSectionId] = useState(
    availableClasses[0]?.sections?.[0]?.id || "",
  );

  const currentClassObj = availableClasses.find((c) => c.id === selectedClassId);
  const sectionsForClass = currentClassObj?.sections || [];

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    const cls = availableClasses.find((c) => c.id === classId);
    const firstSec = cls?.sections?.[0];
    if (firstSec) {
      setSelectedSectionId(firstSec.id);
    } else {
      setSelectedSectionId("");
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");

    if (!selectedYearId || !selectedClassId || !selectedSectionId) {
      setError("Please select Academic Year, Class, and Section.");
      setLoading(false);
      return;
    }

    const res = await promoteStudent(studentId, {
      academicYearId: selectedYearId,
      classId: selectedClassId,
      sectionId: selectedSectionId,
    });

    if (res.success) {
      setIsOpen(false);
      router.refresh();
    } else {
      setError(res.message || "Failed to promote student");
    }
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={() => {
          const firstYr = availableYears[0];
          if (firstYr && !selectedYearId) {
            setSelectedYearId(firstYr.id);
          }
          const firstCls = availableClasses[0];
          if (firstCls && !selectedClassId) {
            setSelectedClassId(firstCls.id);
            const firstSec = firstCls.sections?.[0];
            if (firstSec) {
              setSelectedSectionId(firstSec.id);
            }
          }
          setIsOpen(true);
        }}
        className="bg-primary hover:bg-primary/95 text-white font-bold py-2 px-3.5 rounded-xl shadow-xs transition-colors text-xs inline-flex items-center gap-1.5 min-h-[40px]"
      >
        <UserCheck className="w-3.5 h-3.5" />
        <span>Promote / Reassign Student</span>
      </button>

      <AppModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        size="md"
        title="Promote / Reassign Student"
        description="Select the target academic year, class, and section."
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition disabled:opacity-50 min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !selectedSectionId}
              onClick={() => handleSubmit()}
              className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 min-h-[40px] shadow-sm"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? "Promoting..." : "Confirm Promotion"}</span>
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl text-xs font-medium border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Target Academic Year
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
            >
              {availableYears.map((yr) => (
                <option key={yr.id} value={yr.id}>
                  {yr.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Target Class
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
            >
              {availableClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Target Section
            </label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
            >
              {sectionsForClass.length === 0 ? (
                <option value="">No sections available</option>
              ) : (
                sectionsForClass.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Section {sec.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </form>
      </AppModal>
    </>
  );
}

export default PromoteStudentModal;
