/**
 * Domain Feature: Attendance Management
 */

export { default as AttendanceManager } from "@/app/(admin)/attendance/AttendanceManager";
export {
  getAssignedSections,
  getSectionStudents,
  markSectionAttendance,
} from "@/app/(admin)/attendance/actions";
