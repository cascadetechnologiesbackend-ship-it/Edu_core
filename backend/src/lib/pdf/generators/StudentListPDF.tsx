import React from "react";
import { Document, Page, StyleSheet } from "@react-pdf/renderer";
import { SchoolDocumentHeader, SchoolInfo } from "../components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "../components/SchoolDocumentFooter";
import { SchoolPDFTable, PDFTableColumn } from "../components/SchoolPDFTable";

export interface StudentListRow {
  admissionNumber: string;
  name: string;
  className: string;
  section: string;
  gender: string;
  parentName: string;
  parentPhone: string;
}

export interface StudentListPDFProps {
  school: SchoolInfo;
  academicYear?: string;
  scope?: string;
  rows: StudentListRow[];
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
  { key: "admissionNumber", label: "Adm. No.", width: "14%", align: "left" },
  { key: "name", label: "Student Name", width: "22%", align: "left" },
  { key: "className", label: "Class", width: "12%", align: "left" },
  { key: "section", label: "Sec", width: "8%", align: "center" },
  { key: "gender", label: "Gender", width: "10%", align: "center" },
  { key: "parentName", label: "Parent / Guardian", width: "18%", align: "left" },
  { key: "parentPhone", label: "Phone", width: "16%", align: "right" },
];

export function StudentListPDF({ school, academicYear, scope, rows }: StudentListPDFProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <SchoolDocumentHeader
          school={school}
          reportTitle="Student Directory"
          academicYear={academicYear}
          scope={scope}
        />
        <SchoolPDFTable columns={COLUMNS} rows={rows as unknown as Record<string, unknown>[]} />
        <SchoolDocumentFooter pageLabel={`Total Students: ${rows.length}`} />
      </Page>
    </Document>
  );
}
