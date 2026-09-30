"use client";

import { useState } from "react";
import { promoteStudent } from "./actions";

export function PromoteStudentModal({
  studentId,
  schoolId,
}: {
  studentId: string;
  schoolId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    formData.append("schoolId", schoolId);

    const res = await promoteStudent(studentId, formData);
    if (res.success) {
      setIsOpen(false);
    } else {
      setError(res.message || "Failed to promote");
    }
    setLoading(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors text-sm"
      >
        Promote / Reassign
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-800">
              <h3 className="font-semibold text-lg">Promote Student</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Academic Year ID
                </label>
                <input
                  type="text"
                  name="academicYearId"
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
                  placeholder="uuid"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Class ID
                </label>
                <input
                  type="text"
                  name="classId"
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
                  placeholder="uuid"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Section ID
                </label>
                <input
                  type="text"
                  name="sectionId"
                  required
                  className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2"
                  placeholder="uuid"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Confirm Promotion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
