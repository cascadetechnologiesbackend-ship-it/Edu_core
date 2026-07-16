import { Metadata } from "next";
import AttendanceManager from "./AttendanceManager";

export const metadata: Metadata = {
  title: "Student Attendance",
  description: "Mark and view student attendance.",
};

export default function AttendancePage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Student Attendance
        </h1>
        <p className="text-gray-500 mt-1">
          Select section and date to mark or update student attendance.
        </p>
      </div>

      <AttendanceManager />
    </div>
  );
}
