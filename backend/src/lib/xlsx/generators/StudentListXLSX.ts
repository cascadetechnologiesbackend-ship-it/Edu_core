import { buildStyledXLSX, XLSXColumnDef } from "../xlsxHelper";

export interface StudentListXLSXRow {
  admissionNumber: string;
  name: string;
  className: string;
  section: string;
  gender: string;
  dob: Date | string;
  parentName: string;
  parentPhone: string;
}

const COLUMNS: XLSXColumnDef<StudentListXLSXRow>[] = [
  { key: "admissionNumber", header: "Admission No.", type: "string", minWidth: 16 },
  { key: "name", header: "Student Name", type: "string", minWidth: 22 },
  { key: "className", header: "Class", type: "string", minWidth: 12 },
  { key: "section", header: "Section", type: "string", minWidth: 10 },
  { key: "gender", header: "Gender", type: "string", minWidth: 10 },
  { key: "dob", header: "Date of Birth", type: "date", minWidth: 14 },
  { key: "parentName", header: "Parent / Guardian", type: "string", minWidth: 22 },
  { key: "parentPhone", header: "Parent Phone", type: "string", minWidth: 16 },
];

export async function generateStudentListXLSX(rows: StudentListXLSXRow[]): Promise<Buffer> {
  return buildStyledXLSX("Students", COLUMNS, rows);
}
