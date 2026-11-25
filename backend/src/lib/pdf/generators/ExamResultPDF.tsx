import React from "react";
import { Document, Page, StyleSheet } from "@react-pdf/renderer";
import { SchoolDocumentHeader, SchoolInfo } from "../components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "../components/SchoolDocumentFooter";
import { SchoolPDFTable, PDFTableColumn } from "../components/SchoolPDFTable";

export interface ExamResultRow {
  admissionNumber: string;
  studentName: string;
  subjectName: string;
  marksObtained: number;
  maxMarks: number;
  percentage: string;
  grade: string;
  status: string;
}

export interface ExamResultPDFProps {
  school: SchoolInfo;
  examName: string;
  className: string;
  section?: string;
  academicYear?: string;
  rows: ExamResultRow[];
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
  { key: "studentName", label: "Student Name", width: "24%", align: "left" },
  { key: "subjectName", label: "Subject", width: "20%", align: "left" },
  { key: "marksObtained", label: "Marks", width: "10%", align: "right" },
  { key: "maxMarks", label: "Max", width: "8%", align: "right" },
  { key: "percentage", label: "%", width: "8%", align: "right" },
  { key: "grade", label: "Grade", width: "8%", align: "center" },
  { key: "status", label: "Result", width: "8%", align: "center" },
];

export function ExamResultPDF({
  school,
  examName,
  className,
  section,
  academicYear,
  rows,
}: ExamResultPDFProps) {
  const scope = section ? `${className} - Section ${section}` : className;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SchoolDocumentHeader
          school={school}
          reportTitle={`Exam Results — ${examName}`}
          scope={scope}
          academicYear={academicYear}
        />
        <SchoolPDFTable columns={COLUMNS} rows={rows as unknown as Record<string, unknown>[]} />
        <SchoolDocumentFooter pageLabel={`${examName} | ${scope}`} />
      </Page>
    </Document>
  );
}
