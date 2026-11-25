import { buildStyledXLSX, XLSXColumnDef } from "../xlsxHelper";

export interface StaffXLSXRow {
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  role: string;
  phone: string;
  email: string;
}

const COLUMNS: XLSXColumnDef<StaffXLSXRow>[] = [
  { key: "employeeCode", header: "Emp. Code", type: "string", minWidth: 14 },
  { key: "name", header: "Staff Name", type: "string", minWidth: 22 },
  { key: "department", header: "Department", type: "string", minWidth: 16 },
  { key: "designation", header: "Designation", type: "string", minWidth: 20 },
  { key: "role", header: "Role", type: "string", minWidth: 12 },
  { key: "phone", header: "Phone", type: "string", minWidth: 16 },
  { key: "email", header: "Email", type: "string", minWidth: 24 },
];

export async function generateStaffXLSX(rows: StaffXLSXRow[]): Promise<Buffer> {
  return buildStyledXLSX("Staff Directory", COLUMNS, rows);
}
