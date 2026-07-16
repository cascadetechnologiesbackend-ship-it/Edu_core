"use client";

import { useEffect, useState, useTransition } from "react";
import { getAssignedSections, getSectionStudents, markSectionAttendance } from "./actions";
import { Calendar, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw } from "lucide-react";

type Section = {
  id: string;
  name: string;
  class: {
    displayName: string;
  };
};

type StudentRecord = {
  studentId: string;
  rollNumber: string | null;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  attendanceStatus: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE" | "HOLIDAY" | null;
  remarks: string;
};

export default function AttendanceManager() {
  const [sectionsList, setSectionsList] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0] || ""
  );
  const [students, setStudents] = useState<StudentRecord[]>([]);
  
  const [isPending, startTransition] = useTransition();
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load sections on mount
  useEffect(() => {
    getAssignedSections()
      .then((data) => {
        setSectionsList(data as any);
        if (data.length > 0 && data[0]) {
          setSelectedSection(data[0].id);
        }
      })
      .catch((err) => {
        console.error(err);
        setMessage({ type: "error", text: "Failed to load sections. Make sure you are authenticated." });
      })
      .finally(() => {
        setLoadingSections(false);
      });
  }, []);

  // Fetch students when section or date changes
  useEffect(() => {
    if (!selectedSection || !selectedDate) return;

    setLoadingStudents(true);
    setMessage(null);
    getSectionStudents(selectedSection, selectedDate)
      .then((data) => {
        setStudents(data as any);
      })
      .catch((err) => {
        console.error(err);
        setMessage({ type: "error", text: "Failed to fetch students list." });
      })
      .finally(() => {
        setLoadingStudents(false);
      });
  }, [selectedSection, selectedDate]);

  const handleStatusChange = (studentId: string, status: StudentRecord["attendanceStatus"]) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, attendanceStatus: status } : s))
    );
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, remarks } : s))
    );
  };

  const handleMarkAll = (status: "PRESENT" | "ABSENT") => {
    setStudents((prev) => prev.map((s) => ({ ...s, attendanceStatus: status })));
  };

  const handleSave = () => {
    setMessage(null);
    const incomplete = students.some((s) => s.attendanceStatus === null);
    if (incomplete) {
      setMessage({ type: "error", text: "Please select attendance status for all students before saving." });
      return;
    }

    startTransition(async () => {
      try {
        await markSectionAttendance(
          selectedSection,
          selectedDate,
          students.map((s) => ({
            studentId: s.studentId,
            status: s.attendanceStatus!,
            remarks: s.remarks,
          }))
        );
        setMessage({ type: "success", text: "Attendance marked successfully! Logs written to compliance trail." });
      } catch (err: any) {
        setMessage({ type: "error", text: err.message || "Failed to save attendance." });
      }
    });
  };

  if (loadingSections) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-gray-500">Loading classrooms…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow border border-gray-200 dark:border-slate-800">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Classroom / Section
          </label>
          {sectionsList.length === 0 ? (
            <p className="text-sm text-warning-dark bg-warning/10 p-2 rounded">
              No classrooms assigned.
            </p>
          ) : (
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {sectionsList.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.class.displayName} - Section {sec.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Attendance Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Calendar className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={() => handleMarkAll("PRESENT")}
            disabled={students.length === 0 || loadingStudents}
            className="flex-1 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 border border-green-200 dark:border-green-800 font-medium py-2 rounded-md hover:bg-green-100 transition text-sm disabled:opacity-50"
          >
            Mark All Present
          </button>
          <button
            onClick={() => handleMarkAll("ABSENT")}
            disabled={students.length === 0 || loadingStudents}
            className="flex-1 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border border-red-200 dark:border-red-800 font-medium py-2 rounded-md hover:bg-red-100 transition text-sm disabled:opacity-50"
          >
            Mark All Absent
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg border ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-800"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Student List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow border border-gray-200 dark:border-slate-800 overflow-hidden">
        {loadingStudents ? (
          <div className="flex flex-col justify-center items-center py-20 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-gray-500">Retrieving classroom register…</span>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-20 text-gray-500 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-gray-400" />
            <p className="font-medium">No students enrolled in this section.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-slate-800/50 text-gray-600 dark:text-gray-400 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-3.5 w-16">Roll No</th>
                  <th className="px-6 py-3.5">Student Name</th>
                  <th className="px-6 py-3.5">Admission No</th>
                  <th className="px-6 py-3.5 w-[450px]">Attendance Status</th>
                  <th className="px-6 py-3.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {students.map((student) => (
                  <tr key={student.studentId} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300">
                      {student.rollNumber || "—"}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {student.firstName} {student.lastName}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {student.admissionNumber}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {[
                          { value: "PRESENT", label: "Present", color: "peer-checked:bg-green-600 peer-checked:text-white" },
                          { value: "ABSENT", label: "Absent", color: "peer-checked:bg-red-600 peer-checked:text-white" },
                          { value: "LATE", label: "Late", color: "peer-checked:bg-yellow-600 peer-checked:text-white" },
                          { value: "HALF_DAY", label: "Half Day", color: "peer-checked:bg-orange-600 peer-checked:text-white" },
                          { value: "LEAVE", label: "Leave", color: "peer-checked:bg-blue-600 peer-checked:text-white" },
                          { value: "HOLIDAY", label: "Holiday", color: "peer-checked:bg-gray-600 peer-checked:text-white" },
                        ].map((opt) => (
                          <label key={opt.value} className="relative flex-1 text-center cursor-pointer select-none">
                            <input
                              type="radio"
                              name={`attendance-${student.studentId}`}
                              value={opt.value}
                              checked={student.attendanceStatus === opt.value}
                              onChange={() => handleStatusChange(student.studentId, opt.value as any)}
                              className="peer sr-only"
                            />
                            <span className={`block px-2.5 py-1 text-xs font-semibold rounded-md border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 bg-transparent hover:bg-gray-50 dark:hover:bg-slate-800 transition ${opt.color}`}>
                              {opt.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={student.remarks}
                        onChange={(e) => handleRemarksChange(student.studentId, e.target.value)}
                        placeholder="Optional remarks"
                        className="w-full text-xs rounded border border-gray-200 dark:border-slate-700 bg-transparent px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer actions */}
        {students.length > 0 && !loadingStudents && (
          <div className="bg-gray-50 dark:bg-slate-800/30 px-6 py-4 flex justify-end border-t border-gray-100 dark:border-slate-800">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="bg-primary hover:bg-primary-700 text-white font-semibold py-2 px-6 rounded-lg shadow-sm transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving Attendance…
                </>
              ) : (
                "Save Attendance"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
