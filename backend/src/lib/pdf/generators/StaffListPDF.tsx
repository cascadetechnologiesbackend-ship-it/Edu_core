import React from "react";
import { Document, Page, StyleSheet } from "@react-pdf/renderer";
import { SchoolDocumentHeader, SchoolInfo } from "../components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "../components/SchoolDocumentFooter";
import { SchoolPDFTable, PDFTableColumn } from "../components/SchoolPDFTable";

export interface StaffListRow {
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  role: string;
  phone: string;
  email: string;
}

export interface StaffListPDFProps {
  school: SchoolInfo;
  scope?: string;
  academicYear?: string;
  rows: StaffListRow[];
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
  { key: "employeeCode", label: "Emp. Code", width: "12%", align: "left" },
  { key: "name", label: "Staff Name", width: "20%", align: "left" },
  { key: "department", label: "Department", width: "15%", align: "left" },
  { key: "designation", label: "Designation", width: "17%", align: "left" },
  { key: "role", label: "Role", width: "10%", align: "center" },
  { key: "phone", label: "Phone", width: "12%", align: "right" },
  { key: "email", label: "Email", width: "14%", align: "left" },
];

export function StaffListPDF({ school, scope, academicYear, rows }: StaffListPDFProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <SchoolDocumentHeader
          school={school}
          reportTitle="Staff Directory"
          scope={scope}
          academicYear={academicYear}
        />
        <SchoolPDFTable columns={COLUMNS} rows={rows as unknown as Record<string, unknown>[]} />
        <SchoolDocumentFooter pageLabel={`Total Staff: ${rows.length}`} />
      </Page>
    </Document>
  );
}
