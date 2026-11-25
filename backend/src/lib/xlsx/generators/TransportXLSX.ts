import { buildStyledXLSX, XLSXColumnDef } from "../xlsxHelper";

export interface TransportXLSXRow {
  routeCode: string;
  routeName: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
  assignedStudents: number;
}

const COLUMNS: XLSXColumnDef<TransportXLSXRow>[] = [
  { key: "routeCode", header: "Route Code", type: "string", minWidth: 12 },
  { key: "routeName", header: "Route Name", type: "string", minWidth: 26 },
  { key: "vehicleNumber", header: "Vehicle No.", type: "string", minWidth: 16 },
  { key: "driverName", header: "Driver Name", type: "string", minWidth: 20 },
  { key: "driverPhone", header: "Driver Phone", type: "string", minWidth: 16 },
  { key: "capacity", header: "Capacity", type: "number", minWidth: 12 },
  { key: "assignedStudents", header: "Assigned Students", type: "number", minWidth: 18 },
];

export async function generateTransportXLSX(rows: TransportXLSXRow[]): Promise<Buffer> {
  return buildStyledXLSX("Transport Routes", COLUMNS, rows);
}
