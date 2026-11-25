import { buildStyledXLSX, XLSXColumnDef } from "../xlsxHelper";

export interface ExamResultsXLSXRow {
  admissionNumber: string;
  studentName: string;
  subjectName: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  status: string;
}

const COLUMNS: XLSXColumnDef<ExamResultsXLSXRow>[] = [
  { key: "admissionNumber", header: "Admission No.", type: "string", minWidth: 16 },
  { key: "studentName", header: "Student Name", type: "string", minWidth: 22 },
  { key: "subjectName", header: "Subject", type: "string", minWidth: 20 },
  { key: "marksObtained", header: "Marks Obtained", type: "number", minWidth: 16 },
  { key: "maxMarks", header: "Max Marks", type: "number", minWidth: 12 },
  { key: "percentage", header: "Percentage", type: "number", minWidth: 12 },
  { key: "grade", header: "Grade", type: "string", minWidth: 10 },
  { key: "status", header: "Result", type: "string", minWidth: 12 },
];

export async function generateExamResultsXLSX(rows: ExamResultsXLSXRow[]): Promise<Buffer> {
  return buildStyledXLSX("Exam Results", COLUMNS, rows);
}
