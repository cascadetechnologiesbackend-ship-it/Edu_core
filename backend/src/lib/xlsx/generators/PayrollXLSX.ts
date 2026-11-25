import { buildStyledXLSX, XLSXColumnDef } from "../xlsxHelper";

export interface PayrollXLSXRow {
  employeeCode: string;
  staffName: string;
  department: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  status: string;
}

const COLUMNS: XLSXColumnDef<PayrollXLSXRow>[] = [
  { key: "employeeCode", header: "Emp. Code", type: "string", minWidth: 14 },
  { key: "staffName", header: "Staff Name", type: "string", minWidth: 22 },
  { key: "department", header: "Department", type: "string", minWidth: 16 },
  { key: "grossPay", header: "Gross Pay (INR)", type: "currency", minWidth: 16 },
  { key: "deductions", header: "Deductions (INR)", type: "currency", minWidth: 16 },
  { key: "netPay", header: "Net Pay (INR)", type: "currency", minWidth: 16 },
  { key: "status", header: "Status", type: "string", minWidth: 12 },
];

export async function generatePayrollXLSX(rows: PayrollXLSXRow[]): Promise<Buffer> {
  return buildStyledXLSX("Payroll Statement", COLUMNS, rows);
}
