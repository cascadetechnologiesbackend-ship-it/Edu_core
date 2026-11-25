import React from "react";
import { Document, Page, StyleSheet } from "@react-pdf/renderer";
import { SchoolDocumentHeader, SchoolInfo } from "../components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "../components/SchoolDocumentFooter";
import { SchoolPDFTable, PDFTableColumn } from "../components/SchoolPDFTable";

export interface AttendanceRegisterRow {
  rollNo: string;
  admissionNumber: string;
  studentName: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalDays: number;
  attendancePercent: string;
}

export interface AttendanceRegisterPDFProps {
  school: SchoolInfo;
  monthLabel: string;
  className: string;
  section: string;
  academicYear?: string;
  rows: AttendanceRegisterRow[];
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
  { key: "rollNo", label: "Roll", width: "8%", align: "center" },
  { key: "admissionNumber", label: "Adm. No.", width: "15%", align: "left" },
  { key: "studentName", label: "Student Name", width: "29%", align: "left" },
  { key: "presentDays", label: "Present", width: "10%", align: "right" },
  { key: "absentDays", label: "Absent", width: "10%", align: "right" },
  { key: "lateDays", label: "Late", width: "8%", align: "right" },
  { key: "totalDays", label: "Working", width: "10%", align: "right" },
  { key: "attendancePercent", label: "Attendance %", width: "10%", align: "right" },
];

export function AttendanceRegisterPDF({
  school,
  monthLabel,
  className,
  section,
  academicYear,
  rows,
}: AttendanceRegisterPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SchoolDocumentHeader
          school={school}
          reportTitle="Attendance Register"
          subtitle={`${className} - Section ${section} (${monthLabel})`}
          academicYear={academicYear}
        />
        <SchoolPDFTable columns={COLUMNS} rows={rows as unknown as Record<string, unknown>[]} />
        <SchoolDocumentFooter pageLabel={`${className}-${section} | ${monthLabel}`} />
      </Page>
    </Document>
  );
}
