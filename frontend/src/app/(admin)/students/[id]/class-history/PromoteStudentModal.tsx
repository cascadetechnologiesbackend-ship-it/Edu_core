"use client";

import { useState } from "react";
import { promoteStudent } from "./actions";
import { useRouter } from "next/navigation";

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded-lg shadow-sm transition-colors text-xs inline-flex items-center gap-1.5"
      >
        <span>Promote / Reassign Student</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                  Promote / Reassign Student
                </h3>
                <p className="text-xs text-gray-500">
                  Select the target academic year, class, and section.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Academic Year
                </label>
                <select
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white shadow-sm"
                >
                  {availableYears.map((yr) => (
                    <option key={yr.id} value={yr.id}>
                      {yr.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Class
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  required
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
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white shadow-sm"
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

              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedSectionId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-md shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? "Promoting..." : "Confirm Promotion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
