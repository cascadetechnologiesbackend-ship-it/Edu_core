import { buildStyledXLSX, XLSXColumnDef } from "../xlsxHelper";

export interface FeeCollectionXLSXRow {
  receiptNumber: string;
  paymentDate: Date | string;
  admissionNumber: string;
  studentName: string;
  className: string;
  paymentMode: string;
  amount: number;
}

const COLUMNS: XLSXColumnDef<FeeCollectionXLSXRow>[] = [
  { key: "receiptNumber", header: "Receipt No.", type: "string", minWidth: 16 },
  { key: "paymentDate", header: "Payment Date", type: "date", minWidth: 14 },
  { key: "admissionNumber", header: "Admission No.", type: "string", minWidth: 16 },
  { key: "studentName", header: "Student Name", type: "string", minWidth: 22 },
  { key: "className", header: "Class", type: "string", minWidth: 12 },
  { key: "paymentMode", header: "Payment Mode", type: "string", minWidth: 14 },
  { key: "amount", header: "Amount (INR)", type: "currency", minWidth: 16 },
];

export async function generateFeeCollectionXLSX(rows: FeeCollectionXLSXRow[]): Promise<Buffer> {
  return buildStyledXLSX("Fee Collection", COLUMNS, rows);
}
