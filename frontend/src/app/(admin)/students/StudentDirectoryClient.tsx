"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export interface StudentListItem {
  id: string;
  admissionNumber: string;
  fullName: string;
  gender: string;
  className: string;
  sectionName: string;
  classId: string | null;
  sectionId: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ClassOption {
  id: string;
  name: string;
}

export function StudentDirectoryClient({
  students,
  classes,
}: {
  students: StudentListItem[];
  classes: ClassOption[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Class filter
      if (selectedClassId !== "ALL" && s.classId !== selectedClassId) {
        return false;
      }
      // Status filter
      if (selectedStatus === "ACTIVE" && !s.isActive) return false;
      if (selectedStatus === "INACTIVE" && s.isActive) return false;

      // Text search (name or admission number)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = s.fullName.toLowerCase().includes(term);
        const matchesAdm = s.admissionNumber.toLowerCase().includes(term);
        if (!matchesName && !matchesAdm) return false;
      }
      return true;
    });
  }, [students, searchTerm, selectedClassId, selectedStatus]);

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[280px]">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Search Student
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by student name or admission number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">
              🔍
            </span>
          </div>
        </div>

        <div className="w-48">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Class
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full py-2 px-3 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-40">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full py-2 px-3 text-sm rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Results Count & Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/20">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Showing <strong className="text-gray-900 dark:text-white">{filteredStudents.length}</strong> of {students.length} students
          </span>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs text-blue-600 hover:underline"
            >
              Clear Search
            </button>
          )}
        </div>

        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3.5">Admission No</th>
              <th className="px-6 py-3.5">Student Name</th>
              <th className="px-6 py-3.5">Current Placement</th>
              <th className="px-6 py-3.5">Gender</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No students found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => (
                <tr
                  key={student.id}
                  className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-4 font-mono font-medium text-gray-900 dark:text-white">
                    {student.admissionNumber}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {student.fullName}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    {student.className ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200">
                        {student.className} • Section {student.sectionName || "A"}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">
                        Not Assigned
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {student.gender}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        student.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {student.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/students/${student.id}`}
                      className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded-lg text-xs shadow-sm transition-colors"
                    >
                      View Student 360 →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
