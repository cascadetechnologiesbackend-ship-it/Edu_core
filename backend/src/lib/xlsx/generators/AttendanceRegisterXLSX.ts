import { buildStyledXLSX, XLSXColumnDef } from "../xlsxHelper";

export interface AttendanceRegisterXLSXRow {
  rollNo: string;
  admissionNumber: string;
  studentName: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalDays: number;
  attendancePercent: number;
}

const COLUMNS: XLSXColumnDef<AttendanceRegisterXLSXRow>[] = [
  { key: "rollNo", header: "Roll No.", type: "string", minWidth: 10 },
  { key: "admissionNumber", header: "Admission No.", type: "string", minWidth: 16 },
  { key: "studentName", header: "Student Name", type: "string", minWidth: 24 },
  { key: "presentDays", header: "Present Days", type: "number", minWidth: 14 },
  { key: "absentDays", header: "Absent Days", type: "number", minWidth: 14 },
  { key: "lateDays", header: "Late Days", type: "number", minWidth: 12 },
  { key: "totalDays", header: "Working Days", type: "number", minWidth: 14 },
  { key: "attendancePercent", header: "Attendance %", type: "number", minWidth: 14 },
];

export async function generateAttendanceRegisterXLSX(
  rows: AttendanceRegisterXLSXRow[]
): Promise<Buffer> {
  return buildStyledXLSX("Attendance Register", COLUMNS, rows);
}
