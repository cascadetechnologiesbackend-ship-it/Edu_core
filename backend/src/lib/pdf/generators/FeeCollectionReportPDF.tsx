import React from "react";
import { Document, Page, StyleSheet } from "@react-pdf/renderer";
import { SchoolDocumentHeader, SchoolInfo } from "../components/SchoolDocumentHeader";
import { SchoolDocumentFooter } from "../components/SchoolDocumentFooter";
import { SchoolPDFTable, PDFTableColumn } from "../components/SchoolPDFTable";

export interface FeeCollectionRow {
  receiptNumber: string;
  paymentDate: string;
  admissionNumber: string;
  studentName: string;
  className: string;
  paymentMode: string;
  amountFormatted: string;
}

export interface FeeCollectionReportPDFProps {
  school: SchoolInfo;
  dateRangeLabel: string;
  totalCollectedFormatted: string;
  academicYear?: string;
  rows: FeeCollectionRow[];
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
  { key: "receiptNumber", label: "Receipt No.", width: "14%", align: "left" },
  { key: "paymentDate", label: "Date", width: "12%", align: "right" },
  { key: "admissionNumber", label: "Adm. No.", width: "14%", align: "left" },
  { key: "studentName", label: "Student Name", width: "24%", align: "left" },
  { key: "className", label: "Class", width: "12%", align: "left" },
  { key: "paymentMode", label: "Mode", width: "10%", align: "center" },
  { key: "amountFormatted", label: "Amount (INR)", width: "14%", align: "right" },
];

export function FeeCollectionReportPDF({
  school,
  dateRangeLabel,
  totalCollectedFormatted,
  academicYear,
  rows,
}: FeeCollectionReportPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <SchoolDocumentHeader
          school={school}
          reportTitle="Fee Collection Report"
          subtitle={`Period: ${dateRangeLabel} | Total Collected: ${totalCollectedFormatted}`}
          academicYear={academicYear}
        />
        <SchoolPDFTable columns={COLUMNS} rows={rows as unknown as Record<string, unknown>[]} />
        <SchoolDocumentFooter pageLabel={`Total: ${totalCollectedFormatted}`} />
      </Page>
    </Document>
  );
}
