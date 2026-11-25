import React from "react";
import { Document, Page, StyleSheet } from "@react-pdf/renderer";
import { SchoolDocumentHeader, SchoolInfo } from "../components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "../components/SchoolDocumentFooter";
import { SchoolPDFTable, PDFTableColumn } from "../components/SchoolPDFTable";

export interface TransportReportRow {
  routeCode: string;
  routeName: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  capacity: number;
  assignedStudents: number;
}

export interface TransportReportPDFProps {
  school: SchoolInfo;
  scope?: string;
  academicYear?: string;
  rows: TransportReportRow[];
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 30,
    fontFamily: "Helvetica",
  },
});

const COLUMNS: PDFTableColumn[] = [
  { key: "routeCode", label: "Route", width: "10%", align: "left" },
  { key: "routeName", label: "Route Name", width: "26%", align: "left" },
  { key: "vehicleNumber", label: "Vehicle No.", width: "14%", align: "left" },
  { key: "driverName", label: "Driver", width: "18%", align: "left" },
  { key: "driverPhone", label: "Driver Phone", width: "14%", align: "right" },
  { key: "capacity", label: "Cap.", width: "9%", align: "right" },
  { key: "assignedStudents", label: "Students", width: "9%", align: "right" },
];

export function TransportReportPDF({ school, scope, academicYear, rows }: TransportReportPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SchoolDocumentHeader
          school={school}
          reportTitle="Transport Routes & Allocation Report"
          scope={scope}
          academicYear={academicYear}
        />
        <SchoolPDFTable columns={COLUMNS} rows={rows as unknown as Record<string, unknown>[]} />
        <SchoolDocumentFooter pageLabel={`Total Routes: ${rows.length}`} />
      </Page>
    </Document>
  );
}
